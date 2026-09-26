# User Flows — Sailent Foundation

**Phase:** 0 · **Date:** 19 September 2026

Every flow that touches money is written with the trust boundary drawn explicitly, because the single most important architectural rule in this platform is that **the browser is never the source of truth about a payment** (decision A3).

---

## 1. Flow map

```
PUBLIC                    Discover → Campaign → Choose → Pay → Confirmed → Receipt → Impact
DONOR ACCOUNT             Claim (phone OTP) → Dashboard → Manage recurring → Receipts → Impact
VOLUNTEER                 Apply → Review → Approve → ID → Assign → Attend → Hours → Certificate
EVENT                     Browse → Register → Confirm → Remind → Attend
STAFF                     Invite → 2FA setup → Role → Operate → Audited
```

---

## 2. Donation — selection

Covers all three donation shapes. One flow, because forcing the donor to choose a *mode* before choosing an *amount* is an artificial step.

```
Entry points
  Campaign detail → Donate Now
  Header → Donate  (no campaign chosen)
  Product card → quantity  (jumps straight into the builder)
  Homepage / email / QR
        │
        ▼
/campaigns/[slug]/donate — donation builder
        │
        ├─ Products: quantity steppers, live line totals
        ├─ Custom amount: preset chips or free entry
        ├─ Monthly toggle
        └─ Running summary, always visible
        │
        ▼
Client-side validation (convenience only)
  total > 0, quantities are positive integers, total ≥ minimum
        │
        ▼
POST /donations/intent        ← THE TRUST BOUNDARY BEGINS HERE
        │
   Server re-validates everything:
     campaign exists and is Active
     each product belongs to this campaign and is active
     quantity ≥ 1 and ≤ remaining where a target exists
     unit price read from the DB, NOT from the request
     total recomputed server-side, NOT trusted from the client
        │
        ├─ invalid → 422 with per-field reasons; the builder
        │            re-renders with current prices and availability
        │            and tells the donor exactly what changed
        │
        ▼
Donation created, status = pending
Line items written with snapshotted unit_amount and item_name (A5)
Razorpay order created for the server-computed amount
        │
        ▼
/donate/checkout
```

**The request body carries product IDs and quantities. It never carries prices or a total.** A client-supplied total is the oldest vulnerability in e-commerce, and it is the one that would let someone fund a ₹1,200 medicine kit for ₹1.

---

## 3. Donation — checkout, payment and verification

### 3.1 Checkout

```
/donate/checkout
        │
   Donor details
     Name*        Phone*       Email*
     Anonymous donation?  [ ]   (public display only — never anonymous to Finance)
     Tax ID (PAN etc.)    optional, with "why we ask" explanation
     Address              optional, required only if the donor wants it on the receipt
     Message to the team  optional
        │
   Recognised donor?
     Phone matches an existing donor → offer OTP sign-in to prefill
     Never blocks. Guest checkout always completes.
        │
        ▼
   Summary re-confirmed  (prices re-read; changed prices surface here, not after payment)
        │
        ▼
   POST /donations/{id}/checkout → Razorpay order id + key
        │
        ▼
   Razorpay Checkout opens
     UPI · Cards · Netbanking · Wallets
     International instruments DISABLED (no FCRA — see product-requirements §6)
```

### 3.2 The verification boundary

This is the part that must be right.

