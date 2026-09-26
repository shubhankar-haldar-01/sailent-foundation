# Phase 8 — Volunteer management

Phase 8 was built after Phase 9, which is unusual and worth saying plainly:
the numbering reflects the brief, not the order of work. Team, events and
impact landed first because they had no prerequisites. Volunteers did — the
role model had to be collapsed first, and that touched every authenticated
request in the application.

It is the phase in which the application stopped having five staff roles.

---

## 1. Three user types, and no fourth authentication system

The application now has exactly three kinds of actor:

| Type | How they sign in | Where the identity lives |
|---|---|---|
| `SUPER_ADMIN` | Email + password + **mandatory** TOTP | `users` |
| `DONOR` | Email + OTP. No password, ever | `donors` |
| `VOLUNTEER` | Email + OTP — **the same session as a donor** | `donors` + `volunteers` |

A volunteer is not a separate login. They are a public account that also has a
`volunteers` row, and the two are joined on the email address. That is the
whole of it, and it is why no volunteer authentication was built.

### 1.1 The donation gate had to go

Before this phase, the OTP endpoint refused an address with no donations
against it:

> "We could not find a donation recorded against that address."

That was correct while the only reason to hold a public account was to see
your giving history. It is wrong the moment somebody volunteers and has never
given money — which is most volunteers. The refusal is removed, and verifying
an OTP for an unknown address now opens an account.

The consequence is deliberate and should be understood: **anybody who can
receive mail at an address can now obtain a public session.** That session
carries no permissions at all. It can read that person's own donations (none),
their own volunteering (none unless they applied), and nothing else. The
guard's audience check means it cannot reach a single admin route — not
because a permission is missing, but because the token is signed with a
different key and does not verify there.

---

## 2. Collapsing five staff roles into one

The seed previously created `SUPER_ADMIN`, `FINANCE_MANAGER`,
`CAMPAIGN_MANAGER`, `VOLUNTEER_MANAGER` and `CONTENT_MANAGER`. The brief for
this phase says there is one. Deleting the other four was not an option —
they were held by real rows in `user_roles` and referenced by audit history.

`0014_phase8_single_admin_role.sql` does it in this order, in one transaction:

1. Grant `SUPER_ADMIN` to every **active** user holding a retired role.
2. **Assert nobody was stranded.** A `RAISE EXCEPTION` if any user would be
   left with no role at all. This is the step that makes the migration safe to
   run against production: it either moves everybody or it moves nobody.
3. Delete the `user_roles` rows for retired roles, then their
   `role_permissions`, then the roles.
4. Assert exactly one role remains.

Audit rows are untouched. They record what somebody did as
`CAMPAIGN_MANAGER`, and that remains true — the role is gone, the history of
it is not.

### 2.1 Everybody who can sign in now needs TOTP

`SUPER_ADMIN` has always required a second factor. Collapsing the roles means
**every staff account requires one**, including accounts that previously had a
role that did not. This is a real consequence, not an implementation detail:
an administrator who has not enrolled cannot sign in at all, by design, and
the error says so rather than reading as a wrong password.

The seed sweeps for accounts the migration left without a second factor and
enrols them. `users` is unique on `lower(email)` — a functional index — so
`onConflictDoUpdate` cannot target the column and the sweep runs separately
rather than as part of the upsert.

### 2.2 The regression this caused, found by the browser

One role holding every permission meant one access token carrying **94
permission strings**. The staff session cookie went to **4642 bytes**, past
the 4096 a browser will store. Eleven admin shell tests failed on
`Error setting storage state: Invalid cookie fields`.

The size was the symptom. The defect was older and worse: **a permission baked
into a token cannot be revoked until the token expires.** `auth.service.ts`
already made exactly this argument about `reauthenticatedAt` — "a claim baked
in at login could not be revoked, and could be replayed for the life of the
token" — and permissions had been sitting beside it the whole time.

An access token now carries `sub`, `aud` and `sid`, and nothing else.
Permissions are resolved from the database on each request, alongside the
session lookup the guard already performs. Revoking access now means now. The
cookie is **2306 bytes**.

> **Headroom note for whoever adds the next permission.** The web cookie still
> keeps its own copy of the list for `can()`, which decides whether to draw a
> button and is explicitly not a security control. That leaves roughly 1.8KB,
> or about 95 more permission strings, before the same wall is hit. The fix
> when it comes is to stop storing the list browser-side, not to raise a limit
> that cannot be raised.

---

