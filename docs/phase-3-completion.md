# Phase 3 — Database and backend foundation

**Status: complete.**

Phase 3 built the production PostgreSQL database and the NestJS backend foundation, and connected the Phase 2 public website to it. No payment provider, no donation checkout, no notification delivery — those are later phases, listed in §9.

---

## 1. What was built

### Database

28 tables, 33 CHECK constraints, 40 foreign keys, 49 unique indexes, 118 indexes, 23 enums. Five migrations, verified by applying them to a database created from nothing.

| Domain | Tables |
|---|---|
| Identity | `users`, `sessions`, `otp_codes` |
| Authorization | `roles`, `permissions`, `role_permissions`, `user_roles` |
| Programmes | `programs`, `campaigns`, `campaign_products` |
| Giving | `donors`, `donations`, `donation_items` |
| Payments | `payments`, `payment_transactions`, `payment_webhooks`, ~~`refunds`~~, ~~`subscriptions`~~ (both dropped later — subscriptions in Phase 6, refunds in Phase 7) |
| People | `volunteers`, `team_members` |
| Events | `events`, `event_registrations` |
| Content | `success_stories`, `impact_updates`, `documents` |
| Platform | `notifications`, `audit_logs`, `settings` |

The payment and subscription tables exist and are constrained but are not yet written to — the schema has to be settled before the provider is wired in, not during.

### Backend

NestJS modular monolith, 32 endpoints, every one documented in OpenAPI.

| Module | Owns |
|---|---|
| `config` | Zod-validated environment; refuses to boot when misconfigured |
| `database` | The Drizzle client |
| `redis` | Connection, fail-open cache, fail-closed lock |
| `queue` | BullMQ producers |
| `auth` | Sessions, tokens, TOTP, passwords, re-authentication |
| `audit` | Append-only audit log, read-only through the API |
| `content` | The public read API |
| `users` | Staff accounts, roles, the permission catalogue |
| `health` | Liveness and readiness |

### Frontend integration

Programmes, campaigns, campaign detail, stories, events, team and impact now render from the database. The Phase 2 design was not touched: the pages import from a new content layer rather than from fixtures.

---

## 2. Verification

Everything below was run against live Postgres, Redis and the API.

### Automated

```
pnpm lint         13/13 packages clean, zero warnings
pnpm typecheck    13/13 packages clean
pnpm test         232 tests passed
                    ├── api         184  (unit + integration, real DB and Redis)
                    ├── web          20
                    ├── validation   23
                    └── worker        5
pnpm build        8/8 packages
pnpm format:check clean
```

### Migrations and seed, from nothing

```
createdb sailent_phase3_check
db:migrate → 4 migrations applied
db:seed    → 63 permissions, 6 roles, 185 grants, 5 staff accounts, demo content
             28 tables · 33 CHECKs · 40 FKs · 49 unique · 118 indexes · 23 enums
```

Seeding three times in a row produced identical row counts — the demo tier is idempotent.

The production guard was exercised both ways:

```
APP_ENV=production pnpm db:seed              → refused: "Refusing to seed demo content in production."
APP_ENV=production pnpm db:seed -- --reference → allowed: 63 permissions, 6 roles, 5 settings
```

### Constraints reject invalid data

Not "the constraint exists" — the database was asked to accept bad rows and refused:

| Attempted write | Refused by |
|---|---|
| Session belonging to both a donor and a staff user | `sessions_one_subject` |
| Donation line where `total ≠ quantity × unit price` | `donation_items_total_matches` |
| Published story naming a person without consent | `success_stories_consent_before_publish` |
| Volunteer ID on an unapproved application | `volunteers_id_requires_approval` |
| Second user with the same email in different case | `users_email_unique` |

Also asserted: every money column is an integer type, and `payment_webhooks.provider_event_id` is unique — that index is the entire webhook deduplication strategy (decision A4).

### Authentication

```
staff login, correct password, no TOTP        401  (mandatory for privileged roles)
staff login, correct password + TOTP          200  63 permissions
unknown email vs wrong password               identical status and message
refresh rotation                              200  new token issued
replay of the rotated token                   401  family revoked
the replacement token, after reuse detected   401  family revoked
logout, then the access token                 401  immediate, not at expiry
donor OTP for a known and an unknown number   identical response
```

TOTP is tested against the five published RFC 6238 vectors, not against its own output.

### Authorization

