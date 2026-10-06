# CURRENT DEVELOPMENT STATUS

> This is the **CURRENT DEVELOPMENT CHECKPOINT**: where work stopped, what is unfinished and what to do next. It is a **dated snapshot**. Every count, list and test result below is labelled "as of" a date, and will go stale.
>
> The **PERMANENT PROJECT RULES** (how agents may work, what must never change, the production access policy) live in [`AGENTS.md`](AGENTS.md), not here.
>
> Update this file after every meaningful piece of work (`AGENTS.md` §12).

**Last updated:** 2026-10-06 (accurate donor count, **uncommitted**, on top of `ed69d41`). Source: a read-only audit of the repository and the local databases, validation runs on 2026-10-06, and the git history.

| | |
|---|---|
| **Overall status** | Feature-rich build, **not deployed to any hosting.** Phases 0–10.12 are implemented in the API, admin and public site. |
| **Current phase** | Post-10.12 polish (no phase number). Everything up to `ed69d41` (the campaign public experience cleanup) is committed and pushed (§1). |
| **Current feature** | **Accurate donor count** (§1, item 8): `campaigns.donor_count` counts distinct donors per campaign, and the public impact total counts distinct donors. Implemented and validated; **not committed**. Historical counters were **not** recounted. |
| **Branch / HEAD** (as of 2026-10-06) | `main` @ `ed69d41` = `origin/main` (up to date). The first commit (`2ba2b43`, 2026-09-26) contains everything through Phase 10.12. Development happens directly on `main` (`AGENTS.md` §9). A leftover local branch `feat/featured-campaigns-and-deadlines` (= `dd64d41`, never pushed, already contained in `main`) is not used. |
| **Working tree** (as of 2026-10-06) | The donor-count change (`donation-capture.service.ts`, `content.service.ts`, `test/donations.spec.ts`, `test/public-api.spec.ts`) and this documentation update (`DEVELOPMENT_STATUS.md`, `CHANGELOG.md`, `DATABASE.md`), all **uncommitted**. Run `git status` for the live state. |
| **Production database** | The **production Supabase project** exists (owner confirmed, 2026-10-06). Its schema and data state were **not inspected** and are **unknown**. Agents must not access it (`AGENTS.md` §8). |
| **Application hosting** | None. No Dockerfiles, IaC or deploy workflow exist. |
| **Local databases** | `sailent_dev` and `sailent_e2e` have migrations `0000`–`0022` applied, **plus one migration that is not in the repository** (§5.1). The repository has no pending migration. |
| **CI** | **Not passing as of the last observed run.** Run #4 (at `166b70c`): the `quality` job passed lint, typecheck, migrate and seed, then failed at tests (`EnvValidationError`: Turborepo strict env mode stripped `DATABASE_URL`/`REDIS_URL`); the `security` job failed at `pnpm audit` (30 vulnerabilities: 2 low, 13 moderate, 15 high), so gitleaks was skipped. `7fe6c25` (pushed) adds `passThroughEnv` for the test task; **its GitHub Actions run has not been observed**. The audit failure is **unresolved** (dependency upgrades not approved yet), so the `security` job is expected to keep failing (§5.4). Do not describe CI as passing until a passing run has been observed. The owner has **deferred CI work** for now (2026-10-06). |

---

## 1. LAST DEVELOPMENT CHECKPOINT — 2026-10-06

### Commits on 2026-10-06

| Commit | Content | Pushed? |
|---|---|---|
| `dd64d41` | feat(campaigns): admin-controlled featured campaigns and optional end-date deadlines (items 1–3 below; 27 files) | ✅ yes |
| `d7f42e3` | added md files: the documentation in item 4 | ✅ yes |
| `0e94632` | ci: target local database in CI migrations and seed (item 5; `.github/workflows/ci.yml` only) | ✅ yes |
| `166b70c` | docs: update project context and development checkpoint | ✅ yes |
| `7fe6c25` | ci: pass test database and redis env through turbo (item 6; `turbo.json` only) | ✅ yes |
| `ed69d41` | feat(campaigns): campaign public experience cleanup (item 7) | ✅ yes |
| — | Accurate donor count (item 8) and this documentation update | ❌ **uncommitted** |

Also on 2026-10-06, local `main` (`8dae087`, `d569fcf`, `ae1520b`) was pushed to `origin/main` with a fast-forward push; until then `origin/main` held only `2ba2b43`.

### Completed on 2026-10-06

