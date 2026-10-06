# CHANGELOG

A chronological development history built from the git history, the migration journal (`packages/database/drizzle/meta/_journal.json`), the phase documents in `docs/` and the work recorded in this project's development sessions. Nothing here is invented.

**Dating notes:**
- The phase documents 0, 1 and 2 are dated 2026-09-19. The other phase documents carry no date; their migrations' journal timestamps are used instead. The timestamps for `0017`–`0022` were hand-assigned and may not be exact.
- The first commit (`2ba2b43`, 2026-09-26) contains all work up to Phase 10.12, so individual dates before it cannot be confirmed from git. Later commits (from 2026-10-04) are dated from git.

Newest first.

---

## 2026-10-07 — Phase 11: Payment & Donation Production Readiness (`feat(payments): complete payment production readiness`; committed locally, NOT pushed as of 2026-10-07)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Payment reconciliation and pending expiry: a worker-scheduled job (`payments` queue, every 10 min) calls `POST /internal/payments/reconcile` (shared `INTERNAL_API_SECRET`); the API checks pending donations older than 15 min against Razorpay's order payments, captures through the normal path (source `reconciliation`), and cancels unpaid donations after 24 h | Payment audit H1: a payment missed by browser and webhook stayed `pending` forever; nothing wrote `cancelled` | Captured money is recorded exactly once; abandoned checkouts expire; `cancelled` still captures a late payment | none |
| Checkout: a failed attempt no longer ends the checkout; the same basket reopens the same donation and order; `POST /donations` accepts `Idempotency-Key` (Redis, 30 min) | H2: a successful retry after a failure was dropped and the donor could pay twice; every retry created another pending donation | No unnecessary duplicate donations or orders | none |
| Rate limits keyed on the real client: the web server forwards the client address with the internal secret; the API trusts it only with the secret (never `X-Forwarded-For`) | H3: every limit was site-wide | Limits apply per donor once the web server is configured (`CLIENT_IP_HEADER`) | none |
| Hardening: receipt financial year in IST; production rejects `rzp_test_` keys and requires `INTERNAL_API_SECRET`; the fetched payment's order and currency are checked before capture | M1, M2, L2, L3 | — | none |
| Read-only admin **Payment exceptions** (`/admin/payments`, `payment.read`): failed/unfinished/needs-review webhooks and stuck donations; identifiers only | M4 | No write route; no "mark successful" | none |
| `Permissions-Policy`: `payment` allowed for this origin and Razorpay's only (was `payment=()`) | It blocked the Payment Request API inside Razorpay Checkout | Other features still off | — |
| Tests: reconciliation, retries on one order, idempotency, hardening, exceptions authorisation (API); per-client limits; config guards; IST boundary; worker processor; checkout wrapper, attempt reuse, client IP, policy (web); E2E header and admin page | Cover the phase | Tests only | — |

Exactly-once capture, signatures, amount checks, distinct donor counts and campaign rules are unchanged. Human-only: production scheduling (worker env), web proxy configuration, Razorpay dashboard settings (`DEPLOYMENT.md` §6a).

## 2026-10-07 — `e87864b` Razorpay webhook hardening, payment audit C1 + L1 (pushed 2026-10-07)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Webhook events stored `pending` or `failed` are processed again when Razorpay redelivers them; only `processed`, `ignored` and `needs_review` are terminal duplicates. Event-id uniqueness unchanged | A transient failure was marked `failed` and answered 200, and a redelivery was treated as a duplicate, so a captured payment could stay `pending` | Crashed or failed events recover on redelivery | none |
| Transient processing failures (Razorpay re-fetch, database) answer **503**; an amount mismatch becomes `needs_review` (200) | Razorpay only retries non-2xx; a mismatch cannot be fixed by retrying | Razorpay retries what can succeed | none |
| Invalid webhook signature answers **401** (was 200) | The controller's stated intent; a forged delivery should be refused | Nothing stored, as before | — |
| Tests: 6 webhook-redelivery tests; forged-webhook test expects 401 and no stored row | Cover retry, crash recovery and exactly-once capture | Tests only | — |

