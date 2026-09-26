# API Architecture — Sailent Foundation

**Phase:** 0 · **Date:** 19 September 2026
**Status:** Design only. **No endpoints are implemented in this phase.**

NestJS · TypeScript · REST · OpenAPI/Swagger. Consumed by the Next.js web app through a BFF layer (decision A1), by the worker, and by Razorpay webhooks.

---

## 1. Who calls this API

```
Browser ──► Next.js (same origin)
              ├── Server Components ──► API  (public content, server-side)
              └── /api/bff/* handlers ──► API  (authenticated; holds the session cookie,
                                                attaches the bearer token server-side)

Razorpay ─────────────────────────────► API  /webhooks/razorpay   (direct, never via Next.js)
Worker ───────────────────────────────► API / DB                  (jobs, scheduled tasks)
```

**The browser never holds an access token and never calls the API directly** (A1). CORS is closed to browser origins; the API accepts requests from the web app's server, the worker, and Razorpay's webhook IPs.

The BFF is a transport layer. It authenticates, forwards and shapes responses for the client. **Any business logic that appears in a BFF route handler is a bug** — it belongs in a Nest service where it can be tested, audited and reused.

---

## 2. Conventions

### Base and versioning
`https://api.sailentfoundation.org/v1`

Version in the path. v1 lives until a breaking change is genuinely unavoidable; additive changes never bump the version.

### Audiences

Every endpoint declares one of four access levels. This is enforced by a guard, not by convention.

| Level | Meaning |
|---|---|
| **Public** | No authentication. Explicitly marked `@Public()`; every such marking is reviewed. |
| **Donor** | Valid `aud: "donor"` token. Can only ever reach its own records. |
| **Volunteer** | Donor-audience token carrying a volunteer link. |
| **Staff** | Valid `aud: "staff"` token **plus** a specific permission (see [`rbac.md`](rbac.md)). |

A donor token presented to a staff endpoint fails on **audience mismatch before any permission check runs** (A8). The two token families are not interchangeable in either direction.

### Request and response shape

> **Updated in Phase 1 (decision P1-1).** The envelope now carries an explicit
> `success` discriminant so clients can narrow the union without inspecting the
> payload. The error object is unchanged. Implemented in
> `packages/types/src/domain/api.ts` and applied by the API's response
> interceptor and exception filter.

Success:
```json
{ "success": true, "data": { … }, "meta": { … } }
```

Collection:
```json
{
  "success": true,
  "data": [ … ],
  "meta": { "page": 1, "perPage": 20, "total": 143, "totalPages": 8 }
}
```

Error — one envelope, everywhere:
```json
{
  "success": false,
  "error": {
    "code": "CAMPAIGN_PAUSED",
    "message": "This campaign is not currently accepting donations.",
    "details": [{ "field": "campaignId", "code": "invalid_state" }],
    "requestId": "req_01J8X…"
  }
}
```

A handler may opt out of the envelope with `@RawResponse()` — required for the
Razorpay webhook, which must reply with exactly what the provider expects, and
for file streams.

`code` is a stable machine-readable string the UI branches on. `message` is human-readable and safe to display. `requestId` correlates to Sentry and the audit log — it is what a donor quotes to support.

### Money on the wire

`bigint` paise does not survive JSON's number type. **Amounts are serialised as strings**: `"amount": "290000"` is ₹2,900. A shared codec in `packages/validation` owns both directions, so no endpoint hand-rolls it and no client guesses.

### Pagination, filtering, sorting

`?page=1&perPage=20` (max 100) · `?sort=-createdAt` (leading `-` for descending) · `?status=active&programId=…&q=search`.

Cursor pagination (`?cursor=…`) for the audit log and donation exports, where offset pagination degrades and rows shift under the reader.

### Idempotency

Mutating endpoints that create money-bearing records accept `Idempotency-Key`. Replaying a key within 24 hours returns the original response rather than creating a second record. Required on `POST /donations/intent` and `POST /donations/{id}/checkout` — a donor double-tapping "Continue" on a slow connection must not create two donations.

### Rate limits

