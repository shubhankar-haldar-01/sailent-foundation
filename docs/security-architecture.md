# Security Architecture — Sailent Foundation

**Phase:** 0 · **Date:** 19 September 2026

The platform holds donor PANs, postal addresses, volunteer identity documents and payment records. A breach here is not an outage — it is a legal exposure and the end of the trust the organisation runs on. The architecture is shaped accordingly.

---

## 1. Threat model

What we are actually defending against, in rough order of likelihood:

| Threat | Mitigation |
|---|---|
| **Price tampering at checkout** — funding a ₹1,200 kit for ₹1 | Server computes every total from database prices; the request carries product ids and quantities only (`api-architecture.md` §4) |
| **Forged payment confirmation** | Client success callbacks are never trusted (A3); only signature-verified webhooks or server-side fetches complete a donation |
| **Replayed or duplicated webhooks** | `UNIQUE(razorpay_event_id)` plus a forward-only state machine (A4) |
| **Donor data exfiltration** via a compromised low-privilege account | Least-privilege roles, PII split behind separate permissions, every export re-authenticated and audited |
| **IDOR** — reading another donor's donations | Ownership is a query constraint, never a post-fetch comparison |
| **Credential stuffing on donor accounts** | No donor passwords exist at all — email OTP only |
| **Staff account compromise** | Mandatory TOTP for privileged roles, short sessions, rotating refresh tokens with reuse detection |
| **Session theft via XSS** | No access token ever reaches client-side JavaScript (A1); httpOnly cookies; strict CSP |
| **Malicious file upload** | Type and magic-byte validation, size caps, re-encoding of images, private buckets, no execution path |
| **Accidental exposure of a private document** | Visibility changes require re-authentication and are audited; private objects are never publicly addressable |
| **Enumeration of donors or volunteers** | Uniform responses on OTP request; uuid v7 identifiers; rate limits |
| **Insider misuse** | Append-only audit log covering every sensitive read and write |

Out of scope for v1: nation-state adversaries, physical security of client devices, and supply-chain attacks beyond dependency pinning and automated advisories.

---

## 2. Authentication

### Donors — email OTP only

No password exists, so there is nothing to leak, reuse, phish at scale, or reset.

- 6-digit numeric code, **10-minute expiry**, single use, **hashed at rest** (never stored in plaintext).
- Maximum 5 verification attempts per code, then the code is burned.
- Rate limits: 3 requests per email address per 15 minutes; 10 per IP per hour.
- **`POST /auth/donor/otp/request` always returns 200**, whether or not the address is known. Anything else turns the endpoint into a donor-enumeration oracle. A code is only ever *sent* to an address already on a donor record, so the endpoint cannot be used to mail anything to an arbitrary inbox.
- The OTP message names the organisation and states that Sailent will never ask for the code — the most common real-world attack on OTP is social engineering, not interception.
- **Delivered by email**, using the transactional email transport the platform already had. Phase 0 planned SMS, which needs a DLT-registered sender ID and pre-approved templates under Indian telecom regulation — a lead time the platform no longer waits on, because the address is now both the identifier and the destination.

### Staff — password, plus mandatory TOTP for privileged roles

- **Argon2id** hashing (memory 64 MB, iterations 3, parallelism 4), tuned on the deployment target.
- Minimum 12 characters, checked against a breached-password list. **No composition rules and no forced rotation** — both are known to produce weaker passwords in practice.
- **TOTP 2FA mandatory for Super Admin, Admin and Finance Manager** (A8); strongly encouraged for the rest. Ten single-use backup codes, hashed, shown once.
- Account lockout after 5 failed attempts in 15 minutes, with exponential backoff.
- **No self-registration.** Accounts are created by invitation, with a single-use 48-hour token.
- Login notifications for a new device or a new IP range.

### Tokens and sessions

