# Phase 0 — Decision Log

**Project:** Sailent Foundation Digital Platform
**Phase:** 0 (Discovery & Architecture)
**Date:** 19 September 2026
**Status:** Decisions recorded. No implementation.

This is the canonical record of *why* the architecture is shaped the way it is. Every other document in `docs/` defers to this one when there is a conflict. Decisions are numbered `A1…A14` and are referenced by number throughout the rest of the documentation.

Each decision states the context, the options that were genuinely considered, the decision itself, and — most importantly — the **consequence**, because the consequence is what constrains Phase 1 onward.

---

## Product decisions confirmed with the client

Four questions were put to the client before architecture began, because each one changes the database schema and cannot be cheaply reversed later.

| Question | Answer | Consequence |
|---|---|---|
| Compliance status | **12A + 80G registered. Not FCRA. Not CSR-focused for v1.** | Donor tax-ID capture and Form 10BD export are core, not optional. Foreign contributions must be actively blocked. |
| Peer-to-peer fundraising | **Out of scope.** NGO-run campaigns only. | No fundraiser entity, no fundraiser KYC, no payout splitting, no moderation queue. Campaigns carry a nullable `attributed_to` column so P2P can be added later without a painful migration. |
| Donor authentication | **Guest donation always; account claimed later via email OTP.** | Donor records are created by the donation, not by a signup. `donors` and `users` are separate tables joined by a nullable FK. Revised in Phase 7: the identifier is the EMAIL ADDRESS, not the phone — see `phase-7.md`. No SMS vendor is needed. |
| CMS flexibility | **Structured typed content + a section composer for the homepage and marketing pages only.** | Campaigns, programs, stories, events and blog posts render in fixed templates. Only `pages` carries an ordered list of approved section blocks. No arbitrary drag-and-drop page builder. |

---

## A1 — The browser never calls the API directly

**Context.** The stack specifies both Next.js (web) and NestJS (API). That leaves an unstated question: does the browser call NestJS directly with a bearer token in JavaScript, or does Next.js sit in front as a backend-for-frontend?

**Options considered.**

1. *Direct browser → NestJS.* Simplest mental model. Requires CORS configuration, a token readable by JavaScript (or a cookie on a second domain), and refresh-token handling in the client.
2. *Next.js as BFF.* Server components fetch public content from NestJS server-side. Authenticated calls go through Next.js route handlers that hold an httpOnly cookie and attach the bearer token server-side.

**Decision.** Option 2. The browser talks only to the Next.js origin.

- Public content (campaigns, programs, stories, blog) is fetched in React Server Components directly from the API over the private network, cached by Next.js.
- Authenticated donor and admin calls go to `/api/bff/*` route handlers in Next.js, which read the session cookie, attach the access token, and proxy to NestJS.
- **Razorpay webhooks land only on NestJS**, never on Next.js.
- The worker and any future clients (a mobile app, a partner integration) still consume the same clean REST API.

**Consequence.** One cookie domain. No access token ever reaches client-side JavaScript, so an XSS bug does not immediately become a session-theft bug. CORS is effectively disabled on the API for browser origins. The cost is one extra network hop for authenticated calls and a proxy layer that must be kept thin — the BFF forwards and authenticates, it does not contain business logic. Any business logic that appears in a route handler is a bug.

---

## A2 — Money is stored as integer paise

**Context.** Donation amounts, product prices and goals all involve currency. Floating-point currency is the single most common source of financial bugs in donation platforms.

**Decision.** Every monetary value is a **`bigint` count of paise**. ₹900 is `90000`. There is no `decimal`, no `float`, no `money` type anywhere in the schema.

- A `currency` column exists on every money-bearing table and is `'INR'` for all of v1 (see A14 note on FCRA below and in `security-architecture.md`).
- Razorpay's API natively speaks paise, so no conversion happens at the payment boundary.
- TypeScript crosses the boundary with a branded type (`type Paise = bigint & { readonly __brand: 'Paise' }`) so that a raw `number` cannot be passed where an amount is expected.
- Formatting to "₹900" happens exactly once, in a shared presentation helper in `packages/ui`. No component formats currency inline.

