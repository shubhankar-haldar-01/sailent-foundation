# SECURITY.md — security policy and control status

Permanent security policy for the Sailent Foundation platform. Each control's status was verified against the code on **2026-10-06** (a snapshot; re-verify before relying on a status). Status key: **IMPLEMENTED · PARTIAL · MISSING · NEEDS REVIEW · N/A**.

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
| Staff 2FA (TOTP) | **MISSING (in effect)** | `TOTP_REQUIRED_ROLES` = {ADMIN, FINANCE_MANAGER}, roles deleted by migration `0014`. No enrolment route. **Fix:** build enrolment and recovery codes, and require them for `SUPER_ADMIN`. |
| Invite acceptance / password reset | MISSING | No API route. Admins are created only via `db:create-admin` / `db:rotate-admin-password`. `must_change_password` is never read. |
| Donor email OTP | IMPLEMENTED | 6 digits, unsalted SHA-256 at rest, 10-minute TTL, 5 attempts, 3 per 15 minutes per email, single use, no enumeration. **Fix (low):** HMAC with a server key; constant-time compare. |
| Session re-authentication (`@Sensitive`) | IMPLEMENTED | 5-minute `sessions.reauthenticated_at`. Re-auth does not check `locked_until`. |
| Logout / revocation | IMPLEMENTED | Revokes the whole token family. Suspending a user revokes their sessions. There is no "log out all devices" for donors. |

### Tokens and sessions
| Control | Status | Evidence / gap |
|---|---|---|
| Access JWT | PARTIAL | HS256, 15 minutes, claims `sub`/`aud`/`sid` only, per-audience key. **Gaps:** no `algorithms` pin in `jwt.verify`; a development fallback secret is used if the variable is unset outside production; `JWT_REFRESH_SECRET` is required in production but never used. |
| Refresh tokens | PARTIAL | Opaque, stored as SHA-256, rotated, reuse revokes the family. **Gap:** rotation is a non-atomic select-then-update. **Fix:** `UPDATE … WHERE revoked_at IS NULL RETURNING`. |
| Cookies | IMPLEMENTED | httpOnly, `SameSite=Lax`, `Secure` in production, separate staff and donor cookies. Not signed or encrypted (the value holds tokens). Consider the `__Host-` prefix. |
| Refresh during server-component render | NEEDS REVIEW | `token-store.ts` cannot set cookies during a render. The API has already rotated the token, so the next use looks like reuse and revokes the family. Likely, not proven. |

### Authorization / RBAC
| Control | Status | Evidence / gap |
|---|---|---|
| Permission guard | IMPLEMENTED | `apps/api/src/common/guards/auth.guard.ts`. Permissions are resolved from the database on every request. 112 permissions (37 sensitive). |
| Separation of duties | **NEEDS REVIEW** | Only `SUPER_ADMIN` exists (migration `0014`). Every staff account can do everything, including finance exports. |
| Donor ownership (no IDOR) | IMPLEMENTED | `/me/*` scopes queries by `actor.id`. |
| Web-side checks | N/A | The web `can()` reads the cookie for UI gating only; the API enforces. |
| `story.archive` permission | MISSING | Seeded but never enforced. |

### API protection
| Control | Status | Evidence / gap |
|---|---|---|
| Rate limiting | **NEEDS REVIEW (HIGH)** | Redis-backed throttler, but it keys on `req.ip`. All traffic arrives via the Next.js BFF and server actions with no forwarded client IP, so **every limit is site-wide**: staff login 5/min, OTP request 3/15 min. **Fix:** the BFF sets a trusted client-IP header and strips the client's own; the API sets `trust proxy` and a custom `getTracker`; key login and OTP on email+IP. |
| Client IP for audit | NEEDS REVIEW | `clientIp()` trusts `X-Forwarded-For` unconditionally, so it is spoofable. |
| Brute force | PARTIAL | Lockout plus throttling, both weakened by the above. Add backoff or CAPTCHA, and alert on lockouts. |
| CORS | IMPLEMENTED | Allow-list via `CORS_ORIGINS`, with credentials. It allows an `Idempotency-Key` header that nothing implements. |
| CSRF | PARTIAL | `SameSite=Lax` only. The BFF has no Origin / `Sec-Fetch-Site` check; server actions get Next.js's built-in Origin check. **Fix:** check Origin on non-GET requests in the BFF. |
| Input validation | IMPLEMENTED | Zod on every route (422 with field details). Shared schemas live in `packages/validation`. Gap: no cap on a donation's total quantity value (custom amount is capped at ₹10L). |
| SQL injection | IMPLEMENTED | Drizzle parameterised queries; no `sql.raw`; sort allow-list. |
| Idempotency | PARTIAL | Webhook event-ID uniqueness, conditional capture, and the receipt job ID are idempotent. **Missing:** an `Idempotency-Key` on `POST /donations`. |