## 3. What was reused, not rebuilt

The `volunteers` table has existed since Phase 3 and was never written to.
Phase 8 connects it rather than replacing it.

| Existing | Used for |
|---|---|
| `volunteers` | The profile. Gained `emergency_contact_relation`, which the form always collected and the schema always dropped. |
| `otp_codes`, donor sessions | Volunteer sign-in. No new auth. |
| `audit_logs` | Every decision, assignment and certificate. |
| BullMQ + Brevo | All four notifications. |
| `SlugService` sequences | The `VOL-` allocator follows the same shape. |
| `/volunteer` | Kept. The form on it now posts somewhere. |

Five tables are new: `volunteer_applications`, `volunteer_assignments`,
`volunteer_attendance`, `volunteer_certificates`, `volunteer_sequences`.

### 3.1 Why an application is a second table

A `volunteers` row is a profile that gets edited for years. A
`volunteer_applications` row is **what this person actually said when they
applied**, frozen. The reviewer reads the second one. Editing a phone number
in 2028 must not change what was submitted in 2026, and one table cannot hold
both.

### 3.2 The unique phone index is partial

```sql
WHERE status NOT IN ('rejected', 'archived')
```

A plain unique index burns the number: a rejected applicant could never apply
again from the same phone, which is not what rejection means. A cooling period
is set explicitly at rejection, and enforced by looking at dates rather than
by a constraint that cannot express "not yet".

---

## 4. Hours, and why they round down

Attendance is the **only** source of hours. There is no `volunteer_hours`
table; a second one would drift, and the one that drifted would be the one
printed on a certificate.

`total_hours` and `verified_hours` are counters on `volunteers`, updated in
the same transaction as the attendance row that changed, and **recomputed from
the rows rather than incremented**. Incrementing is correct once and wrong
after the first correction; a shift register submitted twice from a phone at a
venue is the ordinary case, not the exception.

`minutesToHours` floors:

> 119 minutes is one hour, not two.

These hours are printed on a document somebody shows an employer. Rounding up
certifies half an hour that did not happen, and across a year of shifts that
is a materially inflated claim made by the organisation about a person who did
not ask for it. A volunteer credited with one hour for 119 minutes has been
short-changed, which is a disappointment; the other direction is a false
statement.

**Correcting a verified figure clears its verification.** Somebody approved
the old number, not the new one.

### 4.1 A volunteer cannot record or verify their own attendance

There is no route that would let them. Not a permission they lack — no route.
`/me/volunteering` takes no volunteer id anywhere in its surface and resolves
the record from the session. This is asserted directly in
`apps/api/test/volunteers.spec.ts`, and the assertion is `401`, not `403`: the
admin routes are a different token audience, so a public session does not fail
an authorization check there, it fails signature verification. That is a
boundary no future edit to a permission list can weaken.

---

## 5. The identifier, and decision A13

`VOL-2026-00001` is allocated **at approval**, never at application, from
`volunteer_sequences` under `INSERT … ON CONFLICT DO UPDATE … RETURNING`, in
the approval transaction. Two approvals racing get two numbers; the test
proves it by approving two applicants concurrently.

It is never reissued. Suspending, deactivating or archiving somebody leaves it
intact, because it appears on certificates that exist in the physical world.
`0016` backfills the counter from identifiers the Phase 3 seed had already
written — without it, the first real approval collided with `VOL-2026-00001`.

---

## 6. Certificates

Issued against **verified** hours only, and the figure is **frozen onto the
certificate** at issue. Later work does not change a document already printed.

A certificate is **revoked, never deleted**, and `/verify/[code]` answers a
revoked one with `200` and `valid: false` rather than `404`. "No certificate
carries this code" reads as a forgery, which is unfair to somebody holding one
that was reissued for an administrative reason.

The public verification response contains only what is printed on the
document: name, identifier, hours, period, status. No email, no phone, no
address, no notes. The code proves possession of one document; it is not a key
to a person's record. `/verify/[code]` is `noIndex`, because the URL contains
the code.

---

## 7. What is deliberately absent

**Volunteer document upload is out of scope** and nothing was built toward it:
no private bucket, no signed URLs, no ID proof, no upload route. It is
deferred whole.

**Rejection reasons are never shown to the applicant.** They are recorded, and
the rejection notification carries none. The job payloads carry ids only.

---

## 8. Defects found and fixed

### 8.1 The form submitted almost nothing

