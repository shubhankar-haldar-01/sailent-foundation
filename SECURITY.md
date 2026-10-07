# SECURITY.md — security policy and control status

Permanent security policy for the Sailent Foundation platform. Each control's status was verified against the code on **2026-10-06**, and the platform rows again on **2026-10-07** for Phase 14 (a snapshot; re-verify before relying on a status). Status key: **IMPLEMENTED · PARTIAL · MISSING · NEEDS REVIEW · N/A**.

> **PRODUCTION DATABASE IS OFF LIMITS TO AI AGENTS BY DEFAULT.** The production Supabase database may be touched only by a human, with explicit approval for each action (`AGENTS.md` §8, `DEPLOYMENT.md` §2). There is no staging environment.

The original design is in `docs/security-architecture.md`. Parts of it describe controls that do not exist; this file records the reality.

> **Reporting a vulnerability:** contact the project owner privately. Do not open a public issue. Never include secrets or donor data in a report.

---

## 1. Principles

1. **Deny by default.** Every route is closed unless it is marked `@Public()` or granted a permission.
2. **The browser never holds API tokens.** Tokens live in httpOnly cookies behind the Next.js BFF (decision A1).
3. **The server is the source of truth** for prices, payment status and counters.
4. **Least data.** Collect PAN only when needed, never export it raw, never log PII.
5. **Defence in depth.** Validation runs at the edge (Zod), in the service layer and as database constraints.
6. **Fail closed** for money and access. Fail soft only for non-critical delivery such as email.
7. **Everything sensitive is audited.**

## 2. Control status

### Authentication
| Control | Status | Evidence / gap |
|---|---|---|
| Staff password login | IMPLEMENTED | Argon2id (m=64MB, t=3, p=4) in `apps/api/src/modules/auth/password.service.ts`. Dummy-hash timing equaliser for unknown users. |
| Password rehash on parameter change | MISSING | `needsRehash` exists but is never called. |
| Account lockout | PARTIAL | 5 failures → 15-minute lock. The non-atomic counter and the 429 response reveal that an account exists, and anyone can lock out any staff account. |
| Staff 2FA (TOTP) | **NOT REQUIRED — owner decision (2026-10-07, Phase 12)** | Staff authenticate with email and password. TOTP enrolment, TOTP at login and mandatory staff 2FA are deliberately **not** part of the product; do not add them unless the owner asks. The dormant `TOTP_REQUIRED_ROLES` set names only retired roles and has no effect. Staff accounts are protected by Argon2id, lockout, per-client rate limits, re-authentication for `@Sensitive` actions and authentication audit events. |
| Invite acceptance / password reset | IMPLEMENTED (Phase 13) | `StaffAccountService` (`apps/api/src/modules/auth/staff-account.service.ts`). Inviting (`POST /admin/users`, `user.invite`, sensitive) emails a link; `POST /admin/users/:id/invitation` re-sends one. `POST /auth/staff/invitation/accept` sets the first password and activates the account; `POST /auth/staff/password/forgot` (always 202, same body, 3 per account per hour) and `POST /auth/staff/password/reset` reset it and **revoke every session**. Tokens: 32 random bytes in the link **after `#`** (never in a server log or Referer), stored as SHA-256 in `otp_codes` (`staff_invite` 7 days, `staff_password_reset` 1 hour), claimed atomically (single use), older tokens burned on re-issue, purposes not interchangeable. Password policy shared (`staffPasswordSchema`: ≥ 12, ≤ 128, known defaults refused). Audited (`auth.staff.invitation_sent` / `_accepted` / `_failed`, `password_reset_requested` / `_completed` / `_failed`; no token or password). The invitee chooses nothing but the password — the role is the inviting SUPER_ADMIN's choice. No TOTP. `must_change_password` is cleared by these flows but still not enforced at sign-in. The CLI scripts remain for the first administrator. |
| Donor email OTP | IMPLEMENTED | 6 digits (100000–999999), SHA-256 at rest, constant-time comparison (Phase 12), 10-minute TTL, 5 attempts, 3 per 15 minutes per email, single use, no enumeration. Codes are sent only to an address held on a donor account **or a live volunteer record** (Phase 12), so a volunteer who never donated can sign in; first sign-in opens the general account. **Remaining (low):** HMAC with a server key instead of a bare hash. |
| Session re-authentication (`@Sensitive`) | IMPLEMENTED | 5-minute `sessions.reauthenticated_at`. Re-auth does not check `locked_until`. |
| Logout / revocation | IMPLEMENTED | Revokes the whole token family. Suspending a user revokes their sessions. There is no "log out all devices" for donors. |