```
                    ┌──────────── UNTRUSTED ────────────┐
                    │                                   │
Donor completes payment in Razorpay Checkout            │
                    │                                   │
        ┌───────────┴───────────┐                       │
        │                       │                       │
   handler fires          handler never fires           │
   (success callback)     (browser closed, network      │
        │                  dropped, app switched)       │
        │                       │                       │
        ▼                       ▼                       │
  Redirect to             Nothing happens               │
  /donate/status/[ref]    client-side                   │
        │                       │                       │
        └───────────┬───────────┘                       │
                    └───────────────────────────────────┘
                                │
        ══════════════ TRUST BOUNDARY ══════════════
                                │
                    ┌───────────┴────────────┐
                    │                        │
          Razorpay webhook          Nightly reconciliation
          (primary path)            (safety net, catches
                    │                lost webhooks)
                    ▼                        │
     1. Capture RAW body bytes               │
     2. HMAC-SHA256 over raw buffer,         │
        constant-time compare to             │
        X-Razorpay-Signature                 │
        ─ mismatch → 400, log, stop          │
     3. INSERT into payment_webhooks         │
        UNIQUE(razorpay_event_id)            │
        ─ duplicate → 200, no-op ────────────┤
     4. Return 200 immediately               │
     5. Enqueue BullMQ job                   │
                    │                        │
                    ▼                        │
          Payment state machine ◄────────────┘
          forward transitions only
                    │
                    ▼
        ┌───── payment.captured ─────┐
        │  ONE TRANSACTION:          │
        │  • lock campaign row       │  SELECT … FOR UPDATE
        │  • lock product rows       │  ordered by PK (deadlock-safe)
        │  • re-validate availability│  inside the lock
        │  • donation → completed    │
        │  • campaign.amount_raised +│
        │  • campaign.donor_count +  │  (only if donor is new to campaign)
        │  • product.provided_qty +  │
        │  • generate receipt number │  gapless, per financial year
        │  COMMIT                    │
        └────────────┬───────────────┘
                     ▼
        Async jobs (outside the transaction, each retryable)
          → render receipt PDF → R2
          → send receipt email (Brevo)
          → notify admins if amount ≥ threshold
          → analytics: donation_success (no PII)
```

**Why the counters move inside the transaction and the emails do not:** the counters must be atomic with the state change or they drift. The emails must be outside, or a Brevo outage would roll back a completed donation.

### 3.3 The status page

`/donate/status/[reference]` polls `GET /donations/{reference}/status` — every 2s for 30s, then every 5s to a 5-minute cap.

| Server state | What the donor sees |
|---|---|
| `pending`, < 30s | "Confirming your donation…" with a progress indication. Honest, calm, no false success. |
| `pending`, > 30s | "This is taking a little longer than usual. Your payment is safe — we'll email you as soon as it's confirmed." Plus a reference number. |
| `completed` | Full confirmation: itemised summary, receipt number, what the gift funds, and the tax-ID prompt if none was given. |
| `failed` | Reason in plain language, Try again (which reuses the same donation record, not a new one), and a support contact. |

The page is fully functional without JavaScript via a meta-refresh fallback, because a donor on a degraded connection is exactly the donor most likely to be in this state.

If the donor never returns to the page at all, the donation still completes and the receipt still arrives. Confirmation is not contingent on the donor's browser staying open.

---

## 4. Donor account

### 4.1 Claiming an account

```
Donation completes (guest)
        │
   Donor record created/matched by phone
        │
   Receipt email includes "View your donations"
        │
        ▼
   /account → phone entry → OTP (6 digits, 10 min, 5 attempts, rate-limited)
        │
   Phone matches donor record → account claimed, history attached
   Phone matches nothing → account created empty
```

No password ever exists. There is no password reset flow, no credential stuffing surface, and no forgotten-password support burden.

### 4.2 Dashboard

| Section | Contents |
|---|---|
| Overview | Total given, campaigns supported, active monthly gift, next charge date, latest impact update |
| Donations | Full history, line-item detail, status, receipt download |
| Recurring | Active and past subscriptions; pause, resume, change amount, cancel |
| Receipts | All receipts, downloadable, filterable by financial year |
| Supported campaigns | Campaigns funded, with current progress |
| Product donations | What they funded, by product, aggregated |
| Impact | Dated updates for campaigns they supported |
| Profile | Name, phone, email, address, tax ID, communication preferences |

**Visible:** their own data, in full.
**Never visible:** other donors, campaign finances beyond public figures, internal notes on their record, or which staff member viewed their record.

---

## 5. Recurring donations

### 5.1 Creation

```
Builder → "Give this every month" → amount and start date
        │
   Instrument selection is amount-dependent and stated up front:
     ≤ ₹15,000/cycle → UPI Autopay available (the ceiling is a platform
                        limit, not ours — the donor is told before they choose)
     > ₹15,000/cycle → eNACH / card mandate
        │
        ▼
   Razorpay Plan (reused per amount+interval) → Subscription created
        │
   Donor authenticates the mandate
        │
        ▼
   subscription.authenticated → local status = authenticated
   subscription.activated     → local status = active
   subscription.charged       → create donation + line items + receipt
                                (same capture transaction as §3.2)
```

