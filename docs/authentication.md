# Authentication

How sessions are established, proved, rotated and revoked.

Design rationale: [`security-architecture.md`](security-architecture.md) and decision A8 in [`phase-0-decisions.md`](phase-0-decisions.md). This document is what was actually built.

---

## 1. Two audiences that cannot be interchanged

Donors and staff authenticate differently, hold different tokens, and cannot use each other's.

| | Donor | Staff |
|---|---|---|
| Identity | Email | Email |
| Credential | One-time code by email | Password (Argon2id) |
| Second factor | — | **None.** Removed — see §2.1 |
| Permissions | None | Resolved from the database, per request |
| Access token life | 15 minutes | 15 minutes |
| Refresh token life | 30 days | 7 days |

### A public session no longer requires a donation

The OTP endpoint used to refuse an address with no donations recorded against
it. That was right while the only reason to hold a public account was to see
your own giving; it is wrong the moment somebody volunteers and has never
given money, which is most volunteers. Phase 8 removed the refusal, and
verifying a code for an unknown address opens an account.

So **anybody who can receive mail at an address can obtain a public session.**
That session carries no permissions, and the audience separation below is what
makes that safe: it is not that a donor token lacks the rights for an admin
route, it is that a donor token does not verify there at all.

The separation is enforced in the signing key, not only in a claim:

```ts
private secretFor(audience: TokenAudience): string {
  const base = this.config.env.JWT_ACCESS_SECRET ?? '…';
  return createHash('sha256').update(`${base}:${audience}`).digest('hex');
}
```

A donor token presented to a staff route therefore does not merely fail an audience check — it **fails signature verification**. There is no code path where a donor token is a valid staff token with the wrong claim.

Staff refresh tokens expire sooner because staff can move money.

---

## 2. Staff sign-in

```
POST /auth/staff/login
{ "email": "…", "password": "…", "totpCode": "123456" }
```

The order of checks is deliberate:

1. **Look up the user.** If there is none, verify the password against a dummy Argon2 hash anyway and return the same error. An unknown email and a wrong password produce an identical response and an identical response *time* — otherwise the login endpoint is a staff-account enumeration oracle.
2. **Lockout.** Five failed attempts locks the account for fifteen minutes.
3. **Status** is checked *after* the password, so the error cannot be used to discover which accounts exist and are suspended.
4. **Password**, Argon2id, 64 MB / t=3 / p=4 — roughly 100 ms on the deployment target.
5. **Second factor**, where the role requires one.

### TOTP is mandatory, not encouraged

```ts
const TOTP_REQUIRED_ROLES = new Set(['ADMIN', 'FINANCE_MANAGER']);
```

**`SUPER_ADMIN` is not in that set, so in the running system no role requires a
second factor.** Both remaining keys name roles that Phase 8 retired; they stay
only so a database restored from before Phase 8 still behaves.

### Why it was removed

Phase 8 collapsed six staff roles into one and, as a side effect nobody chose,
made TOTP mandatory for every staff account. That turned out to be a deadlock
rather than a hardening.

**There is no TOTP enrolment route in this application.** `totpSecret` is
excluded by construction from every user DTO, the invite flow creates an
account with an unusable password and no way to set one, and the only writer of
the column is the development seed. So the only accounts that could sign in
were the seeded ones — whose secret is the RFC 6238 test vector and whose
password is printed in `database-development.md` — and a real administrator
could not be created at all.

A factor that cannot be enrolled is an outage with a security-shaped
explanation.

### What defends a staff account now

All pre-existing, all still in place: Argon2id hashing, five login attempts per
minute per address (shared across instances via Redis), account lockout after
five failures, uniform failure messages that do not reveal whether an account
exists, and re-authentication within a five-minute window before any
`@Sensitive()` operation.

> **One consequence worth stating.** An account that *has* a secret enrolled —
> the six seeded ones do — no longer has it verified, because `needsTotp` gates
> the whole check. Those accounts are being retired. If a second factor is
> wanted again, **build enrolment first**, then put a role back in the set.

`TotpService` and its RFC test vectors are untouched.

A wrong TOTP code increments the same lockout counter as a wrong password. Otherwise the six-digit space could be brute-forced once a password was known.

`TotpService` implements RFC 6238 on `node:crypto` alone — about thirty lines of well-specified HMAC, and a dependency for that is a supply-chain surface bought for nothing. It is tested against the RFC's own published vectors rather than against its own output: an implementation that is self-consistently wrong passes every round-trip test and fails against every real authenticator app.

Codes are compared with `timingSafeEqual`, and one 30-second window of clock drift is accepted in each direction. Two windows is not: a code from two minutes ago is either a replay or a badly broken clock.

---

## 3. Donor sign-in

```
POST /auth/donor/otp/request   { "email": "asha@example.com" }
POST /auth/donor/otp/verify    { "email": "asha@example.com", "code": "123456" }
```

The request endpoint **always returns `{ sent: true }`**, whether or not the address belongs to a known donor. Anything else makes it a donor-enumeration oracle — a way to discover who has given, which is exactly what a donor expects to stay private.

Codes are stored as a SHA-256 hash, expire in ten minutes, burn after five failed attempts, and are consumed immediately on first success whatever happens next.

Two independent caps, because they stop different attacks:

- **Per IP**, by the HTTP throttler: 3 requests per 15 minutes.
- **Per email address**, in the service: 3 codes per 15 minutes. The IP limit does nothing against a distributed attempt to flood one person's inbox. The address is normalised (trimmed, lower-cased) before it is counted, so a capital letter does not buy a fresh allowance.

**Superseded in Phase 8.** A donor record used to be created only by a
donation, and a valid code for an address with no giving history was refused —
"we could not find a donation recorded against that address". Volunteers
broke that assumption: most have never given money, and they need the same
session. Verifying a code for an unknown address now opens an account. See
§2.1 above.

Codes go out by email through Brevo. In development they are logged instead;
that branch cannot run in production, because the config schema refuses to
boot with `FEATURE_MOCK_DATA` enabled there.

---

## 4. Sessions, rotation and reuse detection

Access tokens are JWTs carrying `sub`, `aud` and `sid` — **and no permission
list**. Permissions are resolved from the database on each request, so
revoking one takes effect immediately rather than when the token expires; see
[`rbac-implementation.md`](rbac-implementation.md) §7.2 for how the single-role
migration forced that change. Refresh tokens are **opaque random strings, not JWTs**, and only their SHA-256 is stored — a leaked database cannot be used to mint sessions.

Every request re-checks that the session row still exists and is not revoked. A revoked session invalidates its access token **immediately**, not at expiry, which is what makes "remove this person's access now" actually mean now.

### Rotation

```
POST /auth/refresh   { "refreshToken": "…" }
```

The presented token is revoked and a new one issued in the same family. Permissions are **re-resolved on every refresh**, never carried forward, so a role change takes effect without waiting for the user to log out.

### Reuse detection

Presenting a token that has already been rotated means either theft or a race. Either way **the entire family is revoked** — including the token that legitimately replaced it, which logs the real user out too. That is deliberate: a forced re-login is a small cost, and leaving a thief with a working session is not.

Verified end to end in `test/auth.spec.ts`:

```
rotate(A) → B                      200
replay(A) → reuse detected         401   family revoked
use(B)    → also dead              401
```

---

## 5. Re-authentication for sensitive operations

Some operations need proof that the person at the keyboard is still the account holder — not that a session exists, but that whoever holds it can still produce the credential.

```
POST /auth/reauth   { "password": "…", "totpCode": "123456" }
```

On success, `sessions.reauthenticated_at` is stamped and a **five-minute window** opens. Routes marked `@Sensitive()` refuse with `REAUTH_REQUIRED` until it is.

Four details that matter:

- The **same factors** as the original login are required. A re-auth weaker than the sign-in would be a downgrade attack.
- The stamp lives on the **session**, not the user, so a second older session belonging to the same person does not inherit the freshness.
- Freshness is read **from the session row on every request**, never from the token. A claim baked in at login could not be revoked and could be replayed for the life of the token.
- It **survives refresh-token rotation**. Refreshing is not itself a re-authentication, but neither does it undo one — the window still runs from the moment the password was actually re-entered.

A failed attempt never extends an existing window, and counts against the lockout.

`/auth/me` returns `reauthenticatedAt` so the admin UI can prompt for a password *before* someone fills in a donor export form rather than after. That is a courtesy; the API rechecks freshness on every sensitive call regardless of what the client believes.

---

## 6. Rate limits

| Endpoint | Limit |
|---|---|
| `POST /auth/staff/login` | 5 / minute |
| `POST /auth/reauth` | 5 / minute |
| `POST /auth/donor/otp/request` | 3 / 15 min (plus 3 / 15 min per email address) |
| `POST /auth/donor/otp/verify` | 10 / 15 min |
| Everything else | 100 / minute |

The login limit is per endpoint as well as per account, so spraying one password across many accounts is throttled too — the attack that per-account limits miss entirely.

Memory-backed for now; Phase 5 moves it to Redis so the limit holds across API instances rather than per process.

---

## 7. What is never returned, and never logged

**Never in a response:** password hashes, TOTP secrets, backup codes, OTP codes, session token hashes.

Enforced structurally rather than by filtering — `UsersService` projects a `PUBLIC_USER_COLUMNS` constant that does not contain them, so there is no shape for a secret to travel in. `test/rbac.spec.ts` asserts that no response from the users API matches `/\$argon2/` or contains `totpSecret`.

**Never in a log:** the same list, plus donor email, phone and PAN. Redaction is declared once, in `app.module.ts`.

**Never in the audit log:** the same list again, redacted at write time from a central key list, recursively — so a nested diff cannot smuggle a hash through.

---

## 8. Development credentials

Password `DevPassword123!` for every seeded account; TOTP secret `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP` for the two that require a second factor.

```bash
pnpm --filter @sailent/api totp:dev     # prints the current code
```

Published on purpose. It is safe precisely because the development seed tier **cannot run in production**, and it saves every developer enrolling a device.

---

## 9. Still to come

| Phase | What |
|---|---|
| 4 | ~~Real SMS delivery~~ (no longer needed — donor codes go by email); staff invitation and password-reset email; TOTP enrolment UI and backup codes |
| 5 | Redis-backed rate limiting; session management UI ("sign out everywhere") |
| 6 | Donor dashboard session handling |