### Tokens and sessions
| Control | Status | Evidence / gap |
|---|---|---|
| Access JWT | IMPLEMENTED (Phase 12) | **HS256 only**: signed with an explicit `algorithm` and verified with `algorithms: ['HS256']`, so `none`, other HMAC sizes and algorithm confusion are refused (`token.service.ts`, `ACCESS_TOKEN_ALGORITHM`). Lifetime from `JWT_ACCESS_TTL` (15 min), claims `sub`/`aud`/`sid` only, per-audience key. The session row is checked on every request, so a revoked session's token stops working at once. Minor: a development fallback secret is used if `JWT_ACCESS_SECRET` is unset outside production (production requires it); `JWT_REFRESH_SECRET` is required in production but unused. |
| Refresh tokens | IMPLEMENTED (Phase 12) | Opaque, stored as SHA-256, rotated. Rotation is **atomic**: the old token is claimed with `UPDATE … WHERE revoked_at IS NULL RETURNING` in the same transaction as the new session, so two simultaneous refreshes cannot both succeed; the loser is treated as a replay — the family is revoked and `auth.refresh_reuse_detected` audited. |
| Cookies | IMPLEMENTED | httpOnly, `SameSite=Lax`, `Secure` in production, separate staff and donor cookies. Not signed or encrypted (the value holds tokens). Consider the `__Host-` prefix. |
| Refresh during server-component render | NEEDS REVIEW | `token-store.ts` cannot set cookies during a render. The API has already rotated the token, so the next use looks like reuse and revokes the family. Likely, not proven. |

### Authorization / RBAC
| Control | Status | Evidence / gap |
|---|---|---|
| Permission guard | IMPLEMENTED | `apps/api/src/common/guards/auth.guard.ts`. Permissions are resolved from the database on every request. 118 permissions (38 sensitive) as of Phase 13; new keys are inserted with their `SUPER_ADMIN` grant by migration (`0023`) so production needs no reference reseed. Integration tests use a real staff account with **no role** to prove refusals (`cms-communications.spec.ts`). |
| Separation of duties | **NEEDS REVIEW** | Only `SUPER_ADMIN` exists (migration `0014`). Every staff account can do everything, including finance exports. |
| Donor ownership (no IDOR) | IMPLEMENTED | `/me/*` scopes queries by `actor.id`. |
| Web-side checks | N/A | The web `can()` reads the cookie for UI gating only; the API enforces. |
| `story.archive` permission | IMPLEMENTED (Phase 13) | `StoriesService.setStatus` requires `story.archive` to archive a story AND to bring one out of the archive; `story.publish` remains the route's floor for publish/unpublish. The admin UI offers archive/restore only with the permission. Tested with a test-only role holding `story.publish` but not `story.archive`. |

