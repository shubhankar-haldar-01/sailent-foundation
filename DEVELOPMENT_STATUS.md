# CURRENT DEVELOPMENT STATUS

> This is the **CURRENT DEVELOPMENT CHECKPOINT**: where work stopped, what is unfinished and what to do next. It is a **dated snapshot**. Every count, list and test result below is labelled "as of" a date, and will go stale.
>
> The **PERMANENT PROJECT RULES** (how agents may work, what must never change, the production access policy) live in [`AGENTS.md`](AGENTS.md), not here.
>
> Update this file after every meaningful piece of work (`AGENTS.md` §12).

**Last updated:** 2026-10-07 (Phase 12 — Accounts, Authentication & Security Hardening, **committed locally, not pushed**, as `feat(auth): complete account and security hardening` on top of `5170ce0`). Source: a read-only audit of the repository and the local databases, validation runs on 2026-10-06, and the git history.

| | |
|---|---|
| **Overall status** | Feature-rich build, **not deployed to any hosting.** Phases 0–10.12 are implemented in the API, admin and public site. |
| **Current phase** | **Phase 12 — Accounts, Authentication & Security Hardening** (§1, item 12), second phase of the 2026-10-07 roadmap (Phases 11–15). Implemented, validated and **committed locally** as `feat(auth): complete account and security hardening`; **not pushed**. Phase 11 (`5170ce0`) and everything before it is committed and pushed. |
| **Current feature** | Volunteer sign-in; email normalisation; verified email change; no guest overwrite; HS256 pin; atomic refresh rotation; authentication audit events; trusted client IPs; PAN encryption and masking; CSP and HSTS; BFF Origin check; production fail-closed web environment. **Staff TOTP/2FA is not required (owner decision).** |
| **Branch / HEAD** (as of 2026-10-07) | Local `main` is **1 commit ahead** of `origin/main` (`5170ce0`, Phase 11): the Phase 12 commit `feat(auth): complete account and security hardening`, **not pushed**. Run `git log --oneline -1` for its hash. The first commit (`2ba2b43`, 2026-09-26) contains everything through Phase 10.12. Development happens directly on `main` (`AGENTS.md` §9). A leftover local branch `feat/featured-campaigns-and-deadlines` (= `dd64d41`, never pushed, already contained in `main`) is not used. |
| **Working tree** (as of 2026-10-07) | Clean: Phase 12 (API, worker, web, config, validation, tests) and its documentation are all in the Phase 12 commit. Run `git status` for the live state. |
| **Production database** | The **production Supabase project** exists (owner confirmed, 2026-10-06). Its schema and data state were **not inspected** and are **unknown**. Agents must not access it (`AGENTS.md` §8). |
| **Application hosting** | None. No Dockerfiles, IaC or deploy workflow exist. |
| **Local databases** | `sailent_dev` and `sailent_e2e` have migrations `0000`–`0022` applied, **plus one migration that is not in the repository** (§5.1); since Phase 12 it no longer causes test failures. The repository has no pending migration. |
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
| `2fc5aa9` | fix(donations): count distinct donors accurately (item 8) | ✅ yes |
| `f9816be` | fix(programs): count open campaigns accurately (item 9) | ✅ yes |
| `e87864b` | fix(payments): make razorpay webhooks retry-safe (item 10) | ✅ yes |
| `5170ce0` | feat(payments): complete payment production readiness — Phase 11 (item 11), with its documentation | ✅ yes (pushed by the owner) |
| `feat(auth): complete account and security hardening` | Phase 12 (item 12), with its documentation | ❌ **committed locally, not pushed** |

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

**8. Accurate donor count (2026-10-06, `2fc5aa9`, pushed)**
- **Rule:** "Donors" means distinct donors. Identity is `donations.donor_id` (one donor row per email, `donors_email_lower_unique`).
- **Campaign counter** (`apps/api/src/modules/donations/donation-capture.service.ts`): capture adds 1 to `donor_count` only when no other successful donation to that campaign has the same `donor_id`. A repeat gift (anonymous or not, same email in any case or spacing) adds to `amount_raised` only. The same donor on another campaign counts there. The existing campaign-row `FOR UPDATE` lock and the `status <> 'successful'` capture gate are unchanged; the lock plus READ COMMITTED makes the check safe when two captures race. A NULL `donor_id` counts as one donor.
- **Public impact total** (`apps/api/src/modules/content/content.service.ts` `getImpact()`): `totals.donorCount` = distinct `donor_id` over successful donations (plus NULL-donor donations), not `SUM(campaigns.donor_count)`. Same field name and response shape. The web does not render this field.
- **Not changed:** schema, migrations, seed (synthetic `donor_count` baselines kept), web UI, `donors.donation_count`/`total_donated`.
- **No recount was run.** Existing counters (including any production values) keep their old meaning until a human runs the recount runbook in `DATABASE.md` §12. Never run it on the demo databases.
- **Tests:** `apps/api/test/donations.spec.ts` gains a "donor count" block (repeat donor +0 with money added; different donor +1; same email differently written +0; same donor on another campaign +1 there; anonymous repeat +0; two racing captures by one new donor +1; `/impact` unchanged after a repeat gift). The webhook/browser race test now uses its own donor so "+1 once" still tests what it meant. The teardown now restores `amount_raised` and `donor_count` on the campaigns it spends (it already restored `provided_quantity`), so runs no longer leak counter increments into `sailent_dev`. `public-api.spec.ts` checks `/impact` equals the distinct count. Against the old capture code, 4 of the new tests fail (checked 2026-10-06).
- **Pre-existing dev drift left alone:** `sailent_dev` `school-kits-jharkhand` reads 397 donors against a seed value of 320, from earlier test runs that never restored counters. Not reconciled (owner rule); a local re-seed would reset it.