Exactly-once capture is unchanged (the `status <> 'successful'` gate in the capture transaction). Still open from the payment audit: reconciliation and pending expiry, checkout retry handling, throttling, and the other findings in `DEVELOPMENT_STATUS.md` §5.5.

## 2026-10-06 — `f9816be` Programme campaign counts (pushed 2026-10-07)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Public `GET /programs` and `GET /programs/:slug` compute `campaignCount` live: open campaigns (active, not deleted, not past their end date; the `status=open` rule) | They read `programs.campaign_count`, a rollup nothing writes, so every card showed "Ongoing program" | Programme cards show "N active campaigns". Same field and shape; admin count unchanged; `campaign_count` column retained, unused by public reads | none |
| Fixture fallback derives programme counts from the campaign fixtures (`countOpenCampaigns`) | The hand-typed fixture counts disagreed with the fixture campaigns | Development fallback only | — |
| Tests: programme-count API tests (count 2 across seven campaign states; equality with SQL for every programme); web unit test; E2E card assertion | Cover the rule and the silent-zero subquery risk | Tests only | — |

## 2026-10-06 — `2fc5aa9` Accurate donor count (pushed 2026-10-06)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `campaigns.donor_count` counts distinct donors per campaign: capture adds 1 only for a donor's first successful donation to that campaign (identity `donations.donor_id`), under the existing campaign-row lock | It counted donations, so a repeat donor was counted again | Repeat gifts raise `amount_raised` only; the same donor counts once per campaign | none |
| Public `GET /impact` `totals.donorCount` = distinct successful donors, not `SUM(campaigns.donor_count)` | The sum counted one person once per campaign, and repeats | Same field and shape; the web does not render it | none |
| Donation tests: a donor-count block; webhook-race test given its own donor; teardown restores `amount_raised`/`donor_count`. `/impact` distinct-count test | Cover the rule; stop tests leaking counter increments into `sailent_dev` | Tests only | — |
| `DATABASE.md` §6 semantics and §12 human-only recount runbook | Existing counters were not recounted | Documentation | — |

## 2026-10-06 — `ed69d41` Campaign public experience cleanup (pushed 2026-10-06)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Public API `status=open` (active, not past its end date) and `status=closed` (paused, or active past its end date), using the new `deadlineCutoff()` in `@sailent/validation`; listing Active → `open`, Closed → `closed`; homepage "Browse by cause" grid uses `open` | Owner: the homepage shows only campaigns accepting donations; "Active" must not include paused or ended campaigns | Paused and past-deadline campaigns leave the homepage grid and the Active filter and appear under Closed | none |
| "Other Ways to Support" custom-amount panel restored on the campaign page | Owner decision | Typed amount and card presets share one value | — |
| Mobile donation area: the fixed bottom "Review" bar is replaced by the full donation card in the page flow | Owner: non-sticky donation area on mobile; the bar covered content and focus | Desktop sticky card unchanged | — |
| Duplication cleanup: "What Will Your Support Provide?" becomes a summary; "Difference Your Support Can Make" shows outcomes and "What one gift does", without the target or the repeated people-reached figure | Owner decisions | Goal kept on the card and in "Our Goal"; reached figures kept in "Your Impact"; Campaign Gallery kept | — |
| Stories: a campaign shows only its own (matched by `campaignId`); borrowed stories are labelled | Unrelated stories appeared under a campaign's name | — | — |
| Section-nav scroll hint; header wordmark wraps on phones; JSON-LD output escaped | Responsive/accessibility audit; stored-injection risk | — | — |
| Tests: E2E campaign/donations/journeys updated to the new layout; new unit, API and E2E tests | Cover the new decisions | — | — |

Also recorded: `166b70c` (docs) and `7fe6c25` ("ci: pass test database and redis env through turbo", `turbo.json` `passThroughEnv`) were committed and pushed on 2026-10-06. The CI run for `7fe6c25` has not been observed.

