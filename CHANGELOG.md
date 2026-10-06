# CHANGELOG

A chronological development history built from the git history, the migration journal (`packages/database/drizzle/meta/_journal.json`), the phase documents in `docs/` and the work recorded in this project's development sessions. Nothing here is invented.

**Dating notes:**
- The phase documents 0, 1 and 2 are dated 2026-09-19. The other phase documents carry no date; their migrations' journal timestamps are used instead. The timestamps for `0017`–`0022` were hand-assigned and may not be exact.
- The git history has only 4 commits. The first (`2ba2b43`, 2026-09-26) contains all work up to Phase 10.12, so individual dates before it cannot be confirmed from git.

Newest first.

---

## 2026-10-06 — Uncommitted (working tree, as of 2026-10-06)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Documentation revised after a cold-read verification: production terminology fixed; production database access policy added; git/approval workflow and permanent rules moved into `AGENTS.md`; local development, single-test commands, local payment behaviour, seed and `--reference` hazards, and the add-a-permission procedure documented; the snapshot rule unified; stale-prone figures dated | Owner request; a fresh-agent audit found gaps and contradictions | Documentation only | — |
| Owner decisions recorded: the Supabase project behind the production guard is **production**; AI agents never operate on the production database | Owner, 2026-10-06 | Permanent rule in `AGENTS.md` §8 | — |
| Documentation system added: root `AGENTS.md` (project content above the Turborepo block), `CLAUDE.md`, `PROJECT.md`, `ARCHITECTURE.md`, `SECURITY.md`, `DEVELOPMENT_STATUS.md`, `PHASES.md`, `DATABASE.md`, `DEPLOYMENT.md`, `CHANGELOG.md` | Read-only audit, so any agent can resume work safely | Documentation only | — |
| Ongoing-by-default campaigns: `hasEnded()` (end of day, IST); `donationAvailability`/`acceptsDonations` aware of the deadline; checkout uses it; cards, status card, donation builder and featured band hide Donate for ended campaigns; campaign header shows "Ends …/N days left" or "Closed …" and the "Campaign period" row is removed; admin date hints rewritten | Owner: "there should be no campaign period". The page offered donations that checkout refused after the end date. | Campaigns without an end date never close on their own | none (seed: `endDate: null`). Dev database `UPDATE campaigns SET end_date=NULL` (local only, approved). |
| Admin-controlled featured campaigns: "Feature on the homepage" and "Featured order" in the admin form; "Featured · N" badge in the admin list; public `sort=featured`; homepage band uses `getFeaturedCampaigns()` (open campaigns only) | Owner asked to give admins the power to choose featured campaigns. The band previously showed the oldest campaigns, ignoring `is_featured`. | Homepage order now follows admin choice | none (columns existed since `0000`) |
| E2E: shared `settle-animations.ts` for the axe audits; new `admin-featured.spec.ts` | Fix a WebKit axe timing flake; cover the featured flow | Tests only | — |
| Homepage visual refinement (single font, type scale, 1320px container, 8px buttons, hero redesign…) | Owner brief | **Reverted by the owner** the same day. Not in the tree. | — |

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