**9. Programme campaign counts (2026-10-06, `f9816be`, pushed)**
- **Problem:** the public `GET /programs` and `GET /programs/:slug` returned `programs.campaign_count`, a rollup nothing writes, so every programme card read "Ongoing program" instead of "N active campaigns".
- **API** (`apps/api/src/modules/content/content.service.ts`): a private `openCampaignCount()` correlated subquery (aliased raw SQL, as in `categories.service.ts`) counts campaigns with `program_id = programs.id`, not deleted, `status = 'active'`, and no end date or one `>= deadlineCutoff()` — the `status=open` rule. Used by `listPrograms` and `getProgramBySlug` (which now selects every column with the live count in place of the stale one). Field name `campaignCount` and the response shapes are unchanged. The admin programme count (all non-deleted campaigns) is unchanged. The `campaign_count` column stays in the schema, unused by public reads (`DATABASE.md` §2).
- **Fixture fallback** (`apps/web/src/lib/content/programs.ts`): programme fixtures no longer carry hand-typed counts (they disagreed with the fixture campaigns); `countOpenCampaigns()` (`apps/web/src/lib/open-campaigns.ts`) derives them from the campaign fixtures with the same rule (`hasEnded`).
- **Tests:** `public-api.spec.ts` "programme campaign counts" — a test programme with open-ongoing, open-with-deadline, expired, paused, completed, draft and deleted campaigns counts **2** on the list and the detail; every published programme's count equals the same rule in SQL. All three fail against the old query (checked 2026-10-06). Web unit test `open-campaigns.test.ts`. E2E: the programmes journey asserts the Education card reads "1 active campaign".

**10. Razorpay webhook hardening — payment audit C1 + L1 (2026-10-07, `e87864b`, pushed)**

From the read-only payment audit of 2026-10-07. Only C1 (a transient webhook failure could lose a captured payment) and L1 (a bad signature answered 200) are fixed here.
- **Retryable events** (`apps/api/src/modules/donations/payment-verification.service.ts`, `claim()`): the insert into `payment_webhooks` and its unique `provider_event_id` are unchanged. On a conflict, the stored status decides:
  - **terminal** — `processed`, `ignored`, `needs_review` — a duplicate, answered 200, nothing runs;
  - **`pending`** (processing never finished, e.g. a crash) or **`failed`** — the redelivery processes the same row again.
- **Transient failures return 503** (`razorpay-webhook.controller.ts`): any processing error other than an amount mismatch (Razorpay re-fetch failure, database error) marks the row `failed` (best effort; if that write fails the row stays `pending`) and the controller answers **503**, so Razorpay redelivers. A transient failure is never recorded as `processed` or `ignored`. Previously it was `failed` + **200**, and Razorpay stopped delivering.
- **Amount mismatch → `needs_review`** (terminal, 200): no redelivery can change what was charged. Detected with `AmountMismatchException` (a `ConflictException` subclass), so the browser's verify-payment answer is unchanged (409, same message). Previously `failed` + 200.
- **Invalid signature → 401** (was 200 `{status:'rejected'}`); nothing is stored.
- **Exactly-once capture is unchanged:** every capture still passes the `status <> 'successful'` gate inside the capture transaction, so a redelivery can never add a second capture, receipt, payment record, campaign amount or donor count. Signature checks, the Razorpay re-fetch, the amount check and the order-ownership check are unchanged.
- **Tests** (`apps/api/test/donations.spec.ts`, "webhook redelivery", 6 new; the forged-webhook test now expects 401 and no stored row): transient re-fetch failure → 503 and `failed`; its redelivery → processed, captured once, then duplicates; browser capture between attempts → nothing added; a crash before the work (row `pending`) → captured on redelivery; a crash after the capture committed → nothing added; amount mismatch → `needs_review`. All 7 fail against the previous code (checked 2026-10-07). The fake Razorpay gained `__failNextFetches(n)`.
- **Limits:** no lease column, so a `pending` row from a crash looks like one still in progress and two simultaneous deliveries may both run (capture stays exactly-once; a repeated `payment.failed` can add an extra history row). Recovery relies on Razorpay redelivering (a limited window, about 24 hours); after that, a `pending`/`failed` row needs reconciliation (H1) or a manual replay tool, neither of which exists.
- **Still open from the payment audit (not started):** H1 reconciliation and pending expiry; H2 checkout failure/retry handling (double-payment risk); H3 throttling keyed on the real client IP; M1 receipt financial year in IST; M2 production live-key guard; M3 international payments (FCRA); M4 admin payment-exceptions view; M6 guest checkout overwriting donor details; L2–L5. See §5.5.