### Output and browser security
| Control | Status | Evidence / gap |
|---|---|---|
| XSS — markdown | IMPLEMENTED | Blog markdown renders to React elements with no raw HTML; `safeUrl` allows only http, https and mailto. |
| XSS — JSON-LD | **MISSING (HIGH)** | `jsonLd()` (`apps/web/src/lib/seo/structured-data.ts`) is a bare `JSON.stringify` written into `<script>` via `dangerouslySetInnerHTML`. Staff-authored content can break out of the tag. **Fix:** escape `<`, `>`, `&`, U+2028 and U+2029. |
| Email template output | IMPLEMENTED | `{{x}}` is HTML-escaped; raw output is allowed only per slug. |
| Security headers — API | IMPLEMENTED | helmet; HSTS in production; no CSP (JSON API). |
| Security headers — web | PARTIAL | `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`. **No CSP, no HSTS.** **Fix:** a nonce-based CSP that allows `checkout.razorpay.com`, plus HSTS. Also check that `payment=()` does not break Razorpay. |
| Error disclosure | PARTIAL | 5xx messages are masked only when `APP_ENV=production`; every other `APP_ENV` returns raw database errors. `/health/ready` returns raw error messages to anonymous callers. |

### Files and storage
| Control | Status | Evidence / gap |
|---|---|---|
| Upload validation | IMPLEMENTED | Magic-byte sniffing (`image-inspection.ts`, `document-inspection.ts`), size limits, random keys, and the sniffed content type is stored. |
| SVG | IMPLEMENTED | Refused. |
| Image re-encoding / EXIF strip | MISSING | GPS metadata survives. **Fix:** re-encode with sharp and strip metadata. |
| R2 permissions / signed URLs | IMPLEMENTED | Separate public and private buckets. Private access only via presigned GET (300–900s), permission-checked and audited. Credentials stay on the API only. **Improve:** set `Content-Disposition: attachment` on downloads. |

### Payments
| Control | Status | Evidence / gap |
|---|---|---|
| Server-side pricing | IMPLEMENTED | Prices come from the database; the client sends IDs and quantities only. |
| Checkout signature verification | IMPLEMENTED | HMAC-SHA256 with a timing-safe comparison, an order-ID match, and a re-fetch of the payment from Razorpay (must be `captured`, and the amount must equal the database amount). **Gap:** the currency is not compared. |
| Webhook verification | PARTIAL | HMAC over the raw body; deduplication on `provider_event_id`. **Gap:** an invalid signature returns HTTP 200 `{status:'rejected'}`. **Fix:** return 401. The raw body (containing payer PII) is stored in `payment_webhooks`. |
| Capture integrity | IMPLEMENTED | Conditional status update, `FOR UPDATE` counters, and the receipt, all in one transaction. |
| Reconciliation | MISSING | Read-only report only. No sweep; `cancelled` is never written; pending donations never expire. |
| Orphan pending rows | NEEDS REVIEW | The donation commits before the Razorpay order is created. If the order fails (including when Razorpay keys are missing locally: HTTP 503), the row is left pending, and any limited-quantity products in it stay held for 30 minutes (`DEPLOYMENT.md` §6). |

### Data protection
| Control | Status | Evidence / gap |
|---|---|---|
| PAN / tax ID at rest | **MISSING (HIGH)** | Stored in plaintext (`me.service.ts`, admin donors). `FIELD_ENCRYPTION_KEY` is never read, although the docs claim AES-256-GCM. The local databases carry an unexplained `donors_tax_id_encrypted` CHECK (`DEVELOPMENT_STATUS.md` §5.1). **Fix:** implement `enc:`-prefixed AES-GCM encryption and commit a migration that matches. |
| PAN exposure | PARTIAL | Lists, audit logs and CSV exports carry only `hasTaxId`. The donor's own `/me` returns the raw value. |
| Donor email change | **MISSING (HIGH)** | `PATCH /me` changes the email with no verification. Guest donations attach by email, so a donor can claim someone else's future donations. A guest donation can also overwrite an existing donor's name and phone. **Fix:** verify the new email by OTP, and do not overwrite profile fields from guest checkouts. |
| PII in logs | PARTIAL | pino redaction in the API and worker. Gaps: the worker's string `to` email; the raw `x-request-id`. |
| Admin PII masking | MISSING | Full email and phone are shown in the admin (acceptable for a single trusted role; review if roles are reintroduced). |