> **Phase 2 amendment.** That helper must NOT use `Intl.NumberFormat` with
> `style: 'currency'`. Engines disagree about the symbol: WebKit emits
> `"₹\u00a0900"` where Node and Chromium emit `"₹900"`, so the server and Safari
> render different strings and React fails hydration on every page showing money
> — for every iOS visitor. Format the number with `Intl` (Indian grouping is
> consistent) and prepend the symbol. Guarded by a regression test. See
> `phase-2.md` §3.1.

**Consequence.** Arithmetic is exact. Summing a hybrid donation's line items always equals the header total, bit for bit, which makes the reconciliation job in A6 meaningful rather than approximate. The cost is that `bigint` does not serialise to JSON natively — the API must serialise amounts as strings, and the validation package owns that codec.

---

## A3 — Frontend payment success is never the source of truth

**Context.** This was called out explicitly in the brief, and it is correct. Razorpay's checkout handler fires a success callback in the browser. That callback can be forged, can fire before capture completes, can fail to fire on a flaky mobile network while the payment succeeded, and tells you nothing about whether the money actually settled.

**Decision.** A donation is `pending` until the server has independently confirmed capture, either by a signature-verified webhook (A4) or by a server-side fetch of the payment from Razorpay's API.

- The browser's success callback does exactly one thing: navigate to `/donate/status/[reference]`.
- That status page polls the API. It shows *Confirming your donation* until the server says otherwise, and it is honest about the possibility of a short wait.
- No receipt is generated, no email is sent, no campaign counter moves, and no thank-you is shown on the strength of a client-side callback.
- Conversely, a **missing** callback is not a failure. If the webhook confirms capture while the donor's browser has closed, the donation completes, the receipt is issued and the email is sent anyway.

**Consequence.** The post-payment experience is a polling state machine, not a static thank-you page — which is why `/donate/status/[reference]` exists in the route map. The design system must therefore treat *payment pending* as a first-class state with real design, not an afterthought spinner. This is the honest design; a page that claims success it has not verified is a lie the NGO would eventually have to apologise for.

---

## A4 — Webhooks are an append-only, idempotent ledger

**Context.** Razorpay's documented behaviour is unambiguous on two points: **duplicate delivery is expected**, and **ordering is not guaranteed**. A `payment.captured` event may arrive before, after, or twice around `order.paid`. Any design that assumes one delivery in order will corrupt donation totals in production.

**Decision.** A four-step intake, in this order:

1. **Capture the raw body.** The route is registered with the Nest body parser disabled so the exact received bytes are available. Razorpay signs the raw body; re-serialising parsed JSON produces a different byte sequence and the signature will not match.
2. **Verify the signature.** HMAC-SHA256 over the raw buffer, keyed with the webhook secret, compared to the `X-Razorpay-Signature` header using a **constant-time comparison**. A failed verification is logged and returns `400`; nothing else happens.
3. **Persist, then acknowledge.** The raw event is inserted into `payment_webhooks` with `razorpay_event_id` (from the `x-razorpay-event-id` header) under a `UNIQUE` constraint. A unique-violation means this is a duplicate: return `200` immediately and do nothing else. The endpoint returns `200` as soon as the row is stored — before any processing.
4. **Process asynchronously.** A BullMQ job picks up the stored event and applies it to the payment state machine.

The state machine permits only forward transitions (`created → authorized → captured`, plus `failed` as a terminal branch; the two `refunded` states were removed in Phase 7). An event that would move a payment backwards is recorded as processed and discarded. This is what makes out-of-order delivery safe.

**Consequence.** Duplicate and out-of-order webhooks become non-events. Razorpay's retries never double-count a donation. The webhook endpoint is fast (one insert) so Razorpay never times out and retries unnecessarily. Because every raw event is retained, any production incident can be replayed and audited against what Razorpay actually sent, rather than against what we think it sent.

A reconciliation job runs nightly regardless, because webhooks can be lost entirely: it fetches Razorpay's payment list for the period and compares it against local state.

---