Only the current step is mounted, so reading `new FormData(form)` on the final
submit saw the review step and nothing before it. Applications arrived as
`{"availability":{}}`.

Every API test passed — the API was handed valid payloads directly. Every unit
test passed — the schema was correct. The fix accumulates answers into a ref
as each step is left. `apps/web/e2e/volunteers.spec.ts` now walks all six
steps in a browser and reads the row back, asserting a field from the **first**
step, which is the one furthest from the submit.

### 8.2 The emergency contact relation was collected and discarded

The form asked, the schema had no column. A name and a number with no
relationship is worse than neither: somebody rings that number in an emergency
not knowing who they are speaking to. The validator now refuses a name without
a number and vice versa.

### 8.3 RLS was missing on all five new tables

Caught by `database.spec.ts`, which asserts it schema-wide. Serious rather
than tidy: Supabase publishes the `public` schema to the `anon` key. `0017`
enables it.

### 8.4 Two seeded accounts could not sign in

A consequence of §2.1, found immediately after the migration ran. Both needed
TOTP enrolment.

---

## 9. Tests

| Suite | Count |
|---|---|
| `apps/api/test/volunteers.spec.ts` | 34 |
| `packages/validation/src/__tests__/volunteer.test.ts` | 30 |
| `apps/web/e2e/volunteers.spec.ts` | 2 (desktop only) |

The e2e is desktop-only on purpose: the apply endpoint is throttled to three
submissions an hour per address, a real control on an unauthenticated write.
Four viewport projects would spend the hour's budget on one run.

### 9.1 Tests that were deleted rather than fixed

Several Phase 7 tests asserted separation between staff roles — that a
Campaign Manager could not reach finance, and so on. With one role those
statements cannot be made. They were **removed with a block comment** naming
what was removed, why it can no longer be expressed, and where the coverage
went: `auth.guard.spec.ts`, which uses synthetic actors and still proves the
guard denies by default.

Making them pass artificially would have been worse than deleting them.

---

## 10. Verification

- `pnpm -r typecheck`, `lint`, `format` — clean
- API: **451 passed**, 24 files
- Validation: 30 new, whole package green
- Playwright: **457 passed**, 7 skipped, 0 failed

### 10.1 A flake this phase caused, and its actual cause

Adding a 24th spec file made the API suite fail intermittently — **a different
random test each run**, never the same one twice, always with
`Test timed out in 5000ms`. Every one of them passed alone in under a second.

The obvious reading is connection exhaustion, and it is wrong. Peak usage
measured across a full run is **24 of Postgres's 100**: each app pools 5 in
development and the suites do not all run at once.

The real cause is CPU. Twenty-four spec files run in parallel, each booting
its own NestJS container, and vitest's default 5-second timeout is sized for
unit tests. `vitest.config.ts` now sets `testTimeout: 20_000` and
`hookTimeout: 60_000`, with the measurement recorded next to them so the next
person does not go looking for a slow query.

Five consecutive full runs green afterwards.

Staff sign-in is capped at five attempts a minute per address and a full
Playwright run spends three. Back-to-back runs need the API restarted between
them to clear the in-memory counters — the same friction documented in
`phase-7.md` §4, and the reason the throttler still needs Redis storage.

---

## 11. Not in this phase

Volunteer document upload. Volunteer self-service attendance. Shift swapping.
Volunteer-to-volunteer messaging. Certificate PDF rendering — the record and
its verification page exist; the document itself does not. Phase 10.

---

## 12. Post-audit cleanup

A read-only audit after Phase 8 shipped found three things. All are fixed or
tooled here; none of them started Phase 10.

### 12.1 Duplicate protection and record lookup disagreed on the key

`apply()` checked for duplicates on the **phone number**. `/me/volunteering`
resolves a volunteer by **email**. Nothing joined the two, so:

```
apply(email E, phone P1)  -> accepted
apply(email E, phone P2)  -> accepted, because P2 is not taken
```

left one person holding two live records, and the resolver's `LIMIT 1` with no
`ORDER BY` returned whichever Postgres preferred. An approved volunteer could
open their dashboard and be shown the other row — no identifier, no hours, no
certificates — which reads as "my approval was lost". Not a cross-user leak;
every row involved is the same person's. It needed no rejection to reach.

Four changes:

- **`0018_phase8_volunteer_email_unique`** — a partial unique index on
  `lower(btrim(email))` for live statuses, mirroring the phone index exactly,
  including being partial so a rejected applicant's address is not burned. The
  migration refuses with a message naming the offending addresses rather than
  letting `CREATE UNIQUE INDEX` fail quoting two row ids.
