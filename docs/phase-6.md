# Phase 6 — One-time donations and Razorpay

**Status: complete.** One-time giving only. No subscriptions, no recurring plans, no mandates — and after this phase the schema cannot express them.

Phase 5 built the catalogue a donor chooses from. Phase 6 takes the money.

```
campaign → choose products and/or an amount → donor details
        → CREATE DONATION (pending)  ← the server prices everything here
        → Razorpay order → Checkout → payment
        → VERIFY (browser)  ⇄  WEBHOOK (Razorpay)   ← whichever wins, once
        → capture transaction: status, counters, receipt
        → confirmation email
```

---

## 1. The three rules everything else follows from

**1. The browser sends ids and quantities. Nothing else counts.**

`POST /donations` accepts a campaign slug, campaign-product ids, quantities, an optional custom amount and the donor's details. It does not accept a price, a subtotal, a total, a currency or a campaign status — those are not validated-and-ignored, they are *unexpressible*, because Zod strips unknown keys before a handler sees the object. Every price is then read from `campaign_products` and the total recomputed by `summariseDonation`, the same function the donation page uses to show a figure.

**2. Nothing money-derived moves until money arrives.**

`campaigns.amount_raised`, `campaigns.donor_count`, `campaign_products.provided_quantity` and `donors.total_donated` are written in exactly one place — `DonationCaptureService` — inside one transaction, only after a payment has been verified against Razorpay. Creating a donation, creating an order and opening Checkout move nothing.

**3. A historical price is never rewritten.**

`donation_items.item_name`, `unit_price` and `total_price` are snapshots taken at the moment of giving. A catalogue or campaign repricing does not reach back into them, and the receipt stores its own copy of the line items as JSON so a document reprinted in five years reads what the donor was sent.

---

## 2. Database

**One migration, `0009_phase6_receipts_and_one_time_only.sql`.** 33 tables → **35**; 38 CHECKs → **39**; 47 FKs → **48**. RLS on all 35.

### New

| Table | Why |
|---|---|
| `receipts` | Immutable. No `deleted_at`, no update path in any service. A wrong receipt is *superseded* by a corrected one that cites it, so the trail shows both. Everything it displays is snapshotted onto it. |
| `receipt_sequences` | The gapless counter. One row per financial year. |

### Why the counter is a table and not a sequence

`nextval()` does not roll back. A capture that takes number 41 and then fails leaves 41 consumed forever, and the book reads 40, 42, 43 — a missing receipt somebody has to explain to an auditor. A row taken with `SELECT … FOR UPDATE` inside the capture transaction is released when that transaction is.

The cost is that receipt allocation serialises. At an NGO's volume that is invisible, and it buys a book with no holes. A unique index on `(financial_year, sequence)` means a counter bug becomes a failed write rather than a duplicated document.

The year is the **Indian financial year** (April–March), so a receipt issued in March 2027 is numbered in FY 2026-27 — the same year the Form 10BD filing covers.

### Removed

Everything recurring, in a self-guarding migration:

- `donation_type` went from `one_time | monthly | product | hybrid | custom` to **`custom | product | hybrid`**. The old enum answered two questions at once; the new one answers only "what is this made of". `one_time` mapped to `custom`; the migration **refuses to run** if any row is typed `monthly`.
- Dropped `donations.subscription_id`, `payment_webhooks.related_subscription_id`, `donors.is_recurring_donor` — all unreferenced.
- Dropped the `subscriptions` tables and their enums, behind a guard that **raises an exception rather than deleting** if either table holds a row.

Phase 5 marked these deprecated and deliberately did not write the drop, because dropping a table is irreversible and the decision belonged to whoever could see the row count on the day. This is that drop, written so it can make the check itself.

---

## 3. Donation states

```
                    ┌──────────► failed      (webhook, or a verified failure)
pending ────────────┤
   │                └──────────► cancelled   (reserved; no path writes it yet)
   │
   └── capture ────► successful      (terminal — Phase 7 withdrew refunds)
```

`pending` is the **only** status a client action can produce. There is no API endpoint anywhere that marks a donation successful by hand — an administrator who could set that flag could manufacture a donation, and every downstream figure would inherit it.

`payments` has its own parallel lifecycle and an append-only `payment_transactions` ledger recording every move with its source (`webhook`, `api_fetch`, `reconciliation`, `manual`).

---

## 4. Payment flow

### Creating the order