```
content mgr  → /admin/users, /admin/roles, /admin/audit-logs   403 FORBIDDEN ×3
volunteer mgr → same                                            403 FORBIDDEN
super admin  → same                                             200 OK ×3
donor token  → any staff route                                  401 UNAUTHENTICATED
anonymous    → any staff route                                  401 UNAUTHENTICATED
content mgr  → /auth/me                                         200, 14 permissions, none of them system
super admin  → POST /admin/users, before re-auth                403 REAUTH_REQUIRED
             → after correct re-auth                            201 Created
content mgr  → POST /admin/users, after re-auth                 403 FORBIDDEN (permission, not freshness)
super admin  → change own roles                                 403 FORBIDDEN
super admin  → suspend own account                              403 FORBIDDEN
suspension   → the suspended user's live session                401 immediately
```

### Input handling

```
?limit=101                        422 VALIDATION_FAILED
?page=-1                          422 VALIDATION_FAILED
/admin/users/not-a-uuid           422 VALIDATION_FAILED
?sort=-email;DROP TABLE users     422 VALIDATION_FAILED
?sort=-passwordHash               200, identical to ?sort=-notacolumn
POST with status/passwordHash     201, both fields discarded; account created `invited`
unknown uuid                      404 NOT_FOUND
```

### Secret exposure

No response from the users API matches `/\$argon2/` or contains `passwordHash`, `totpSecret`, `backupCodes` or `lockedUntil`. `totpEnabled` is returned — whether 2FA is on is useful; the secret is not.

Public content responses contain no `internalNotes`, no `meetingUrl`, no `consentDocumentId`.

The readiness probe reports queue depth and no connection detail.

### Public API and website

All 11 public endpoints return 200 with the documented envelope. A draft campaign is 404. A page past the end returns an empty list, not an error. Money is integer paise throughout.

All 14 checked routes render 200 from the database, with seeded content verified present on each: programme copy on `/programs`, `School Kit` on the campaign page, the seeded team on `/team`, the four computed states on `/impact`, the seeded story on `/stories`.

---

## 3. Decisions made in this phase

**P3-1 — Mandatory TOTP was implemented rather than relaxed.** The seeded development admin could not sign in, because Super Admin requires a second factor. The options were to weaken the rule for development or to build TOTP. Weakening it would have meant the rule was never really tested. `TotpService` is RFC 6238 on `node:crypto` alone: about thirty lines of well-specified HMAC, and a dependency for that is a supply-chain surface bought for nothing.

**P3-2 — `@Sensitive()` was made real.** The decorator existed from Phase 1 and nothing enforced it. Phase 3 added `sessions.reauthenticated_at`, `POST /auth/reauth`, and the fifth link in the guard chain. A decorator that documents an intention nobody checks is worse than no decorator, because it reads like a control.

**P3-3 — `@AuthenticatedOnly()`, an explicit escape from deny-by-default.** Deny-by-default made `/auth/me` unreachable *by everyone*, which was found by testing rather than by reading. The fix was not to weaken the default but to add a decorator that states "authentication is the whole requirement" and is as greppable in review as `@Public()`.

**P3-4 — One development account per role.** RBAC exercised only as a Super Admin is not exercised at all: every request succeeds, so a guard that never runs looks exactly like a guard that works.

**P3-5 — Editorial columns in the database, not in the frontend.** The Phase 2 pages needed content the schema did not carry. Merging API data with fixture prose would have left half of each page fixture-backed in production. Migration `0003` adds the columns instead.

**P3-6 — Public statistics are computed, never stored.** `/impact` derives its totals and its geographic reach from the programme and campaign records. "We work in four states" is a claim; the only honest source is the records. Nobody types it in, so nobody can inflate it. The impact page's per-state beneficiary column was *removed* rather than reconstructed, because no table records that figure (decision A14).

**P3-7 — The development fallback fails closed.** The content layer serves fixtures only while `FEATURE_MOCK_DATA` is on, and the config refuses that flag in production. Verified: with the API down and the flag off, the production build *fails*. A page rendering plausible placeholder numbers when the database is unreachable is worse than a page that fails, because nobody finds out.

---

## 4. Bugs found and fixed

**`team_members.slug` was indexed but not unique.** `onConflictDoNothing()` therefore had no conflict target, and every re-seed duplicated the whole team — four copies had accumulated. A public URL segment identifying one person should be unique regardless; migration `0002` makes it so.

**`impact_updates` had no natural key**, so the demo seed doubled it on every run and the public impact page double-counted. The demo tier now clears the table before inserting, which is safe only because it cannot run in production.

**`phoneSchema` mangled valid mobile numbers.** It stripped a leading `91` unconditionally, so `9111111119` — a real ten-digit Indian mobile that happens to begin with those digits — became eight digits and was rejected. The phone number is the donor deduplication key (A8), so this would have split a donor's giving history in half and understated their 80G total. The prefix is now removed only when what remains is a full ten digits.

**Framework wording reached users.** A throttled request returned `ThrottlerException: Too Many Requests`. Accurate and useless: a donor does not know what a throttler is, and the class name is our implementation detail.

**`/auth/me` returned 403 to everyone** — see P3-3.