- **Both keys are checked**, for duplicates *and* for the cooling period. A
  cooling period keyed only on the number is escaped by re-applying from the
  same address with a different one.
- **The race is caught.** The check cannot share a transaction with the insert,
  so two simultaneous applications both pass it and one loses on the index.
  That now answers `409` with the same sentence, not a `500` quoting an index
  name at somebody filling in a form.
- **`ORDER BY created_at DESC`** on the resolver. The index makes at most one
  record live, but a rejected record may legitimately sit beside a live one.

The duplicate message deliberately does **not** say which key matched. The
endpoint is unauthenticated and naming the field makes a cleaner enumeration
oracle than it needs to be. It remains an oracle — vary one field at a time —
and the honest mitigation is the throttle, not silence: quietly accepting a
duplicate leaves somebody waiting for an answer that never comes.

### 12.2 Rate limiting moved to Redis

`ThrottlerModule` defaults to an in-process Map, so every limit was **per
instance**: two API processes meant ten staff sign-in attempts a minute rather
than five, and six volunteer applications an hour rather than three. Nothing
reported the multiplication, which is the worst property a security control can
have. Carried as a known gap since Phase 7; Phase 8 added a public
unauthenticated write to the endpoints depending on it.

`RedisThrottlerStorage` counts in a single Lua script — two instances
incrementing one key cannot both read the pre-increment value. No new
dependency; `app.module.ts` had already framed the choice as "a third-party
storage package, or ~40 lines implementing the interface", and this is the
second, on the same reasoning that made `TotpService` thirty lines of
`node:crypto`.

**The limits are unchanged.** Volunteer application 3/hour, OTP request
3/15min, staff login 5/minute, baseline 100/minute.

> **A wiring bug worth recording.** The first attempt provided
> `ThrottlerStorage` from the `@Global()` `RedisModule`. It typechecked, it
> looked right, and it did nothing: `ThrottlerModule` provides that token
> itself and an imported module's provider beats a global one, so the guard
> carried on using its Map. **Every behavioural rate-limit test still passed**,
> because the limits were still enforced — just not shared. Only passing
> `storage` into `ThrottlerModule.forRootAsync` binds. The suite now asserts
> that counters actually appear in Redis, because nothing else could see it.

**On Redis failure it degrades to per-instance counting**, not fail-open and
not a 500. Fail-open would remove limiting from sign-in and the public
application endpoint exactly when infrastructure is unhealthy, invisibly.
Fail-closed would turn a blip into an outage, contradicting `RedisService`,
which logs connection errors on the stated grounds that a blip must not take
the API down. Degrading lands on the behaviour the system already had, logged
at `error` so it is visible rather than inferred.

### 12.3 Development credentials on a live database

The six `@sailent.local` staff accounts have a password printed in
`database-development.md` and a TOTP secret that is the **RFC 6238 test
vector**. `assertDemoSeedAllowed()` stops the seed creating them in production;
it does nothing about rows already present, which is the position of any
project promoted from its development database. Phase 8 made it worse — all six
now hold every permission, where most previously held a subset.

`pnpm --filter @sailent/database db:harden` inspects and neutralises them. It
is **dry-run by default** and prints no hash, secret or password.

It **neutralises rather than deletes**, which matters: these rows are
`approved_by`, `reviewed_by`, `issued_by` and `verified_by` on real records,
and every one of those foreign keys is `ON DELETE SET NULL`. Deleting succeeds
and quietly rewrites history into "approved by nobody". So the row stays and
the ability to sign in goes: suspended, TOTP cleared, password hash replaced
with a value nothing verifies against, live sessions revoked. It warns if no
administrator on a real address is left.

Accounts, and what they are for:

| Account | Referenced by | Disposition |
|---|---|---|
| `admin@sailent.local` | `harness.ts`, `rbac.spec.ts`, `admin-auth.spec.ts` | **Keep in development.** Neutralise before production |
| `staff@sailent.local` | `harness.ts`, Playwright `global-setup.ts` | **Keep in development.** Neutralise before production |
| `campaigns@sailent.local` | a comment only | Legacy. Neutralise |
| `finance@sailent.local` | nothing | Legacy. Neutralise |
| `content@sailent.local` | nothing | Legacy. Neutralise |
| `volunteers@sailent.local` | nothing | Legacy. Neutralise |