Each successful charge produces a full donation record with line items, so a recurring gift accumulates exactly the same history, receipts and impact visibility as one-time gifts. A subscription is a schedule; the donations are the record.

### 5.2 Lifecycle and recovery

| Razorpay event | Local state | Donor-facing action |
|---|---|---|
| `subscription.authenticated` | authenticated | Confirmation email |
| `subscription.activated` | active | — |
| `subscription.charged` | active | Donation + receipt + thank-you |
| `subscription.pending` | pending | **Charge failed.** Email: "We couldn't process this month's donation" with a link to update the payment method. Razorpay retries automatically. |
| `subscription.halted` | halted | **Retries exhausted.** Email plus in-account banner. This is a recoverable relationship, not a lost donor — the messaging says so without guilt. |
| `subscription.paused` | paused | Confirmation and the resume date |
| `subscription.resumed` | active | Confirmation |
| `subscription.cancelled` | cancelled | Confirmation, gratitude, no dark patterns, no retention interstitial |
| `subscription.completed` | completed | Summary of the full giving period |
| `subscription.updated` | (unchanged) | Reflect the change |

Cancellation is self-service and takes effect immediately for future charges. A donor who has to email someone to stop giving will not come back.

---

## 6. Volunteer lifecycle

```
/volunteer → /volunteer/apply
        │
   Multi-step, saved per step, resumable by link
     1. Personal details
     2. Skills and experience
     3. Interests and preferred programmes
     4. Availability (days, hours, remote/field)
     5. Emergency contact
     6. Documents (optional at this stage)
     7. Review and consent
        │
        ▼
   Status: APPLIED          → acknowledgement email
        │
   Volunteer Manager opens the review queue
        │
   Status: UNDER_REVIEW     → optional interview/call note recorded
        │
        ├── Reject → REJECTED  (reason recorded internally;
        │                       courteous email; record retained)
        │
        ▼
   Approve  ── inside one transaction ──
     • status → APPROVED
     • volunteer_id assigned from the per-year sequence: VOL-2026-00001 (A13)
     • portal access granted
        │
        ▼
   Status: ACTIVE  (on first assignment or first recorded attendance)
        │
   ┌────┴─────────────────────────────────────────┐
   │ Assignment → event or project, with a role   │
   │ Attendance → recorded by a manager at the     │
   │              event (mobile-first, offline-    │
   │              tolerant)                        │
   │ Hours      → accumulated from verified        │
   │              attendance only                  │
   │ Certificate→ generated from verified hours,   │
   │              naming the volunteer ID          │
   └───────────────────────────────────────────────┘
        │
   INACTIVE   (no activity for a defined period — reversible)
   SUSPENDED  (conduct; blocks portal and assignment; reason required; audited)
   ARCHIVED   (left the organisation; record retained, ID never reused)
```

### 6.1 Who may change what

| Field | Volunteer | Volunteer Manager | Admin |
|---|---|---|---|
| Contact details, photo | ✅ | ✅ | ✅ |
| Skills, interests, availability | ✅ | ✅ | ✅ |
| Emergency contact | ✅ | ✅ | ✅ |
| Own documents (upload) | ✅ | ✅ | ✅ |
| Document verification status | ❌ | ✅ | ✅ |
| Status | ❌ | ✅ | ✅ |
| Volunteer ID | ❌ | ❌ | ❌ (never editable) |
| Assignments | ❌ | ✅ | ✅ |
| Attendance | ❌ | ✅ | ✅ |
| Verified hours | ❌ | ✅ | ✅ |
| Certificates | download only | ✅ | ✅ |
| Internal notes | ❌ (cannot even see) | ✅ | ✅ |

A volunteer who could edit their own attendance could inflate the hours on a certificate that a future employer might rely on. That is the reason for the split, and it is worth the extra administrative load.

### 6.2 Attendance capture

Designed for a phone, held by a coordinator, at a field site with poor connectivity.

- Assignment roster with large tap targets, searchable.
- Check-in and check-out timestamps, or a manually entered duration.
- Queues locally and syncs when connectivity returns; queued records are visibly marked as unsynced.
- A coordinator may correct a record; the correction is audited with before/after.
- Hours become *verified* only after a manager confirms the session. Certificates count verified hours only.

