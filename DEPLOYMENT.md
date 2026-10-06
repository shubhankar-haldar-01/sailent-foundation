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
- **Run commands:**
  - API: `node apps/api/dist/main.js`.
  - Worker: `node apps/worker/dist/main.js`.
  - Web: `next start`. There is no `output: 'standalone'`.
- Some web routes fail the build if the API is unreachable (`docs/phase-9.md` §9).
- `turbo.json` declares only `globalEnv: [NODE_ENV, APP_ENV]`.

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
| Redis | api, worker | `REDIS_URL`, `TEST_REDIS_URL`, `E2E_REDIS_URL` | Local. Upstash planned. |
| Cloudflare R2 | api only | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_PUBLIC`, `R2_BUCKET_PRIVATE`, `R2_PUBLIC_BASE_URL` | Implemented. Not set locally. The web needs `images.remotePatterns` before R2 images can render. |
| Razorpay | api (the web loads `checkout.js`) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Implemented; no keys anywhere. Webhook: `POST {API}/api/v1/payments/razorpay/webhook`. Production requires a live key (§6a). |
| Brevo | worker | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `APP_PUBLIC_URL` | Implemented; optional |
| SMS / Sentry / GA4 | — | `SMS_*`, `SENTRY_*`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Declared, unused |

Other variable names:

| Scope | Variables |
|---|---|
| Web | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`, `API_URL`, `FEATURE_MOCK_DATA`, `INTERNAL_API_SECRET`, `CLIENT_IP_HEADER`, `TRUSTED_PROXY_HOPS` |
| API | `API_PORT`, `API_HOST`, `CORS_ORIGINS`, `SWAGGER_ENABLED`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (unused), `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DONOR`, `JWT_REFRESH_TTL_STAFF`, `FIELD_ENCRYPTION_KEY` (unused), `FEATURE_FCRA_ENABLED` (unused), `INTERNAL_API_SECRET` |
| Worker | `WORKER_CONCURRENCY`, `WORKER_PORT`, `API_INTERNAL_URL`, `INTERNAL_API_SECRET`, `PAYMENT_RECONCILE_INTERVAL_MS` |
| Scripts and tests | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`, `ALLOW_REMOTE_TEST_DB`, `DRIZZLE_AUTHORISED_URL`, `PLAYWRIGHT_BASE_URL`, `CI` |

**Production requirements enforced by `apiEnvSchema`:**
- `JWT_*`, `RAZORPAY_*`, `R2_*` and `INTERNAL_API_SECRET` are required;
- `RAZORPAY_KEY_ID` must be a live key (`rzp_live_…`);
- `SWAGGER_ENABLED`, `DATABASE_INSECURE_TLS` and `FEATURE_MOCK_DATA` must be false.

**Enforced by `workerEnvSchema` in production:** `API_INTERNAL_URL` and `INTERNAL_API_SECRET`. The web server does not validate its environment yet (Phase 12); set its three variables by hand.

## 8. Planned hosting (owner decision; not configured — Phase 14)

```
Cloudflare (DNS / CDN / WAF)
  ├── apps/web     → Google Cloud Run
  ├── apps/api     → Google Cloud Run (persistent process; decision A12)
  └── apps/worker  → Google Cloud Run (always-on: it consumes queues)
Production Supabase Postgres · Redis · Cloudflare R2 · Brevo · Razorpay
```

Earlier documents named Vercel and Render/Railway; the owner's decision is Cloud Run. No Dockerfile, service definition or deploy workflow exists yet.

**Not provisioned:** backups (PITR, logical dumps, restore tests), IaC, runbooks, monitoring.

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

## 11. Release procedure (PLANNED; hosting is not chosen)

1. The owner approves the commit(s) and the push to `main`, and a GitHub Actions run on that `main` head has succeeded.
2. Run the full Playwright suite in an isolated copy.
3. A human applies the migrations (§9).
4. Deploy the API, then the worker, then the web.
5. Check health:
   - `GET /api/v1/health` and `/api/v1/health/ready`;
   - worker `:4001/health`;
   - web `/api/health`.
6. Smoke test: home page, a campaign page, a Razorpay test-mode donation and its webhook, admin login.

## 12. Rollback

- **Application:** redeploy the previous build. The API, worker and web are stateless.
- **Database:** there are no down migrations. Restore from a backup or PITR, or write a corrective migration. A destructive migration needs a backup taken before it runs.
- **Payments:** never edit donation, payment or receipt rows to "undo" something. Reconcile against the Razorpay dashboard; supersede receipts.
- **Secrets:** rotating `JWT_ACCESS_SECRET` signs everyone out. `RAZORPAY_WEBHOOK_SECRET` must change in Razorpay and on the platform together.

## 13. Production safety rules

- Agents never operate on production (§2). Humans act only with explicit, per-action approval.
- `--target=production --confirm-host=<host>` is mandatory on every production script.
- No demo seed outside LOCAL or E2E.
- `FEATURE_MOCK_DATA=false` on every deployed service: the web treats an unset value as **on**.
- Swagger off, `DATABASE_INSECURE_TLS=false`, real organisation data in place.
- See the pre-release checklist in `SECURITY.md` §5.