**11. Phase 11 — Payment & Donation Production Readiness (2026-10-07, `5170ce0`, pushed)**

The payment-audit findings H1, H2, H3, M1, M2, M4, L2, L3 and L4 (idempotency), plus the `Permissions-Policy` check. No schema change, no migration.
- **Reconciliation and pending expiry (H1).** `PaymentReconciliationService` (`apps/api/src/modules/donations/payment-reconciliation.service.ts`), run by `POST /api/v1/internal/payments/reconcile` (`internal-payments.controller.ts`, authenticated only by `INTERNAL_API_SECRET`; 503 when unset). The worker schedules it (`apps/worker/src/processors/payment-reconciliation.processor.ts`; `payments` queue, repeatable `payments.reconcile`, default every 10 min).
  - Candidates: `pending`/`processing` donations older than 15 min (up to 30 days), and `failed` ones with an order from the last 72 h; oldest first, 100 per run.
  - A captured payment on the order (`RazorpayClient.fetchOrderPayments`) → `PaymentVerificationService.captureVerifiedPayment` → the same order/currency/amount checks and the same exactly-once capture as browser and webhook.
  - Nothing captured, `pending`, past **24 h** → `DonationCaptureService.markCancelled` (conditional on `pending`/`processing`; payment row and `payment_transactions` follow). Not if an `authorized` payment exists; not if a captured payment mismatches (both stay pending and show in the exceptions view). No order → cancelled after 24 h. `failed` is never cancelled.
  - Idempotent and race-safe with the webhook and the browser; a late payment on a `cancelled` donation still captures.