## 2026-10-06 — `0e94632` "ci: target local database in CI migrations and seed" (21:08 IST; not pushed as of 2026-10-06)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `.github/workflows/ci.yml`: `pnpm db:migrate --target=local` and `pnpm db:seed --target=local` | The database target guard refused both commands without a declared target, so every CI run stopped at "Apply migrations" | CI can reach the test steps. With the flag, the guard also verifies that CI's `DATABASE_URL` is a localhost database. **Not verified on GitHub yet.** | — |

## 2026-10-06 — `d7f42e3` "added md files" (20:59 IST; not pushed as of 2026-10-06)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Documentation/context system: `AGENTS.md` (project rules above the Turborepo block), `CLAUDE.md`, `PROJECT.md`, `ARCHITECTURE.md`, `SECURITY.md`, `DEVELOPMENT_STATUS.md`, `PHASES.md`, `DATABASE.md`, `DEPLOYMENT.md`, `CHANGELOG.md` | Read-only audit, so any agent can resume work safely; revised after a fresh-agent verification | Documentation only | — |
| Owner decisions recorded: the Supabase project behind the production guard is **production**; AI agents never operate on the production database | Owner, 2026-10-06 | Permanent rule in `AGENTS.md` §8 | — |

Later on 2026-10-06 (working tree): `AGENTS.md`, `CLAUDE.md` and the other docs were updated for the main-only git workflow (no feature branches or PRs unless requested) and the CI fix. Not committed as of this entry.

## 2026-10-06 — `dd64d41` "feat(campaigns): admin-controlled featured campaigns and optional end-date deadlines" (20:50 IST; pushed to `origin/main` 2026-10-06)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Ongoing-by-default campaigns: `hasEnded()` (end of day, IST); `donationAvailability`/`acceptsDonations` aware of the deadline; checkout uses it; cards, status card, donation builder and featured band hide Donate for ended campaigns; campaign header shows "Ends …/N days left" or "Closed …" and the "Campaign period" row is removed; admin date hints rewritten | Owner: "there should be no campaign period". The page offered donations that checkout refused after the end date. | Campaigns without an end date never close on their own | none (seed: `endDate: null`). Dev database `UPDATE campaigns SET end_date=NULL` (local only, approved). |
| Admin-controlled featured campaigns: "Feature on the homepage" and "Featured order" in the admin form; "Featured · N" badge in the admin list; public `sort=featured`; homepage band uses `getFeaturedCampaigns()` (open campaigns only) | Owner asked to give admins the power to choose featured campaigns. The band previously showed the oldest campaigns, ignoring `is_featured`. | Homepage order now follows admin choice | none (columns existed since `0000`) |
| E2E: shared `settle-animations.ts` for the axe audits; new `admin-featured.spec.ts` | Fix a WebKit axe timing flake; cover the featured flow | Tests only | — |

Also on 2026-10-06:
- Local `main` (`8dae087`, `d569fcf`, `ae1520b`) was pushed to `origin/main` with a fast-forward push. Until then, `origin/main` held only `2ba2b43`.
- The homepage visual refinement (single font, type scale, 1320px container, 8px buttons, hero redesign) was made and then **reverted by the owner** the same day. It is not in the history.

## 2026-10-05 — `ae1520b` "homepage and campaign page design done"

44 files changed. The work, as recorded at the time it was done (2026-10-04 to 2026-10-05):
- `/campaigns` rebuilt to the owner's mockup: banner, search and status menu (Active, Closed, Completed, All), cause tiles, cards with status badges and category-coloured progress, "View More".
- Homepage:
  - a "Browse by cause" campaign grid, added before "Who We Are";
  - the focus-area strip removed;
  - the Featured and Testimonials rails autoplay, with no visible controls but a keyboard pause.
- "Impact" removed from the header nav and the footer.
- The seed gained 4 campaigns (`animal-care-pune`, `child-nutrition-gaya`, `women-livelihoods-ranchi`, `greener-communities-bhopal`) and 2 programmes (`animal-welfare`, `environment`), so every campaign now has a programme.