| Scope | Limit |
|---|---|
| Public reads | 100/min per IP |
| OTP request | 3 per email address per 15 min; 10 per IP per hour |
| OTP verify | 5 attempts per code |
| Donation intent | 10/min per IP |
| Staff login | 5 per account per 15 min, then lockout |
| Admin writes | 60/min per user |
| Exports | 5/hour per user |
| Webhooks | Not rate-limited — never throttle Razorpay |

---

## 3. Module ownership

One Nest module per bounded context. A module owns its tables and exposes a service; **no module reads another module's tables directly** — cross-context reads go through the owning service, so a schema change has one blast radius.

| Module | Owns | Depends on |
|---|---|---|
| `auth` | sessions, otp_codes | users, donors |
| `users` | users, user_roles | rbac |
| `rbac` | roles, permissions, role_permissions | — |
| `donors` | donors, donor_preferences | — |
| `volunteers` | volunteers + profiles, applications, documents, assignments, attendance, hours, certificates | users, events, storage |
| `team` | team_members, team_departments | media |
| `programs` | programs | — |
| `campaigns` | campaigns, campaign_products, updates, media, faqs, documents | programs, media |
| `donations` | donations, donation_items | campaigns, donors, payments |
| `payments` | payments, payment_transactions, payment_webhooks | donations |
| `subscriptions` | subscriptions, subscription_items, subscription_payments | donations, payments |
| `receipts` | receipts, tax_documents, form_10bd_exports | donations, donors, storage |
| `events` | events, event_registrations | programs, volunteers |
| `impact` | impact_records, impact_updates | programs, campaigns |
| `stories` | stories | programs, campaigns, media |
| `content` | pages, page_revisions, faqs | media |
| `blog` | blogs, categories, tags | media, users |
| `media` | media, galleries | storage |
| `documents` | documents | storage |
| `notifications` | notifications, templates, newsletter_subscribers | — |
| `reports` | (read-only across modules) | most |
| `audit` | audit_logs | — |
| `settings` | settings | — |
| `storage` | R2 client, signed URLs | — |
| `webhooks` | Razorpay intake | payments, subscriptions |

---

## 4. Endpoint map

Access column: **P** public · **D** donor · **V** volunteer · **S** staff (with the permission named).

### `/auth`

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/auth/donor/otp/request` | P | Email OTP. Always returns 200 regardless of whether the address exists — otherwise the endpoint becomes a donor-enumeration oracle. |
| POST | `/auth/otp/verify` | P | Returns donor tokens |
| POST | `/auth/staff/login` | P | Email + password → TOTP challenge |
| POST | `/auth/staff/totp` | P | Completes staff login |
| POST | `/auth/refresh` | P | Rotating refresh; reuse revokes the family |
| POST | `/auth/logout` | D/S | |
| GET | `/auth/me` | D/S | Identity + effective permissions |
| POST | `/auth/reauthenticate` | S | Required before sensitive operations (A9) |

### `/campaigns`

| Method | Path | Access |
|---|---|---|
| GET | `/campaigns` | P — published/active only; filters and sorts per `information-architecture.md` §5.1 |
| GET | `/campaigns/{slug}` | P — 404 for draft/archived |
| GET | `/campaigns/{slug}/products` | P |
| GET | `/campaigns/{slug}/updates` | P |
| GET | `/campaigns/{slug}/faqs` · `/documents` | P (public documents only) |
| GET | `/campaigns/{slug}/donors` | P — **the only public endpoint that returns a person's name.** Confirmed donations only. An anonymous gift returns the literal `Anonymous Donor`; the real name is never read out of the database, not filtered afterwards. Either the donation's own flag or the donor's standing preference hides it. Returns exactly four fields — display name, anonymity flag, amount, timestamp — and no email, phone, donor id or reference at any point. `sort` is an enum of `recent \| generous`, never a column name. |
| GET | `/admin/campaigns` | S `campaign.view` — all statuses |
| POST | `/admin/campaigns` | S `campaign.create` |
| PATCH | `/admin/campaigns/{id}` | S `campaign.edit` |
| POST | `/admin/campaigns/{id}/publish` | S `campaign.publish` — stricter publish-time schema |
| POST | `/admin/campaigns/{id}/pause` | S `campaign.pause` — reason required |
| DELETE | `/admin/campaigns/{id}` | S `campaign.delete` — re-auth + audit; blocked while donations are pending |

### `/campaign-products`

| Method | Path | Access |
|---|---|---|
| GET | `/admin/campaign-products` | S `campaign.view` |
| POST/PATCH | `/admin/campaign-products/{id}` | S `campaign.edit` — price changes audited; historical line items unaffected (A5) |
| POST | `/admin/campaign-products/{id}/fulfil` | S `campaign.edit` — manual fulfilment adjustment, audited |

### `/donations` — the critical path

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/donations/intent` | P | **Accepts product ids + quantities only. Never a price or a total.** Server re-reads prices, re-validates availability, computes the total, creates the donation and the Razorpay order. `Idempotency-Key` required. |
| POST | `/donations/{id}/checkout` | P | Attaches donor details; returns the Razorpay order and key |
| GET | `/donations/{reference}/status` | P | Polled by `/donate/status/[reference]` (A3). Returns only the state and a public summary — never PII. |
| POST | `/donations/{reference}/tax-id` | P | Post-payment tax-ID capture, token-scoped to that donation |
| GET | `/me/donations` | D | Own donations, full line detail |
| GET | `/me/donations/{id}` | D | Ownership enforced in the query, not by a post-fetch check |
| GET | `/admin/donations` | S `donation.view` — aggregates for Campaign Manager; donor identity requires `donation.view_pii` |
| GET | `/admin/donations/{id}` | S `donation.view`; donor block requires `donation.view_pii` |
| POST | `/admin/donations/export` | S `donation.export` — re-auth + audit, row count recorded |

