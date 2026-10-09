# DEPLOYMENT.md — environments, local development, migrations, releases

This document gives environment variable **names** only. It never contains secret values: no passwords, keys, tokens or connection strings with credentials. Status is as of **2026-10-06**:
- The application is **not deployed** to any hosting. There are no Dockerfiles, no IaC and no deploy workflow. The owner's intended host is **Google Cloud Run** (§8); that work is Phase 14.
- A **production Supabase database** exists (owner, 2026-10-06). Its state is unverified, and **AI agents must not access it** (`AGENTS.md` §8).

> **THE HUMAN OWNER APPROVES EVERY COMMIT, PUSH, MERGE AND PRODUCTION ACTION.**

## 1. Environment model

| Environment | `APP_ENV` | Database | Redis | Agents may… |
|---|---|---|---|---|
| **LOCAL** | `development` | `sailent_dev` on local Postgres (`DATABASE_URL`) | `REDIS_URL` (DB 0) | migrate/seed with `--target=local`, run the app |
| **TEST** (API integration tests) | `test` | `TEST_DATABASE_URL`. Locally this is `sailent_dev`; CI uses a service container `sailent_test` | `TEST_REDIS_URL` (DB 1) | run tests |
| **E2E** (Playwright) | `development` (set by `prepare-e2e`) | `sailent_e2e` (`E2E_DATABASE_URL`) | `E2E_REDIS_URL` (DB 2) | `db:prepare-e2e`, run Playwright |
| **PRODUCTION** | `production` | The hosted Supabase project (session pooler, TLS verified with `DATABASE_CA_CERT`). The guard's `PRODUCTION_DATABASE_HOST` is a shared regional pooler host, so it does not by itself identify the project; the owner confirmed the project on 2026-10-06. | none provisioned | **nothing. Humans only.** |

**There is no staging environment.**
- `APP_ENV=staging` is accepted by the code's environment guard, but no staging database or hosting exists.
- Older documents (`docs/phase-8.md` §13.6, §16.1) describe the hosted Supabase project as "development/staging". The owner confirmed on 2026-10-06 that it is the **production** project, the one the production guard is meant to protect.

**The runtime guard** `assertRuntimeDatabaseTarget` (`packages/database/src/lib/database-target.ts`) enforces the database for each environment:
- `development` and `test` must use a local database (`sailent_dev`, `sailent_e2e` or `sailent_test`);
- `production` must use the production host;
- `staging` must use neither.

## 2. Production database access policy (permanent; see `AGENTS.md` §8)

**PRODUCTION DATABASE IS OFF LIMITS TO AI AGENTS BY DEFAULT.** Agents must not:
- connect to it or run SQL against it;
- migrate it, seed it (including `--reference`), reset it, harden it or truncate it;
- change its data, users, roles, permissions, settings or configuration.

Every production database action needs **explicit human approval** for that action, and is **run by a human** through §9–§10. Agents may prepare migration files, commands and runbooks for review.

## 3. Local development (self-contained)

### Requirements

| Requirement | Detail |
|---|---|
| Node | `engines.node` is `>=20.9.0`. **CI uses Node 22** (`NODE_VERSION: '22'`). There is **no `.nvmrc`**: use Node 22 to match CI. Standardising the version is a future task. |
| Package manager | pnpm `9.15.4` (`packageManager`); `engines.pnpm >=9` |
| PostgreSQL | 17, local. Databases: `sailent_dev` (app) and `sailent_e2e` (E2E). The API tests use `TEST_DATABASE_URL`. |
| Redis | 7, local, on the default port. DB 0 for the app, DB 1 for tests (`TEST_REDIS_URL`), DB 2 for E2E (`E2E_REDIS_URL`). Redis is required: the API throttler and queues use it, and so does the worker. |
| Postgres + Redis setup | **Native** (Homebrew or similar) or **Docker**: `pnpm infra:up` starts `infrastructure/docker-compose.yml` (Postgres 17 + Redis 7, local-only default credentials). Either works; the connection strings in `.env` must match. |

### Environment file

Copy `.env.example` to `.env` at the repo root (`.env` is gitignored), then adjust to your local services. **Never commit `.env`.**

**Required to run locally** (from `packages/config/src/env.ts`):

| App | Variables |
|---|---|
| API | `DATABASE_URL`, `REDIS_URL` (no defaults) |
| Worker | `DATABASE_URL`, `REDIS_URL` |
| Web | `API_URL` (defaults to `http://localhost:4000`) and `NEXT_PUBLIC_APP_URL` (defaults to `http://localhost:3000`). Set `API_URL` explicitly: the web code uses `??`, so a *blank* value does not fall back. |
| Runtime | `APP_ENV=development`, `NODE_ENV=development` (these are the defaults) |

**Optional locally:**
- `FEATURE_MOCK_DATA`: defaults to on outside production; it enables fixture fallback and the dev OTP log. `false` or `0` turns it off; it is always off when `APP_ENV=production`.
- `FIELD_ENCRYPTION_KEY`: without it, saving a donor's PAN returns 503 (everything else works). Generate a local-only key with `openssl rand -base64 32`; the API tests use their own fixed test key.
- `JWT_*`: a development fallback secret is used if unset.
- `RAZORPAY_*`: without them, payments are unavailable (§6).
- `BREVO_*`: without them, email is not sent.
- `R2_*`: without them, uploads return 503.
- `TEST_DATABASE_URL`, `TEST_REDIS_URL`, `E2E_DATABASE_URL`, `E2E_REDIS_URL`.

### First run

```bash
pnpm install
pnpm --filter @sailent/config --filter @sailent/database build   # some apps import package dist output
pnpm db:migrate --target=local
pnpm db:seed --target=local       # reference data + demo content (LOCAL only)
pnpm build                        # builds all packages and apps
pnpm dev                          # web :3000 · API :4000 (/api/v1) · worker health :4001
```

Build the workspace packages (`pnpm build`) before `pnpm dev`, and again after changing a package that apps import from `dist` (`@sailent/config`, `@sailent/database`, `@sailent/validation`, `@sailent/types`).

### Signing in locally

**Staff (admin):**
1. Open `http://localhost:3000/admin/login`.
2. Sign in with a seeded account. The current seed creates `admin@sailent.local` and `staff@sailent.local`, both `SUPER_ADMIN`.
   - **The shared development password** is published deliberately for local use. It is in `docs/database-development.md` under "Development credentials", and the seed stores only its hash (`DEV_PASSWORD_HASH` in `packages/database/src/seed/index.ts`). It is not repeated here.
   - **No second factor in practice:** TOTP is not enforced for `SUPER_ADMIN`.
   - **Lockout:** an account locks for 15 minutes after 5 failures.
   - **Older local databases** may also hold accounts from earlier seeds and from API test runs.
3. Sensitive admin actions prompt for the password again (5-minute re-authentication).

**Donor:**
1. Open `http://localhost:3000/sign-in` and enter an email address.
2. In development, when `FEATURE_MOCK_DATA` is on and the environment is not production, the **API process console** logs the code at warn level as `[dev] OTP for <email>: <code>` (`apps/api/src/modules/auth/auth.service.ts`).
   - The code is also emailed if Brevo is configured.
   - Codes expire after 10 minutes, allow 5 attempts, and are limited to 3 per 15 minutes per email address.
