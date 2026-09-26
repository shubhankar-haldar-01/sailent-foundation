# Environment Variables

Every variable is declared in [`.env.example`](../.env.example) and **validated
at boot** by `@sailent/config`. A missing or malformed value fails startup with
every problem listed at once, rather than surfacing as `undefined` three weeks
later in a code path nobody exercised.

---

## How validation works

`packages/config/src/env.ts` defines one schema per surface — API, worker, web,
database — so the web app is not forced to know about payment secrets and the
worker is not forced to know about the browser's public URL.

```ts
const env = loadEnv(apiEnvSchema, 'api');   // parses, freezes, or throws
```

Two behaviours worth knowing:

**A blank value means "not set".** `.env.example` declares future variables as
`KEY=`. dotenv parses that as an **empty string**, not `undefined` — so
`z.string().min(32).optional()` would receive `''`, fail the length check, and
refuse to boot from the project's own documented template. The `optional()`
helper maps `''` to `undefined`. Application code reading such a variable
directly must use `||`, not `??`: an empty string is not nullish.

**Production is stricter.** With `APP_ENV=production` the schema additionally
requires JWT secrets and **refuses** `SWAGGER_ENABLED=true` or
`FEATURE_MOCK_DATA=true`. Those are not warnings — the process will not start.

### Where `.env` comes from

One `.env` at the repository root. Applications run from their own directory but
`loadRootEnvFile()` walks up to find it, so there is no per-app copy to drift
out of sync.

In production this is a **no-op**: Vercel, Render and Railway inject variables
into the process directly, there is no file on disk, and a platform-provided
value always wins over a file.

---

## Runtime

| Variable | Required | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development` \| `test` \| `production` |
| `APP_ENV` | no | `development` | `development` \| `test` \| `staging` \| `production`. Drives strictness. |

---

## Database

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | **yes** | The database THIS process may open. Must start `postgres://` or `postgresql://`, and must agree with `APP_ENV` — see below. **Use the pooled/TCP string**: decision A12 needs multi-statement transactions, which an HTTP serverless endpoint cannot run. |
| `TEST_DATABASE_URL` | for tests | The API test suites. `localhost:5432/sailent_dev`. |
| `E2E_DATABASE_URL` | for E2E | The browser suite, and nothing else. `localhost:5432/sailent_e2e`. |
| `DATABASE_MIGRATION_URL` | no | Separate role with DDL rights, so the application role has none. Read only by `db:migrate`. |
| `DATABASE_CA_CERT` | hosted only | Path to the provider's root CA. Not needed for local Postgres — see below. |

### One database per environment, and the application checks

`APP_ENV` is the environment; `DATABASE_URL` is the database. They must agree,
and `assertRuntimeDatabaseTarget` in `@sailent/database` checks that **at
startup, before the connection pool is created**. It never rewrites the URL —
it refuses to start.

| `APP_ENV` | `DATABASE_URL` must be |
|---|---|
| `development` | a LOCAL host, and one of `sailent_dev`, `sailent_e2e`, `sailent_test` |
| `test` | the same |
| `staging` | a remote host that is **not** the production one |
| `production` | the approved production host, and not a development database |

| Environment | Database |
|---|---|
| Development | `DATABASE_URL` → `localhost:5432/sailent_dev` |
| E2E | `E2E_DATABASE_URL` → `localhost:5432/sailent_e2e` |
| Production | `DATABASE_URL` → the Supabase production session pooler |

> **Never put the production `DATABASE_URL` in the normal local `.env`.**
>
> This is not a style rule. A local `.env` held the production Supabase URL
> while `APP_ENV=development`: the API started, served, and wrote to
> production, and a draft written in a local admin UI landed in the live
> database. Neither value was wrong on its own, which is why nothing looked
> wrong — and why the check inspects the PAIR.
>
> Production configures its own environment in its own runtime. The password
> never enters this repository, and no `.env.production` is committed.

A refusal names the host, the database and the environment, and never the
connection string or the password:

```
Unsafe database configuration: the development environment cannot connect to a remote database.
  host=aws-0-ap-south-1.pooler.supabase.com database=postgres environment=development
```

### TLS and `DATABASE_CA_CERT`

`DATABASE_CA_CERT` points at the hosted provider's root CA and is read **only
when the connection needs TLS**, which a local socket does not — so local
development does not depend on a production certificate, and the variable can
be absent on a developer's machine.

For a hosted database the certificate is verified in full:
`rejectUnauthorized` stays on. An `ssl` object is passed deliberately so it
overrides any `?sslmode=require` in the URL — `require` encrypts **without**
verifying the certificate, which is the setting that looks secure and is not.

---

## Redis

| Variable | Required | Notes |
|---|---|---|
| `REDIS_URL` | **yes** | `redis://` or `rediss://`. Rate limiting now; BullMQ transport from Phase 5. |

---

## Web

| Variable | Required | Default | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | no | `http://localhost:3000` | Canonical URLs, sitemap, OG tags |
| `NEXT_PUBLIC_APP_NAME` | no | `Sailent Foundation` | |
| `API_URL` | no | `http://localhost:4000` | **Server-side only.** Where the BFF reaches the API. Never exposed to the browser (A1). |

Anything the browser needs must be prefixed `NEXT_PUBLIC_`. Anything else stays
server-side — that prefix is the boundary, so never put a secret behind it.