- **Checkout retry and duplicates (H2, L4).** `razorpay-checkout.ts` no longer settles on `payment.failed` (Razorpay's window allows a retry on the same order); it settles on payment or close (reporting the last failure). `checkout-attempt.ts` + `donation-checkout.tsx`: the same basket reopens the same donation and order. `POST /donations` accepts `Idempotency-Key` (`DonationIdempotencyService`, Redis 30 min; same key+body → same donation while unpaid incl. failed; different body → 422; in progress → 409; paid/cancelled → 409; Redis down → no idempotency).
- **Per-client rate limits (H3).** `ClientThrottlerGuard` keys on the address in `x-sailent-client-ip`, believed only with `INTERNAL_API_SECRET` in `x-sailent-internal-auth` (`common/security/internal-request.ts`), else `req.ip`. The BFF and the staff-login, OTP and volunteer-apply server actions add the headers (`apps/web/src/lib/api/forwarding.ts`, `client-ip.ts`) and the BFF strips browser-supplied copies. The web server derives the address only from `CLIENT_IP_HEADER` (+ `TRUSTED_PROXY_HOPS`) — unset means site-wide limits, as before. Limits unchanged.
- **Hardening.** IST financial year (`receipts.service.ts`, M1); production rejects non-`rzp_live_` keys and requires `INTERNAL_API_SECRET` (API) and `API_INTERNAL_URL` + `INTERNAL_API_SECRET` (worker) (`packages/config/src/env.ts`, M2); order and currency checked on the fetched payment before capture (L2, L3; mismatches are `PaymentMismatchException` → `needs_review` from the webhook).
- **Admin payment exceptions (M4).** `GET /api/v1/admin/payments/exceptions` (`payment.read`; GET only) and `/admin/payments` (Finance menu): failed, unfinished (pending > 15 min) and needs-review webhooks with payment/order ids and the linked donation; donations pending > 1 h (overdue past 24 h); cancelled in the last 7 days. No raw payload, no donor details, no write action.
- **Razorpay Checkout compatibility.** `Permissions-Policy` `payment=()` → `payment=(self "https://api.razorpay.com" "https://checkout.razorpay.com")` (`apps/web/src/lib/security/permissions-policy.ts`). Not verified on a real device (no Razorpay keys) — part of the sandbox trial.
- **Also updated:** `.env.example` (variable names only), the admin reconciliation page copy, `SECURITY.md`, `DATABASE.md` §6, `DEPLOYMENT.md` §6/§6a/§7.
- **Not changed:** exactly-once capture, signatures, amount checks, distinct donor counts, campaign status/deadline/stop-at-goal checks, out-of-band refund flagging, schema.

**12. Phase 12 — Accounts, Authentication & Security Hardening (2026-10-07, committed locally as `feat(auth): complete account and security hardening`, NOT pushed)**

**Owner decisions for this phase:**
- Staff authenticate with email and password.
- **Staff TOTP/2FA is NOT required.** No enrolment, no TOTP at login, no mandatory staff 2FA was built. The dormant `TOTP_REQUIRED_ROLES` set (retired roles only) is unchanged and has no effect.

No schema change, no migration, no seed change, no CI change, no payment behaviour change.

**A. Account flows.**
- **Volunteer sign-in.** `AuthService.signInRecipient()` sends a code to an address held by a donor **or** a volunteer whose status is not rejected/archived. The first sign-in opens the general (`donors`) account, which `/me/volunteering` links by email. An unknown address still gets the same answer and no mail.
- **Email normalisation.** One `normaliseEmail()` (NFC, trim, lower case) in `packages/validation`, used by staff login, donor OTP, the email change, guest checkout, volunteer apply and lookup, `/me/volunteering`, staff invites and admin donor corrections. Staff login matches `lower(btrim(users.email))`.
- **Verified email change.** `PATCH /me` refuses `email` (422, strict schema). `POST /me/email/change` sends a six-digit code to the NEW address (`otp_codes` purpose `email_change`, identifier `email_change:<donor id>:<email>`; 10 min, 5 attempts, 3 per 15 min). `POST /me/email/verify` applies it; a clash is reported (409) only after the code proves ownership. The worker's `donor.login_code` processor has an email-change variant. The web profile shows the address read-only, with a request-then-confirm form.
- **Guest checkout** (`donations.service.ts` `upsertDonor`) attaches a donation to an existing donor **without** changing the donor's name or phone, and answers the same whether or not an account exists.
- **Volunteer self-service** stays limited to its allowed fields; tests now assert that status, hours, volunteer id, email and the reviewer fields are refused (422).

**B. JWT and sessions.**
- `TokenService` signs with `algorithm: 'HS256'` and verifies with `algorithms: ['HS256']` (`ACCESS_TOKEN_ALGORITHM`).
- Refresh rotation claims the old token with `UPDATE … WHERE revoked_at IS NULL RETURNING` inside the transaction that creates the new session. The loser of a race is treated as reuse: the family is revoked and `auth.refresh_reuse_detected` audited.
- Logout revokes the session, and the access token stops working at once (the session row is checked on every request).

**C. Authentication audit events** (`audit_logs`, via `AuditService`):
- staff: `auth.staff.login_succeeded`, `login_failed` (reason), `locked`, `reauth_succeeded` / `reauth_failed`;
- donor: `auth.donor.otp_verified` / `otp_failed` / `account_created`;
- sessions: `auth.logout`, `auth.refresh_reuse_detected`;
- email change: `donor.email_change_requested` / `_verified` / `_failed`.

No password, code, token or PAN is written. An address with no account is recorded as a 16-character hash.

**D. PAN protection.**
- `FieldEncryptionService` (`apps/api/src/common/security/`, global `SecurityModule`): AES-256-GCM, random IV, the column name as associated data, stored as `enc:v1:<iv>:<ct>:<tag>`.
- `FIELD_ENCRYPTION_KEY` is required in production; without it, saving a PAN returns 503 (never plaintext). Legacy plaintext is read and encrypted on the next write.
- `/me` returns `taxIdNumberMasked` + `hasTaxId` only; staff with `donor.read_sensitive` see it decrypted.

**E. Headers.**
- **CSP:** `apps/web/src/lib/security/content-security-policy.ts`, Razorpay Checkout allowed, `'unsafe-inline'` scripts kept (documented trade-off).
- **HSTS:** 2 years, subdomains, when started with `APP_ENV=production`.

**F. CSRF.** The BFF refuses (403) a write whose `Origin` is not this site, `NEXT_PUBLIC_APP_URL` or `TRUSTED_ORIGINS`, or that has no `Origin` and no `Sec-Fetch-Site: same-origin` (`apps/web/src/lib/security/origin-check.ts`). Webhook and worker calls go to the API directly and are unaffected.

**G. Client IPs.** `requestClientIp()` (`common/security/internal-request.ts`) replaces the 18 controller helpers that trusted `X-Forwarded-For`. It uses the Phase 11 trusted header only with `INTERNAL_API_SECRET`, and otherwise the connecting address.

**H. Fail-closed environment.**
- **API:** requires a valid `FIELD_ENCRYPTION_KEY` in production.
- **Worker:** requires an https `APP_PUBLIC_URL` in production.
- **Web:** validates `webEnvSchema` at startup (`apps/web/src/instrumentation.ts`). Production refuses mock data, a missing `INTERNAL_API_SECRET` or `CLIENT_IP_HEADER`, a non-https app URL, and DEMO organisation data. Mock fixtures are never used when `APP_ENV=production` (`lib/runtime-flags.ts`).

**Tests:**
- `apps/api/test/account-security.spec.ts` (22);
- `token.service.spec.ts`, `field-encryption.service.spec.ts`;
- config guards in `app.config.spec.ts`;
- `normaliseEmail`;
- web `origin-check`, `content-security-policy`, `runtime-flags`;
- E2E: the CSP and BFF cross-site tests in `shell.spec.ts`, and the email-change test in `dashboard.spec.ts`.

**Not in scope:** staff invite and password reset (Phase 13); SEO (Phase 15). **Campaign Gallery: untouched.**

**Human-only follow-ups:**
- generate and store `FIELD_ENCRYPTION_KEY`;
- re-encrypt existing production PANs;
- configure the production web environment.

All in `DEPLOYMENT.md` §6b.

### What was being worked on

Phase 12 (item 12) is implemented, validated (§2) and committed locally as one commit, `feat(auth): complete account and security hardening`. It is **not pushed**; pushing needs the owner's approval. CI is deferred by the owner.

### Reverted by the owner on 2026-10-06 (do not redo unless asked)

The homepage visual refinement (one font family, a new type scale, a 1320px container, 8px buttons, a hero redesign). The repository is back to the `ae1520b` design:
- fonts: DM Sans, Plus Jakarta Sans and Caveat;
- `--container-page` 90rem;
- pill buttons;
- a full-bleed hero photograph.

### Must not change

See **`AGENTS.md` §11**, the permanent list of owner-approved designs and decisions.

---

## 2. LAST VALIDATION — snapshot as of 2026-10-07 (local only)

**Phase 12 (item 12), 2026-10-07:**

| Command | Result |
|---|---|
| `pnpm prettier --check .`, `pnpm typecheck`, `pnpm lint` | ✅ pass (13/13 tasks each) |
| `pnpm --filter @sailent/api test` (full) | ✅ **861 passed, 0 failed**, 9 skipped (second run). The 4 `me.spec.ts` drift failures are gone (PAN is now stored `enc:v1:`, §5.1). The first run had 1 intermittent `public-api.spec.ts` failure ("matches the open-campaign rule for every programme", a whole-database comparison raced by other suites); it passed on the rerun. Includes `account-security.spec.ts` 22/22. |
| `pnpm --filter @sailent/web test` / `@sailent/validation` / `@sailent/database` / `@sailent/worker` | ✅ 146 / 281 / 180 / 8 passed |
| `pnpm build --force` (isolated copy) | ✅ 8/8 tasks |
| Playwright, **full suite** × 4 projects (744 tests, isolated copy, `--workers=2`) | 546 passed, 6 failed, 168 skipped, 24 not run. 4 failures were one too-broad locator in the new email-change test (fixed); the 24 not run were the later tests in that serial block. The other 2 are the **pre-existing WebKit failures** (below). |
| Playwright `dashboard.spec.ts` × 4 projects, after the locator fix | ✅ 92 passed |
| Mutation checks | Each of these reverts made tests fail: no `algorithms` pin (HS384/HS512 accepted); no `revoked_at IS NULL` in the refresh claim (race test); `X-Forwarded-For` trusted again in the auth controller (spoof test); PAN written in plaintext (encryption test); origin check bypassed (3 failures); the volunteer schema made `.passthrough()` (5 failures). |

**Phase 11 (item 11), 2026-10-07:**

| Command | Result |
|---|---|
| `pnpm prettier --check .`, `pnpm typecheck`, `pnpm lint` | ✅ pass (13/13 tasks each) |
| `pnpm --filter @sailent/api test` (full) | ❌ 819 passed, **4 failed**, 9 skipped — only the 4 `me.spec.ts` drift failures (§5.1). Includes `donations.spec.ts` 60/60 and `rate-limit.spec.ts` 10/10. |
| API unit (config guards, client IP, IST financial year) | ✅ included above; the IST tests also pass under `TZ=UTC` |
| `pnpm --filter @sailent/worker test` | ✅ 8 passed |
| `pnpm --filter @sailent/web test` / `@sailent/validation` / `@sailent/database` | ✅ 128 / 280 / 180 passed |
| `pnpm build --force` (isolated copy) | ✅ 8/8 tasks |
| Playwright campaign, donations, journeys, shell, admin-reports × 4 projects (isolated copy, `--workers=2`) | 391 passed, **1 failed**, 56 skipped. The failure is the pre-existing WebKit "featured campaigns rail › keyboard users can still pause it" (below). |
| Mutation checks | The previous throttler guard fails both per-client tests; the previous checkout wrapper fails "payment after a failed attempt"; the previous financial-year code fails 5 boundary cases under `TZ=UTC`. |

**Webhook hardening C1 + L1 (item 10), 2026-10-07:**

| Command | Result |
|---|---|
| `pnpm prettier --check .`, `pnpm typecheck`, `pnpm lint` | ✅ pass (13/13 tasks each) |
| API `donations.spec.ts` + `public-api.spec.ts` + donations module unit tests | ✅ 103 passed |
| `pnpm --filter @sailent/api test` (full) | ❌ 773 passed, **4 failed**, 9 skipped — the 4 `me.spec.ts` drift failures (§5.1) |

**Programme campaign counts (item 9), 2026-10-06:**

| Command | Result |
|---|---|
| `pnpm prettier --check .`, `pnpm typecheck`, `pnpm lint` | ✅ pass (13/13 tasks each) |
| API `public-api.spec.ts` + `catalog.spec.ts` | ✅ 99 passed |
| `pnpm --filter @sailent/web test` / `@sailent/validation test` | ✅ 114 / 280 passed |
| `pnpm --filter @sailent/api test` (full, 3 runs) | 766–767 passed, 9 skipped. Always the 4 `me.spec.ts` drift failures (§5.1). Once each, an intermittent failure in `rbac.spec.ts` ("ignores an unknown sort field") and `blog.spec.ts` ("stamps publishedAt once"); both pass alone and in the other runs (§5.5). |
| Playwright `journeys.spec.ts -g programs` × 4 projects (isolated copy) | ✅ 8 passed |

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
| One-time donations + Razorpay | COMPLETE IN CODE / NOT VERIFIED LIVE | Phase 11 added reconciliation and expiry, checkout retry, idempotency, per-client limits, currency/order checks (committed locally, not pushed). Tested with a mocked client only; never run against live or sandbox Razorpay. Missing: total cap, receipt PDF. Local behaviour without keys: `DEPLOYMENT.md` §6. |
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

### 5.1 Local database drift (no longer causes test failures, since Phase 12)

**Unknown migration.** `drizzle.__drizzle_migrations` holds **24 rows** in both `sailent_dev` and `sailent_e2e`; the repository journal has **23**.
- Row 24 matches no repository file. Its only effect is a CHECK constraint, `donors_tax_id_encrypted` (`tax_id_number IS NULL OR tax_id_number LIKE 'enc:%'`).
- Since Phase 12 the API encrypts PANs (`enc:v1:…`), which satisfies the constraint, so `PATCH /me` with a tax ID works locally and the 4 `me.spec.ts` failures are resolved — **with no database change**.
- The row itself is still unexplained, and the repository has no matching migration.

**Edited migration.** Row 15 (`0014`) no longer matches its file; the file was edited after it was applied.

**Owner decision still open (lower priority now):**
- **(a)** commit a migration that adds the same CHECK, so every database (including production, after its PANs are re-encrypted by a human) carries it; or
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

- **Rate limits and audit IPs.** Per real client since Phase 11, and audit/session IPs since Phase 12 — once the web server's `CLIENT_IP_HEADER` and `INTERNAL_API_SECRET` are configured; until then site-wide, as before (`DEPLOYMENT.md` §6a). `X-Forwarded-For` is no longer trusted anywhere in the API.
- **Staff 2FA: not required, by owner decision** (2026-10-07). Not a gap.
- **Staff invite and password reset** do not exist (Phase 13).
- **PAN:** encrypted since Phase 12, but **production may hold plaintext PANs** written earlier; re-encrypting them, and generating and keeping `FIELD_ENCRYPTION_KEY`, are human-only (`DEPLOYMENT.md` §6b).
- **CSP keeps `'unsafe-inline'` scripts** (accepted trade-off, `SECURITY.md`). HSTS needs `APP_ENV=production` on the web.
- **Audit log** is not tamper-proof (no REVOKE, writes fail open).
- **Account lockout** can be triggered by anyone for any staff account, and its 429 reveals that the account exists (unchanged).
- Donor OTPs are a bare SHA-256, not an HMAC (low).

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
- **Programme rollups are never written.** Public reads of the campaign count now compute it live (§1 item 9); `total_raised` and `beneficiaries_reached` remain unwritten and unrendered.
- **Historical `donor_count` values are not recounted.** New captures count distinct donors (§1 item 8); values written before 2026-10-06 may be overstated where a donor gave more than once. Recount is a human-only runbook (`DATABASE.md` §12).
- **Orphan pending donations without Razorpay keys** (`DEPLOYMENT.md` §6).
- **Payment items still open after Phase 11 (2026-10-07):**
  - Reconciliation, per-client limits and the worker schedule need **deployment configuration** (`INTERNAL_API_SECRET` on API, web and worker; `API_INTERNAL_URL`; `CLIENT_IP_HEADER`), a human task (`DEPLOYMENT.md` §6a). Without it, limits stay site-wide and nothing is reconciled.
  - **Never run against real Razorpay** (no keys): order payments endpoint, Checkout retry behaviour and the `Permissions-Policy` change are verified only against fakes — the sandbox trial (Phase 15) must cover them.
  - M3 international payments are accepted and kept (FCRA) — disable in the Razorpay dashboard (human).
  - ~~M6 guest checkout overwrites an existing donor's name and phone~~ — fixed in Phase 12.
  - No total-value cap on a donation (custom amount is capped at ₹10 lakh); receipt PDF; receipt superseding (blocked by `receipts_donation_unique`).
  - `payment_webhooks` rows left `failed`/`pending` are not replayed by any tool (reconciliation settles the donation directly; the rows stay visible in Payment exceptions).
  - Reconciliation examines up to 100 donations per run, oldest first; stuck ones (authorised or mismatched payments) are re-examined every run until resolved by a human.
- **Soft 404s.**
- **The web build needs the API** for some routes.
- **`campaigns.program_id` is nullable.** A live campaign can be detached by PATCH.
- **2 pre-existing WebKit E2E failures** (§2).
- **Intermittent API test failures in full parallel runs** (seen 2026-10-06): `rbac.spec.ts` "ignores an unknown sort field" compares two consecutive `/admin/users` responses while other suites sign users in; `blog.spec.ts` "stamps publishedAt once" failed once. Both pass alone. Not investigated.
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
| `FIELD_ENCRYPTION_KEY` not generated for production; production PANs possibly plaintext | Storing PANs in production | Generate and store the key; re-encrypt existing PANs (`DEPLOYMENT.md` §6b) |
| Unknown production database state | Any production work | A human verifies the production schema version and residue (§5.2) |
| No refund/cancellation policy page (Razorpay requires one) | Razorpay activation | Supply the policy text |

---

## 7. UNFINISHED WORK (ordered)

1. ~~Commit the featured/deadline work~~ (done: `dd64d41`). ~~Fix the CI target flag~~ (done: `0e94632`). ~~Turborepo test env~~ (done: `7fe6c25`). All pushed.
2. ~~Commit the campaign cleanup~~ (done: `ed69d41`, pushed). **Commit the donor-count change** (§1 item 8) with owner approval; push only with a separate approval.
3. CI (deferred by the owner, 2026-10-06): observe the GitHub Actions run and, with approval, the dependency overrides for `pnpm audit` (§5.4).
4. ~~Programme campaign counts~~ (`f9816be`), ~~webhook hardening~~ (`e87864b`) and ~~Phase 11~~ (`5170ce0`), pushed. Phase 12 committed locally (`feat(auth): complete account and security hardening`); **push it** with owner approval; then **Phase 13 — Admin, CMS & Communications** (2026-10-07 roadmap; includes staff invite and password reset).
5. Owner decision on the leftover local migration row (§5.1); no longer blocks tests.
6. ~~Web `FEATURE_MOCK_DATA` default and `webEnvSchema`; spoofable audit IPs; PAN encryption; email verification; CSP and HSTS~~ (Phase 12). Staff 2FA: not required (owner decision).
7. Human-led production audit and hardening (§5.2), including `FIELD_ENCRYPTION_KEY` and re-encrypting existing PANs (`DEPLOYMENT.md` §6b).
8. Phase 14 (infrastructure and operations) and Phase 15 (final launch readiness, including SEO).
9. Notification retry consumer; programme rollups. (Reconciliation and pending expiry: Phase 11.)
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
| 2 | `docs/security-architecture.md`, `database-architecture.md`: PAN encrypted (AES-256-GCM) | **Resolved in Phase 12:** encrypted with AES-256-GCM and `FIELD_ENCRYPTION_KEY` (`enc:v1:` format). Rows written before Phase 12 may still be plaintext until rewritten. |
| 3 | A8, `security-architecture.md`: TOTP mandatory for privileged staff | **Superseded by owner decision (2026-10-07):** staff TOTP/2FA is not required. The TOTP role set lists deleted roles and has no effect. The older documents are left unchanged. |
| 4 | A4: webhook processed asynchronously via BullMQ | Inline |
| 5 | A7: receipt `SF/2026-27/000001` | `SFL-<FY>-000001` |
| 6 | A10: audit-log INSERT/SELECT-only role | No GRANT/REVOKE or trigger; the app connects as the owner |
| 7 | `docs/rbac*.md`: 6–7 roles; permissions in the token | One role; token carries `sub`/`aud`/`sid` only; permissions resolved per request |
| 8 | `docs/README.md` index stops at Phase 9 | Phase 10.5–10.12 documents exist |
| 9 | IA, user-flows, PRD: recurring giving, refunds, `/refund-policy`, `/transparency`, `/gallery`, `/account/*`, phone OTP, guest event registration and waitlist | Removed or changed |
| 10 | `api-architecture.md`: `/donations/intent`, `/subscriptions`, `Idempotency-Key` | `POST /donations`; no subscriptions; an optional `Idempotency-Key` on `POST /donations` since Phase 11 (Redis-held, not a column) |
| 11 | `design-system.md`, `phase-1.md`: green brand hue, serif display font, 1200px container | Navy/blue/orange palette (hue 250); DM Sans + Plus Jakarta Sans + Caveat; 90rem container |
| 12 | `development-setup.md`, `database-development.md`: `pnpm db:migrate` with no `--target` | `--target` is required |
| 13 | `docs/database-development.md` "Development credentials": five per-role accounts with a required second factor | The current seed creates two `SUPER_ADMIN` accounts (`admin@sailent.local`, `staff@sailent.local`); TOTP is not enforced for `SUPER_ADMIN`. Older local databases may still hold the earlier accounts. |
| 14 | `content-layer.md` §8: blog is fixture-backed | Database-backed |
| 15 | Worker queue comments: declared queues are consumed | Only `example` and `email` are consumed |
| 16 | `.env.example`: `SMS_*`, `SENTRY_*`, `JWT_REFRESH_SECRET`, `FEATURE_FCRA_ENABLED` | Never read (`FIELD_ENCRYPTION_KEY` is read since Phase 12) |
| 17 | `docs/environment.md`: blank values fall back via `\|\|` | Web code uses `??` for `API_URL` |
| 18 | `docs/phase-8.md` §13.6, §16: the Supabase project is "development/staging" | The code guard treats that host as production; the owner confirmed (2026-10-06) that it is **production** |
| 19 | Phase 8 code comments use both labels for the same hosted project | "production" in `rotate-admin-password.ts` (about line 56) and in the seed's `main()` comment; "staging" in `database-target.ts` (about line 199) and `prepare-e2e.ts`. Per the owner (2026-10-06), it is **production**. The comments are left unchanged (application code). |
| 22 | Seed header comment (`packages/database/src/seed/index.ts`, near the top): `--reference` is "safe anywhere / safe in any environment" | It is **not** safe on production: it deletes and re-inserts the `SUPER_ADMIN` grants (a lockout window), prunes permissions and upserts category slugs. The seed's own `main()` comment says so, and so do `DATABASE.md` §10 and `DEPLOYMENT.md` §10. |
| 23 | Seed `main()` comment: "five staff accounts with a known password" | The current seed creates **two** (`admin@sailent.local`, `staff@sailent.local`) |
| 24 | `donations.service.ts` comment: a failed order leaves a pending donation "swept by the same reconciliation"; `razorpay.client.ts` comment: `isConfigured` is "checked by the donation endpoints" | Since Phase 11 reconciliation exists and cancels such a donation after 24 h (when the worker is configured). `isConfigured` is still checked only inside `RazorpayClient.call()`, after the donation has been committed (`DEPLOYMENT.md` §6). |
| 20 | The audit task mentioned Cloud Run | No Cloud Run, GCP or Docker deployment configuration exists |
| 21 | Local databases | One applied migration is absent from the repo, and `0014` was edited after it was applied (§5.1) |

---

## THE NEXT AI AGENT SHOULD START HERE

1. Read `AGENTS.md` in full, especially §8 (production is off limits), §9 (work directly on `main`; owner approval before every commit and every push) and §11 (must not change). Then read this file, and `CLAUDE.md` if you are Claude Code.
2. Run `git status`, `git log --oneline -5` and `git status -sb`. As of 2026-10-07, local `main` is 1 commit ahead of `origin/main` (`5170ce0`): the Phase 12 commit `feat(auth): complete account and security hardening`, **not pushed** (§1 item 12). Ask the owner before pushing it. Staff TOTP/2FA is **not required** (owner decision); do not add it.
3. **CI (deferred by the owner on 2026-10-06; resume only when asked): watch CI.**
   - Observe the GitHub Actions run for the current `main` head (for example with `gh run list` / `gh run view`, or on GitHub). The `security` job is expected to fail at `pnpm audit` until the dependency fixes are approved (§5.4).
   - Report the `quality` and `security` job results with their failing step and log excerpt, if any.
   - **Do not claim CI passes until that run has been observed.**
   - If a later step fails (build, tests, format, audit, gitleaks), report it and wait for the owner. Do not fix it unprompted.
4. **Then:** Phase 13 (Admin, CMS & Communications) when the owner starts it. Recommend a **human-led** review of the production database (§5.2) and the Phase 12 human-only steps (`DEPLOYMENT.md` §6b). The §5.1 leftover migration row still needs an owner decision, but no longer blocks tests.

Do not create feature branches or pull requests unless the owner explicitly asks (`AGENTS.md` §9).