`POST /api/v1/donations` — public, rate-limited to 10/minute.

1. Load the campaign; refuse unless `acceptsDonations(status)` — the *same* shared function the public page uses, so page and server cannot disagree
2. Refuse a campaign past its end date, or at goal with `stop_at_goal`
3. Resolve each `campaignProductId` to its row; refuse one belonging to another campaign, or inactive in either the catalogue or the campaign
4. Validate composition and reserve units (§6)
5. Insert the donation `pending`, its items, and a `created` payment — all in one transaction
6. **After the commit**, create the Razorpay order and store its id

The provider call is outside the transaction on purpose: holding a database transaction open across a third-party network call is how a slow provider becomes a pile of locked rows. A failure there leaves a `pending` donation with no order, which is indistinguishable from an abandoned checkout and swept the same way.

### Verifying

Two paths, one destination.

| | Browser (`POST /donations/:id/verify-payment`) | Webhook (`POST /payments/razorpay/webhook`) |
|---|---|---|
| Purpose | Speed — the donor sees a result in a second | Authority — arrives whether or not the browser survived |
| Auth | Public, rate-limited | Public; the HMAC **is** the authentication |
| Signature | HMAC of `order_id\|payment_id`, API secret | HMAC over the **raw body**, webhook secret |
| Then | Re-fetch the payment from Razorpay, compare the amount | Identical |

Both end at `DonationCaptureService.capture`. They race on essentially every real donation, and that is fine.

**Three checks before anything is recorded**: the signature, the payment's status *at Razorpay*, and the amount against our own figure. A valid signature proves the browser saw a genuine Razorpay response for this order — it says nothing about whether the payment captured or for how much.

### Why the raw body matters

`JSON.parse` then `JSON.stringify` is not a round trip. Key order, unicode escaping and number formatting can all change, and the HMAC then differs over a document that is logically identical. `rawBody: true` is set at bootstrap in `main.ts` for exactly one line in the webhook controller.

The webhook secret is a **different secret** from the API key. Reusing the key secret is the commonest Razorpay misconfiguration and it fails silently: every delivery is rejected, which looks exactly like none arriving. There is a test for it.

---

## 5. Idempotency

Two independent mechanisms, because one is not enough.

**At the door** — `payment_webhooks.provider_event_id` is UNIQUE, and the row is inserted *before* the event is processed. A repeat delivery becomes an insert conflict and returns as a no-op. Storing first rather than after is what makes that constraint a lock rather than a record, and it means an event that crashes the handler is on disk with its raw body and can be replayed.

**At the capture** — a conditional update whose row count is the lock:

```sql
UPDATE donations SET status = 'successful', …
 WHERE id = $1 AND status <> 'successful'
RETURNING id
```

`SELECT status` then `UPDATE` leaves a window in which the other caller does the same and both proceed to credit the campaign — a donation counted twice, the worst bug this system could have. Here exactly one transaction can observe a row count of 1.

**The webhook always answers 200**, except on a bad signature. Razorpay retries anything else, and retrying an event we have stored and decided about achieves nothing. A handler bug is visible in `payment_webhooks.processing_status`, not in a retry storm.

---

## 6. Concurrency

A campaign product with a target can be over-sold between the order and the capture, because `provided_quantity` only moves on capture and a pending checkout holds nothing the database knows about.

So availability is computed as **target − provided − held**, where *held* is the quantity on `pending`/`processing` donations created in the last 30 minutes. The whole check runs inside the creation transaction under `SELECT … FOR UPDATE` on the `campaign_products` rows, sorted by id so concurrent baskets cannot deadlock. The lock is a mutex over "units of this offering"; what it protects is the INSERT that follows it.

**At capture the increment is honest even if it exceeds the target.** A donor who paid for seven kits gave seven kits, and clamping the count to tidy a progress bar would understate what was received. `quantityProgress` already caps the *bar* at 100% while reporting the true figure. A hold can expire between order and capture; when it does the money is already taken, and recording it correctly is the only available right answer.

---

## 7. Refunds — withdrawn in Phase 7

Phase 6 shipped a full refund implementation: Finance-only, provider-first,
counters adjusted down under a row lock, with separation of duties enforced by a
database CHECK.

**It has been removed.** Phase 7 decided the platform does not offer refunds, and
migration `0010` dropped the `refunds` table, `donation_items.refunded_quantity`,
the `donation.refund` permission, its threshold setting, and the `refunded` and
`partially_refunded` values from both status enums. Every guard in that migration
passed with zero rows, so nothing was lost.