### API protection
| Control | Status | Evidence / gap |
|---|---|---|
| Rate limiting | IMPLEMENTED (Phase 11, 2026-10-07) — needs deployment configuration | Redis-backed throttler keyed on the REAL client (`ClientThrottlerGuard`). The BFF and the rate-limited server actions (staff login, OTP request/verify, volunteer apply) send `x-sailent-client-ip` with `INTERNAL_API_SECRET` in `x-sailent-internal-auth`, and strip both from browser requests; the API believes the address only with the secret (timing-safe), never `X-Forwarded-For`, and otherwise falls back to `req.ip` (site-wide, as before). Trusted and direct keys use separate namespaces. Limits unchanged. **Until the web server's `CLIENT_IP_HEADER` and `INTERNAL_API_SECRET` are set at deployment, limits remain site-wide** (`DEPLOYMENT.md` §6a). Login and OTP are not yet keyed on email+IP as well (OTP keeps its per-email service limit). |
| Client IP for audit | IMPLEMENTED (Phase 12) | Every address recorded on a session, a sign-in code or an audit entry comes from `requestClientIp()` — the address the web server vouched for with `INTERNAL_API_SECRET`, otherwise the connecting address. The 18 controller copies that took `X-Forwarded-For`'s first entry are gone. |
| Brute force | PARTIAL | Lockout plus throttling, both weakened by the above. Add backoff or CAPTCHA, and alert on lockouts. |
| CORS | IMPLEMENTED | Allow-list via `CORS_ORIGINS`, with credentials. Allows the `Idempotency-Key` header, now used by `POST /donations` (Phase 11). |
| CSRF | IMPLEMENTED (Phase 12) | `SameSite=Lax` cookies, plus an Origin check on every POST/PATCH/PUT/DELETE through the BFF (`apps/web/src/lib/security/origin-check.ts`): allowed only from the request's own origin, `NEXT_PUBLIC_APP_URL` or `TRUSTED_ORIGINS`; without `Origin`, only with `Sec-Fetch-Site: same-origin`; otherwise 403 before any token is attached. Server actions keep Next.js's built-in Origin check. The API itself takes bearer tokens, not cookies; the Razorpay webhook and the worker call it directly. |
| Input validation | IMPLEMENTED | Zod on every route (422 with field details). Shared schemas live in `packages/validation`. Gap: no cap on a donation's total quantity value (custom amount is capped at ₹10L). |
| SQL injection | IMPLEMENTED | Drizzle parameterised queries; no `sql.raw`; sort allow-list. |
| Idempotency | IMPLEMENTED (Phase 11) | Webhook event-ID uniqueness (failed/pending events reprocessed on redelivery), conditional capture and cancellation, and the receipt job ID are idempotent. `POST /donations` accepts an optional `Idempotency-Key` (Redis, 30 min): same key and body → the same donation and order while unpaid; a different body → 422; in progress → 409; paid or cancelled → 409. Fails open (no idempotency) if Redis is down. |