**1. Admin-controlled featured campaigns**
- **Admin form** (`apps/web/src/components/admin/campaign-form.tsx`): a "Feature on the homepage" checkbox and a "Featured order" number field. The server action `featuredFields()` (`apps/web/src/lib/admin/actions.ts`) sends `isFeatured`/`featuredOrder`; unticking clears the order.
- **Admin list** (`apps/web/src/app/admin/(workspace)/campaigns/page.tsx`): shows a "Featured · N" badge. The admin list API now also returns `featuredOrder` (`apps/api/src/modules/catalog/campaigns.service.ts`).
- **Live-data ordering is decided by the API.** `GET /api/v1/campaigns?sort=featured` (`apps/api/src/modules/content/content.service.ts`) orders by `is_featured DESC`, then `featured_order ASC` (NULLs last), `end_date ASC` (NULLs last), `created_at`, `id`.
- **Homepage band data.** `getFeaturedCampaigns()` (`apps/web/src/lib/content/campaigns.ts`) requests `status=active&sort=featured&limit=24` and keeps the API's order. It filters with `acceptsDonationsNow()`, which drops paused campaigns and campaigns past their end date, then caps the list at 12 (`FEATURED_BAND_SIZE`).
  - **Edge case:** if more than 12 of the 24 fetched campaigns are closed, the band shows fewer than 12.
- **Fixture fallback only.** `apps/web/src/lib/featured-campaigns.ts` `orderFeaturedFirst()` orders the **fixture data** when the API is unavailable and mock data is enabled. It does **not** control live-data ordering.
- **Band component.** `components/home/featured-campaigns.tsx` renders whatever list it receives (`VISIBLE_CARDS = FEATURED_BAND_SIZE`). It does not call `acceptsDonationsNow()` itself; each card does (below).
- **"Browse by cause" grid** keeps its own list. Since item 7 it asks for `status: 'open'` (campaigns taking donations today) instead of `'active'`.

**2. Ongoing-by-default campaigns with an optional deadline**
- **Shared rules** (`packages/validation/src/domain/lifecycle.ts`):
  - `hasEnded(endDate)`: the end date is the last giving day; donations close at 23:59:59.999 IST.
  - `donationAvailability(status, endDate)`: returns state `'ended'` for an active campaign past its date.
  - `acceptsDonations(status, endDate)`: false in that case.
- **Checkout** (`apps/api/src/modules/donations/donations.service.ts`) refuses with `hasEnded(campaign.endDate)`. The campaign detail API sends the deadline-aware `donation` state.
- **List rows.** `toCampaign` (`apps/web/src/lib/content/campaigns.ts`) derives `donation` with `donationAvailability(row.status, row.endDate)` when the API does not send it.
- **Where `acceptsDonationsNow()` is used** (`apps/web/src/components/campaigns/campaign-status.ts`). It returns true when `status === 'active'` and `donation.state === 'open'`. It is called in exactly three places:
  - `campaign-card.tsx`: `isOpen` decides Donate Now vs View Campaign.
  - `campaign-status-card.tsx`: `isOpen` decides between the donate panel and the closed reason.
  - `getFeaturedCampaigns()`: the filter above.
- **Donation builder.** `components/donations/donation-builder.tsx` does **not** use the helper. It has its own equivalent check: `isPaused = status === 'paused'` and `isClosed = status === 'completed' || status === 'archived' || donation?.state === 'ended'`. Either flag disables the controls.
- **Status badge.** `campaignState(status, donationState)` shows **Closed** for an active campaign whose donation state is `'ended'`.
- **Campaign header** (`components/campaigns/campaign-hero.tsx`):
  - the "Campaign period" row is **removed**;
  - with an end date it shows "Ends DD Mon YYYY" with "N days left" or "Last day to give", or "Closed DD Mon YYYY" / "Donations closed" once the date has passed;
  - with no end date it shows nothing.
- **Admin hints:** the start and end date hints in the admin form were rewritten.
- **Seed:** every seeded campaign now has `endDate: null`.
- **Local data change (2026-10-06):** `UPDATE campaigns SET end_date = NULL` was run on **local** `sailent_dev`, 9 rows, owner-approved. It was not a schema change and did not touch production.

**3. Tests**
- New: `apps/web/e2e/admin-featured.spec.ts`; `apps/web/src/lib/__tests__/featured-campaigns.test.ts`.
- New helper: `apps/web/e2e/settle-animations.ts`, used by the axe helpers in `journeys.spec.ts` and `shell.spec.ts` (fixes a WebKit timing flake).
- Additions to `campaign-status.test.ts`, `packages/validation/src/__tests__/domain.test.ts` and `apps/api/test/public-api.spec.ts`.

**4. Documentation (2026-10-06):** the root context files (`AGENTS.md`, `CLAUDE.md`, `PROJECT.md`, `ARCHITECTURE.md`, `SECURITY.md`, this file, `PHASES.md`, `DATABASE.md`, `DEPLOYMENT.md`, `CHANGELOG.md`), created by a read-only audit, revised the same day, and committed as `d7f42e3`. A later update (this revision) records the main-only git workflow and the CI fix.

**5. CI fix (2026-10-06, `0e94632`):** `.github/workflows/ci.yml` now passes `--target=local` to `pnpm db:migrate` and `pnpm db:seed`. Before the fix, both commands were refused by the database target guard before connecting, so every CI run stopped at "Apply migrations". This was reproduced locally with CI's environment and was not a database-safety failure: CI never reached a database. With the flag, the guard also verifies that `DATABASE_URL` is a localhost database (CI's is `localhost:5432/sailent_test`). Checks run: Prettier and a YAML parse (`js-yaml`); the migrate and seed commands were **not** run against any database.