---

## 7. Events

```
/events → /events/[slug]
        │
   Register: name, phone, email, number of attendees, any event-specific fields
        │
   ├─ Capacity available   → registered → confirmation email → reminder 24h before
   └─ Capacity full        → waitlisted → promoted automatically on cancellation,
                                          with a notification
        │
        ▼
   Attendance recorded at the event (same interface as volunteer attendance)
        │
   Post-event: thank-you, photos, impact update, optional feedback request
```

Capacity is enforced under a row lock on the event, exactly as product quantity is (A6), because two people registering for the last seat simultaneously is the same race as two donors funding the last kit.

Paid events are out of scope for v1; registration is free. An event may link to a campaign so that attendees can donate, but registration itself never takes payment.

---

## 8. Refunds — withdrawn

**The platform does not offer refunds.** Phase 7 removed the refund table, the
`donation.refund` permission, the provider call and the two `refunded` values in
each status enum. A donation, once confirmed, is final.

This section previously described a full refund flow with separation of duties,
partial refunds and counter reversal. None of it is built, so it is recorded
here as a decision rather than left as a design somebody might implement from.

**What happens instead when money genuinely has to move back:**

- The donor raises a dispute with their bank or card issuer, which the payment
  network handles. `/refund-policy` says so, and says it before somebody gives
  rather than afterwards.
- A refund raised directly in the Razorpay dashboard still reaches us as a
  webhook. It is stored, marked `needs_review` in `payment_webhooks`, and logged
  at error level — it changes no counter and no donation status, because there
  is no code here that does. A human reconciles it.

Reinstating refunds would mean a new migration, a new permission and a new
decision recorded in `phase-0-decisions.md`. It is deliberately not a matter of
re-enabling something that is still lying around.

---

## 9. Edge cases

Documented now, implemented later. Every row is a decision, not a to-do.

### 9.1 Products and quantities

| Case | Behaviour |
|---|---|
| Quantity 0 | Line is not created. If it is the only line and there is no custom amount, Continue stays disabled with the reason shown. |
| Negative quantity | Rejected client-side by the stepper's clamp and server-side by a `CHECK (quantity > 0)`. Never a validation message the donor has to interpret — the control simply cannot go below zero. |
| Non-integer quantity | Rejected server-side. Column is `integer`. |
| Absurd quantity (e.g. 100,000 kits) | Soft cap per line (configurable, default 999). Above it, the donor is routed to a "large gift" contact path rather than being blocked outright — a genuine large donor should not hit a wall. |
| Product deactivated mid-session | Server rejects at intent with 422; the builder re-renders showing what was removed and why. |
| Product fulfilled mid-session | Same, with remaining availability shown. If partially available (donor wants 5, 2 remain), the donor is offered 2 rather than being refused entirely. |
| Price changed mid-session | Server always uses the current DB price. The donor sees the change before payment, at the checkout re-confirmation, never after. |
| Product deleted | Products are soft-deleted only. Historical line items retain the snapshotted name and price (A5). |
| Target quantity lowered below provided | Allowed; the product shows as over-subscribed rather than throwing. Admin is warned before saving. |

### 9.2 Campaigns

| Case | Behaviour |
|---|---|
| Campaign paused mid-session | Intent rejected with a clear explanation; the story stays readable; donation to the parent programme is offered. |
| Campaign completed mid-session | Same, with the outcome summary and an offer to give to a related active campaign. |
| Goal exceeded | Donations continue by default; progress shows over 100% honestly. A per-campaign "stop at goal" flag exists for campaigns that must not over-collect. |
| End date passed but status still Active | A scheduled job transitions it to Completed. The donation path checks the date as well as the status, so a stale status never accepts a donation for a finished campaign. |
| Campaign archived with pending donations | Archiving is blocked while any donation is pending. The admin is told which ones. |
| Slug changed after publish | Old slug 301-redirects permanently. Slug history is retained. |

### 9.3 Payments