What remains is the alarm: `refund.created` and `refund.processed` webhooks are
stored, marked `needs_review` in `payment_webhooks` and logged at error level.
They change nothing. See `phase-7.md` §2.

## 8. Receipts

Issued inside the capture transaction, one per donation, enforced by a unique index on `donation_id`.

**A receipt is not an 80G certificate, and no copy anywhere says it is.** This is the transactional acknowledgement that money was received. Section 80G relief comes from **Form 10BE**, issued by the Income Tax Department to the donor after the organisation files its annual **Form 10BD** — months later, by a different party. `eighty_g_eligible_at` is left NULL until a real registration is configured: a hard-coded `true` would print a tax claim on a document a donor may hand to an accountant.

Format `SFL-2026-000001`. Reachable publicly at `GET /donations/:reference/receipt` — the reference is a **capability**, generated with enough entropy to be unguessable and rate-limited, which is the right trade for a guest donation whose alternative is requiring an account to see a receipt already emailed.

---

## 9. Email

`donation.confirmation` on the `email` queue, enqueued after the capture commits, with the receipt number as the job id so a retried capture cannot send twice.

Brevo, over its REST API, and it **fails soft always**. By the time a job runs, the money is taken and the counters have moved; an email provider having a bad afternoon must not roll that back. `not_configured` and `rejected` are permanent and do not retry; only `unreachable` does. Either way a `notifications` row is written with the outcome, so an unsent receipt is *visible* rather than lost.

The processor re-reads the donation status and **refuses to send unless it is `successful`** — the last line of defence against thanking someone for a payment that failed.

---

## 10. Programme permissions

Per the brief, **Campaign Managers no longer create, edit or publish programmes.** They keep `program.read`, because without it a campaign cannot be filed under anything.

A programme is a taxonomy, not a project: "Disaster Relief" outlives every flood appeal under it. A manager running the 2026 Bihar floods needs to *attach* that campaign to the existing programme, not create a second Disaster Relief because the first was not obvious in a dropdown. Two near-identical programmes cannot be reported across, and nobody notices until someone asks how much was raised for disaster relief and gets half the answer.

There is **no `program.delete` permission and no delete endpoint, for anybody**. Foreign keys are `ON DELETE RESTRICT` down to donations. Archiving is the strongest available action.

### RBAC changes

| Permission | Change |
|---|---|
| `program.create`, `program.update`, `program.publish` | Removed from CAMPAIGN_MANAGER |
| `donation.reconcile` | New, sensitive, Finance only |
| `receipt.read`, `receipt.resend`, `receipt.reissue` | New — Admin gets the first two, Finance all three |
| `subscription.read`, `subscription.manage` | Removed entirely |

---

## 11. Security

- Every price and total recomputed server-side; a client amount is unexpressible
- Signatures verified in constant time (`timingSafeEqual`) — `===` leaks the digest a byte at a time to anyone who can measure the response
- `RazorpayClient` holds its credentials as **non-enumerable** fields and does not retain `AppConfig`, so `JSON.stringify(client)` exposes nothing. A TypeScript `private` is a compile-time courtesy; at runtime it serialises like any other property. There is a test.
- Only `RAZORPAY_KEY_ID` ever reaches a browser
- pino redacts `x-razorpay-signature`; no secret, signature or full payment payload is logged
- Rate limits: 10/min create, 20/min verify, 60/min status, 30/min receipt. The **webhook is exempt** — throttling a payment provider is self-sabotage, since a burst is Razorpay catching up after an outage, which is when the events matter most. The unique event id is what protects against repetition.
- PII gated **in the query**: without `donation.read_pii` the donor columns are never selected, and the admin search does not match on them either (a result count is an oracle). Same for payment identifiers and `payment.read`.
- FCRA: the organisation is not registered for foreign contributions, so `payments.is_international` flags one received in error, surfaced on the admin donation page.

---

## 12. Environment

```
RAZORPAY_KEY_ID=          # publishable; the only one that may reach a browser
RAZORPAY_KEY_SECRET=      # signs orders, verifies the checkout handshake
RAZORPAY_WEBHOOK_SECRET=  # verifies the HMAC over the raw webhook body

BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=Sailent Foundation
```