---

## 5. Documentation

| Document | Contents |
|---|---|
| [`database-development.md`](database-development.md) | Local Postgres, the migration workflow, seeding, the rules changes must obey |
| [`backend-development.md`](backend-development.md) | Module structure, cross-cutting behaviour, adding a module, testing |
| [`api-development.md`](api-development.md) | REST conventions, the envelope, error codes, the full endpoint map |
| [`authentication.md`](authentication.md) | Both audiences, TOTP, rotation, reuse detection, re-authentication |
| [`rbac-implementation.md`](rbac-implementation.md) | The guard chain, deny-by-default, separation of duties |
| [`content-layer.md`](content-layer.md) | How the website gets its data and why fixtures cannot reach production |

---

## 6. Known gaps

**Naming drift.** [`rbac.md`](rbac.md) says `user.view`, `role.view`, `audit.view`; the implementation uses `.read` for consistency with the other 60 permissions. The implemented names are authoritative.

**Rate limiting is per process.** Memory-backed, so limits are per API instance. Correct on one container; Phase 5 moves it to Redis.

**Campaign updates are JSONB.** Append-only editorial content read only with its campaign. If it ever needs to be queried across campaigns, that is the moment to normalise it.

**`0002` needs a clean table.** Adding a unique index fails on existing duplicates. Fresh environments are unaffected; the development database was deduplicated by hand before applying it.

**Dynamic routes return a soft 404.** A missing slug renders the right not-found page with `noindex, nofollow` — but with HTTP 200 rather than 404. It is reproducible in dev and in production, on routes Phase 3 touched and on `/blog`, which it did not, so it predates this phase; a route that matches nothing at all (`/totally-unknown`) correctly returns 404 from the routing layer. The cause is `notFound()` being reached after the response has begun streaming, so the status is already committed. The `noindex` directive means crawlers do not index these pages, which is the practical mitigation; the proper fix is to resolve the lookup before the streaming boundary, and it belongs with the next round of route work rather than in a backend phase. Next 15.5.25.

**Statutory identifiers are still null.** The `registration_details` setting holds nulls, deliberately. An invented 80G number on an NGO platform is a legal exposure, not a placeholder.

---

## 6b. Supabase

The platform was pointed at Supabase after the phase's main work. Supabase is PostgreSQL, so the schema, migrations, queries and seed are unchanged. Three platform details needed handling, and each is enforced in code rather than in a runbook — see [`supabase.md`](supabase.md).

**The Data API is the one that matters.** Supabase publishes the `public` schema over HTTP through PostgREST, reachable with the `anon` key, which is public by design. Our tables hold password hashes, TOTP secrets, session token hashes, donor PII and the audit log. On a default project, anyone with the project URL could read all of it. Migration `0004_lock_down_data_api` revokes the API roles and enables row level security with no policies on all 28 tables; the application is unaffected because it connects as the table owner. Four tests assert that every table has RLS, that no policies exist, that `FORCE` is off, and that the application can still read.

**Migrations refuse the transaction pooler.** Supabase's three connection strings differ by a hostname and a port. Port 6543 is PgBouncer in transaction mode, which does not preserve the session state DDL needs — a migration run through it can apply partially. `pnpm db:migrate` now stops with an explanation rather than trying.

**TLS is verified, not merely required.** Supabase's connection strings end in `?sslmode=require`, which encrypts without verifying the certificate. The client passes an explicit `ssl` option that overrides it. `DATABASE_INSECURE_TLS` exists as an escape hatch and is refused in production.

## 7. Deliberately not built

Payment gateway integration, donation checkout, payment webhooks, recurring donations, receipts and Form 10BD export, real email or SMS delivery, notification workflows, donor dashboard logic, volunteer approval, attendance and certificates, campaign product checkout, advanced reporting, production analytics, the CMS, and the admin dashboard UI.

The tables for several of these exist and are constrained. Nothing writes to them yet.

---

## 8. Running it

```bash
brew services start postgresql@17 redis
createdb sailent_dev
cp .env.example .env            # set DATABASE_URL and REDIS_URL

pnpm install
pnpm --filter @sailent/database build
pnpm db:migrate
pnpm db:seed

pnpm dev                        # web :3000 · api :4000 · worker
```

Sign in at the API with `admin@sailent.local` / `DevPassword123!` plus the code from `pnpm --filter @sailent/api totp:dev`. OpenAPI is at `http://localhost:4000/api/v1/docs`.

---

## 9. Phase 4

Razorpay integration and the donation flow end to end: order creation, checkout, webhook verification against the raw body, the idempotency ledger, the payment state machine, receipt numbering, and the derived-counter update inside the capture transaction (decisions A3–A7).

The schema for all of it already exists and is constrained. Phase 4 writes to it.