## A5 — A donation is a header plus line items, with snapshotted prices

**Context.** The brief's core requirement is a hybrid gift:

```
School Kit    × 2   = ₹1,800
Textbook Set  × 1   =   ₹600
Additional donation =   ₹500
                      ------
Total                 ₹2,900
```

That is one donation containing three heterogeneous lines. Modelling it as three donations would break the receipt (a donor receives one receipt for one payment) and inflate the donor count.

**Decision.** `donations` (header: donor, campaign, totals, status, payment link) has many `donation_items` (lines). A line has a `type` of `product` or `custom`. A product line carries `campaign_product_id`, `quantity` and `unit_amount`. A custom line carries `quantity = 1` and the full amount.

**The unit price is copied onto the line at the moment of donation.** `donation_items.unit_amount` is not a reference to `campaign_products.unit_amount`; it is a snapshot of it.

**Consequence.** When the NGO raises the School Kit price from ₹900 to ₹950 next quarter, every historical donation still reads ₹900 — receipts stay correct, reports stay correct, and the donor who queries their old receipt sees what they actually paid. This is non-negotiable for a financial record. A `CHECK` constraint enforces `SUM(line totals) = donations.total_amount`, validated in the application before insert and asserted by the reconciliation job.

The same snapshot rule applies to the product *name*: `donation_items.item_name` stores the label as it was shown, so a renamed product does not rewrite the donor's receipt.

---

## A6 — Progress counters are derived first, cached second

**Context.** Campaign pages show `₹4,20,000 raised of ₹10,00,000` and product cards show `340 of 500 kits provided`. Recomputing those aggregates on every page view does not scale; storing them without a source of truth guarantees drift.

**Decision.** Both. The cached columns (`campaigns.amount_raised`, `campaigns.donor_count`, `campaign_products.provided_quantity`) are the read path. They are mutated in exactly one place: the transaction that moves a payment to `captured`.

That transaction:

1. Takes `SELECT … FOR UPDATE` on the campaign row and each affected product row, in a **deterministic order (by primary key ascending)** to prevent deadlock between concurrent donations touching the same products.
2. Re-validates availability *inside the lock* — a product with a `target_quantity` cannot exceed it.
3. Increments the counters.
4. Commits.

A nightly worker job recomputes every counter from `donation_items` joined to captured payments, and raises a Sentry alert on any mismatch rather than silently correcting it. A silent correction hides the bug that caused the drift.

**Consequence.** Public pages are a single indexed read. Concurrency is correct under load — the race described in the edge-case matrix (two donors claiming the last available kit simultaneously) resolves deterministically because the check happens under the lock, not before it. The counters are auditable against the line items at any time.

A deliberate consequence: **counters only move on captured payments.** A pending donation contributes nothing to the public progress bar. A campaign's progress therefore reflects money actually held.

---

## A7 — A receipt is not an 80G certificate

**Context.** This is the decision most likely to be got wrong, and getting it wrong creates a legal problem rather than a bug.

Under the current regime, an 80G-registered organisation does **not** issue the tax certificate itself. It files **Form 10BD** — a statement of all donations received in the financial year — with the Income Tax Department by **31 May** following the end of that year. The Department then produces **Form 10BE**, the certificate of donation, which the NGO downloads and issues to donors. The donor claims the deduction on the strength of Form 10BE, not on the strength of a receipt the NGO printed.

Late or missing filing carries a fee of ₹200 per day of delay under §234G, plus a penalty under §271K of not less than ₹10,000 and up to ₹1,00,000.

**Decision.** Two distinct artefacts, never conflated.

| | Transactional receipt | Form 10BE certificate |
|---|---|---|
| Issued by | The platform, automatically | The Income Tax Department, via the NGO |
| When | Within minutes of capture | Annually, by 31 May |
| Numbering | Gapless per financial year, `SF/2026-27/000001` | Assigned by the Department |
| Purpose | Proof of payment, donor record | Proof for claiming the 80G deduction |
| In the platform | `receipts` table, PDF in R2 | Uploaded by Finance, attached to the donor record |