3. Verifying a code signs the donor in, and creates a donor record if none exists.

## 4. Running E2E safely

`next dev` and `next start` share `apps/web/.next`. **Do not build or run Playwright in the main checkout while `next dev` is running.** Use an isolated copy:

1. Copy the repository:
   ```bash
   rsync -a --delete --exclude node_modules --exclude .next --exclude .turbo --exclude dist \
         --exclude test-results --exclude playwright-report --exclude e2e/.auth ./ <scratch>/repo/
   ```
2. In `<scratch>/repo`, prepare and build:
   ```bash
   find . -name '*.tsbuildinfo' -not -path '*/node_modules/*' -delete
   pnpm install --frozen-lockfile --prefer-offline && pnpm build --force
   pnpm --filter @sailent/database db:prepare-e2e      # migrate + seed sailent_e2e (--target=local)
   rm -rf apps/web/.next/cache/fetch-cache              # clear stale cached API data if the DB changed
   ```
3. Run the specs (from `apps/web`):
   ```bash
   npx playwright test <spec> [--project=desktop] [-g "<test title>"] --workers=2
   ```

Playwright starts its own API on 4100 and web on 3100 (`E2E_API_PORT`, `E2E_WEB_PORT`). `R2_*` is blanked, so upload tests expect a 503. More single-test commands are in `AGENTS.md` §7.

## 5. Build and CI

### Build
- `pnpm build` runs `turbo run build`. Outputs go to `dist/**` and `.next/**`.
- **Run commands (local):**
  - API: `node apps/api/dist/main.js`.
  - Worker: `node apps/worker/dist/main.js`.
  - Web: `next start`. The container build sets `NEXT_OUTPUT=standalone` and runs `apps/web/start-standalone.cjs` instead (§12).
- **The web build needs no API (Phase 14).** Content is fetched at request time (`loadContent` calls `connection()`), and the six `generateStaticParams` that fetched slugs at build were removed — every public page already rendered per request because the layout reads the session cookie. `pnpm check:web-build-isolation` (run it in a copy while `next dev` is up) builds with production settings against a stand-in API and fails if a single request reaches it. Before Phase 14 a production-mode build without an API failed at `/impact/[slug]`.
- `turbo.json`: `globalEnv: [NODE_ENV, APP_ENV]`; the `build` task also hashes and passes `NEXT_PUBLIC_APP_URL`, `MEDIA_PUBLIC_BASE_URL` and `NEXT_OUTPUT` (Phase 14 — before, Turborepo stripped them, so a build could reuse output made with different public values).
- **Incremental TypeScript trap:** a copied tree with `*.tsbuildinfo` but no `dist/` makes `tsc` emit nothing. Delete `*.tsbuildinfo` in copies (§4); `.dockerignore` excludes both.

### CI (`.github/workflows/ci.yml`)
**Triggers:** pushes to `main` (the workflow also accepts pull requests targeting `main`, but the project works directly on `main` and opens none unless the owner asks; `AGENTS.md` §9). Pushing `main` (owner approval required) is what runs CI.

**`quality` job** (Postgres 17 + Redis 7 services, Node 22):
1. install
2. lint
3. typecheck
4. build `@sailent/database` and run `pnpm db:migrate --target=local`
5. `pnpm db:seed --target=local`
6. test
7. build
8. `pnpm format:check`

**`security` job:** `pnpm audit --prod --audit-level high` and gitleaks.

**Known problems and gaps:**
- **Phase 14 (2026-10-07):** CI is unchanged. Its `pnpm build` step no longer needs a running API (above). Its `security` job will still fail at `pnpm audit --audit-level high` on one remaining high advisory (drizzle-orm, `SECURITY.md` §2 "Dependency scanning") until the owner approves the drizzle upgrade. Building the container images in CI is a recommended follow-up that needs the owner's approval (§12).
- **CI has not yet been verified on GitHub (as of 2026-10-06).** Commit `0e94632` (2026-10-06) added `--target=local` to the migrate and seed steps. Before it, the target guard refused both commands, so every run stopped at "Apply migrations". `0e94632` had not been pushed when this was written, so no GitHub Actions run has used it. **CI is not considered passing until a GitHub Actions run succeeds after the push.** That first run may expose failures the broken step had hidden (for example, the build without a running API).
- **Not run in CI:** E2E and deployment.
- **No `permissions:` block** in the workflow.

## 6. Local payment behaviour (without Razorpay credentials)

This is **development behaviour**, and it **never represents a successful payment.** Verified in code on 2026-10-06:

1. `POST /api/v1/donations` validates the campaign and prices, then **commits** a `pending` donation, its line items and a payment row in one transaction (`apps/api/src/modules/donations/donations.service.ts`).
2. **After** that commit, it asks Razorpay for an order. With no `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`, `RazorpayClient` (`razorpay.client.ts`) throws `ServiceUnavailableException`, so the request returns **HTTP 503**: "Online payments are not configured on this server. No money has been taken."
3. The donation **stays `pending`** until payment reconciliation (Phase 11) cancels it: with no Razorpay order there is nothing to look up, so once it is older than 24 hours it becomes `cancelled` — provided the worker is running with `INTERNAL_API_SECRET` set (§6a). Without that, it stays pending.
4. If the donation included **limited-quantity campaign products**, those units count as **held for 30 minutes** (`HOLD_MINUTES = 30`) against availability. Custom-amount-only donations hold nothing.
5. No receipt is issued, no counters change, and no email is sent. A donation becomes successful only through checkout verification or the webhook, which both need Razorpay.

The API tests mock the Razorpay client. A live test-mode payment has never been run.

## 6a. Payment reconciliation, retries and per-client limits (Phase 11, 2026-10-07)