| Case | Behaviour |
|---|---|
| Duplicate webhook | `UNIQUE(razorpay_event_id)` makes it a no-op returning 200 (A4). |
| Out-of-order webhooks | Forward-only state machine. A backward transition is recorded as processed and discarded. |
| Webhook never arrives | Nightly reconciliation compares local state to Razorpay's payment list and repairs. |
| Webhook signature invalid | 400, logged with source IP, nothing processed. Repeated failures alert. |
| Donor opens checkout twice in two tabs | One donation record, one order. The second tab's attempt joins the same record. |
| Payment authorized but never captured | Auto-capture is used. Any authorized-only payment is surfaced in reconciliation and expires per Razorpay's policy. |
| Payment succeeds, our DB write fails | Webhook processing is retried by BullMQ with backoff; the raw event is already persisted, so nothing is lost. Reconciliation is the final backstop. |
| Browser closed immediately after paying | Donation completes on the webhook. Receipt is emailed. No loss. |
| Amount mismatch between order and payment | Rejected, flagged for manual review, never auto-completed. |
| Concurrent donations for the last available unit | Both reach the capture transaction; the row lock serialises them; the second re-validates inside the lock, finds no availability, and is completed as a **general donation to the campaign** rather than failed — the money was taken, so it must be honoured. The donor's receipt reflects what actually happened, and Finance is notified. |
| Test-mode payment reaching production | Separate keys per environment; the API rejects any event whose mode does not match the environment. |

### 9.4 Recurring

| Case | Behaviour |
|---|---|
| Card expires | `subscription.pending` → donor emailed with an update link. Razorpay retries. |
| Retries exhausted | `subscription.halted` → recovery email plus in-account banner. Not silently dropped. |
| Amount change | Razorpay requires a new subscription for a changed amount. The old one is cancelled and the new one linked, so the donor's history shows continuity rather than an apparent lapse. |
| Campaign ends while a subscription targets it | Charges continue against the parent programme; the donor is notified of the reallocation and offered a switch or cancellation. |
| Duplicate subscriptions by the same donor | Allowed (a donor may support two campaigns), but the account warns if two identical subscriptions to the same campaign exist. |
| Donation exceeds the UPI Autopay ceiling | Disclosed before instrument selection, not discovered at failure. |

### 9.5 Volunteers, attendance and certificates

| Case | Behaviour |
|---|---|
| Duplicate application from the same phone | Detected; linked to the existing record rather than creating a second volunteer. |
| Rejected applicant re-applies | Permitted after a configurable cooling period. Previous decision and reason are visible to the reviewer. |
| Approval race (two managers approve simultaneously) | Transaction plus sequence guarantees one volunteer ID. The second approval is a no-op. |
| Attendance recorded offline | Queued locally, marked unsynced, synced on reconnect, deduplicated by assignment and date. |
| Check-out before check-in | Rejected with a clear message; correction is audited. |
| Attendance for an unassigned volunteer | Blocked — assignment first. A manager may assign on the spot. |
| Overlapping assignments | Warned, not blocked; some roles genuinely overlap. |
| Certificate requested with zero verified hours | Blocked. Certificates state hours; a certificate for zero hours is meaningless. |
| Volunteer suspended holding a certificate | Existing certificates remain valid. New ones are blocked while suspended. |
| Volunteer requests data deletion | Personal data redacted; the volunteer ID, attendance totals and certificates are retained as organisational records, and the volunteer is told exactly what is retained and why. |

### 9.6 Content, documents and permissions

| Case | Behaviour |
|---|---|
| Two editors editing the same record | Optimistic concurrency by `updated_at`. The second save is rejected with a diff rather than silently overwriting. |
| Publishing without required fields | Blocked by a publish-time schema stricter than the draft-time one. Drafts may be incomplete; published content may not. |
| Scheduled publish while the campaign is archived | Skipped, and the editor is notified. |
| Private document made public by mistake | Requires re-authentication and is audited. Signed URLs already issued are revocable by rotating the object key. |
| Public document removed | 410 Gone, not a silent 404 — removed public documents from an NGO warrant an explicit status. |
| Role changed while the user is logged in | Permissions are resolved per request, so the change takes effect on the next call. Privilege *reduction* additionally invalidates the session. |
| Last Super Admin removed | Blocked. The system always retains at least one. |
| Permission removed mid-operation | The operation fails at the guard. No partial writes, because mutations are transactional. |

---

*Related: [`phase-0-decisions.md`](phase-0-decisions.md) · [`database-architecture.md`](database-architecture.md) · [`rbac.md`](rbac.md)*