The platform's job on the certificate side is to make filing possible and correct: capture donor identity to the standard Form 10BD requires, and produce a **Form 10BD-shaped export** from the Finance area covering a selected financial year.

**Donor identification.** PAN is the preferred identifier. Acceptable alternatives are Aadhaar, Passport, Driving Licence, Voter ID, or a foreign Tax ID — the ID type is stored alongside the number so the export can declare it. Identity is **optional at checkout** (demanding a PAN before payment destroys conversion) and requested afterwards: on the status page, in the receipt email, and via a reminder campaign before the filing deadline. A donation without a tax ID is still a valid donation; it simply cannot appear on the 10BD statement.

**Consequence.** UI copy never uses the phrase "80G certificate" for a transactional receipt. The receipt template says what it is: a receipt, with a note that the 80G certificate follows after the annual filing. The Finance dashboard surfaces the 31 May deadline and the count of captured donations still missing a tax ID, because that count is the NGO's compliance exposure. Receipt numbering is gapless — a cancelled receipt is voided and retained, never deleted and never renumbered.

---

## A8 — Donor sessions and staff sessions are different things

**Context.** A donor who gave ₹500 once and a Finance Manager who can export the donor list are not the same class of user, and should not carry the same class of credential.

**Decision.** Two separate authentication paths producing two non-interchangeable token audiences.

**Donors** (`aud: "donor"`)
- Authenticate by **email OTP**. No password exists to be leaked, reused or phished at scale. (Written as phone OTP in Phase 0; the identifier became the email address in Phase 7, when the code had to be delivered somewhere and no SMS vendor existed.)
- The donor record is created by the donation. The account is *claimed* later by proving control of the phone number used at checkout.
- Donation itself never requires an account. This is a conversion decision as much as a UX one.

**Staff** (`aud: "staff"`)
- Email and password (Argon2id), plus **mandatory TOTP two-factor for Super Admin, Admin and Finance Manager**. Optional but strongly encouraged for the other roles.
- No self-registration. Staff accounts are created by invitation from a Super Admin.

A donor token presented to an admin endpoint fails at the guard on audience mismatch, before any permission check runs. Access tokens are short-lived (15 minutes) and held server-side by the BFF (A1); refresh tokens are rotating, httpOnly, `SameSite=Lax`, and reuse of a rotated refresh token invalidates the whole family and alerts.

**Consequence.** ~~An SMS/OTP vendor is a hard dependency.~~ **Resolved in Phase 7 by removing the dependency:** the code is addressed to, and delivered to, an email address, using the transactional email transport the platform already had. Volunteers authenticate through the donor path but carry a volunteer role that unlocks the volunteer portal.

---

## A9 — RBAC is permission strings, deny-by-default

**Context.** Six roles are specified, and the role list will grow. Hard-coding role names into route guards (`if (user.role === 'admin')`) produces a codebase where adding a seventh role means auditing every guard.

**Decision.** Guards check **permissions**, never roles. Roles are named bundles of permissions stored in the database and editable by a Super Admin.

- Permissions are `resource.action` strings: `campaign.publish`, `donation.export`, `volunteer.approve`.
- The default answer is **no**. An endpoint without an explicit permission requirement is unreachable by anyone except through an explicit `@Public()` decorator, which is itself flagged in review.
- Sensitive operations require **re-authentication within the last 5 minutes** (password + TOTP for staff): role assignment, donor data export, correcting a donor record, changing a document's public visibility, and deleting anything. (Refunds were on this list until Phase 7 withdrew them.)
- Every permission-gated mutation writes an audit row (A10). This is enforced by the same interceptor that enforces the permission, so the two cannot drift apart.

**Consequence.** New roles are configuration. The permission catalogue in `rbac.md` is the contract between the API and the admin UI — the admin sidebar filters itself from the same permission list the API enforces, so a user never sees a menu item leading to a 403. Client-side filtering is cosmetic only; the API is the enforcement point.

---

## A10 — The audit log is append-only

**Decision.** `audit_logs` records actor, action, entity type and id, a before/after JSON diff, IP address, user agent and timestamp. **There is no update path and no delete path in application code.** The application's database role is granted `INSERT` and `SELECT` on that table and nothing else.