**Reconciliation and pending expiry.** The worker schedules a repeatable BullMQ job (`payments.reconcile` on the `payments` queue, schedule id `payments-reconcile`, every `PAYMENT_RECONCILE_INTERVAL_MS`, default 10 minutes). The job calls the API's internal endpoint `POST /api/v1/internal/payments/reconcile` with `INTERNAL_API_SECRET` in `x-sailent-internal-auth`; the API does the work (`PaymentReconciliationService`), so capture logic exists in one place.
- Pending donations older than **15 minutes** are checked against Razorpay (`GET /orders/:id/payments`). A captured payment is recorded through the normal capture path (source `reconciliation`), exactly once.
- Pending donations with nothing paid after **24 hours** become **`cancelled`** (never deleted). Not if Razorpay holds an `authorized` payment, or a captured payment that does not match (those stay pending and appear under **Finance → Payment exceptions**).
- `failed` donations from the last 72 hours are re-checked for a later successful retry on the same order; they are never cancelled.
- A late payment on a cancelled donation is still recorded (capture moves any non-successful state forward).
- **Scheduling requirement (human, at deployment):** run the worker with `API_INTERNAL_URL` (the API's address as the worker reaches it) and `INTERNAL_API_SECRET` (the same value as the API). Both are required in production by `workerEnvSchema`; without them the worker removes the schedule and logs a warning. BullMQ keeps one schedule under a fixed id, so several worker instances do not multiply runs.

**Per-client rate limits.** The web server sends the real client address to the API in `x-sailent-client-ip`, with `INTERNAL_API_SECRET` in `x-sailent-internal-auth` (both stripped from anything a browser sends). The API believes the address only with the secret; otherwise it falls back to the connecting address (the old, site-wide behaviour). **Configure the web server (human, at deployment):**
- `INTERNAL_API_SECRET`: the same value as the API.
- `CLIENT_IP_HEADER`: the header your hosting puts the client address in (for example `x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`). **Unset means no address is derived**, deliberately: a guess would believe what the browser wrote.
- `TRUSTED_PROXY_HOPS`: for `x-forwarded-for` only, how many proxies you control append to it (default 1). The client is that many entries from the end.

**Checkout retries.** A failed attempt in Razorpay's window no longer ends the checkout; the donor can retry on the same order, and pressing Donate again for the same basket reopens the same donation and order. `POST /donations` accepts an optional `Idempotency-Key` (16–128 of `A–Z a–z 0–9 - _`), held in Redis for 30 minutes.

**Razorpay dashboard (human only):** live keys in production (`rzp_live_…`; a test key fails validation); the webhook at `{API}/api/v1/payments/razorpay/webhook` with its own secret, subscribed to `payment.captured`, `payment.failed`, `refund.created` and `refund.processed`; automatic capture on; **international payments disabled** (the organisation is not FCRA-registered). Verify Checkout on a real Android device during the sandbox trial — `Permissions-Policy` now allows `payment` for Razorpay's origins only.

## 6b. Account and security configuration (Phase 12, 2026-10-07)

**Staff authentication** is email and password. Staff TOTP/2FA is **not required** (owner decision) and there is nothing to configure for it.

**`FIELD_ENCRYPTION_KEY` (API only; required in production).** Encrypts donors' PANs (AES-256-GCM). 32 random bytes as base64 (`openssl rand -base64 32`) or 64 hex characters; the API refuses to start in production without a valid key. **Human only:**
- generate it once per environment, store it in the hosting provider's secret store and a separate secure backup. **Losing it makes every stored PAN unreadable;** anyone holding it and a database copy can read them;
- never reuse the local or test key, and never give it to the web or worker;
- rotation is not automated: changing the key requires decrypting with the old key and re-encrypting with the new one, run by a human with approval;
- **existing plaintext PANs in production** (written before Phase 12) keep working — they are read as-is and encrypted on their next save. Re-encrypting them in bulk is a human-prepared, human-run, owner-approved step; agents do not run it (`AGENTS.md` §8).

**Web server (production).** At startup the web validates its environment (`apps/web/src/instrumentation.ts`) and refuses to run unless:
- `FEATURE_MOCK_DATA=false`;
- `INTERNAL_API_SECRET` (same value as the API) and `CLIENT_IP_HEADER` are set (§6a);
- `NEXT_PUBLIC_APP_URL` is the public `https://` address;
- `apps/web/src/lib/demo-org.ts` no longer holds DEMO organisation data (replace it with the real details).

Set **`APP_ENV=production`** when building and starting the web: it turns on HSTS (two years, subdomains, no preload). Serve the site over HTTPS only before doing so. `TRUSTED_ORIGINS` (comma-separated) lists any extra origins allowed to POST through the BFF — normally empty, because the site's own origin is always allowed.

**Worker (production):** `APP_PUBLIC_URL` must be the public `https://` address used in email links.

**Content-Security-Policy.** Scripts load only from the site and `checkout.razorpay.com`. If a new third-party script or embed is added (analytics, chat, video), its origin must be added to `apps/web/src/lib/security/content-security-policy.ts`, or the browser will block it.

## 6c. CMS and communications configuration (Phase 13, 2026-10-07)

**Migration `0023` (HUMAN, production).** Adds `contact_messages`, `newsletter_subscribers`, the EMPTY `organization_contact` and `organization_social` settings rows, and six permissions (`document.delete`, `contact.read`, `contact.manage`, `newsletter.read`, `faq.read`, `faq.manage`) granted to `SUPER_ADMIN` — all idempotent. Apply with the normal human migration procedure (§9). **No reference reseed is needed** for the new permissions or settings. Until it is applied, the new admin screens answer 403/500 and the contact and newsletter forms fail.

**Organisation details (staff, in Admin → Settings).** Enter the contact email (contact-form messages are emailed there), phone, office hours, postal address, social links, and the registration details (registration number, PAN, 12A, 80G, registered as, trust deed, date of registration, CSR-1). The public site shows only what is entered; the DEMO values are never shown in production. The registration number is printed on receipts issued afterwards.

**Email (Brevo, §7).** Contact notifications, newsletter confirmations, staff invitations and password-reset links go through the existing transactional email (`BREVO_*`) and use the worker's `APP_PUBLIC_URL` for links. Without Brevo, contact messages are still stored (Admin → Messages) and the send log shows `not_configured`; invitations and resets cannot be delivered, so the CLI scripts (§10) stay the way to create the first administrator.

**`MEDIA_PUBLIC_BASE_URL` (web, BUILD time).** The same value as the API's `R2_PUBLIC_BASE_URL`. `next.config.ts` turns it into the allowed remote image host, so library covers and gallery images render through `next/image`. Unset, no remote image is allowed (as before).

**Existing images keep their EXIF/GPS (HUMAN, optional, production).** Phase 13 strips metadata from NEW uploads only. Objects uploaded earlier (media library and image documents) are unchanged. To clean them, a human would download each object, run it through the same byte-level stripper (`apps/api/src/modules/storage/strip-metadata.ts`), and re-upload it under the same key — with approval, against production storage, never by an agent. Until then, assume older photographs may carry location data.

**Staff accounts.** Inviting a staff member now emails a single-use link (7 days); "Forgot your password?" on `/admin/login` emails a 1-hour link, and a reset signs out every session. Staff 2FA remains not required (owner decision).

## 7. External services

| Service | Used by | Env var names | Status (as of 2026-10-06) |
|---|---|---|---|
| PostgreSQL / Supabase | api, worker, scripts | `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `DATABASE_CA_CERT`, `DATABASE_INSECURE_TLS`, `PRODUCTION_DATABASE_HOST` | Local in use. **The production Supabase project exists**: session pooler on 5432 (6543 is refused), CA at `infrastructure/certs/supabase-prod-ca-2021.crt`. |
| Redis | api, worker | `REDIS_URL`, `TEST_REDIS_URL`, `E2E_REDIS_URL` | Local. Production: Memorystore over Direct VPC egress (§14). |
| Cloudflare R2 | api only (the web reads only `MEDIA_PUBLIC_BASE_URL`) | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_PUBLIC`, `R2_BUCKET_PRIVATE`, `R2_PUBLIC_BASE_URL` | Implemented. Not set locally. The web's `MEDIA_PUBLIC_BASE_URL` must equal `R2_PUBLIC_BASE_URL`; it becomes one exact `images.remotePatterns` entry (no wildcard). In production both must be `https`, with no credentials, query or fragment — the API, the web's start-up check and the web build all refuse otherwise (Phase 14). |
| Razorpay | api (the web loads `checkout.js`) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Implemented; no keys anywhere. Webhook: `POST {API}/api/v1/payments/razorpay/webhook`. Production requires a live key (§6a). |
| Brevo | worker | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `APP_PUBLIC_URL` | Implemented; optional |
| Sentry | api, worker, web (server side only) | `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` | Implemented (Phase 14), off unless `SENTRY_DSN` is set; scrubbed (§17). `NEXT_PUBLIC_SENTRY_DSN` is reserved and unused. |
| GA4 | — | `NEXT_PUBLIC_GA_MEASUREMENT_ID` | **Not wired** (Phase 14 decision: no consent mechanism yet; §17) |
| SMS | — | `SMS_*` | Declared, unused |

Other variable names:

| Scope | Variables |
|---|---|
| Web | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`, `MEDIA_PUBLIC_BASE_URL` (build time), `NEXT_OUTPUT` (build time, `standalone` in the image), `API_URL`, `FEATURE_MOCK_DATA`, `INTERNAL_API_SECRET`, `CLIENT_IP_HEADER`, `TRUSTED_PROXY_HOPS` |
| API | `PORT` (Cloud Run; wins over `API_PORT`), `API_PORT`, `API_HOST`, `DATABASE_POOL_MAX`, `CORS_ORIGINS`, `SWAGGER_ENABLED`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (unused), `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DONOR`, `JWT_REFRESH_TTL_STAFF`, `FIELD_ENCRYPTION_KEY` (unused), `FEATURE_FCRA_ENABLED` (unused), `INTERNAL_API_SECRET` |
| Worker | `PORT` (Cloud Run; wins over `WORKER_PORT`), `WORKER_CONCURRENCY`, `WORKER_PORT`, `API_INTERNAL_URL`, `INTERNAL_API_SECRET`, `PAYMENT_RECONCILE_INTERVAL_MS` |
| Scripts and tests | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`, `ALLOW_REMOTE_TEST_DB`, `DRIZZLE_AUTHORISED_URL`, `PLAYWRIGHT_BASE_URL`, `CI` |

**Production requirements enforced by `apiEnvSchema`:**
- `JWT_*`, `RAZORPAY_*`, `R2_*` and `INTERNAL_API_SECRET` are required;
- `RAZORPAY_KEY_ID` must be a live key (`rzp_live_…`);
- `SWAGGER_ENABLED`, `DATABASE_INSECURE_TLS` and `FEATURE_MOCK_DATA` must be false.

**Also enforced by `apiEnvSchema` in production (Phase 14):** `R2_PUBLIC_BASE_URL` is a safe public `https` base URL.

**Enforced by `workerEnvSchema` in production:** `API_INTERNAL_URL` and `INTERNAL_API_SECRET`.

**Enforced by `webEnvSchema` at start-up (`instrumentation.ts`, Phase 12; the container wrapper exits on failure, Phase 14):** `INTERNAL_API_SECRET`, `FEATURE_MOCK_DATA=false`, public `https` URLs, and a safe `MEDIA_PUBLIC_BASE_URL` in production. A malformed `SENTRY_DSN` is refused on all three services.

## 8. Production architecture on Google Cloud Run (Phase 14; owner decision — NOT YET DEPLOYED)

```
                 Donors, staff ──► Cloudflare (DNS, TLS, WAF, cache for static assets)
                                        │
             ┌──────────────────────────┴───────────────────────────┐
             ▼                                                      ▼
   Cloud Run: sailent-web  (Next.js, public)          Razorpay webhooks ─────┐
     │  server-side only, with INTERNAL_API_SECRET                           │
     ▼                                                                       ▼
   Cloud Run: sailent-api  (NestJS, public: web server + Razorpay webhook)
     │        │            │              │                 │
     │        │            │              │                 └─► Sentry (errors, scrubbed)
     │        │            │              └─► Cloudflare R2 (public + private buckets)
     │        │            └─► Razorpay API (orders, payment fetch)
     │        └─► Memorystore Redis (private VPC: queues, rate limits, idempotency)
     ▼
   Supabase Postgres (production; session pooler, TLS verified)
     ▲
     │        ┌─► Brevo (transactional email)
   Cloud Run: sailent-worker  (BullMQ consumer, INTERNAL, 1 instance, CPU always on)
              └─► calls sailent-api /internal/payments/reconcile every 10 min
```

| Component | Where it runs | Why |
|---|---|---|
| **Web** (`apps/web`) | Cloud Run service `sailent-web`, public | Request-time rendering; the browser never calls the API (decision A1) |
| **API** (`apps/api`) | Cloud Run service `sailent-api`, public | The web server calls it server-side; Razorpay must reach the webhook |
| **Worker** (`apps/worker`) | Cloud Run service `sailent-worker`, **internal** ingress, exactly 1 instance, **CPU always allocated** | Consumes queues outside any request; runs the reconciliation schedule |
| Database | **Supabase** (production project, external) | Owner decision; human-only access (§2) |
| Redis | **Memorystore for Redis**, same region, reached over Direct VPC egress — never public | BullMQ needs a durable, non-evicting Redis (§17) |
| Object storage | **Cloudflare R2** (external) | Existing architecture; credentials on the API only |
| Payments | **Razorpay** (external) | Dashboard configuration is human-only (§6a) |
| Email | **Brevo** (external) | Existing transactional email |
| Error tracking | **Sentry** (external, optional) | Server-side errors, scrubbed (§17) |
| Logs and metrics | **Cloud Logging / Cloud Monitoring** (built in) | JSON logs with `severity`, `service`, `environment`, `requestId` |
| Scheduling | **None external** — the always-on worker owns the one schedule (§18) | No Cloud Scheduler needed |

**Region:** `asia-south1` (Mumbai) — next to the Supabase pooler in `ap-south-1`, so each query does not cross a continent.

**Nothing else is introduced**: no Kubernetes, no load balancer of our own (Cloud Run's front end, with Cloudflare in front), no second database, no message broker besides Redis.

**Status:** the images, service templates and procedures exist (§11–§21); **nothing has been deployed**, no project, secret, DNS record or certificate has been created. All of that is human work with the owner's approval.

## 9. Migration procedure

**Authoring** (agents may do this; it is the rule in `AGENTS.md` §5):
1. Write the SQL by hand. No `BEGIN`/`COMMIT`; enable RLS on new tables; guard data-dependent constraints.
2. Add the journal entry and update the TS schema.
3. Run `pnpm db:migrate --target=local`, the API tests, and `db:prepare-e2e` with E2E.
4. **Do not use `db:generate` or `db:push`.**

**Applying to production (HUMAN ONLY, with explicit approval):**
1. Verify the production schema version first: compare its `drizzle.__drizzle_migrations` with the repository journal.
2. Take a backup or PITR point.
3. Set `DATABASE_MIGRATION_URL` to the session pooler (port 5432), then run `pnpm db:migrate --target=production --confirm-host=<host>`.
4. Never edit an applied migration. Migrations are forward-only; there are no down migrations.

## 10. Seeding and production (HUMAN ONLY, with explicit approval)

How the seed behaves, verified in `packages/database/src/seed/index.ts`:

**Which database it writes to.**
- It reads **only `DATABASE_URL`**. It ignores `DATABASE_MIGRATION_URL`, `TEST_DATABASE_URL` and `E2E_DATABASE_URL` by design.
- **Before connecting, it runs the target guard:** `--target=local` or `--target=production --confirm-host=<host>` is required, and the guard checks that the URL matches.

**What `--reference` changes** (the "reference" tier):
- It **deletes and re-inserts every permission grant of the `SUPER_ADMIN` role**. In between there is a **window in which the only administrator role has no permissions**: an admin lockout.
- It **deletes permissions** that are no longer in the catalogue (`seed/permissions.ts`); their grants cascade.
- It **retires legacy roles**: users holding them are moved to `SUPER_ADMIN`, and the roles and grants are deleted.
- It **upserts categories, including their names and slugs.** Slugs are public URLs.
- It upserts settings, but **only their description and category; existing values are kept.**
- It upserts notification templates, but **only name, description and variables; edited subjects and bodies are kept.**

**What the default mode (no `--reference`) adds**, after the reference tier: the demo tier.
- Fictional campaigns, donors and donations.
- Development staff accounts with a published password.
- It **deletes all** `impact_updates`, `faqs` and `campaign_gallery` rows.

**The demo-data safety gate** (`assertDemoSeedAllowed`) refuses **only** when `APP_ENV` or `NODE_ENV` is `production`. **It does not look at `--target`.** So `--target=production` with `APP_ENV=development` would pass the target guard **and** the demo gate, and write demo data and published-password accounts to production.

**Therefore:**
- **Never run `pnpm db:seed` (any mode) against production casually.**
- `--reference` on production is a human-only operation with explicit approval, run with `APP_ENV=production`, at a quiet time, with another way to recover admin access if needed.
- **The demo tier must never run on production.**

**Other production scripts** (`packages/database`), all **human-only with approval**:
- `db:create-admin` (uses `ADMIN_*` variables)
- `db:rotate-admin-password`
- `db:harden` (dry run unless `--confirm`): suspends `@sailent.local` accounts and revokes their sessions

## 11. Release procedure (Cloud Run; every step HUMAN, with the owner's approval)

1. The owner approves the commit(s) and the push to `main`, and the GitHub Actions run on that head has succeeded.
2. Run the full Playwright suite in an isolated copy (§4).
3. **Build and push the images** (§12). Tag them with the commit SHA (`git rev-parse --short HEAD`).
4. **Back up first if the release has a migration** (§19), then a human applies the migrations (§9). Migrations are additive and the old revision must keep working against the new schema; a release whose code cannot run against the old schema is deployed in two steps.
5. **Deploy in order: API → worker → web** (§12), each with `gcloud run services replace`. Cloud Run sends traffic to a new revision only after its startup probe passes; a revision that fails it never serves.
6. **Check health** (§17):
   - `GET https://<api>/api/v1/health` and `/api/v1/health/ready` (200, `status: ok`);
   - worker: Cloud Run shows the revision ready (its ingress is internal, so it cannot be reached from outside); the logs show `Worker started` and, when configured, the reconciliation schedule;
   - web: `GET https://<site>/api/health`.
7. **Smoke test:** home page, a campaign page, `/campaigns`, admin sign-in, one real-money donation of the smallest amount and its webhook (or a test-mode donation on a staging deployment), and the confirmation email.
8. Watch errors and logs for 30 minutes (§17). If anything is wrong, roll back (§20).

## 12. Containers, build and deploy (Phase 14)

**Images** — one Dockerfile per service, all built **from the repository root** (the build needs the whole workspace):

| Image | Dockerfile | Runtime contents | Start command | Size of the runtime tree (measured locally) |
|---|---|---|---|---|
| API | `apps/api/Dockerfile` | `pnpm deploy --prod` output: production dependencies, compiled `dist/`, workspace packages with their `dist/`; the Supabase CA certificate | `node dist/main.js` | ~117 MB + Node base |
| Worker | `apps/worker/Dockerfile` | the same, for the worker | `node dist/main.js` | ~47 MB + Node base |
| Web | `apps/web/Dockerfile` | Next.js standalone output, `.next/static`, `public/`, `start-standalone.cjs` | `node apps/web/start-standalone.cjs` | ~127 MB + Node base |

What every image does and does not do:
- **Multi-stage.** The build stage has pnpm, the full dependency tree and the sources; the runtime stage has none of those.
- **Base image:** `node:22-bookworm-slim` (Node ≥ 22.12 is required: the API loads ESM workspace packages with `require`). Override with `--build-arg NODE_IMAGE=…` to pin a digest.
- **Runs as `node`** (uid 1000), not root. `NODE_ENV=production`, `PORT=8080`.
- **Starts `node` directly** (exec form), so Cloud Run's SIGTERM reaches the process: the API closes the HTTP server and its database pool, the worker stops taking jobs and finishes the current ones, the web server finishes requests in flight.
- **Never runs a migration, seed or hardening script.** Migrations are a separate human step (§9).
- **Contains no `.env` and no secret.** `.dockerignore` excludes every `.env*`, `*.pem`, `*.key`, `node_modules`, build output and `.git`. Configuration arrives at run time from Cloud Run (§15, §16).
- **No localhost.** Every address comes from the environment; the API and worker refuse to start in production without the variables they need (`packages/config/src/env.ts`), and the web image does the same through `start-standalone.cjs` (it runs the environment check first and exits 1 on a bad configuration — in standalone mode Next.js would otherwise start and fail every request).
- **The web image is built per site.** `NEXT_PUBLIC_APP_URL` and `MEDIA_PUBLIC_BASE_URL` are compiled into the client bundle and the image optimiser's allow-list, so they are build arguments (`APP_ENV`, `NEXT_PUBLIC_APP_URL`, `MEDIA_PUBLIC_BASE_URL` — nothing else, nothing secret). Changing the site or media domain means a new web image.
- **The web build needs no API, database or secret** (§5).

**Build and push** (from the repository root; requires an Artifact Registry repository named `sailent` in the region):

```bash
gcloud builds submit --config infrastructure/cloud-run/cloudbuild.yaml \
  --substitutions=_REGION=asia-south1,_IMAGE_TAG=$(git rev-parse --short HEAD),_SITE_URL=https://<site>,_MEDIA_PUBLIC_BASE_URL=https://<media host> .
```

`cloudbuild.yaml` builds and pushes only — it has no deploy step (`pnpm check:deploy` enforces this). Local equivalent: `docker build -f apps/api/Dockerfile -t sailent-api .` (and likewise for the worker and web, the web with the three `--build-arg`s).

**Deploy** (human, approved, per service, in the order of §11):

```bash
export PROJECT_ID=<project> REGION=asia-south1 IMAGE_TAG=<sha> SITE_URL=https://<site> \
  API_URL=https://<api host> MEDIA_PUBLIC_BASE_URL=https://<media host> \
  VPC_NETWORK=<network> VPC_SUBNET=<subnet> BREVO_SENDER_EMAIL=<sender> CLIENT_IP_HEADER=cf-connecting-ip
envsubst < infrastructure/cloud-run/api.service.yaml > /tmp/api.yaml   # review it
gcloud run services replace /tmp/api.yaml --region "$REGION"
```

The first deploy of `sailent-api` gives its `https://…run.app` URL; use it (or a custom domain) as `API_URL` for the worker and web. `CORS_ORIGINS` on the API is the site's origin. Neither the web nor the API is ever deployed automatically: CI does not build images, and nothing here is wired to a trigger. Wiring Cloud Build to `main` is a later decision for the owner.

**Not verified in this repository's environment:** Docker and `gcloud` are not installed on the development machine, so the images have **not** been built here. The runtime layout of each image was exercised instead (`DEVELOPMENT_STATUS.md` §2 records the dry runs), and `pnpm check:deploy` checks the files. The first `gcloud builds submit` is the first real image build; check its log.

## 13. Cloud Run service settings

Templates: `infrastructure/cloud-run/{api,worker,web}.service.yaml` (placeholders `${…}`, filled with `envsubst`). Every service uses its own service account (`sailent-api@…`, `sailent-worker@…`, `sailent-web@…`) with only `roles/secretmanager.secretAccessor` on its own secrets (§16).

| Setting | API | Worker | Web |
|---|---|---|---|
| Ingress | all (web server + Razorpay webhook) | **internal** | all |
| Instances (min–max) | 1–3 | **1–1** | 1–5 |
| CPU | 1, throttled between requests | 1, **always allocated** (`cpu-throttling: 'false'`) | 1, throttled |
| Memory | 1 GiB | 512 MiB | 1 GiB |
| Concurrency | 40 | 10 (only probes arrive) | 80 |
| Request timeout | 300 s (admin CSV export) | 30 s | 60 s |
| Startup probe | `/api/v1/health/ready` | `/ready` | `/api/health` |
| Liveness probe | `/api/v1/health` | `/health` | `/api/health` |
| VPC (Direct VPC egress, private ranges) | yes — Redis | yes — Redis | no |
| Startup CPU boost | on | on | on |

**Why the worker is different.** Cloud Run normally gives a container CPU only while it is handling a request. The worker handles no requests — it pulls jobs from Redis — so with throttled CPU it would stall, and with `min-instances: 0` it would not exist at all. It therefore runs exactly one instance with CPU always allocated. Exactly one also keeps the reconciliation schedule simple (BullMQ's job scheduler would de-duplicate several workers anyway). It is billed for every second it runs (§14).

**Minimum one instance** on the API and web avoids cold starts on the donation path. Setting them to 0 is acceptable for a staging deployment.

**More than one web instance signs people out unless requests stick (2026-10-09, not yet decided).** The web server renews a signed-in session in its middleware and remembers each renewal for 60 seconds, so the several requests of one page load share it (`apps/web/src/lib/auth/session-refresh.ts`). That memory is per instance. With `maxScale` above 1, two requests from one browser can reach different instances; the second has no memory of the renewal, sends the spent refresh token to the API, and the API revokes the session as a replay — the donor is signed out. Before the web service runs more than one instance, choose one (owner decision):
- **Session affinity** on the web service (`gcloud run services update sailent-web --session-affinity`, or `run.googleapis.com/sessionAffinity: 'true'` in `web.service.yaml`) — best-effort, so it makes the collision rare rather than impossible;
- **one web instance** (`maxScale: '1'`) to start with;
- or later, **move that 60-second memory to Redis**, shared by every instance (needs the web service on the VPC, as the API is).

The templates do not set any of these yet (`web.service.yaml` allows 1–5 instances).

**Shutdown.** Cloud Run sends SIGTERM and waits 10 seconds before SIGKILL. The API closes its server, database pool and queues; the worker stops taking jobs, waits for running ones, flushes error reports and closes its connections. A job interrupted by SIGKILL is retried by BullMQ after its lock expires (all jobs are safe to run twice, §18).

## 14. Sizing, concurrency, database connections and Redis

**Starting sizes** (in the templates; revise after a month of real traffic, using Cloud Monitoring's CPU, memory and latency per service):

| | Expected load | Starting point |
|---|---|---|
| Web | Mostly anonymous page views; each page is server-rendered and calls the API | 1 vCPU / 1 GiB, 80 concurrent, 1–5 instances |
| API | Page data for the web server, checkout, webhooks, admin | 1 vCPU / 1 GiB, 40 concurrent, 1–3 instances |
| Worker | Emails, reconciliation every 10 minutes | 1 vCPU / 512 MiB, always on, 1 instance, `WORKER_CONCURRENCY=5` |

The always-on minimum is roughly 3 vCPU and 2.5 GiB in total. Most of the cost is the always-allocated worker and the two minimum instances; consult the Cloud Run pricing page for the region rather than an estimate here.

**Database connections.** Each API instance opens up to `DATABASE_POOL_MAX` connections (default 20 in production, 5 elsewhere; the template sets 10). The worker uses a fixed pool of 4. The total must stay under the limit of the Supabase **session pooler** for the project's compute size (shown in the Supabase dashboard):

```
max API instances × DATABASE_POOL_MAX  +  worker pool (4)  +  ~5 for humans and scripts   ≤  pooler limit
            3     ×        10           +        4         +  5                        =  39
```

Raising `maxScale` on the API means lowering `DATABASE_POOL_MAX` or raising the Supabase compute size. Use the **session pooler (port 5432)**; the transaction pooler (6543) cannot hold the session state the API's transactions need (§7). The pool is closed on shutdown, so a rolling deploy does not leak connections.

**Redis.** Use **Memorystore for Redis** (Basic tier is enough to start; Standard for a replica) in the same region:
- reached over **Direct VPC egress** — never exposed publicly. Enable AUTH and in-transit encryption and use `rediss://:<auth>@<ip>:6378` in `REDIS_URL`;
- **`maxmemory-policy noeviction`**: BullMQ refuses to work correctly if Redis evicts keys, and evicted keys would lose jobs or idempotency records;
- holds only rebuildable state: queues and jobs, rate-limit counters, idempotency keys and the web/API caches. Losing it loses unsent emails and in-flight jobs, not money (payments reconcile against Razorpay, §18); no backup is needed (§19);
- size: 1 GB is ample (jobs are small and pruned after 1–7 days).

An external Redis such as Upstash also works (`rediss://` over the internet, no VPC), but each BullMQ poll is a billed command; Memorystore avoids that.

## 15. Production environment checklist (per service)

Values in **bold** come from Secret Manager (§16); everything else is a plain environment variable in the service template. The services validate their environment at start and refuse to boot when something below is missing or unsafe.

**API (`sailent-api`)**

| Variable | Value |
|---|---|
| `APP_ENV`, `NODE_ENV` | `production` |
| `PORT` | set by Cloud Run (8080); takes precedence over `API_PORT` |
| **`DATABASE_URL`** | Supabase **session pooler** URI, `sslmode=verify-full` (CA is in the image at `DATABASE_CA_CERT=/app/certs/supabase-prod-ca-2021.crt`) |
| `DATABASE_POOL_MAX` | 10 (§14) |
| **`REDIS_URL`** | Memorystore `rediss://…` |
| **`JWT_ACCESS_SECRET`**, **`JWT_REFRESH_SECRET`** | 64+ random characters each, different |
| **`INTERNAL_API_SECRET`** | 32+ random characters; the same value on all three services |
| **`FIELD_ENCRYPTION_KEY`** | 32-byte key (§16 — keep an offline copy) |
| **`RAZORPAY_KEY_ID`** (`rzp_live_…`), **`RAZORPAY_KEY_SECRET`**, **`RAZORPAY_WEBHOOK_SECRET`** | from the Razorpay dashboard (human-only, §6a) |
| **`R2_ACCOUNT_ID`**, **`R2_ACCESS_KEY_ID`**, **`R2_SECRET_ACCESS_KEY`** | an R2 API token scoped to the two buckets |
| `R2_BUCKET_PUBLIC`, `R2_BUCKET_PRIVATE` | `sailent-public`, `sailent-private` |
| `R2_PUBLIC_BASE_URL` | the public bucket's custom domain, `https://…` — must equal the web's `MEDIA_PUBLIC_BASE_URL` |
| **`BREVO_API_KEY`**, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` | Brevo, with the sender domain verified |
| `CORS_ORIGINS` | the site's origin |
| `SWAGGER_ENABLED`, `FEATURE_MOCK_DATA` | `false` (enforced) |
| **`SENTRY_DSN`**, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` | optional; release = image tag |

**Worker (`sailent-worker`)**: `APP_ENV`/`NODE_ENV`, **`DATABASE_URL`**, **`REDIS_URL`**, `APP_PUBLIC_URL` (the site, for links in emails), `API_INTERNAL_URL` (the API's URL) and **`INTERNAL_API_SECRET`** (both required in production), `WORKER_CONCURRENCY` (5), `PAYMENT_RECONCILE_INTERVAL_MS` (600000), **`BREVO_API_KEY`**, `BREVO_SENDER_*`, Sentry as above. `PORT` from Cloud Run takes precedence over `WORKER_PORT`.

**Web (`sailent-web`)**:
- build arguments (§12): `APP_ENV=production`, `NEXT_PUBLIC_APP_URL`, `MEDIA_PUBLIC_BASE_URL` (https, exact host, no wildcard);
- run time: `APP_ENV`/`NODE_ENV`, `API_URL` (the API's URL), `NEXT_PUBLIC_APP_URL` (same as the build), `FEATURE_MOCK_DATA=false` (the web treats unset as **on**), **`INTERNAL_API_SECRET`**, `CLIENT_IP_HEADER=cf-connecting-ip` behind Cloudflare, `TRUSTED_PROXY_HOPS=1`, Sentry as above.

**Client address (rate limits, audit):** `cf-connecting-ip` is trustworthy only if the service cannot be reached except through Cloudflare. A Cloud Run service with `ingress: all` also answers on its `*.run.app` address, where a caller can set that header to anything. Either take the direct address out of reach (a load balancer or domain mapping with `run.googleapis.com/default-url-disabled: 'true'`), or use `x-forwarded-for` with the right `TRUSTED_PROXY_HOPS`. After the first deploy, check one `auth.staff.login_succeeded` audit row against your own address before relying on either.

**Outside the services (human):** Razorpay webhook URL `https://<api>/api/v1/payments/razorpay/webhook` with the events in §6a; the R2 public bucket's custom domain; Cloudflare DNS and TLS for the site, API and media hosts; Brevo sender-domain DNS (SPF, DKIM); a SUPER_ADMIN account created with `db:create-admin` and `db:harden` run (§10). **GA4 is not wired** (§7) — leave `NEXT_PUBLIC_GA_MEASUREMENT_ID` unset.

## 16. Secret management

- **Google Secret Manager holds every secret**, one secret per variable, named `sailent-<variable-in-kebab-case>` (`sailent-database-url`, `sailent-jwt-access-secret`, …; the full list is in the templates). The templates reference `version: latest`; pin a version number if you want rotations to require a deploy.
- **Created by a human**, never by an agent, never in the repository: `printf '%s' "$VALUE" | gcloud secrets create sailent-jwt-access-secret --data-file=-` (with shell history off), then grant `roles/secretmanager.secretAccessor` **on that secret** to the service account(s) that need it — the API's on all its secrets; the worker's on database, Redis, internal secret, Brevo and Sentry; the web's on the internal secret and Sentry only. R2 and Razorpay credentials reach the API alone.
- **Never** put a secret in a `value:` field, a build argument, a Dockerfile, Cloud Build substitutions or a commit. `pnpm check:deploy` fails if a template sets a secret variable to a literal or contains a credential-shaped string.
- **Generate** with `openssl rand -base64 48` (JWT, internal secret) and `openssl rand -base64 32` (field encryption key).
- **Rotation:** add a new version, then deploy (or restart) the services that read it. Effects:
  - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`: everyone is signed out.
  - `INTERNAL_API_SECRET`: all three services together, or the web and worker fail their calls until all run the new value.
  - `RAZORPAY_WEBHOOK_SECRET`: change it in Razorpay and here together; missed webhooks are recovered by reconciliation (§18).
  - `FIELD_ENCRYPTION_KEY`: **do not rotate** without a re-encryption plan — data encrypted with the old key becomes unreadable.
- **`FIELD_ENCRYPTION_KEY` must also be kept offline** (a password manager the owner controls). A database backup is useless for encrypted fields without it.
- Access to Secret Manager is audited by Cloud Audit Logs; review who holds `secretAccessor` when people leave.

## 17. Health, monitoring and logging

**Health endpoints** — none reveals an error message, host name or version string:

| Service | Liveness (process is up) | Readiness (dependencies) |
|---|---|---|
| API | `GET /api/v1/health` → 200 | `GET /api/v1/health/ready` → 200 `ok` / 200 `degraded` (Redis or queues down: the site can still render and take donations' first steps) / **503 `unavailable`** (database down). Each check has a 2 s timeout; the result is cached for 5 s so probes cannot load the database. |
| Worker | `GET /health` → 200 | `GET /ready` → 200, or **503** when Redis or the database does not answer. Same timeout and cache. |
| Web | `GET /api/health` → 200, `Cache-Control: no-store` | (the same; the web holds no connections of its own) |

Cloud Run uses readiness as the startup probe (a revision that cannot reach its database never takes traffic) and liveness to restart a hung container. Liveness deliberately does **not** check dependencies, so a database outage does not restart every container in a loop.

**Logs.** All three services write one JSON object per line to stdout. Outside development each line carries `severity` (Cloud Logging's level field), `service`, `environment` and, on the API, `requestId` (also returned in the `X-Request-Id` header, so a user-reported error can be found). Redacted before writing: `Authorization`, `Cookie`, `Set-Cookie`, the internal-secret header, the idempotency key, the Razorpay signature, and password, token, OTP and secret fields. Useful queries in Logs Explorer: `resource.labels.service_name="sailent-api" severity>=ERROR`; `jsonPayload.requestId="<id>"`.

**Error tracking (optional): Sentry.** Set `SENTRY_DSN` (a secret) on a service to turn it on; unset, nothing is sent. Reported: unhandled API errors that become a 5xx (with request id, method, route without query string, status and error code), errors at start-up, worker jobs that exhausted their retries, unhandled rejections and uncaught exceptions, and Next.js server errors (`onRequestError`). Every event is scrubbed before it leaves the process (`packages/config/src/observability.ts`): no request body, cookies, query string, user block or breadcrumbs; only four safe headers; values whose key names a secret are replaced; JWTs, bearer tokens, Razorpay keys, PANs and email addresses inside any string are masked. At most 30 events per minute per process. The browser sends nothing (`NEXT_PUBLIC_SENTRY_DSN` is reserved and unused). The reporter is dependency-free; see `SECURITY.md` §2 "Error tracking" for why the Sentry SDK was not used.

**Alerts to create (human, in Cloud Monitoring):**
1. Uptime check on `https://<site>/api/health` and `https://<api>/api/v1/health/ready` from two regions, alerting after 2 failures.
2. Log-based alert: `severity>=ERROR` on `sailent-api` above a handful per 5 minutes.
3. Log-based alert on `sailent-worker` for `severity>=ERROR` — it covers `Job failed permanently — dead-lettered`, an email job that `failed permanently`, a reconciliation that failed all its attempts, and Redis connection errors.
4. Cloud Run: instance count at `maxScale` for 10 minutes (capacity), and 5xx ratio above 2%.
5. Supabase: connection count near the pooler limit, disk usage (Supabase dashboard).

**Analytics (GA4): not wired** (Phase 14 decision). There is no consent mechanism, and the privacy policy promises consent-based analytics; adding GA4 needs a consent banner and the legal review in Phase 15. `NEXT_PUBLIC_GA_MEASUREMENT_ID` stays unset and unused.

## 18. Scheduled and background jobs

| Job | Where | Trigger | Retry | Duplicate protection | Failure visible as |
|---|---|---|---|---|---|
| Payment reconciliation | worker → `POST {API_INTERNAL_URL}/api/v1/internal/payments/reconcile` with `INTERNAL_API_SECRET` | BullMQ job scheduler, every `PAYMENT_RECONCILE_INTERVAL_MS` (10 min); registered only when both variables are set (required in production) | 3 attempts, exponential backoff | one scheduler key; the API's reconciliation is idempotent (§6a) | error log + Sentry when exhausted; admin dashboard "payments need review" |
| Transactional emails (donation confirmation, login code, event and volunteer messages, contact acknowledgement, newsletter confirmation, staff invitation and reset) | worker, `email` queue | enqueued by the API | 3 attempts, exponential backoff (2 s, 4 s, 8 s) | deterministic job ids from the API; processors re-read state and skip what was already sent or no longer applies | error log + Sentry when exhausted; `notification_log` status `failed` (admin → Notifications) |
| Queue history pruning | BullMQ | on completion | — | — | completed jobs kept 24 h (max 1000), failed 7 days |

There is **no Cloud Scheduler job, cron job or other timer** in the system: the always-on worker owns the only schedule. Expired sessions, OTPs and tokens are rejected at use and need no sweeper; the `cleanup`, `reports` and `notifications` queues are registered but have no producers yet. Every job must be safe to run twice — BullMQ delivers at least once.

## 19. Backups and restore (HUMAN ONLY; nothing here has been run)

**What needs a backup:**

| Data | Where | Backup | Notes |
|---|---|---|---|
| Database (donations, receipts, donors, content, audit log) | Supabase | **Supabase daily backups** (Pro plan: 7 days) and, recommended, the **PITR add-on** (restore to any second) | The only system of record. Check the plan before launch. |
| Independent database copy | owner-controlled storage | `pg_dump --format=custom` weekly and before every migration, encrypted, kept off Supabase | Guards against losing the Supabase account itself |
| Media (public images, private documents and receipts) | Cloudflare R2 | Copy the two buckets to a second location (e.g. `rclone sync` to another bucket or provider) on a schedule; turn on object versioning if the plan allows | R2 has no built-in point-in-time restore |
| Secrets | Secret Manager | Previous versions are kept; `FIELD_ENCRYPTION_KEY` **also offline** (§16) | Without that key, encrypted fields in any backup are unreadable |
| Redis | Memorystore | **None** | Ephemeral by design (§14). After a loss, payments reconcile from Razorpay; unsent emails can be re-sent from the admin notification log. |
| Code and images | GitHub, Artifact Registry | The repository; keep at least the last 10 image tags | Rollback needs the previous image (§20) |

**Manual database backup (before a migration):**

```bash
pg_dump "$PRODUCTION_SESSION_POOLER_URL" --format=custom --no-owner --file "sailent-$(date +%Y%m%d-%H%M).dump"
```

**Restore — always into a new, empty database first, never over production:**
1. Create a scratch Supabase project (or a local Postgres 17) and `pg_restore --no-owner --dbname "$SCRATCH_URL" <file>.dump`; or use Supabase's "Restore" / PITR into a new project.
2. **Validate** on the copy: `pnpm --filter @sailent/database db:migrate --target=local` reports nothing pending (point it at the copy); row counts of `donations`, `payments`, `receipts`, `donors` and `audit_logs` match expectations; the most recent captured donation is the one Razorpay's dashboard shows last; an encrypted field decrypts with the stored `FIELD_ENCRYPTION_KEY`; the admin can sign in to an API pointed at the copy.
3. Only then, with the owner's approval, either restore over production (Supabase restore, downtime) or switch `sailent-database-url` to the restored database and redeploy the API and worker.
4. After any restore, run payment reconciliation and compare against the Razorpay dashboard for the gap; never invent payment rows by hand (§20).

**Restore drill:** do one before launch and once a quarter, end to end on a scratch project, and note the time it took.

## 20. Rollback runbook

**Application (the usual case).** Every deploy creates a new Cloud Run revision; the previous one is kept.

```bash
gcloud run revisions list --service sailent-api --region asia-south1
gcloud run services update-traffic sailent-api --region asia-south1 --to-revisions <previous-revision>=100
```

Do the same for `sailent-web` and `sailent-worker` as needed (the worker has one instance; rolling it back replaces it). The services are stateless, so a rollback takes effect in seconds. Roll back in the reverse order of deployment (web → worker → API) when an API change is involved. After the fix, deploy a new revision normally; `update-traffic --to-latest` returns traffic to the newest.

**Configuration mistake** (wrong variable or secret). Environment changes create a new revision too; roll back as above, or fix the value and redeploy. A secret referenced as `latest` is re-read only by new instances — redeploy after changing it.

**Failed deploy.** A revision that fails its startup probe never receives traffic; the previous revision keeps serving. Read its logs (`severity>=ERROR`), fix, and deploy again. Nothing to roll back.

**Database.**
- There are **no down migrations**. Migrations are additive so that the previous revision still runs against the new schema: roll back the application, leave the schema.
- If a migration itself was wrong: write a corrective migration (reviewed, human-applied), or restore from the backup taken before it (§19) — the last resort, since it loses every donation since the backup.
- Never edit donation, payment or receipt rows to "undo" something. Reconcile against the Razorpay dashboard; supersede receipts.

**Payments incident.** If checkout misbehaves, the fastest safe action is to pause the affected campaign(s) in the admin (they stop accepting donations immediately) and roll back the API. Webhooks that fail are retried by Razorpay, and reconciliation recovers missed captures.

**Secrets:** see the rotation effects in §16.

## 21. Production safety rules

- Agents never operate on production (§2). Humans act only with explicit, per-action approval.
- `--target=production --confirm-host=<host>` is mandatory on every production script.
- No demo seed outside LOCAL or E2E.
- `FEATURE_MOCK_DATA=false` on every deployed service: the web treats an unset value as **on**.
- Swagger off, `DATABASE_INSECURE_TLS=false`, real organisation data in place.
- No image runs a migration or seed at start; deployment never applies migrations.
- See the pre-release checklist in `SECURITY.md` §5.