The last four are survivors of migration `0014`, which migrated rather than
deleted — correct, and it means four accounts named after retired functions now
hold full administrative access.

**It has not been run.** This database is the development one and the suites
sign in as two of these accounts. Running it is a go-live step, and the order
matters: create a real administrator with a real second factor **first**, verify
that sign-in works, then harden.

---

## 13. Resolving the authentication deadlock

The §12.3 plan said "create a real administrator first, then harden". Following
it revealed that the first half was impossible.

### 13.1 There was no way to create an administrator

`SUPER_ADMIN` required TOTP, and **nothing in the application can enrol one**:

- `totpSecret` is excluded by construction from every user DTO.
- `POST /admin/users` creates an account `invited` with a deliberately unusable
  password hash, and there is no password-set route, no reset route and no
  invitation-token table. Its own comment says delivery "is Phase 4", which
  never shipped.
- That route is `@Sensitive()`, so it needs an administrator already signed in.
- The only writer of `totp_secret` anywhere is the development seed.

So the only accounts able to sign in were the seeded ones, whose secret is the
RFC 6238 test vector and whose password is in the documentation — the exact
credentials the cleanup exists to remove.

`SUPER_ADMIN` has been removed from `TOTP_REQUIRED_ROLES`. Staff authenticate
with **email and password**. The set keeps `ADMIN` and `FINANCE_MANAGER`,
retired role keys that cost nothing and still matter to a restored database,
and `TotpService` is untouched.

This was a decision taken by the project owner, not a default. The tradeoff:
a password alone now reaches donor exports, PAN data and the audit log. Against
that, the alternative was a system with no administrator at all.

### 13.2 What `@Sensitive()` still guarantees

Reviewed all 22 `@Sensitive()` routes. The guard chain is unchanged — Public →
Authentication → Audience → Permission → Freshness — and `@Sensitive()` reads
only `sessions.reauthenticated_at`. It never consulted TOTP.

What changed is the strength of `/auth/reauth`: password only. That is not a
*downgrade*, which was the original argument for requiring a factor there — a
re-auth weaker than the login would let somebody open the sensitive window with
less than they signed in with. Login is now password only too, so the two are
equal. `@Sensitive()` still buys what it always bought: proof that the person
at the keyboard *now* is the account holder, within five minutes, before
anything irreversible.

RBAC, permission strings, audience separation, Argon2id, the 5/minute login
limit and account lockout are all untouched. No route became public.

### 13.3 Provisioning the first administrator

`pnpm --filter @sailent/database db:create-admin`.

Out of band and deliberately so: the first superuser should not be mintable
over HTTP. It reads the address and password from an interactive prompt with
echo suppressed, or from `ADMIN_EMAIL` / `ADMIN_PASSWORD` for automation —
**never from a command-line argument**, which would be visible in `ps` and
land in shell history.

It refuses a `@sailent.local` address, refuses known development passwords,
requires twelve characters, hashes with the same Argon2id parameters as
`PasswordService`, and **verifies the hash before writing it** — a hash the
application cannot check produces an administrator who cannot sign in,
discovered at the worst possible moment. It grants `SUPER_ADMIN` through the
existing `user_roles` relationship, creates no new role, sets no TOTP, and
refuses to overwrite an existing account. The password is never printed,
logged or stored.

### 13.4 Audit logging: the actor email snapshot

`actor_email_snapshot` has existed since Phase 3 and `record()` has always
accepted an `actorEmail`. No caller ever passed one, so **0 of 233 rows were
populated** — and 73 of those already pointed at user ids that no longer
resolve, because `audit_logs` has no foreign key to `users` (deliberately, so
the log cannot be cascaded away) and nothing stops a dangling reference.

`AuditService.record()` now resolves it at write time when a `userId` is
present and no email was supplied. One indexed lookup on a path already writing
a row; it returns null rather than throwing.

It is a **snapshot, not a join**: written once, never updated, so a 2026 row
still shows the address that acted even if that administrator changes theirs in
2028. The user id is still stored, unchanged — this is an addition.

**Historical rows are not backfilled.** There is no honest source for what
those addresses were, and inventing them would make the log say something
nobody can stand behind.

**Donor actors deliberately get no snapshot.** Measured over a full suite run:
2308 of 2308 `user` rows now carry one, and 0 of 268 `donor` rows do. That is
the intended boundary, not a gap. A staff snapshot exists for accountability —
who approved this, who exported that — while a donor's address in a log with a
longer retention period than the record it describes is a second copy of
somebody's contact details for no benefit. The same reasoning the volunteer
application already follows when it writes an audit row with no name, email or
phone.