### Database and platform
| Control | Status | Evidence / gap |
|---|---|---|
| Supabase Data API lockdown | IMPLEMENTED | Migration `0004` revokes `anon` and `authenticated` access and enables RLS with no policies; migration `0017` asserts it schema-wide. There is no Supabase SDK in the code. Also disable the Data API in the Supabase dashboard. |
| App database role | NEEDS REVIEW | The app connects as the table owner, which bypasses RLS. Least privilege would use a separate runtime role. |
| Audit logging | PARTIAL | `AuditService.record` covers about 60 mutation actions, with key-based redaction. **Not audited:** logins, failures, lockouts, token reuse, re-auth. **Not tamper-proof:** no REVOKE or trigger, and writes fail open. **Fix:** audit authentication events; REVOKE UPDATE/DELETE from the runtime role. |
| Environment validation | PARTIAL | `apiEnvSchema` refuses unsafe production settings (Swagger, insecure TLS, mock data). **`webEnvSchema` is never loaded**, and the web treats an unset `FEATURE_MOCK_DATA` as **ON** (`apps/web/src/lib/content/source.ts`, `lib/mock/index.ts`). **Fix:** load `webEnvSchema` at boot; make mock data opt-in. |
| Secrets in the repository | IMPLEMENTED | `.env` is gitignored; gitleaks runs in CI. Only the variable names are documented. |
| Dependency scanning | IMPLEMENTED | `pnpm audit --prod --audit-level high` in CI. Add Dependabot or Renovate. Remove the stray `package-lock.json`. |
| Database target guards | IMPLEMENTED | Scripts need `--target`/`--confirm-host`; `assertRuntimeDatabaseTarget` runs at app start. **Gap:** the seed's demo-data gate checks only `APP_ENV`/`NODE_ENV`, **not** `--target`. `db:seed --target=production` with `APP_ENV=development` would write demo data and published-password accounts (`DEPLOYMENT.md` §10). Make the demo gate refuse `--target=production`. |
| Production database access by agents | IMPLEMENTED (policy) | Permanent rule: agents never connect to, migrate, seed or modify production (`AGENTS.md` §8). This is a process rule, not a technical control. |
| Production database residue | **NEEDS REVIEW (HIGH)** | `docs/phase-8.md` (§12.3, §14.6, §16.1) records `@sailent.local` accounts with **published credentials**, test accounts, test donors and a password incident on the hosted Supabase project. That doc calls the project "staging"; it is production (owner, 2026-10-06). `db:harden` was not run. **Fix (human only):** verify the accounts and data; run `db:harden --confirm` with approval; create a real admin; remove the test residue through the approved process. |
| Docker | N/A / NEEDS REVIEW | There are no application images. The local compose file uses default credentials on 0.0.0.0; bind it to 127.0.0.1. |
| Cloud Run | N/A | Not used or configured anywhere. |
| Production configuration | NEEDS REVIEW | The production database exists; its schema version, accounts and settings are unverified (as of 2026-10-06). The application is not deployed, so there is no production runtime configuration yet. |

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

- [ ] `FEATURE_MOCK_DATA=false` everywhere; the web validates its environment at boot.
- [ ] Rate limits key on the real client IP; `trust proxy` is configured.
- [ ] Staff 2FA is enforced for every staff account.
- [ ] PAN encryption is implemented and migrated; the email-change verification and donor-overwrite fixes are in.
- [ ] JSON-LD is escaped; a CSP and HSTS are on the web app.
- [ ] A forged webhook returns 401; currency is checked on verify.
- [ ] A reconciliation job and expiry of stuck pending donations exist.
- [ ] A human has verified the production database: its schema version against the repo journal, and that no `@sailent.local` accounts with published credentials, `*@sailent.test` test accounts or `DNR-E2E` donors remain. `db:harden --confirm` has run, and a real administrator exists.
- [ ] The demo seed has never run on production, and the seed's demo gate refuses `--target=production`.
- [ ] `JWT_*`, `RAZORPAY_*`, `R2_*` and `BREVO_*` are set as platform secrets; Swagger is off; `DATABASE_INSECURE_TLS=false`.
- [ ] The Supabase Data API is disabled and RLS is confirmed on every table.
- [ ] `pnpm audit` is clean at high severity; gitleaks is clean.
- [ ] The refund and cancellation policy page required by Razorpay is published.
- [ ] Real organisation registration data has replaced the DEMO values.