Retention is indefinite for financial and permission events. Logs are exportable by Super Admin only.

**Consequence.** When a donor disputes a refund or a trustee asks who published a campaign claiming a particular figure, there is an answer. Because the diff is stored rather than just the action name, "who changed this product's price and to what" is answerable without event-sourcing the whole system.

---

## A11 — Design tokens, with the brand hue deferred

**Context.** The brief is explicit that real brand colours may arrive later, and equally explicit about the aesthetic to avoid: generic SaaS, gradient-heavy, over-rounded, over-animated, AI-generated-looking.

**Decision.** A single token architecture expressed in **OKLCH**, where the brand identity is a small number of variables — principally one hue angle and one chroma ceiling — from which the full scale is generated. Components reference semantic tokens (`--color-surface`, `--color-accent-fg`), never raw values.

One token set, two themes:

- **Public:** warm neutrals, generous vertical rhythm, an editorial type scale, photography carrying the emotional weight. Human and trustworthy, not playful.
- **Admin:** cool neutrals, dense spacing, tabular figures, a compressed type scale. Operational and quiet.

They are recognisably the same system — same type family, same radius language, same accent — deployed at different densities. That is the "two experiences, one design system" requirement, and density plus warmth is how it is achieved without maintaining two systems.

**Consequence.** When the real palette arrives, the change is a handful of token values, not a component refactor. Until then the placeholder palette is explicitly labelled as placeholder in `design-system.md` so that nobody mistakes it for an approved brand decision.

---

## A12 — A real connection pool, not the HTTP serverless driver

**Context.** Neon offers an HTTP serverless driver designed for short-lived serverless functions, and a WebSocket/TCP driver for long-lived processes. The HTTP driver **cannot run multi-statement transactions**.

**Decision.** The NestJS API runs as a long-lived process on Render/Railway and uses Drizzle over a standard pooled connection (`pg` / Neon WebSocket driver). The HTTP driver is not used.

**Consequence.** A6's `SELECT … FOR UPDATE` donation-capture transaction is possible. Had the API been built on Vercel functions with the HTTP driver, the correct concurrency design would have been unavailable and the counters would have been racy. This is precisely why the API is a persistent service rather than serverless functions.

Next.js may read from the database directly for public content if a future optimisation calls for it, but **writes go through the API only** — there is exactly one code path that can mutate a donation.

---

## A13 — Volunteer IDs are assigned at approval

**Decision.** `VOL-2026-00001`. The year is the calendar year of **approval**, the sequence is per-year from a database sequence, and the ID is permanent.

- Assigned when an application is **approved**, not when it is submitted. Applicants who are never approved consume no IDs, so the sequence reflects the actual volunteer corps.
- Never reused, never reassigned, never changed — not even if the volunteer is later suspended or archived. It appears on certificates and ID cards that exist in the physical world.
- Generated inside the approval transaction so two simultaneous approvals cannot collide.

**Consequence.** Applications and volunteers are distinguishable in the data: a `volunteers` row without a volunteer ID has not been approved. Certificates can reference the ID permanently.

---

## A14 — No number appears publicly unless the database can produce it

**Context.** The brief prohibits fake statistics and fake NGO claims. Reference sites in this sector routinely display round, unverifiable numbers — "2K+ Lives Impacted" — and that habit is exactly what erodes the trust an NGO site exists to build.

**Decision.** Every public statistic traces to one of two sources: a **live database aggregate**, or a **dated impact record** entered by staff with a location and, where the claim is significant, a supporting document.

- The stat component takes a source identifier, not a hard-coded string.
- **If the underlying value is zero or unavailable, the section does not render.** A new campaign with no donors shows its story and its goal, not "0 donors" and not a fabricated placeholder.
- Impact numbers that cannot be derived (beneficiaries reached, for example) are entered as `impact_records` with a date, a location, a method note and optional evidence — and are attributed on the page to the report they came from.
- No lorem ipsum survives into any environment that a member of the public can reach.