### 13.5 Tests no longer depend on deployment accounts

The suites signed in as `admin@sailent.local` and `staff@sailent.local`. That
coupling is why the cleanup could not proceed: hardening those accounts would
have taken the test suite down with them. **A test suite that pins a
deployment's administrator accounts in place is a test suite holding a security
fix hostage.**

Both suites now provision their own accounts on `@sailent.test` — reserved by
RFC 6761 §6.2, never delegable, so the addresses cannot belong to anybody:

| Suite | Account | Created by |
|---|---|---|
| API integration | `super-admin@sailent.test`, `staff@sailent.test` | `test/global-setup.ts` |
| Playwright | `e2e-staff@sailent.test` | `e2e/global-setup.ts` |

Both provisioners are idempotent and re-apply the password on every run, so a
suite that failed halfway — or one that locked the account out by deliberately
spraying wrong passwords — repairs itself instead of failing the next run on a
sign-in that looks like a code defect.

> **A mistake worth recording.** The first version did this inside
> `createTestApp()`, which runs once per spec file. Twenty-five files run in
> parallel, so twenty-five workers updated the same two rows at once and waited
> on each other's locks; five spec files failed on unrelated assertions,
> because what actually ran out was time. It also hashed the same password
> twenty-five times at ~100ms each. It belongs in a global setup that runs once.

`e2e/admin-auth.spec.ts` was rewritten. It existed to catch a two-step TOTP
form broken by React 19's uncontrolled-form reset; there is no second step now,
so it asserts the current contract instead — sign-in completes in one step and
**no authenticator field appears**. Reinstating mandatory TOTP without building
enrolment first fails there rather than in production.

### 13.6 Environment

The Supabase project in `DATABASE_URL` is **development/staging**, confirmed by
the project owner. `NODE_ENV=development` and `APP_ENV=development` are
therefore correct and were not changed.

The production seed guard was tested rather than assumed: with either
`APP_ENV=production` or `NODE_ENV=production`, `pnpm db:seed` refuses —

```
[seed] failed: Refusing to seed demo content in production.
```

— while `--reference` still seeds roles, permissions and settings. Demo and
development accounts cannot be created in production.

**Required for a production deployment:** `APP_ENV=production`,
`NODE_ENV=production`, a fresh `DATABASE_URL`, `JWT_ACCESS_SECRET` set (the
development fallback is refused at boot), `REDIS_URL` for shared rate limiting,
`FEATURE_MOCK_DATA` off, seed with `--reference` only, then
`db:create-admin`.

### 13.7 Hardening: not run

The six `@sailent.local` accounts are **untouched**. Hardening them without a
replacement administrator would leave the platform permanently unadministrable,
and no real administrator has been provisioned yet — the address is the
owner's to choose.

The dry run was reviewed and is correct: six accounts, all active
`SUPER_ADMIN`, 160 audit rows and 56 sessions between them.

---

## 14. End-to-end test isolation

§13.5 gave the suites their own fixtures. It did not give them their own
database, and that turned out to be the part that mattered.

### 14.1 The failure

`playwright.config.ts` started only the web app, with `reuseExistingServer`,
and assumed an API was already listening on 4000. Both processes read
`DATABASE_URL` — the staging Supabase project. So every run created a Super
Admin there, signed four donors in, and left sessions behind. Suspending that
account by hand lasted exactly until the next run recreated it.

The mechanism was reuse: a server that happened to be up got used, and nothing
anywhere asked what it was connected to.

### 14.2 The architecture

| | Application | API integration suites | End-to-end suite |
|---|---|---|---|
| Database | `DATABASE_URL` (Supabase) | `TEST_DATABASE_URL` (`sailent_dev`) | `E2E_DATABASE_URL` (`sailent_e2e`) |
| Redis | DB 0 | DB 1 | DB 2 |
| API port | 4000 | in-process | 4100 |
| Web port | 3000 | — | 3100 |

Three independent things keep the suite off staging, and all three are needed:

1. **Both processes are started by the config**, so neither can be inherited
   from a shell with the wrong database behind it.
2. **Dedicated ports**, so the suite cannot collide with — or silently adopt —
   a dev server someone already has running.
3. **`reuseExistingServer: false` always**, including locally. Reuse is the
   exact mechanism that caused this; a slower start is a cheap price for
   knowing what the tests are talking to.