All three Razorpay variables are **required in production** (enforced in `apiEnvSchema`'s `superRefine`) and optional in development, where the donation endpoints refuse one request with a clear message instead of the whole API failing to boot.

Brevo is optional **even in production**, deliberately: a failure to send a receipt must never stop a donation being recorded.

---

## 13. Testing

| Suite | Result |
|---|---|
| `packages/validation` | 136 |
| `apps/api` unit + integration | 332 |
| `apps/web` unit | 22 |
| `apps/worker` | 5 |
| Playwright, 4 viewports | 323 |

New in this phase: 18 signature-verification tests, 10 receipt-numbering tests, 23 donation integration tests, 6 programme-permission tests, 10 donation e2e tests.

The integration suite runs against **real Postgres and Redis**; only Razorpay's HTTP calls are substituted, and the signature verification under test is the production code given real HMACs computed with the fake's own secrets.

The e2e tests stop at the moment before Checkout opens. Beyond that is a third-party modal in a cross-origin iframe needing live sandbox credentials — automating it would test Razorpay's UI. Everything past that boundary is covered by the API suite, where it can be exercised properly.

**The first Playwright run after a fresh `next build` is not representative.** Next optimises images on first request, and the tablet project asks for 2× variants of roughly fifty photographs. `global-setup.ts` warms the cache at every project's real viewport *and pixel ratio*, which mitigates it, but a completely cold run can still push a handful of tablet and mobile tests past their budget — and they are usually unrelated tests, which is what makes it look like a regression rather than a cold cache. Observed here as 5 failures on a first run and 0 on the two that followed. Run it twice after a rebuild before believing a failure.

```bash
pnpm --filter @sailent/database run db:migrate
pnpm --filter @sailent/database run db:seed
pnpm test
pnpm --filter @sailent/web exec playwright test
```

---

## 14. Known limitations

- **`cancelled` is reachable in the enum but nothing writes it.** A donor closing Checkout leaves the donation `pending`, which is honest — the payment may still complete by UPI after the window closed. A sweep that ages pending donations to `cancelled` belongs with reconciliation.
- **No reconciliation job.** `donation.reconcile` exists as a permission and `payment_transactions` records the source, but the scheduled sweep that re-fetches stuck payments is not built. Today a stuck donation is resolved by the webhook or by hand.
- **No receipt PDF.** The receipt is data and an email; rendering and storing a PDF in R2 is queued work that is not built.
- ~~Refund webhooks are stored, not acted on.~~ **Superseded by Phase 7.** Refunds were withdrawn entirely; a refund webhook is now stored, flagged `needs_review` and logged loudly, and reconciled by a human.
- **No donor account area.** `/account/*` is still a placeholder, so a donor's history is reachable only through the reference in their email.
- **Receipt numbering serialises** on one counter row per financial year. Correct, and a bottleneck only at a volume this organisation will not reach.
- **Pending donations hold product units for 30 minutes**, which is the point (§6) but has a consequence worth knowing when testing: abandoned donations left behind by a manual run reduce the availability seen by the next one, and a suite that creates donations must clean up after itself. The integration suite does; ad-hoc `curl` testing does not.

---

## 15. Fixed after the phase closed

An audit for loose ends found five defects in shipped work, all now closed:

| Defect | Fix |
|---|---|
| A refund raised in the Razorpay dashboard never reached our records — the campaign kept counting money the bank had returned | Superseded in Phase 7: no refund path exists, so such an event is flagged `needs_review` and logged at error level for a human, with a test |
| `/refund-policy` did not exist, though Razorpay requires a merchant to publish one and Phase 0 committed to the page | Written, linked in the footer, added to the sitemap |
| `/donation-policy` existed but nothing linked to it | Added to the footer's legal row |
| The donation policy told donors monthly giving was supported, which Phase 6 removed | Corrected to say all donations are one-time |
| The donor account menu offered six links, every one a 404 — including "Recurring", a feature that will not be built | Reduced to the page that exists; the rest return as they are built |
| The admin sidebar labelled Programs "Phase 4 pending" although it was built | Label removed |

A new end-to-end test walks every internal link the site renders and fails if one 404s, because the six broken ones went unnoticed: each page test only visited pages that existed.

## 15. Not built, deliberately

Recurring donations, monthly giving, subscriptions, auto-debit, mandates, billing schedules, next-billing-date, recurring dashboards. Removed from the schema, the enums, the permissions and the UI.

Peer-to-peer fundraising. Users creating campaigns. A second payment provider.