**6. Turborepo test env (2026-10-06, `7fe6c25`):** the `test` task in `turbo.json` gains `passThroughEnv` for `DATABASE_URL`, `REDIS_URL`, `TEST_DATABASE_URL`, `TEST_REDIS_URL` and `ALLOW_REMOTE_TEST_DB`. CI run #4 had failed at tests because strict env mode stripped them. Pushed; **its CI run has not been observed**.

**7. Campaign public experience cleanup (2026-10-06, UNCOMMITTED)**
- **Open/closed availability.**
  - The public API `GET /api/v1/campaigns` accepts two new `status` values: `open` (active, with no end date or one not yet passed) and `closed` (paused, or active but past its end date). `active` (the default: active + paused), `paused`, `completed` and `all` are unchanged. No schema change.
  - The SQL filter uses the new `deadlineCutoff(now)` in `packages/validation/src/domain/lifecycle.ts` (start of today, IST), which agrees exactly with `hasEnded()`: `hasEnded(d, now) ⇔ d < deadlineCutoff(now)`.
  - Listing (`components/campaigns/listing-query.ts` `API_STATUS`): **Active → `open`**, **Closed → `closed`**; Completed and All unchanged.
  - Homepage "Browse by cause" grid: `getCampaigns({ status: 'open', … })`. The fixture fallback filters with `acceptsDonationsNow()`.
- **"Other Ways to Support" restored** on the campaign page (the `showCustomAmountSection={false}` override is removed). The typed amount and the card's presets share one value. "One-Time Donation" in the card now jumps to and focuses that field.
- **Mobile donation card** (`components/donations/donation-builder.tsx`): the fixed bottom bar ("Review"/"Hide" sheet) is **removed**. Below `lg` the full donation card (progress, presets, total, Donate, assurances) sits **in the page**, after "Other Ways to Support" and before About, and scrolls with it. The desktop sticky rail is unchanged. The radio labels in the card may wrap below 360px (a 2px overflow at 320px otherwise).
- **Duplication cleanup** (owner decisions):
  - donation card goal, "Our Goal" and "Your Impact" figures are kept;
  - "What Will Your Support Provide?" is a short summary with a link back to the items, not the product list again (`campaign-about.tsx`);
  - "The Difference Your Support Can Make" (`campaign-impact.tsx`) shows reported `impactNotes` (up to four) minus any note that repeats the people-reached count (`repeatsPeopleReached()`), no "Campaign target" tile and no people-reached tile, plus "What one gift does" lines from product prices.