On top of that, `global-setup.ts` refuses to run if its target is not a local
host, or is the same string as `DATABASE_URL` — the second condition matters on
its own, because pointing `DATABASE_URL` at a local database for a debugging
session should not quietly re-authorise the suite to seed it.

`pnpm --filter @sailent/database db:prepare-e2e` migrates and seeds it, and
carries the same two refusals: it runs the SEED, so pointed at a live database
it would add fictional programmes to a real site, not merely test rows.

### 14.3 Rate-limit counters

Donor sign-in is capped at ten per fifteen minutes and the setup spends four,
one per viewport project. Three runs inside a window exhausted it, and the
suite failed on the limiter rather than on anything under test. It used to
self-heal because counters lived in the API process and every run restarted it;
since they moved to Redis they survive — correctly.

So the setup clears them, and the scope is the argument: only in
`E2E_REDIS_URL` (DB 2), only keys under the `throttle:` prefix, and refused
outright if that URL is the application's own. **The limits are unchanged and
still enforced everywhere.** What proves them is
`apps/api/test/rate-limit.spec.ts`, which runs the real limiter deliberately.
This suite is not where they are tested, and letting it fail on them tests
nothing.

### 14.4 A migration that could not run on a fresh database

Preparing `sailent_e2e` surfaced a defect that would have blocked the first
production deployment:

```
[migrate] failed: Expected exactly one role after the migration, found 0.
```

`0014_phase8_single_admin_role` asserted `count(*) = 1` on `roles`. On a fresh
database that count is legitimately **zero** — roles are reference data created
by `db:seed --reference`, not by a migration. So `pnpm db:migrate` could not
complete on any new environment, including a new production database, and
nobody would have found out until go-live.

Changed to `> 1`. The guard is for the UPGRADE path — a database that had the
five retired roles must end with exactly one — and zero means nothing has been
seeded yet, which is not a failure.

### 14.5 Proof

Supabase was fingerprinted, then four full Playwright runs, then fingerprinted
again:

```
before: users=8 donors=9 volunteers=13 sessions=150 otp_codes=48 audit=276
after : users=8 donors=9 volunteers=13 sessions=150 otp_codes=48 audit=276
```

Identical. The only deltas across the whole exercise were the two deliberate
ones: `active_admins` 2 → 1 and `live_sessions` 59 → 57, from suspending the
test account left behind before isolation existed.

### 14.6 Residue from before isolation

Staging still holds artefacts created while the suite pointed at it:

- `e2e-staff@sailent.test` — **suspended**, row kept
- Four `DNR-E2E-0*` donors on `example.test`, one donation each

They are inert and nothing recreates them. Removing them is a data decision
rather than a code one, and each has a donation attached, so they are left for
a deliberate call rather than swept up here.

---

## 15. Password rotation

### 15.1 There was no way to change a password

Inspected before building anything, and the answer was nothing at all:

- `updateUserSchema` accepts a first name, a last name and a phone number.
- `UsersService` writes `password_hash` exactly once — at invite, with a random
  unusable value.
- No reset route, no change route, no invitation-token table.
- `must_change_password` is written at invite and **never read**.
- The only two password inputs in the product, the login form and the
  re-authentication panel, both VERIFY a password. Neither can change one.

So an exposed administrator credential could not be replaced except by hand.

### 15.2 `db:rotate-admin-password`

Deliberately narrow: it changes `password_hash`, clears the lockout counters,
revokes that account's live sessions, and appends one audit row. It does not
touch the email, role, status, permissions, TOTP columns, donors, volunteers,
or any existing audit row.

- The password is never a command-line argument — arguments are visible in `ps`
  to every process on the machine and land in shell history.
- Input is hidden and asked for twice.
- The account must already exist. **An unknown address is an error, not an
  invitation**: otherwise a typo in an email silently mints a second
  administrator, which is the situation this whole sequence has been unwinding.
- **Rotating to the current password is refused.** The reason anyone runs this
  is that the password is no longer trusted; re-setting the same value succeeds,
  prints a success line, and leaves the exposure open while looking closed.
- The new hash is verified before it is stored, so a hash the application
  cannot check never locks an administrator out.

### 15.3 One policy, not two

`lib/password-policy.ts` now holds the minimum length, the blocklist, the
Argon2id parameters and the prompt helpers, shared with `db:create-admin`. Two
copies of a password rule drift, and always the same way: the newer command
gets the stricter rule while the older one quietly keeps accepting what the
newer one refuses. `sailent` was added to the blocklist.