| | Donor | Staff |
|---|---|---|
| Access token TTL | 15 min | 15 min |
| Refresh token TTL | 30 days | 7 days |
| Audience claim | `donor` | `staff` |
| Storage | httpOnly cookie on the Next.js origin | same |
| Idle timeout | 30 days | 8 hours |

- Access tokens are **held server-side by the BFF** and never reach the browser (A1).
- Refresh tokens are httpOnly, `Secure`, `SameSite=Lax`, rotating. **Reuse of a rotated token revokes the entire family and alerts** — the standard detection for a stolen refresh token.
- Audiences are non-interchangeable: a donor token fails at an admin route on audience alone, before any permission lookup.
- Privilege reduction invalidates sessions immediately rather than waiting for expiry.

---

## 3. Authorization

Fully specified in [`rbac.md`](rbac.md). The security-relevant invariants:

1. **Deny by default.** A route lacking both `@Public()` and a permission requirement is unreachable.
2. **Audience before permission**, so cross-audience access fails early and cheaply.
3. **Ownership as a query constraint** — `WHERE donor_id = :tokenDonorId`, never fetch-then-compare. This makes IDOR structurally impossible rather than merely tested for.
4. **Re-authentication within 5 minutes** for every sensitive operation.
5. **Client-side permission filtering is cosmetic**; the API enforces independently.

---

## 4. Payment security

The highest-value target in the system.

### Webhook verification

1. **Raw body** — the JSON parser is disabled on `/webhooks/razorpay`. Razorpay signs the exact bytes sent; re-serialising parsed JSON changes them and verification fails.
2. **HMAC-SHA256** over that buffer, keyed with the webhook secret, compared to `X-Razorpay-Signature` using a **constant-time comparison** (`crypto.timingSafeEqual`). A naive `===` leaks the signature one byte at a time under timing analysis.
3. **Persist before processing** — the raw event is stored with `UNIQUE(razorpay_event_id)` and `200` is returned immediately.
4. **Process asynchronously** through the forward-only state machine.

Verification failures are logged with the source IP; repeated failures alert, because they mean either a misconfiguration or someone probing the endpoint.

### Other payment controls

- **No card data touches our servers.** Razorpay Checkout is hosted; we store only the last four digits, network and method, all of which Razorpay returns.
- API keys and the webhook secret live in the secret manager, are environment-separated, and are rotatable without a deploy.
- **Test-mode events are rejected in production** and vice versa; the environment/mode mismatch is checked on every event.
- Amount mismatch between order and payment is never auto-resolved — it is flagged for manual review.
- ~~Refunds require permission, re-authentication and separation of duties.~~ Withdrawn in Phase 7 — there is no refund path, so there is nothing to gate.
- Nightly reconciliation against Razorpay's records catches anything the webhooks missed.

### FCRA enforcement

No FCRA registration means foreign contributions cannot legally be accepted (`product-requirements.md` §6).

- International payment instruments are **disabled in the Razorpay configuration** — the enforcement is upstream of our code.
- `payments.international` and `donations.ip_country` are retained so a foreign contribution received in error is identifiable and returnable.
- `settings.fcra_enabled` is a documented feature gate, defaulting to `false`.

---

## 5. Input validation

**Zod schemas in `packages/validation`, shared by the web app and the API.** The client validates for a fast, humane experience; **the server validates because the client cannot be trusted.** Same schemas, so the two cannot disagree about what is valid.

- Parameterised queries throughout (Drizzle). Raw SQL only where genuinely necessary, and always parameterised.
- Output encoding by React; `dangerouslySetInnerHTML` is used only for CMS rich text, which is sanitised server-side with an allow-list on write and again on render.
- Request body size capped (1 MB default, higher on upload routes).
- Strict schemas reject unknown properties rather than silently ignoring them, so mass-assignment cannot occur.
- **Financial fields are never accepted from the client** — prices, totals and amounts are always read from or computed in the database.

---

## 6. File uploads and storage

Cloudflare R2, **three buckets with different exposure**:

| Bucket | Contents | Access |
|---|---|---|
| `public` | Campaign images, team photos, gallery, public documents | Public via CDN, long cache |
| `private` | Receipts, volunteer documents, tax documents, internal files | **No public access.** Short-lived signed URLs only, issued after a permission check |
| `temp` | In-progress uploads | Auto-expire after 24 hours |

Upload controls:

- Server-issued presigned URLs with a content-type and size constraint; the client never holds R2 credentials.
- **Magic-byte validation, not extension trust.** A `.jpg` whose bytes are a PHP script is rejected.
- Allowed types: JPEG, PNG, WebP, AVIF, PDF, and specific document formats. **Never SVG from untrusted input** — SVG is an XSS vector.
- Images are re-encoded server-side, which strips EXIF (including GPS coordinates that could identify a beneficiary's location) and neutralises polyglot files.
- Size caps: 10 MB images, 25 MB documents.
- Randomised object keys — filenames are never guessable and never derived from user input.
- Signed URLs expire in 5 minutes for sensitive documents, 60 minutes for receipts.
- Every access to a volunteer document or tax document is audited.

---

## 7. Transport and headers

- HTTPS only, HSTS with `includeSubDomains` and preload.
- TLS 1.2 minimum, 1.3 preferred.
- Cloudflare in front: WAF, DDoS protection, bot management on the donation and OTP endpoints.

Security headers on every response:

```
Content-Security-Policy: default-src 'self';
  script-src 'self' 'nonce-…' https://checkout.razorpay.com https://www.googletagmanager.com;
  frame-src https://api.razorpay.com https://checkout.razorpay.com;
  connect-src 'self' https://lumberjack.razorpay.com https://*.sentry.io;
  img-src 'self' data: https://<r2-public-domain>;
  style-src 'self' 'nonce-…';
  object-src 'none'; base-uri 'self'; frame-ancestors 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
```

CSP uses **nonces, not `unsafe-inline`**. Razorpay's checkout script is the one third-party script permitted in the payment flow, and it is pinned to its own origin.

CORS on the API is closed to browser origins entirely — the only callers are the Next.js server, the worker, and Razorpay.

---

## 8. Secrets

- **Never in the repository.** `.env.example` documents names only, never values.
- Vercel and Render environment variables for runtime; a secret manager for anything shared.
- Fully separated per environment. **Production credentials never exist on a developer machine** — local development uses test keys and a seeded database.
- Rotation schedule: payment keys and the webhook secret every 90 days or immediately on any suspicion; JWT signing keys every 180 days with an overlap window so existing sessions survive.
- Secret scanning in CI; a commit containing a credential fails the build and the credential is treated as burned.

---

## 9. Audit logging

Append-only (A10). The application's database role holds `INSERT` and `SELECT` on `audit_logs` and nothing else — there is no code path to modify or delete a log entry, and no permission that grants one.

**Always logged:** authentication (success and failure), every permission-gated mutation, every sensitive read (PII views, document downloads, exports with row counts), donor record corrections, role changes, visibility changes, settings changes, and webhook verification failures.

Each entry: actor, action, resource, before/after diff, IP, user agent, request id, severity, timestamp.

**Never logged:** passwords, OTP codes, tokens, full PANs, card data. A shared redaction serialiser enforces this, rather than relying on per-call-site discipline.

Retention is indefinite for financial and permission events. `critical` severity entries alert in real time.

---

## 10. Rate limiting and abuse

| Endpoint class | Limit |
|---|---|
| Public reads | 100/min per IP |
| OTP request | 3 per email address / 15 min; 10 per IP / hour |
| OTP verify | 5 attempts per code |
| Donation intent | 10/min per IP |
| Staff login | 5 per account / 15 min, then lockout |
| Admin writes | 60/min per user |
| Exports | 5/hour per user |
| File upload | 20/hour per user |
| **Webhooks** | **Unlimited** — never throttle Razorpay |

Backed by Upstash Redis with a sliding window. Cloudflare provides the outer layer. Limit responses include `Retry-After` and are logged; sustained hits alert.

---

## 11. Data protection

### Encryption
- In transit: TLS 1.2+ everywhere, including the database connection.
- At rest: Neon and R2 provide storage encryption.
- **Application-level encryption for `donors.tax_id_number`** (AES-256-GCM, key in the secret manager, rotatable). Storage encryption protects against a stolen disk; application-level encryption protects against a leaked database dump or an over-broad query. A PAN warrants both.

### Retention

| Data | Retention |
|---|---|
| Donations, payments, receipts | 8 years (statutory) |
| Tax records, 10BD exports | 8 years |
| Audit logs | Indefinite for financial and permission events |
| Webhook payloads | 24 months |
| Volunteer records | Duration of engagement plus 3 years |
| Donor accounts | Until deletion is requested, subject to statutory retention |
| Analytics | 14 months |
| Session and OTP records | 90 days |

### Deletion requests

Personal data is redacted; **financial records are retained** because statute requires it. The donor is told precisely what is retained and why, rather than being given a vague answer. Volunteer IDs, attendance totals and certificates are retained as organisational records even after personal data is redacted.

---

## 12. Database access

- The application connects as a role with `SELECT`, `INSERT`, `UPDATE`, `DELETE` on its tables — and **`INSERT`/`SELECT` only on `audit_logs`**.
- No `DROP`, no `ALTER`, no superuser. Migrations run as a separate role in a separate step.
- Connections over TLS from a pooled long-lived process (A12).
- **No direct human access to the production database as routine.** Read access for incident investigation is time-boxed, individually credentialed and logged. No shared credentials.
- Read replicas for reporting once volume warrants, so an analytical query cannot degrade the donation path.

### Backups

- Neon point-in-time recovery, 30-day window.
- Daily logical backups to R2 in a separate region, encrypted, 90-day retention.
- **Restores are tested quarterly.** An untested backup is a hypothesis, not a backup.
- Documented RTO of 4 hours and RPO of 15 minutes, with the restore runbook in `infrastructure/`.

---

## 13. Monitoring and incident response

**Sentry** for both applications, with PII scrubbing configured before the first deploy rather than after the first leak.

Real-time alerts on: webhook signature failures, payment state anomalies, reconciliation mismatches, authentication spikes, `critical` audit entries, error-rate spikes, and any 5xx on the donation path.

**Incident response.** Detect → contain (revoke sessions, rotate secrets, disable the affected path) → assess via the audit log → notify affected parties and, where required, authorities → remediate → post-mortem. A payment or PII incident escalates to the Super Admin and the client immediately, not at the end of the working day.

---

## 14. Development practices

- Dependencies pinned via `pnpm-lock.yaml`; automated advisory scanning; security patches applied within a week, critical ones within 24 hours.
- CI: type-check, lint, unit tests, secret scan, dependency audit. All must pass to merge.
- Branch protection with required review on `main`.
- **No production data in development or staging.** Seed data is synthetic; if production data must ever be used for debugging, it is anonymised first.
- A security review before each release that touches authentication, payments, permissions or file handling.

---

## 15. Compliance posture

- **DPDP Act (India)** — purpose limitation, consent capture for communications, a deletion pathway, and breach notification. Data is stored in an Indian or Asia-Pacific region where the provider offers it.
- **80G** — statutory record retention, donor identification, Form 10BD accuracy (`product-requirements.md` §6).
- **FCRA** — foreign contributions actively blocked, not merely unimplemented.
- **PCI DSS** — out of scope by design. No card data ever reaches our servers; Razorpay's hosted checkout carries that burden, and the architecture keeps it that way.

---

*Related: [`rbac.md`](rbac.md) · [`api-architecture.md`](api-architecture.md) · [`database-architecture.md`](database-architecture.md)*