- **Campaign Gallery kept** unchanged (`AGENTS.md` §11).
- **Stories** (`campaigns/[slug]/page.tsx`, `stories-strip.tsx`): a campaign shows **only its own stories**, matched by `campaignId` (API list rows carry no `campaignSlug`, so the old match never found them) or `campaignSlug` (fixtures). A campaign with none borrows stories (its programme's first) and the strip says so: a different lead and a "From another campaign" label. `Story` gains an optional `campaignId`.
- **Responsive / accessibility:**
  - section nav: edge fades show when more links are off-screen, and the current link is scrolled into the row;
  - header wordmark wraps below `sm` instead of truncating to "Sailent Foundati…";
  - the fixed mobile bar no longer covers content or focus.
- **JSON-LD escaping:** `jsonLd()` (`apps/web/src/lib/seo/structured-data.ts`, used by every JSON-LD script) escapes `<`, `>`, `&`, U+2028 and U+2029 as JSON unicode escapes.
- **Tests:** E2E `campaign.spec.ts`, `donations.spec.ts`, `journeys.spec.ts` updated to the new layout (no sheet to open; assertions kept, mobile branches now run the full card checks); new E2E tests for the custom-amount panel and the in-page mobile card. New unit tests: `campaign-impact.test.ts`, `jsonLd` in `seo.test.ts`, `deadlineCutoff` in `domain.test.ts`, listing mapping in `listing-query.test.ts`. New API tests in `public-api.spec.ts` for `open`/`closed`.

**8. Accurate donor count (2026-10-06, UNCOMMITTED)**
- **Rule:** "Donors" means distinct donors. Identity is `donations.donor_id` (one donor row per email, `donors_email_lower_unique`).
- **Campaign counter** (`apps/api/src/modules/donations/donation-capture.service.ts`): capture adds 1 to `donor_count` only when no other successful donation to that campaign has the same `donor_id`. A repeat gift (anonymous or not, same email in any case or spacing) adds to `amount_raised` only. The same donor on another campaign counts there. The existing campaign-row `FOR UPDATE` lock and the `status <> 'successful'` capture gate are unchanged; the lock plus READ COMMITTED makes the check safe when two captures race. A NULL `donor_id` counts as one donor.
- **Public impact total** (`apps/api/src/modules/content/content.service.ts` `getImpact()`): `totals.donorCount` = distinct `donor_id` over successful donations (plus NULL-donor donations), not `SUM(campaigns.donor_count)`. Same field name and response shape. The web does not render this field.
- **Not changed:** schema, migrations, seed (synthetic `donor_count` baselines kept), web UI, `donors.donation_count`/`total_donated`.
- **No recount was run.** Existing counters (including any production values) keep their old meaning until a human runs the recount runbook in `DATABASE.md` §12. Never run it on the demo databases.
- **Tests:** `apps/api/test/donations.spec.ts` gains a "donor count" block (repeat donor +0 with money added; different donor +1; same email differently written +0; same donor on another campaign +1 there; anonymous repeat +0; two racing captures by one new donor +1; `/impact` unchanged after a repeat gift). The webhook/browser race test now uses its own donor so "+1 once" still tests what it meant. The teardown now restores `amount_raised` and `donor_count` on the campaigns it spends (it already restored `provided_quantity`), so runs no longer leak counter increments into `sailent_dev`. `public-api.spec.ts` checks `/impact` equals the distinct count. Against the old capture code, 4 of the new tests fail (checked 2026-10-06).
- **Pre-existing dev drift left alone:** `sailent_dev` `school-kits-jharkhand` reads 397 donors against a seed value of 320, from earlier test runs that never restored counters. Not reconciled (owner rule); a local re-seed would reset it.

### What was being worked on

The donor-count change (item 8) is implemented and validated (§2) and **awaits owner approval to commit**. CI is deferred by the owner.

### Reverted by the owner on 2026-10-06 (do not redo unless asked)

The homepage visual refinement (one font family, a new type scale, a 1320px container, 8px buttons, a hero redesign). The repository is back to the `ae1520b` design:
- fonts: DM Sans, Plus Jakarta Sans and Caveat;
- `--container-page` 90rem;
- pill buttons;
- a full-bleed hero photograph.

### Must not change

See **`AGENTS.md` §11**, the permanent list of owner-approved designs and decisions.

---

## 2. LAST VALIDATION — snapshot as of 2026-10-06 (local only)

**Donor-count change (item 8), 2026-10-06:**

| Command | Result |
|---|---|
| `pnpm prettier --check .` | ✅ pass |
| `pnpm typecheck` | ✅ pass (13/13 tasks) |
| `pnpm lint` | ✅ pass (13/13 tasks) |
| API `test/donations.spec.ts` + `test/public-api.spec.ts` | ✅ 66 passed (26 + 40) |
| `pnpm --filter @sailent/api test` (full) | ❌ 764 passed, **4 failed**, 9 skipped — the same 4 `me.spec.ts` failures from local database drift (§5.1) |
| `pnpm --filter @sailent/web test` / `@sailent/validation test` | ✅ 110 / 280 passed (unchanged code) |
| Playwright | not run (API-only change; no web change) |

**Campaign cleanup (item 7, now `ed69d41`):**

| Command | Result (as of 2026-10-06) |
|---|---|
| `pnpm prettier --check .` | ✅ pass |
| `pnpm typecheck` | ✅ pass (13/13 tasks) |
| `pnpm lint` | ✅ pass (13/13 tasks) |
| `pnpm --filter @sailent/web test` | ✅ 110 passed |
| `pnpm --filter @sailent/validation test` | ✅ 280 passed |
| `pnpm --filter @sailent/worker test` | not re-run (5 passed earlier on 2026-10-06; untouched) |
| API specs `public-api`, `catalog`, `donations` | ✅ 115 passed |
| `pnpm --filter @sailent/api test` (full) | ❌ 757 passed, **4 failed**, 9 skipped. All 4 are in `test/me.spec.ts` and are caused by local database drift (§5.1). |
| `pnpm build --force` (isolated copy) | ✅ pass |
| Playwright: campaign, donations, journeys, admin-featured, shell × 4 projects (isolated copy, `--workers=2`) | 366 passed, **2 failed**, 32 skipped. One was the WebKit rail failure below; the other was a new 2px overflow at 320px, fixed afterwards. |
| Playwright re-run after the fix: campaign, donations, journeys × 4 projects | 302 passed, **2 failed** (both the pre-existing WebKit failures below), 28 skipped. `admin-featured` and `shell` were not re-run after the one-class fix. |

These are **local** results. **CI is not passing** as of the last observed run (header table).

**The two Playwright failures** are on the `tablet` project only (WebKit), and both **also fail at commit `ae1520b`**, so they predate this work:
- `journeys.spec.ts` › "featured campaigns rail › keyboard users can still pause it"
- `journeys.spec.ts` › "campaign listing › searches through the API…"

The likely cause is WebKit keyboard behaviour; this was **not investigated**.

**The full Playwright suite** (712 tests) last ran on 2026-10-06, before the featured and deadline work: 551 passed, 158 skipped, 3 failed. Two were the WebKit failures above; the third was an axe flake that `settle-animations.ts` has since fixed.

---

## 3. APPLICATION FILES IN `dd64d41` — for reference (committed and pushed 2026-10-06)

These were uncommitted at the original audit and are now in `dd64d41`. Run `git status` for the live state.

**Modified at the time (now committed):**
- `apps/api/src/modules/catalog/campaigns.service.ts`
- `apps/api/src/modules/content/content.controller.ts`
- `apps/api/src/modules/content/content.service.ts`
- `apps/api/src/modules/donations/donations.service.ts`
- `apps/api/test/public-api.spec.ts`
- `apps/web/e2e/journeys.spec.ts`
- `apps/web/e2e/shell.spec.ts`
- `apps/web/src/app/(public)/page.tsx`
- `apps/web/src/app/admin/(workspace)/campaigns/page.tsx`
- `apps/web/src/components/admin/campaign-form.tsx`
- `apps/web/src/components/campaigns/__tests__/campaign-status.test.ts`
- `apps/web/src/components/campaigns/campaign-card.tsx`
- `apps/web/src/components/campaigns/campaign-hero.tsx`
- `apps/web/src/components/campaigns/campaign-status-card.tsx`
- `apps/web/src/components/campaigns/campaign-status.ts`
- `apps/web/src/components/donations/donation-builder.tsx`
- `apps/web/src/components/home/featured-campaigns.tsx`
- `apps/web/src/lib/admin/actions.ts`
- `apps/web/src/lib/admin/api.ts`
- `apps/web/src/lib/content/campaigns.ts`
- `packages/database/src/seed/index.ts`
- `packages/validation/src/__tests__/domain.test.ts`
- `packages/validation/src/domain/lifecycle.ts`

**New at the time (now committed):**
- `apps/web/e2e/admin-featured.spec.ts`
- `apps/web/e2e/settle-animations.ts`
- `apps/web/src/lib/__tests__/featured-campaigns.test.ts`
- `apps/web/src/lib/featured-campaigns.ts`

**Documentation:** committed separately as `d7f42e3` (not pushed as of 2026-10-06): `AGENTS.md` and the nine new root files.

---

## 4. FEATURE STATUS — verified against code as of 2026-10-06

Statuses: COMPLETE · PARTIALLY COMPLETE · IN PROGRESS · NOT STARTED · BLOCKED · DEPRECATED · REMOVED · NEEDS REVIEW

| Feature | Status | Notes |
|---|---|---|
| Monorepo, design system, shells | COMPLETE | |
| Public website | PARTIALLY COMPLETE | Mostly API-backed. Still fixture-backed: `/faq`, testimonials, `/volunteer` testimonials, donation-widget presets, `/search`. Organisation details are **DEMO** values (`lib/demo-org.ts`). |
| Programmes | PARTIALLY COMPLETE | Rollups `campaign_count`, `total_raised` and `beneficiaries_reached` are never written, yet the public listing reads `campaignCount`. |
| Campaigns | COMPLETE | Lifecycle, FAQs, gallery, products, preview, admin-controlled featuring, and the optional end-date deadline (`dd64d41`). Public experience cleanup (open/closed filter, Other Ways to Support, in-page mobile card, own stories) implemented, **uncommitted** (§1, item 7). |
| Products / campaign products | COMPLETE | |
| One-time donations + Razorpay | PARTIALLY COMPLETE | Tested with a mocked client only. Missing: idempotency key, reconciliation and expiry of pending donations, currency check, total cap. Never run against live Razorpay. Local behaviour without keys: `DEPLOYMENT.md` §6. |
| Receipts | PARTIALLY COMPLETE | No PDF; 80G fields null. |
| Donor accounts | PARTIALLY COMPLETE | PAN stored in plaintext; email change unverified. |
| Staff authentication | PARTIALLY COMPLETE | No 2FA in effect; no invite acceptance or password reset (CLI only). |
| RBAC | COMPLETE (mechanism) / NEEDS REVIEW (policy) | 112 permissions; one role (`SUPER_ADMIN`). |
| Volunteers | COMPLETE | Certificate PDF, uploads and self-service attendance are out of scope. |
| Events, team, impact | COMPLETE | |
| Stories | COMPLETE | `story.archive` not enforced. |
| Media + R2 | COMPLETE | No re-encoding. The web `images.remotePatterns` is empty. |
| Blog | COMPLETE | |
| Technical SEO | PARTIALLY COMPLETE | Soft 404s. JSON-LD escaping fixed in the uncommitted working tree (§1, item 7). |
| Page composer | COMPLETE | Home only. |
| Documents | COMPLETE | |
| Notifications | PARTIALLY COMPLETE | Admin retry enqueues to a queue nothing consumes; newsletter is UI-only. |
| Reports | COMPLETE | Form 10BD export deferred. |
| Audit logging | PARTIALLY COMPLETE | No auth events; not tamper-proof. |
| Admin dashboard home | NOT STARTED | `PhasePlaceholder`. |
| Scheduled jobs | NOT STARTED | |
| Analytics / Sentry | NOT STARTED | |
| Application hosting / deployment | NOT STARTED | |
| Homepage visual refinement | REMOVED | Reverted by the owner on 2026-10-06. |
| Recurring donations, refunds, P2P fundraising | REMOVED | Permanent exclusions. |

---

## 5. CURRENT KNOWN ISSUES (highest first) — as of 2026-10-06

### 5.1 Local database drift (causes the 4 failing API tests)

**Unknown migration.** `drizzle.__drizzle_migrations` holds **24 rows** in both `sailent_dev` and `sailent_e2e`; the repository journal has **23**.
- Row 24 matches no repository file. Its only effect is a CHECK constraint, `donors_tax_id_encrypted` (`tax_id_number IS NULL OR tax_id_number LIKE 'enc:%'`).
- The application writes PAN **in plaintext**: `FIELD_ENCRYPTION_KEY` is never read.
- So `PATCH /me` with a tax ID fails locally.
- `TEST_DATABASE_URL` points at `sailent_dev`, so the API tests hit that drift.

**Edited migration.** Row 15 (`0014`) no longer matches its file; the file was edited after it was applied.

**Owner decision needed:**
- **(a)** implement PAN encryption, with a committed migration for the constraint; or
- **(b)** drop the constraint locally and rebuild the local databases from the repository migrations.

### 5.2 Production database: unverified residue (HIGH)

`docs/phase-8.md` records the following about the hosted Supabase project (which it called "development/staging", and which the owner confirmed on 2026-10-06 is **production**):
- `@sailent.local` development accounts with **published credentials** were created there, and `db:harden` was **not** run (§12.3);
- test residue was left: `e2e-staff@sailent.test` and `DNR-E2E` donors (§14.6);
- a password-rotation incident occurred (§16.1);
- Phase 10.5–10.11 migrations and seeds were not run there.

**The production schema version and data are therefore unknown, and may include accounts whose passwords are public.**

This is for a **human** to verify and remediate through the approved process (`DEPLOYMENT.md` §9–§10). Agents must not connect (`AGENTS.md` §8).

### 5.3 Security (details in `SECURITY.md`)

- **Global rate limits.** Every limit is effectively site-wide, because the API sees the BFF's IP. `X-Forwarded-For` is trusted for audit IPs.
- **No staff 2FA in effect.**
- **Donor data:** PAN stored in plaintext; unverified donor email change; guest checkout can overwrite an existing donor's name and phone.
- **Web defaults:** `FEATURE_MOCK_DATA` is treated as ON when unset; `webEnvSchema` is never loaded.
- **Output and headers:** no CSP or HSTS on the web; a forged Razorpay webhook gets HTTP 200. (JSON-LD escaping is fixed in the uncommitted working tree, §1 item 7.)

### 5.4 Infrastructure and tooling

- **CI migrate/seed target: fixed in `0e94632` and confirmed** — run #4 passed "Apply migrations" and the seed step.
- **CI tests: env stripped by Turborepo strict mode.** Fixed in `7fe6c25` (`passThroughEnv`); **the run for `7fe6c25` has not been observed**. Later steps may still fail (for example, `docs/phase-9.md` §9 notes that some web routes fail to build without a running API, and CI starts none). Unverified.
- **CI security job: `pnpm audit` fails** (30 vulnerabilities as of run #4: 2 low, 13 moderate, 15 high — sharp, postcss and source-map-js via next; multer via `@nestjs/platform-express`; lodash; js-yaml via swagger; drizzle-orm 0.38.4). Gitleaks is skipped as a result. Proposed `pnpm.overrides` and a separate drizzle upgrade are **not approved or applied**.
- **Drizzle snapshots stop at `0007`.** Migrations are hand-written; `db:generate` and `db:push` are not used (`AGENTS.md` §5).
- **Inner `BEGIN`/`COMMIT`** in migrations `0018`–`0022`.
- **Hand-assigned journal timestamps** on `0017`–`0022`.
- **Stray lockfile.** `package-lock.json` (npm) is tracked next to `pnpm-lock.yaml`.
- **Duplicate checkout.** `.kilo/worktrees/rebel-erigeron/` is a full repo copy.
- **Node version mismatch.** `engines` says `>=20.9.0`; CI uses 22; there is no `.nvmrc`. Standardising is a future task.

### 5.5 Functional

- **Notification retry is a no-op.**
- **Programme rollups are never written.**
- **Historical `donor_count` values are not recounted.** New captures count distinct donors (§1 item 8); values written before 2026-10-06 may be overstated where a donor gave more than once. Recount is a human-only runbook (`DATABASE.md` §12).
- **Orphan pending donations without Razorpay keys** (`DEPLOYMENT.md` §6).
- **No reconciliation job.**
- **Soft 404s.**
- **The web build needs the API** for some routes.
- **`campaigns.program_id` is nullable.** A live campaign can be detached by PATCH.
- **2 pre-existing WebKit E2E failures** (§2).
- **No E2E coverage for paused or past-deadline campaigns.** The E2E seed has none, so the `open`/`closed` split is covered by API integration tests only.
- **Featured band** still requests `status=active` and filters with `acceptsDonationsNow()` in the web (edge case in §1 item 1); it does not use `status=open`.
- **Campaign FAQs "View All FAQs"** links to `/faq`, which is fixture-backed.

### 5.6 UI (known, not bugs)

- Story photographs are 137×113 thumbnails, and campaign images are about 232px wide, so they look soft at larger sizes.
- The hero photograph contains painted text.
- **Header wordmark at 1024px** still truncates ("Sailen…") because the desktop nav takes the width. The phone fix (item 7) does not cover it; a desktop header change needs owner approval (`AGENTS.md` §11, item 10).

---

## 6. CURRENT BLOCKERS

| Blocker | Blocks | Owner action |
|---|---|---|
| No real registration data (PAN, 12A, 80G, address) | Go-live; 80G receipts | Supply the values |
| No Razorpay keys in any environment | Live payment testing | Provide test-mode keys |
| No application hosting chosen or configured | Deployment | Decide the platform. Cloud Run is not referenced in the repository. |
| Local database drift / PAN encryption | Clean API test run | Choose (a) or (b) in §5.1 |
| Unknown production database state | Any production work | A human verifies the production schema version and residue (§5.2) |
| No refund/cancellation policy page (Razorpay requires one) | Razorpay activation | Supply the policy text |

---

## 7. UNFINISHED WORK (ordered)

1. ~~Commit the featured/deadline work~~ (done: `dd64d41`). ~~Fix the CI target flag~~ (done: `0e94632`). ~~Turborepo test env~~ (done: `7fe6c25`). All pushed.
2. ~~Commit the campaign cleanup~~ (done: `ed69d41`, pushed). **Commit the donor-count change** (§1 item 8) with owner approval; push only with a separate approval.
3. CI (deferred by the owner, 2026-10-06): observe the GitHub Actions run and, with approval, the dependency overrides for `pnpm audit` (§5.4).
4. Programme campaign counts (rollups never written; §5.5), soft 404s, then the admin dashboard home — the order recommended in the 2026-10-06 roadmap review.
5. Resolve the local drift / PAN encryption (§5.1).
6. Fix the security items that need no product decisions: rate-limit keying and trusted client IP; the web `FEATURE_MOCK_DATA` default and `webEnvSchema`; webhook 401. (JSON-LD escaping: done in `ed69d41`.)
7. Human-led production audit and hardening (§5.2).
8. Then: PAN encryption and email verification; staff 2FA; CSP and HSTS.
9. Notification retry consumer; reconciliation and pending expiry; programme rollups.
10. Deployment artefacts and hosting.
11. Replace the fixture content and the DEMO organisation data.
12. Optional, owner-approved: rebuild the Drizzle snapshot baseline so `db:generate` becomes usable. **This is not required for hand-written migrations.**
13. Soft-404 fix; R2 `remotePatterns`; receipt PDF.

---

## 8. PRODUCTION / DATABASE / DEPLOYMENT STATUS — as of 2026-10-06

- **Production database:** the hosted Supabase project that the production guard targets. The guard's `PRODUCTION_DATABASE_HOST` (`packages/database/src/lib/database-target.ts`) is a **shared regional pooler host**, so the host alone does not uniquely identify the project; the owner confirmed which project it is on 2026-10-06. It exists; its state is **not verified** (§5.2). **No agent access** (`AGENTS.md` §8).
- **Staging:** there is no separate staging environment. Older documents call the Supabase project "staging"; it is production (owner, 2026-10-06).
- **Local:** `sailent_dev`, `sailent_e2e`.
- **Hosting:** none. See `DEPLOYMENT.md`.

---

## 9. DOCUMENTATION / IMPLEMENTATION DISCREPANCIES

These are recorded here and **not** silently resolved in the source documents.

| # | Document says | Code / repository says |
|---|---|---|
| 1 | `README.md`: "Phase 1 complete"; webhook at `/webhooks/razorpay`; Neon | Phases 0–10.12 implemented; webhook `POST /api/v1/payments/razorpay/webhook`; Supabase (production) and local Postgres |
| 2 | `docs/security-architecture.md`, `database-architecture.md`: PAN encrypted (AES-256-GCM) | Plaintext; `FIELD_ENCRYPTION_KEY` unused |
| 3 | A8, `security-architecture.md`: TOTP mandatory for privileged staff | Not in effect; the TOTP role set lists deleted roles |
| 4 | A4: webhook processed asynchronously via BullMQ | Inline |
| 5 | A7: receipt `SF/2026-27/000001` | `SFL-<FY>-000001` |
| 6 | A10: audit-log INSERT/SELECT-only role | No GRANT/REVOKE or trigger; the app connects as the owner |
| 7 | `docs/rbac*.md`: 6–7 roles; permissions in the token | One role; token carries `sub`/`aud`/`sid` only; permissions resolved per request |
| 8 | `docs/README.md` index stops at Phase 9 | Phase 10.5–10.12 documents exist |
| 9 | IA, user-flows, PRD: recurring giving, refunds, `/refund-policy`, `/transparency`, `/gallery`, `/account/*`, phone OTP, guest event registration and waitlist | Removed or changed |
| 10 | `api-architecture.md`: `/donations/intent`, `/subscriptions`, `Idempotency-Key` | `POST /donations`; no subscriptions; no idempotency |
| 11 | `design-system.md`, `phase-1.md`: green brand hue, serif display font, 1200px container | Navy/blue/orange palette (hue 250); DM Sans + Plus Jakarta Sans + Caveat; 90rem container |
| 12 | `development-setup.md`, `database-development.md`: `pnpm db:migrate` with no `--target` | `--target` is required |
| 13 | `docs/database-development.md` "Development credentials": five per-role accounts with a required second factor | The current seed creates two `SUPER_ADMIN` accounts (`admin@sailent.local`, `staff@sailent.local`); TOTP is not enforced for `SUPER_ADMIN`. Older local databases may still hold the earlier accounts. |
| 14 | `content-layer.md` §8: blog is fixture-backed | Database-backed |
| 15 | Worker queue comments: declared queues are consumed | Only `example` and `email` are consumed |
| 16 | `.env.example`: `SMS_*`, `SENTRY_*`, `JWT_REFRESH_SECRET`, `FEATURE_FCRA_ENABLED`, `FIELD_ENCRYPTION_KEY` | Never read |
| 17 | `docs/environment.md`: blank values fall back via `\|\|` | Web code uses `??` for `API_URL` |
| 18 | `docs/phase-8.md` §13.6, §16: the Supabase project is "development/staging" | The code guard treats that host as production; the owner confirmed (2026-10-06) that it is **production** |
| 19 | Phase 8 code comments use both labels for the same hosted project | "production" in `rotate-admin-password.ts` (about line 56) and in the seed's `main()` comment; "staging" in `database-target.ts` (about line 199) and `prepare-e2e.ts`. Per the owner (2026-10-06), it is **production**. The comments are left unchanged (application code). |
| 22 | Seed header comment (`packages/database/src/seed/index.ts`, near the top): `--reference` is "safe anywhere / safe in any environment" | It is **not** safe on production: it deletes and re-inserts the `SUPER_ADMIN` grants (a lockout window), prunes permissions and upserts category slugs. The seed's own `main()` comment says so, and so do `DATABASE.md` §10 and `DEPLOYMENT.md` §10. |
| 23 | Seed `main()` comment: "five staff accounts with a known password" | The current seed creates **two** (`admin@sailent.local`, `staff@sailent.local`) |
| 24 | `donations.service.ts` comment: a failed order leaves a pending donation "swept by the same reconciliation"; `razorpay.client.ts` comment: `isConfigured` is "checked by the donation endpoints" | No reconciliation job exists. `isConfigured` is checked only inside `RazorpayClient.call()`, after the donation has been committed (`DEPLOYMENT.md` §6). |
| 20 | The audit task mentioned Cloud Run | No Cloud Run, GCP or Docker deployment configuration exists |
| 21 | Local databases | One applied migration is absent from the repo, and `0014` was edited after it was applied (§5.1) |

---

## THE NEXT AI AGENT SHOULD START HERE

1. Read `AGENTS.md` in full, especially §8 (production is off limits), §9 (work directly on `main`; owner approval before every commit and every push) and §11 (must not change). Then read this file, and `CLAUDE.md` if you are Claude Code.
2. Run `git status`, `git log --oneline -5` and `git status -sb`. As of 2026-10-06, `main` = `origin/main` = `ed69d41`, with the donor-count change and its documentation **uncommitted** (§1 item 8). Ask the owner before committing it, and separately before pushing.
3. **CI (deferred by the owner on 2026-10-06; resume only when asked): watch CI.**
   - Observe the GitHub Actions run for the current `main` head (for example with `gh run list` / `gh run view`, or on GitHub). The `security` job is expected to fail at `pnpm audit` until the dependency fixes are approved (§5.4).
   - Report the `quality` and `security` job results with their failing step and log excerpt, if any.
   - **Do not claim CI passes until that run has been observed.**
   - If a later step fails (build, tests, format, audit, gitleaks), report it and wait for the owner. Do not fix it unprompted.
4. **Then ask the owner for the §5.1 decision** (PAN encryption vs rebuilding the local databases), and recommend a **human-led** review of the production database (§5.2).

Do not create feature branches or pull requests unless the owner explicitly asks (`AGENTS.md` §9).