## 2026-10-04 — `8dae087`, `d569fcf` "campaign page design" / "campaign page design complete"

36 files changed in total: the campaign detail page and listing design.

## 2026-09-26 — `2ba2b43` "first commit"

The initial commit: 859 files, the entire platform through Phase 10.12.

## 2026-09-23 — Phases 10.5–10.12 (journal timestamps)

| Migration | Phase | Change |
|---|---|---|
| `0017_phase8_volunteer_rls` | 8 | RLS on the volunteer tables; schema-wide RLS assertion |
| `0018_phase8_volunteer_email_unique` | 8 | Live volunteer email unique |
| `0019_phase10_7_blog` | 10.7 | Blog tables; `category_kind` gains `blog` |
| `0020_phase10_9_pages` | 10.9 | Pages and revisions (section composer) |
| `0021_phase10_10_documents` | 10.10 | Documents: unique `file_key`; public requires `published_at` |
| `0022_phase10_11_notifications` | 10.11 | Notification templates and revisions |

Phases 10.5 (stories), 10.6 (media, R2), 10.8 (SEO) and 10.12 (reports) added no migrations. According to their documents, none of these migrations or seeds were run on the hosted database. That database is the production Supabase project, which older documents call "staging".

## 2026-09-21 — Phases 9 and 8

| Migration | Change |
|---|---|
| `0012_phase9_team_events_impact` | Impact slug and event link; event deadline and organiser |
| `0013_phase9_impact_event_parent` | Impact parent CHECK includes event |
| `0014_phase8_single_admin_role` | All roles collapsed into `SUPER_ADMIN` (data rewrite). The file was later edited after it had been applied. |
| `0015_phase8_volunteer_management` | Volunteer tables |
| `0016_phase8_volunteer_sequence_backfill` | `VOL-` sequence backfill |

Other changes recorded in the docs:
- Staff TOTP dropped (owner decision).
- Redis throttler storage added.
- `db:harden`, `db:create-admin` and the database-target guard added.
- E2E isolation set up (`sailent_e2e`, ports 3100/4100).
- `/refund-policy` removed.
- `jobKey()` fix for queue job IDs.

## 2026-09-20 — Phases 5, 6, 7

| Migration | Phase | Change |
|---|---|---|
| `0008_phase5_product_catalogue` | 5 | Products master; campaign products become a junction |
| `0009_phase6_receipts_and_one_time_only` | 6 | Receipts and sequences; recurring and subscriptions removed |
| `0010_phase7_donor_accounts` | 7 | Refunds removed; saved campaigns; donor notification flags |
| `0011_phase7_email_login` | 7 | Donor identity becomes the unique email (was phone) |

## 2026-09-19 — Phases 0–4

- Documents dated: phase-0 decisions, phase-1 foundation, phase-2 public website.

| Migration | Phase | Change |
|---|---|---|
| `0000_reflective_morg` | 3 | Initial schema |
| `0001_add_session_reauth` | 3 | Session re-authentication stamp |
| `0002_team_slug_unique` | 3 | Team slug unique |
| `0003_editorial_content_columns` | 3 | Editorial content columns |
| `0004_lock_down_data_api` | 3 | Supabase Data API lockdown and RLS |
| `0005_phase4_taxonomy` | 4 | Categories, slug history, FAQs, media, campaign gallery |
| `0006_phase4_normalise_campaign_content` | 4 | jsonb content moved to tables (data rewrite) |
| `0007_allow_draft_campaign_without_goal` | 4 | Drafts may omit a goal |

## Undated — local database drift (discovered 2026-10-06)

- **Unknown migration.** An unrecorded migration was applied to the local `sailent_dev` and `sailent_e2e` databases at some point after `0022`. It adds CHECK `donors_tax_id_encrypted`. Its file is not in the repository, and no encryption code exists. See `DEVELOPMENT_STATUS.md` §5.1.
- **Edited migration.** `0014` was edited after it had been applied.