### 15.4 A prompt bug worth recording

The first version created a readline interface per question. Interactively that
works. With piped input, closing the first one ends the stream, the second
question never receives a line, the promise never settles, the event loop
drains and node exits **0** — a credential tool that appears to succeed and
changed nothing.

Fixing that exposed a second layer: readline emits piped lines as fast as it
reads them, so line two arrived while no question was pending and was silently
discarded. The prompts now share one interface with a line QUEUE, and treat
end-of-input as an explicit error.

Both bugs only ever appeared non-interactively — which is also why the command
could not be tested until they were fixed.

---

## 16. Database-target safety for credential commands

### 16.1 The incident

While testing `db:rotate-admin-password`, a run connected to the **staging
Supabase database** and changed the password for `admin@sailentfoundation.com`
to a value nobody recorded. It was found when a later verification could not
sign in, confirmed against the stored hash, and restored.

Root cause, one line:

```ts
const connectionString = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
```

A test set one of those to a local database and left the other pointing at
Supabase. `||` is not a decision procedure — it is a guess, and it guessed
wrong. Nothing in the command ever asked whether that was an appropriate place
to change a credential.

`db:harden` shared the same resolution and had **no target guard at all**. Its
`@sailent.local` filter was mistaken for one; that limits *what* is changed and
says nothing about *where*.

### 16.2 The guard

`lib/database-target.ts`, shared by all four commands rather than copied into
each. Three properties, all needed:

1. **No fallback chain.** Two variables set to different databases is an
   ambiguous instruction, and it is refused with both hostnames named.
2. **The operator declares the environment** (`--target=local|production`) and
   the guard checks that declaration against the connection it resolved. Being
   wrong is a refusal, not a silent success.
3. **Production requires the hostname typed back** (`--confirm-host=…`). A flag
   can sit in shell history and be re-run by accident; a hostname somebody had
   to read off the refusal and retype cannot be.

**Hostnames are matched exactly, not by substring.** The previous guards tested
the connection *string* with a regex, which `localhost.attacker.example.com`
satisfies. This parses the URL and compares `hostname` against an allowlist.

The resolver is a pure function over an environment object, so the refusals are
tested without a database anywhere near them.

### 16.3 Production is still possible, just deliberate

| Situation | Outcome |
|---|---|
| No target configured | refused |
| Two targets disagreeing | refused, both named |
| Target undeclared | refused |
| Remote declared `local` | refused |
| Local declared `production` | refused |
| Production, no confirmation | refused, prints the exact flag |
| Production, host typed exactly | **allowed** |
| Local declared `local` | allowed |

### 16.4 `db:seed` was the last command without it

Added after Phase 10.5, when seeding two new permissions into production was
the obvious next step and the command to do it turned out to be unguarded.

It read `process.env.DATABASE_URL` and started inserting. What it can do to a
live database is not small — even `--reference`, the narrow mode, **deletes
every SUPER_ADMIN grant before re-inserting it**, so there is a window in which
the only administrator has no permissions, and it upserts category names and
slugs, which are public URLs. (It does *not* overwrite settings VALUES; that
conflict clause deliberately touches only `description` and `category`.)

The seed passes `variables: ['DATABASE_URL']` — it has exactly one legitimate
source, and reading only that makes "never silently fall back" structural
rather than a rule somebody has to remember. `DATABASE_MIGRATION_URL`,
`TEST_DATABASE_URL` and `E2E_DATABASE_URL` cannot reach it at all.

> **One thing the guard cannot do.** These commands load the repository `.env`
> themselves, so an *unset* variable means "whatever `.env` says" — which on a
> developer's machine is production. The target guard cannot prevent that file
> being read. What catches it is the DECLARATION check: `--target=local`
> against a Supabase URL is refused. That is the reason declaring the
> environment is required rather than inferred, and it is tested directly.

`db:prepare-e2e` spawns the seed, so it now passes `--target=local` explicitly.

### 16.5 Tests

52 tests. 24 unit tests over the resolver — no database involved at all, which
is the point: the incident happened while testing a credential command, and the
suite for that must not be able to repeat it. 28 tests invoke the real commands
as an operator would.

The "production" host in those tests ends in `.invalid`, which **RFC 2606
reserves so that it can never resolve**. The guard classifies it as remote
exactly like Supabase, so the refusals are genuinely exercised — while a
regression that let a command through would fail to connect rather than change
something real.