### Output and browser security
| Control | Status | Evidence / gap |
|---|---|---|
| XSS — markdown | IMPLEMENTED | Blog markdown renders to React elements with no raw HTML; `safeUrl` allows only http, https and mailto. |
| XSS — JSON-LD | IMPLEMENTED (`ed69d41`) | `jsonLd()` escapes `<`, `>`, `&`, U+2028 and U+2029, so staff-authored content cannot close the `<script>`. |
| Email template output | IMPLEMENTED | `{{x}}` is HTML-escaped; raw output is allowed only per slug. |
| Security headers — API | IMPLEMENTED | helmet; HSTS in production; no CSP (JSON API). |
| Security headers — web | IMPLEMENTED (Phase 12) | `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy` (`payment` for this origin and Razorpay only, Phase 11), and a **Content-Security-Policy** (`apps/web/src/lib/security/content-security-policy.ts`): scripts from this origin and `checkout.razorpay.com` only, Razorpay frames, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri`/`form-action 'self'`, `upgrade-insecure-requests` in production. **HSTS** (2 years, subdomains, no preload) when built and started with `APP_ENV=production`. **Accepted limitation:** `script-src` keeps `'unsafe-inline'` for Next.js's inline hydration scripts — a nonce-based policy would force every page to render per request and end the public site's caching. External script injection is still blocked. Confirm Razorpay on a real device in the sandbox trial. |
| Error disclosure | PARTIAL | 5xx messages are masked only when `APP_ENV=production`; every other `APP_ENV` returns raw database errors. `/health/ready` returns raw error messages to anonymous callers. |

### Files and storage
| Control | Status | Evidence / gap |
|---|---|---|
| Upload validation | IMPLEMENTED | Magic-byte sniffing (`image-inspection.ts`, `document-inspection.ts`), size limits, random keys, and the sniffed content type is stored. |
| SVG | IMPLEMENTED | Refused. |
| Image metadata (EXIF / GPS) | IMPLEMENTED for new uploads (Phase 13) | `apps/api/src/modules/storage/strip-metadata.ts`, applied to every media upload and every image document before storage: JPEG APP1 (Exif, XMP), APP3–13, APP15 and comments; PNG `eXIf`/`tEXt`/`zTXt`/`iTXt`/`tIME`; WebP `EXIF`/`XMP` (VP8X flags and RIFF size fixed). Byte-level — no re-encode, no image library, no quality loss; ICC colour profiles kept; a non-default JPEG orientation is kept as a one-tag Exif block. Unparseable files are stored unchanged (already magic-byte checked). **Images uploaded before Phase 13 keep their metadata** until a human re-processes them (`DEPLOYMENT.md` §6c). |
| Document deletion | IMPLEMENTED (Phase 13) | `DELETE /admin/documents/:id`: `document.delete` (sensitive) + fresh re-authentication + a reason. Answers 404 for a document the caller may not read. Deletes the stored object FIRST (failure → 503, nothing changed), then the row; the audit entry keeps title, type and visibility. |
| Campaign / programme media | IMPLEMENTED (Phase 13) | A cover must be the URL of a PUBLIC media-library image; gallery items are added by `mediaId` only (the earlier raw-storage-key form, which bypassed upload validation, is gone), and a public item needs a public image. `campaign_gallery.manage` / `campaign.update` / `program.update`. |
| R2 permissions / signed URLs | IMPLEMENTED | Separate public and private buckets. Private access only via presigned GET (300–900s), permission-checked and audited. Credentials stay on the API only. **Improve:** set `Content-Disposition: attachment` on downloads. |

### Payments
| Control | Status | Evidence / gap |
|---|---|---|
| Server-side pricing | IMPLEMENTED | Prices come from the database; the client sends IDs and quantities only. |
| Checkout signature verification | IMPLEMENTED | HMAC-SHA256 with a timing-safe comparison, an order-ID match, and a re-fetch of the payment from Razorpay. Before any capture (browser, webhook or reconciliation) the fetched payment must belong to the donation's order, be `captured`, be in the donation's currency (INR) and match its amount (Phase 11 added the order and currency checks); a mismatch is refused and, from the webhook, flagged `needs_review`. |
| Webhook verification | IMPLEMENTED | HMAC over the raw body; deduplication on `provider_event_id`. An invalid signature gets **401** and nothing is stored (`e87864b`). Transient processing failures answer 503 and are reprocessed on redelivery; only `processed`, `ignored` and `needs_review` are terminal. The raw body (containing payer PII) is stored in `payment_webhooks`; the admin exceptions view shows identifiers only. |
| Capture integrity | IMPLEMENTED | Conditional status update, `FOR UPDATE` counters, and the receipt, all in one transaction. |
| Reconciliation | IMPLEMENTED (Phase 11) | Worker-scheduled job → internal API endpoint (shared secret). Pending donations older than 15 minutes are checked against Razorpay's order payments and captured through the normal path; unpaid ones are `cancelled` after 24 hours (never deleted, never a successful one); a late payment on a cancelled donation is still recorded. Read-only admin **Payment exceptions** view (`payment.read`; no write route, no "mark successful"). Needs the worker running with `INTERNAL_API_SECRET` (`DEPLOYMENT.md` §6a). |
| Orphan pending rows | IMPLEMENTED (Phase 11) | A donation whose Razorpay order was never created is cancelled by reconciliation after 24 hours. Checkout retries reuse the same pending donation and order instead of creating more. Limited-quantity holds still last 30 minutes. |

### Data protection
| Control | Status | Evidence / gap |
|---|---|---|
| PAN / tax ID at rest | IMPLEMENTED (Phase 12) | **AES-256-GCM** (Node `crypto`), random 96-bit IV per value, 128-bit tag, the column name bound as associated data; stored as `enc:v1:<iv>:<ciphertext>:<tag>` (`apps/api/src/common/security/field-encryption.service.ts`). Key: `FIELD_ENCRYPTION_KEY` (32 bytes), **required in production**, held only by the API; without it a PAN cannot be saved (503), never written as plaintext. Legacy plaintext values are still read and are encrypted on their next write. **No migration**: the column stays `text`. **Human-only:** generate, store and back up the key; re-encrypt any plaintext PANs already in production (none exist in the repository's data) — `DEPLOYMENT.md` §6b. Compatible with the local `donors_tax_id_encrypted` CHECK. |
| PAN exposure | IMPLEMENTED (Phase 12) | Lists, audit logs and CSV exports carry only `hasTaxId`. The donor's own `/me` returns `taxIdNumberMasked` (`XXXXXX234F`) and `hasTaxId`, never the number. Only staff holding `donor.read_sensitive` see the decrypted value (corrections, Form 10BD). The web profile form never pre-fills the number. |
| Donor email change | IMPLEMENTED (Phase 12) | `PATCH /me` no longer accepts `email`. `POST /me/email/change` sends a six-digit code to the NEW address (bound to the account and that address, 10 minutes, 5 attempts, 3 per 15 minutes); `POST /me/email/verify` applies it, normalised, and only then checks for a clash (409, no enumeration before ownership is proven). Audited (`donor.email_change_requested` / `_verified` / `_failed`). Guest checkout **attaches to an existing account without changing it** — name and phone are no longer overwritten. Staff corrections normalise the address and report a clash as 409. |
| PII in logs | PARTIAL | pino redaction in the API and worker. **Phase 14 fix:** the API logged the `x-sailent-internal-auth` header (the internal secret) and the `idempotency-key` header in clear on every web→API request; both are now redacted, and the worker also redacts `secret`, `confirmToken` and `unsubscribeToken` fields. Worker errors are logged through `describeError`, which masks tokens, keys, PANs and email addresses in the message. The worker no longer logs the recipient address when email is not configured (Phase 13). Notification rows for Phase 13 emails hold only record ids — never a token, link, address or message body. Gap: the raw `x-request-id`. |
| Contact form | IMPLEMENTED (Phase 13) | `POST /contact` (public, 5 per hour per client, honeypot, shared schema). Stored first (`contact_messages`), then emailed to the organisation by the worker (job carries the id only). Staff read it in Admin → Messages (`contact.read`), mark it handled/archived (`contact.manage`, audited); the sender's IP is kept for abuse handling and not shown. Email bodies are HTML-escaped. |
| Newsletter | IMPLEMENTED (Phase 13) | Double opt-in (`newsletter_subscribers`): `POST /newsletter/subscribe` (5/hour/client, honeypot) answers the same for new, pending and subscribed addresses and sends at most one confirmation per 10 minutes; confirm/unsubscribe are POSTs from a page that needs a click (mail scanners cannot act), tokens SHA-256 hashed, confirmation 48 h, unsubscribe idempotent. `newsletter.read` for the admin list. Nothing sends newsletters. |
| Public search | IMPLEMENTED (Phase 13) | `GET /search` returns only what the public pages show (each type's own published/visibility rule, in the query); LIKE wildcards escaped; 60/min per client. It replaced a browser search over development fixtures. |
| Admin PII masking | MISSING | Full email and phone are shown in the admin (acceptable for a single trusted role; review if roles are reintroduced). |

### Database and platform
| Control | Status | Evidence / gap |
|---|---|---|
| Supabase Data API lockdown | IMPLEMENTED | Migration `0004` revokes `anon` and `authenticated` access and enables RLS with no policies; migration `0017` asserts it schema-wide. There is no Supabase SDK in the code. Also disable the Data API in the Supabase dashboard. |
| App database role | NEEDS REVIEW | The app connects as the table owner, which bypasses RLS. Least privilege would use a separate runtime role. |
| Audit logging | PARTIAL | `AuditService.record` covers about 60 mutation actions, with key-based redaction, and since Phase 12 **authentication events**: `auth.staff.login_succeeded` / `login_failed` (reason: unknown account, wrong password, locked, inactive) / `locked`, `auth.staff.reauth_succeeded` / `reauth_failed`, `auth.donor.otp_verified` / `otp_failed` / `account_created`, `auth.logout`, `auth.refresh_reuse_detected`, and the email-change events. No password, code, token or PAN is recorded; an attempt on an address with no account is recorded as a 16-character hash of the address, not the address. Addresses come from `requestClientIp()`. **Not tamper-proof:** no REVOKE or trigger, and writes fail open. **Remaining:** REVOKE UPDATE/DELETE from a runtime role. |
| Environment validation | IMPLEMENTED (Phase 12) | **API** refuses production without `JWT_*`, `RAZORPAY_*` (live key), `R2_*`, `INTERNAL_API_SECRET`, a valid 32-byte `FIELD_ENCRYPTION_KEY`, and with Swagger, insecure TLS or mock data on. **Worker** refuses production without `API_INTERNAL_URL`, `INTERNAL_API_SECRET` and an https, non-localhost `APP_PUBLIC_URL`. **Web** now validates `webEnvSchema` at startup (`apps/web/src/instrumentation.ts`) and refuses production with `FEATURE_MOCK_DATA` on, without `INTERNAL_API_SECRET` or `CLIENT_IP_HEADER`, with a non-https/localhost `NEXT_PUBLIC_APP_URL`, or while `lib/demo-org.ts` is still DEMO data. Demo fixtures are never served when `APP_ENV=production`, and `0`/`false` both turn them off (`lib/runtime-flags.ts`). |
| Secrets in the repository | IMPLEMENTED | `.env` is gitignored; gitleaks runs in CI. Only the variable names are documented. |
| Dependency scanning | PARTIAL (Phase 14 review) | `pnpm audit --prod --audit-level high` in CI. **Production dependencies, 2026-10-07: 30 advisories (15 high) reduced to 4** with `pnpm.overrides` in the root `package.json` (multer, body-parser 1.x, qs, lodash, js-yaml under @nestjs/swagger, sharp, postcss under next, source-map-js) — patch/minor versions of transitive packages; the full test suites pass on them. **Remaining (each needs a major upgrade, owner decision):** `drizzle-orm` 0.38 (**high**, SQL identifier escaping — our identifiers are code-defined, and `sql.raw` appears only in the CLI `harden.ts`; fix is ≥ 0.45.2); `file-type` via Nest 10 (2 moderate; reached only by Nest's `FileTypeValidator`, which the code does not use — uploads are checked by their magic bytes in the storage and media services); `@nestjs/core` 10 (moderate; fixed in Nest 11). **CI's audit job will keep failing on the drizzle advisory until it is upgraded.** **Development-only tooling (not in any image), 23 more:** vitest 2 / tinypool / @vitest/mocker / vite / esbuild (incl. critical advisories that apply to the Vitest UI server, which is never run), @nestjs/cli 10 and its glob/picomatch/braces/tmp/ajv/webpack, drizzle-kit's shell-quote, and the React Query devtools' seroval. Fixing them means vitest 3+, Nest CLI 11 and a newer drizzle-kit. Add Dependabot or Renovate. Remove the stray `package-lock.json`. |
| Database target guards | IMPLEMENTED | Scripts need `--target`/`--confirm-host`; `assertRuntimeDatabaseTarget` runs at app start. **Gap:** the seed's demo-data gate checks only `APP_ENV`/`NODE_ENV`, **not** `--target`. `db:seed --target=production` with `APP_ENV=development` would write demo data and published-password accounts (`DEPLOYMENT.md` §10). Make the demo gate refuse `--target=production`. |
| Production database access by agents | IMPLEMENTED (policy) | Permanent rule: agents never connect to, migrate, seed or modify production (`AGENTS.md` §8). This is a process rule, not a technical control. |
| Production database residue | **NEEDS REVIEW (HIGH)** | `docs/phase-8.md` (§12.3, §14.6, §16.1) records `@sailent.local` accounts with **published credentials**, test accounts, test donors and a password incident on the hosted Supabase project. That doc calls the project "staging"; it is production (owner, 2026-10-06). `db:harden` was not run. **Fix (human only):** verify the accounts and data; run `db:harden --confirm` with approval; create a real admin; remove the test residue through the approved process. |
| Container images | IMPLEMENTED (Phase 14; **not yet built** — Docker is not installed where this was written) | `apps/{api,worker,web}/Dockerfile`: multi-stage, production dependencies only, run as the unprivileged `node` user, no `.env`/secret/key copied or baked (`.dockerignore` excludes `.env*`, `*.pem`, `*.key`, `.git`), never migrate or seed, exec-form `CMD` so SIGTERM reaches Node. `pnpm check:deploy` enforces these rules on every change. Only the Supabase **CA certificate** (public) is in the API and worker images. The local compose file still uses default credentials on 0.0.0.0; bind it to 127.0.0.1. |
| Cloud Run | PREPARED (Phase 14), **not deployed** | Templates in `infrastructure/cloud-run/`: every secret is a Secret Manager `secretKeyRef`, never a literal; one service account per service, `secretAccessor` only on its own secrets (R2 and Razorpay credentials reach the API alone); the worker has **internal** ingress; Redis is reached only over a private VPC; no project id, credential or connection string in the repository (`pnpm check:deploy` fails otherwise). Cloud Build builds and pushes images and has **no deploy step**. Procedure and rotation: `DEPLOYMENT.md` §12–§16. |
| Health endpoints | IMPLEMENTED (Phase 14) | API `/api/v1/health/ready` and worker `/ready` report only `ok` / `degraded` / `unavailable` per dependency — never an error message, host, driver or version string (the API used to return the raw error text). 2 s timeout per check and a 5 s cache, so the public readiness endpoint cannot be used to load the database. Liveness checks no dependency. |
| Error tracking | IMPLEMENTED (Phase 14), off unless `SENTRY_DSN` is set | A dependency-free, Sentry-compatible reporter (`packages/config/src/error-reporter.ts`). Every event passes `scrubErrorEvent`: request body, cookies, query string, `user` and breadcrumbs dropped; only `user-agent`, `content-type`, `accept`, `x-request-id` headers kept; values under secret-like keys (password, token, secret, otp, signature, PAN/tax id, card, api key, email, phone, ip…) replaced; JWTs, bearer tokens, Razorpay keys, PANs and email addresses masked inside any string, exception messages included. 30 events per minute per process; sending never throws or blocks a request. **Server-side only** — no DSN in the browser, no CSP change. Why not `@sentry/node`: it duplicated `drizzle-orm` through an optional OpenTelemetry peer (breaking the API's types) and captures request bodies and IPs unless each integration is switched off. Unit-tested (41 tests). |
| Analytics (GA4) | NOT WIRED (Phase 14 decision) | No analytics script is loaded. **Discrepancy for Phase 15 (legal):** the privacy policy describes consent-based analytics, but no consent mechanism exists. Wiring GA4 needs a consent banner, a CSP change and that review. |
| Media URL | IMPLEMENTED (Phase 14) | `MEDIA_PUBLIC_BASE_URL` (web) and `R2_PUBLIC_BASE_URL` (API) must, in production, be `https`, not loopback, with no credentials, query or fragment; the web turns it into ONE exact `images.remotePatterns` host — no wildcard — and the build fails on an invalid value (`apps/web/src/lib/security/media-remote-patterns.ts`). |
| Production configuration | NEEDS REVIEW | The production database exists; its schema version, accounts and settings are unverified (as of 2026-10-06). The application is not deployed; the runtime configuration is specified per service in `DEPLOYMENT.md` §15 but exists nowhere yet. |

## 3. Rules for contributors (mandatory)

1. Never commit or print secrets. Document variable **names** only.
2. Every new staff endpoint gets `@RequirePermission(...)`. Destructive, financial, PII-revealing or permission-changing endpoints also get `@Sensitive()` and an `AuditService.record` call.
3. Every new public endpoint gets `@Public()` explicitly, a Zod schema and a sensible throttle.
4. Never trust client prices, amounts, statuses or identities.
5. Never write raw HTML from data. Escape anything placed in `<script>` or attributes.
6. New uploads must sniff magic bytes and stay inside the existing allow-list. SVG stays refused.
7. New PII fields must be added to the pino redact lists and the audit redaction.
8. Payment changes need tests for: a forged signature, an amount mismatch, a duplicate webhook, a closed or ended campaign, and concurrent capture.
9. Migrations: enable RLS on new tables, add no policies (the app does not use them), and never edit an applied migration.

## 4. Incident response basics

1. **Contain.**
   - Rotate the affected secret: the JWT secret (this invalidates all sessions), the Razorpay key or webhook secret, the R2 keys, the Brevo key, or the database password.
   - Revoke sessions by suspending the user, or bulk-revoke the `sessions` rows.
2. **Preserve evidence:** `audit_logs`, `payment_webhooks`, `payment_transactions` and the API logs (by request ID).
3. **Assess** the donor PII affected (email, phone, PAN). Indian law (DPDP Act) may require notification.
4. **Payments:** reconcile against the Razorpay dashboard before changing any donation row.
5. **Record** the incident and the fix in `CHANGELOG.md` and `DEVELOPMENT_STATUS.md`.

## 5. Pre-release security checklist

- [ ] `FEATURE_MOCK_DATA=false` everywhere — the web now validates its environment at boot and refuses production otherwise (Phase 12); set the variables at deployment.
- [x] Rate limits key on the real client IP (Phase 11; set `CLIENT_IP_HEADER` and `INTERNAL_API_SECRET` at deployment).
- [x] ~~Staff 2FA~~ — **not required, by owner decision** (2026-10-07).
- [ ] PAN encryption is implemented (Phase 12); **set `FIELD_ENCRYPTION_KEY` and re-encrypt any existing plaintext PANs in production (human).** Email-change verification and the donor-overwrite fix are in (Phase 12).
- [x] JSON-LD is escaped (`ed69d41`); a CSP is on the web app, and HSTS when started with `APP_ENV=production` (Phase 12).
- [x] A forged webhook returns 401 (`e87864b`); currency and order are checked before capture (Phase 11).
- [ ] A reconciliation job and expiry of stuck pending donations exist — implemented in Phase 11; **running in production needs the worker deployed with `API_INTERNAL_URL` and `INTERNAL_API_SECRET`** (`DEPLOYMENT.md` §6a).
- [ ] Rate limits are per client in production: `INTERNAL_API_SECRET` and `CLIENT_IP_HEADER` set on the web server (Phase 11 code; deployment configuration pending).
- [ ] A human has verified the production database: its schema version against the repo journal, and that no `@sailent.local` accounts with published credentials, `*@sailent.test` test accounts or `DNR-E2E` donors remain. `db:harden --confirm` has run, and a real administrator exists.
- [ ] The demo seed has never run on production, and the seed's demo gate refuses `--target=production`.
- [ ] `JWT_*`, `RAZORPAY_*`, `R2_*` and `BREVO_*` are set as platform secrets; Swagger is off; `DATABASE_INSECURE_TLS=false`.
- [ ] The Supabase Data API is disabled and RLS is confirmed on every table.
- [ ] `pnpm audit --prod` is clean at high severity (one high remains: drizzle-orm, needs the 0.45 upgrade — Phase 14); gitleaks is clean.
- [ ] Every secret is in Secret Manager, one service account per Cloud Run service with access to its own secrets only, and nothing secret in a `value:` field or build argument (`DEPLOYMENT.md` §16).
- [ ] `FIELD_ENCRYPTION_KEY` has an offline copy the owner controls; database backups (and, ideally, PITR) are on and a restore has been rehearsed (`DEPLOYMENT.md` §19).
- [ ] The worker is deployed with internal ingress; Memorystore is private-IP only with AUTH and in-transit encryption.
- [ ] Uptime checks and error alerts exist (`DEPLOYMENT.md` §17). If `SENTRY_DSN` is set, a test error shows no body, cookie, token or email in Sentry.
- [ ] The refund and cancellation policy page required by Razorpay is published.
- [ ] Real organisation registration and contact details are entered in Admin → Settings (Phase 13; the DEMO values in `lib/demo-org.ts` are never shown in production — a blank detail is simply left out).
- [ ] Migration `0023` is applied to production by a human (contact messages, newsletter, organisation settings rows, Phase 13 permissions).
- [ ] Images uploaded before Phase 13 have been re-processed to remove EXIF/GPS, or confirmed to carry none (human, `DEPLOYMENT.md` §6c).