**Consequence.** The site will show fewer numbers than a typical NGO template, especially at launch. That is the intended outcome. The numbers it does show can be defended in front of a donor, a trustee or an auditor — which is worth more than a dense stats band nobody believes.

---

## Information architecture: recommendations against the brief

The brief asked for the proposed structure to be reviewed rather than followed blindly. Full detail is in `information-architecture.md`; the substantive changes are:

- **Add** `/campaigns/[slug]/donate`, `/donate/checkout`, `/donate/status/[reference]` (required by A3), `/account/*`, `/volunteer/apply`, `/search`, `/admin/*`, `sitemap.xml`, `robots.txt`.
- ~~**Merge `/reports` into `/transparency`.**~~ **Superseded in Phase 7, which removed both.** The platform publishes no documents publicly; reports and filings are admin-only. The registration identifiers moved to `/about`.
- **Sharpen `/impact` versus `/stories`.** Impact is verifiable numbers and dated updates; Stories is one human narrative each. Blurring the two is the most common failure mode of NGO sites, and it costs credibility on the impact side and emotion on the story side.
- ~~**Demote `/gallery`**~~ — superseded in Phase 7, which dropped a standalone gallery from the product entirely rather than demoting it. Photography stays attached to the campaign, event, story or impact update it documents.
- **Keep both** `/refund-policy` and `/donation-policy`. Razorpay requires a reachable refund policy; the donation policy covers acceptance, restriction and anonymity. They are not duplicates.
- **Trim the homepage from 18 sections to 12.** Testimonials fold into stories; blog and impact updates combine into one "Latest" band. Eighteen sections is a scroll nobody finishes, and the sections that matter get buried.

---

## Open questions carried into Phase 1

These are blocked on client input. None of them block Phase 1 scaffolding; all of them block Phase 1 completion of the module named.

| # | Question | Blocks | Notes |
|---|---|---|---|
| 1 | Actual brand palette, logo, typography licence | Design system finalisation | Placeholder tokens in place (A11); swap is a token change, not a refactor. |
| 2 | Registration numbers — 12A, 80G, CIN/registration, PAN of the organisation | `/about`, receipt template | Receipts are legally required to carry the 80G registration details. Cannot launch donations without these. |
| 3 | SMS/OTP vendor for donor auth | Donor accounts (A8) | Brevo covers transactional email; it is not the SMS path for Indian DLT-regulated OTP. Needs a DLT-registered sender ID and template approval, which has a lead time. |
| 4 | Razorpay account type and settlement details | Payments | Whether the NGO has a Razorpay NGO account, and the settlement cycle, affects reconciliation timing. |
| 5 | Real programme, campaign and story content | Launch | The design brief forbids lorem ipsum in final content. Content production is a parallel workstream and is usually the critical path, not the code. |
| 6 | Whether volunteer document upload requires ID proof | Volunteer module | Affects the privacy classification and the R2 bucket policy for volunteer documents. |
| 7 | Refund policy specifics — window, conditions, approver | Refund flow | Needed before the refund UI is built; also a public legal page. |
| 8 | Financial year convention for receipt numbering | Receipts | Assumed Indian FY (1 April – 31 March) to align with Form 10BD. Confirm. |

---

## Deliberately deferred

Recorded so that later phases do not re-litigate them:

- **Peer-to-peer fundraising** — excluded by client decision; schema leaves a nullable attribution column.
- **FCRA / foreign contributions** — legally unavailable without registration. International payment methods are blocked at checkout and the block is a documented feature flag, not an oversight.
- **CSR / corporate donor module** — corporate donations can be recorded as a donor type; full CSR-1 workflow, MoU tracking and utilisation reporting are out of v1.
- **Multi-language** — copy is structured so that i18n can be introduced without a content migration, but no translation layer ships in v1.
- **Mobile application** — the API is designed to support one (A1), but none is planned.
- **In-house payouts or grant disbursal** — out of scope entirely.

---

*Related: [`product-requirements.md`](product-requirements.md) · [`architecture.md`](architecture.md) · [`database-architecture.md`](database-architecture.md)*