---

## API

| Variable | Required | Default | Notes |
|---|---|---|---|
| `API_PORT` | no | `4000` | |
| `API_HOST` | no | `0.0.0.0` | |
| `CORS_ORIGINS` | no | `http://localhost:3000` | Comma-separated. Closed to browser origins in production — the only callers are the Next.js server, the worker and Razorpay. |
| `SWAGGER_ENABLED` | no | `true` | **Must be `false` in production**; the schema enforces it. |

---

## Worker

| Variable | Required | Default |
|---|---|---|
| `WORKER_CONCURRENCY` | no | `5` |
| `WORKER_PORT` | no | `4001` |

---

## Auth — Phase 3

Not read in Phase 1. Optional in development; **required in production**.

| Variable | Notes |
|---|---|
| `JWT_ACCESS_SECRET` | ≥ 32 chars. `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | ≥ 32 chars, **different from the access secret** |
| `JWT_ACCESS_TTL` | Default `15m` |
| `JWT_REFRESH_TTL_DONOR` | Default `30d` |
| `JWT_REFRESH_TTL_STAFF` | Default `7d` — shorter, because staff can move money |
| `FIELD_ENCRYPTION_KEY` | AES-256-GCM, 32 bytes base64. Encrypts donor PAN at rest: storage encryption protects against a stolen disk, this protects against a leaked dump or an over-broad query. A PAN warrants both. |

Donor and staff tokens are separate, non-interchangeable audiences (A8).

---

## Payments — Razorpay, Phase 5

| Variable | Notes |
|---|---|
| `RAZORPAY_KEY_ID` | |
| `RAZORPAY_KEY_SECRET` | |
| `RAZORPAY_WEBHOOK_SECRET` | HMAC-SHA256 over the **raw** request body. Re-serialised JSON produces different bytes and verification fails (A4). |

Test and live keys are environment-separated, and an event whose mode does not
match the environment is rejected.

---

## Email, SMS, storage — Phases 3–4

| Variable | Phase | Notes |
|---|---|---|
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` | 4 | Transactional email |
| `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SENDER_ID` | 3 | Donor OTP. Needs a DLT-registered sender ID and pre-approved templates under Indian telecom regulation — this has a lead time. Vendor is open question 3. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | 4 | Cloudflare R2. **API process only** — see below. Required when `APP_ENV=production`. |
| `R2_BUCKET_PUBLIC` | 4 | `sailent-public`. Campaign images, team photos, public documents. |
| `R2_BUCKET_PRIVATE` | 4 | `sailent-private`. Receipts, volunteer documents, tax documents. **No public access** — short-lived signed URLs only. |
| `R2_PUBLIC_BASE_URL` | 4 | Public hostname for the public bucket, no trailing slash. Required when `APP_ENV=production`. |

**Two buckets, not three.** R2 public access is per-BUCKET, not per-prefix, so
there is one public bucket and one private one. A `R2_BUCKET_TEMP` was listed
here and read by nothing; it has been removed from `packages/config` and from
this table. Do not provision a third bucket for it. There is likewise no
`R2_BUCKET_NAME` — nothing in the codebase reads that name.

**Where these go: the API service only.** `apiEnvSchema` is the only schema
that declares them; `workerEnvSchema` and `webEnvSchema` do not, so the worker
and the Next.js app neither need nor validate them. None is `NEXT_PUBLIC_`, and
no storage call is made from the browser.

---

## Monitoring and analytics

| Variable | Notes |
|---|---|
| `SENTRY_DSN` | Server-side |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser |
| `SENTRY_ENVIRONMENT` | Default `development` |
| `SENTRY_TRACES_SAMPLE_RATE` | 0–1, default `0.1` |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Phase 2. Consent-gated; PII exclusion rules in `analytics-plan.md`. |

PII scrubbing is configured in Sentry **before** the first deploy, not after the
first leak.

---

## Feature gates

| Variable | Default | Notes |
|---|---|---|
| `FEATURE_FCRA_ENABLED` | `false` | **Leave false.** Sailent Foundation is not FCRA registered, so accepting a foreign contribution is unlawful — not merely unbuilt. This gate opens only on registration. |
| `FEATURE_MOCK_DATA` | `true` | Development fixtures. **Must be `false` in production**; the schema enforces it. |

---

## Secrets policy

- **Never commit a real `.env`.** It is gitignored and CI scans every pull
  request for committed credentials.
- `.env.example` documents **names only**, never values.
- Production credentials never exist on a developer machine. Local development
  uses test keys and a seeded database.
- Rotate payment keys and the webhook secret every 90 days, or immediately on
  any suspicion. JWT signing keys every 180 days with an overlap window so
  existing sessions survive.
- A committed credential is **burned**: rotate it, do not just remove the commit.

Full policy: [`security-architecture.md`](security-architecture.md) §8.

---

## Adding a variable

1. Add it to `.env.example` with a comment and a `[PHASE N]` marker if deferred.
2. Add it to the right schema in `packages/config/src/env.ts`. Wrap optional
   ones in `optional()` so a blank value means "not set".
3. If it must be present in production, add it to the `superRefine` block.
4. Document it here.
5. Read it through the typed config object — **never** `process.env` directly in
   application code. A typo is then a compile error rather than a silent
   `undefined`.