There is **no** `PATCH /donations/{id}` that alters amounts. A donation's financial content is immutable once created, and Phase 7 removed refunds, so there is no route by which a confirmed donation's money changes at all.

### `/payments` and webhooks

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/webhooks/razorpay` | P (signature-verified) | **Raw body parsing disabled on this route.** HMAC-SHA256 over the raw buffer, constant-time compare against `X-Razorpay-Signature`. Persist with `UNIQUE(razorpay_event_id)`, return 200, process async (A4). |
| GET | `/admin/payments` | S `payment.view` |
| GET | `/admin/payments/{id}/transactions` | S `payment.view` — the state-change ledger |
| GET | `/admin/webhooks` | S `payment.view` — raw events for forensics |
| POST | `/admin/webhooks/{id}/replay` | S `payment.manage` — re-auth + audit |
| POST | `/admin/payments/reconcile` | S `payment.manage` — also runs nightly |

### `/subscriptions`

| Method | Path | Access |
|---|---|---|
| POST | `/subscriptions` | P — create a recurring gift |
| GET | `/me/subscriptions` | D |
| POST | `/me/subscriptions/{id}/pause` · `/resume` · `/cancel` | D — **self-service, no friction, no retention interstitial** |
| GET | `/admin/subscriptions` | S `subscription.view` |
| POST | `/admin/subscriptions/{id}/cancel` | S `subscription.manage` |
| GET | `/admin/subscriptions/halted` | S `subscription.view` — the recovery queue |

### `/receipts` and tax compliance

| Method | Path | Access |
|---|---|---|
| GET | `/me/receipts` · `/me/receipts/{id}/download` | D — signed URL, short TTL |
| GET | `/admin/receipts` | S `receipt.view` |
| POST | `/admin/receipts/{id}/void` | S `receipt.manage` — re-auth; number retained (A7) |
| POST | `/admin/receipts/{id}/resend` | S `receipt.manage` |
| GET | `/admin/tax/10bd/preview` | S `tax.view` — record count, total, and the count excluded for want of a tax ID |
| POST | `/admin/tax/10bd/export` | S `tax.export` — re-auth + audit; the generated file is retained |
| POST | `/admin/tax/10be/upload` | S `tax.manage` — store certificates for issue to donors |
| GET | `/admin/tax/missing-ids` | S `tax.view` — the compliance gap before 31 May |

### `/donors`

| Method | Path | Access |
|---|---|---|
| GET | `/me/profile` | D — own record |
| PATCH | `/me/profile` | D — name, email, address, communication preferences |
| POST | `/me/tax-id` | D — add or correct a PAN / tax ID |
| GET | `/me/campaigns` | D — campaigns this donor has supported |
| GET | `/admin/donors` | S `donor.view` — **SENSITIVE fields omitted** unless the caller also holds `donor.view_sensitive` |
| GET | `/admin/donors/{id}` | S `donor.view` |
| PATCH | `/admin/donors/{id}` | S `donor.edit` — corrections audited |
| POST | `/admin/donors/{id}/notes` | S `donor.edit` — internal notes, ADMIN-ONLY, never returned to the donor |
| POST | `/admin/donors/export` | S `donor.export` 🔒 — re-auth + audit with row count |
| DELETE | `/admin/donors/{id}` | S `donor.delete` 🔒 — redacts personal data; **financial records retained** per statute |

`donor.view_sensitive` gates PAN and postal address specifically. A Finance Manager needs them for Form 10BD; nobody else does, and the serialiser omits them rather than returning nulls, so absence is not distinguishable from a missing value.

### `/volunteers`

| Method | Path | Access |
|---|---|---|
| POST | `/volunteers/apply` | P |
| GET | `/volunteers/application/{token}` | P — resume a part-completed application |
| GET | `/me/volunteer` | V — profile, ID, status |
| PATCH | `/me/volunteer/profile` | V — **only the volunteer-editable fields of `user-flows.md` §6.1** |
| GET | `/me/volunteer/assignments` · `/attendance` · `/certificates` | V — read-only |
| POST | `/me/volunteer/documents` | V — own uploads |
| GET | `/admin/volunteers` | S `volunteer.view` |
| PATCH | `/admin/volunteers/{id}` | S `volunteer.edit` |
| GET | `/admin/volunteers/{id}/documents` | S `volunteer.view_documents` 🔒 — signed URL, short TTL, each access audited |
| POST | `/admin/volunteers/{id}/documents/{docId}/verify` | S `volunteer.view_documents` |
| GET | `/admin/volunteers/applications` | S `volunteer.view` — the review queue |
| POST | `/admin/volunteers/{id}/approve` | S `volunteer.approve` 🔒 — assigns `VOL-2026-00001` in-transaction (A13) |
| POST | `/admin/volunteers/{id}/reject` | S `volunteer.approve` 🔒 — reason required, audited |
| POST | `/admin/volunteers/{id}/suspend` | S `volunteer.suspend` 🔒 — reason required, revokes portal access |
| POST | `/admin/volunteers/export` | S `volunteer.export` 🔒 — re-auth + audit |
| POST | `/admin/volunteers/{id}/assignments` | S `volunteer.assign` |
| POST | `/admin/attendance` · `/admin/attendance/bulk` | S `volunteer.attendance` — bulk accepts offline-queued batches, deduplicated by `(assignment_id, date)` |
| POST | `/admin/attendance/{id}/verify` | S `volunteer.attendance` |
| POST | `/admin/volunteers/{id}/certificates` | S `volunteer.certificate` — blocked at zero verified hours |
| GET | `/verify/certificate/{code}` | P — **public certificate verification.** Returns validity, name, hours and period only; nothing else. |

### Content, programmes, events, impact, stories

| Method | Path | Access |
|---|---|---|
| GET | `/programs` · `/programs/{slug}` | P |
| GET | `/events` · `/events/{slug}` | P — the online joining link is withheld |
| POST | `/events/{id}/register` | **D**, not P — see the note below. Capacity, deadline and event state enforced under `SELECT … FOR UPDATE` on the event row |
| GET | `/events/{id}/registration` | D — the caller's own, including the joining link |
| DELETE | `/events/{id}/registration` | D — the caller's own; refused once attendance is recorded |
| GET | `/me/events` | D — every event this donor has registered for |
| GET | `/stories` · `/stories/{slug}` | P |
| GET | `/impact` | P — **live aggregates only** (A14), plus published updates |
| GET | `/impact/{slug}` | P — one record, **including its verification method** (A14) |
| GET | `/me/impact` | D — updates for campaigns this donor funded |
| GET | `/blog` · `/blog/{slug}` · `/blog/categories` | P |
| GET | `/pages/{slug}` | P — composed sections, validated against the approved section schema |
| GET | `/team` · `/team/{slug}` · `/faqs` | P — a team member needs both `status = published` and `isPublic` |
| GET | `/documents/public` | P — `visibility = 'public'` only |
| POST/PATCH | `/admin/documents` | S `document.manage` — Content Manager is limited to public documents |
| GET | `/documents/{id}/download` | P or S — signed URL; private and restricted require `document.view_private`, and the access is audited |
| GET | `/search` | P — across campaigns, programmes, stories, blog |
| GET | `/admin/{content-type}` | S `content.view` · `program.view` · `event.view` · `impact.view` |
| POST/PATCH | `/admin/pages` · `/blog` · `/faqs` | S `content.create` / `content.edit` |
| POST | `/admin/pages/{id}/compose` | S `page.compose` — ordered approved sections only |
| POST | `/admin/{content-type}/{id}/publish` | S `content.publish` · `impact.publish` |
| DELETE | `/admin/{content-type}/{id}` | S `content.delete` 🔒 |
| POST/PATCH | `/admin/programs` · `/admin/events` | S `program.manage` · `event.manage` |
| GET | `/admin/events/transitions` | S `event.read` — the two transition tables, served so the UI cannot drift from the server |
| PATCH | `/admin/events/{id}/status` | S `event.manage` — draft ⇄ published → archived. Refused while live registrations exist |
| PATCH | `/admin/events/{id}/lifecycle` | S `event.manage` — open/closed/cancelled/completed. Cancelling **requires a reason** and emails every registrant |
| POST | `/admin/events/{id}/recount` | S `event.manage` — recompute seats from the rows |
| GET | `/admin/events/{id}/registrations` | S `event.registration.read` 🔒 — attendee PII, **re-auth required** |
| POST | `/admin/events/{id}/attendance` | S `event.attendance` — one transaction for the whole register; only `attended` and `no_show` |
| GET/POST/PATCH | `/admin/team` · `/admin/team/{id}` | S `team.read` · `team.manage` |
| PATCH | `/admin/team/reorder` · `/admin/team/{id}/status` | S `team.manage` — status and `isPublic` move together |
| POST/PATCH | `/admin/stories` | S `story.create` / `story.edit` |
| POST | `/admin/stories/{id}/publish` | S `story.publish` 🔒 — blocked without recorded consent |
| GET/POST | `/admin/impact` | S `impact.read` · `impact.create` |
| PATCH | `/admin/impact/{id}` | S `impact.update` |
| PATCH | `/admin/impact/{id}/status` | S `impact.publish` — refused when a figure is claimed with no stated method (A14); stamps `verifiedBy` |
| POST | `/admin/media` | S `media.upload`; management requires `media.manage` |
| POST | `/admin/documents/{id}/visibility` | S `document.change_visibility` 🔒 — **re-auth required**, audited |

#### Why event registration is donor-only

The table above said `P` for registration, and Phase 9 made it `D`. §49 requires
that a person may create, view and cancel their **own** registration and nobody
else's, and ownership has to be anchored to something the server established.

A guest registration identified by an email typed into a form is owned by
whoever types that email: anyone could cancel a stranger's place, and the
cancellation notice would go to the stranger. The email address is also the
unique key on `event_registrations`, so a client-supplied address locks the real
owner out of the event.

The registration body therefore carries **no email field** and the API rejects
one. The address is read from the signed-in donor's record. The cost of
requiring an account is low, because it is the existing passwordless one.

#### Waitlists

The old row promised "waitlists on overflow". Phase 9 implements none. The
`waitlisted` value stays in the column's vocabulary and nothing writes it; a
full event says so and offers no queue.

### Reports, notifications, system

| Method | Path | Access |
|---|---|---|
| GET | `/admin/reports/donations` · `/campaigns` · `/volunteers` · `/impact` | S `report.view` |
| POST | `/admin/reports/export` | S `report.export` — audited |
| GET | `/admin/dashboard` | S — role-aware; returns only what the caller may see |
| GET/POST | `/admin/notifications` · `/templates` | S `notification.send` 🔒 |
| GET | `/admin/notifications/log` | S `notification.view` |
| GET | `/admin/users` | S `user.view` |
| POST | `/admin/users/invite` | S `user.invite` 🔒 — invitation only, no self-registration |
| POST | `/admin/users/{id}/suspend` | S `user.suspend` 🔒 |
| POST | `/admin/users/{id}/roles` | S `user.assign_role` — re-auth; cannot remove the last Super Admin |
| GET | `/admin/roles` · `/permissions` | S `role.view` |
| POST/PATCH | `/admin/roles` | S `role.manage` 🔒 — Super Admin only |
| GET | `/admin/audit-logs` | S `audit.view` — cursor-paginated, read-only; **no write or delete endpoint exists** (A10) |
| POST | `/admin/audit-logs/export` | S `audit.export` 🔒 — Super Admin only |
| GET | `/admin/settings` | S `settings.view` |
| PATCH | `/admin/settings` | S `settings.manage` 🔒 — includes the `fcra_enabled` gate |

---

## 5. Authorization enforcement

Three layers, in order, on every request:

1. **Authentication guard** — valid, unexpired, correctly-signed token.
2. **Audience guard** — `aud` matches what the route requires. A donor token dies here at an admin route, before any permission lookup.
3. **Permission guard** — `@RequirePermission('donation.export')`. **Deny by default:** a route without either `@Public()` or a permission requirement is unreachable.

Plus, for sensitive operations:

4. **Re-authentication guard** — `@Sensitive()` requires a successful re-authentication within the last 5 minutes.
5. **Audit interceptor** — writes the audit row. It is wired to the *same* decorator as the permission guard, so a permission-gated mutation cannot ship without its audit trail.

### Ownership is a query constraint, not a check

Donor-scoped endpoints filter by the token's subject **inside the query**:

```
WHERE donations.donor_id = :tokenDonorId
```

They never fetch by id and then compare owners. That pattern produces IDOR bugs the first time someone forgets the comparison, and it leaks existence through response-time differences. Filtering in the query makes the vulnerability structurally impossible.

---

## 6. Webhook endpoint contract

The most security-sensitive endpoint in the system.

```
POST /v1/webhooks/razorpay
Headers: X-Razorpay-Signature, X-Razorpay-Event-Id
Body:    raw JSON (parser disabled for this route)
```

1. Read the **raw body buffer**. Nest's JSON body parser is disabled here — re-serialising parsed JSON changes the bytes and the signature will not match.
2. HMAC-SHA256 the buffer with the webhook secret; **constant-time compare** to the header. Mismatch → `400`, logged with the source IP; nothing further happens.
3. Insert into `payment_webhooks` with `UNIQUE(razorpay_event_id)`. Unique violation → `200`, no-op. This single constraint is the entire deduplication strategy.
4. Return `200` **immediately** — before processing. A slow webhook endpoint causes retries, which causes more load.
5. Enqueue a BullMQ job to apply the event through the forward-only state machine.

Events acted on: `payment.captured` and `payment.failed`. `refund.created` and `refund.processed` are stored, marked `needs_review` and logged at error level but change nothing — the platform has no refund path, so a refund event means money moved outside it and a human reconciles. Subscription events are not handled: recurring giving was removed in Phase 6.

Unknown event types are stored and marked `ignored` rather than rejected — Razorpay may add events, and an unrecognised event is not an error.

---

## 7. OpenAPI

Generated from Nest decorators and Zod schemas so the spec cannot drift from the implementation. Published at `/docs` (staff-authenticated in production, open in development). Types are generated from the spec into `packages/types` and consumed by the web app, so a breaking API change fails the web build rather than reaching production.

Every endpoint documents its access level, required permission, error codes and an example. The spec is the contract between the API and the admin UI's permission-filtered sidebar.

---

*Related: [`rbac.md`](rbac.md) · [`database-architecture.md`](database-architecture.md) · [`security-architecture.md`](security-architecture.md)*
