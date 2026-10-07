# PHASES.md — project roadmap (reconstructed 2026-10-06)

Reconstructed from `docs/phase-*.md`, the migrations, the git history and the code.
- A phase is marked ✅ only where its key claims were **verified in code**.
- Where a phase document claims "complete" but the code shows gaps, the phase is 🟡, and the gap is listed.
- No phases were invented. Numbers without a document are noted as such.

**Status key:**

| Symbol | Meaning |
|---|---|
| ✅ | COMPLETE |
| 🟡 | PARTIAL |
| 🔵 | IN PROGRESS |
| ⚪ | NOT STARTED |
| 🔴 | BLOCKED |
| ⚫ | REMOVED |

**Where development stopped (as of 2026-10-07):** Phase 14 (Infrastructure & Production Operations).
- Phases 11 (`5170ce0`), 12 (`3941ee7`) and 13 (`84e77ad`) are committed and pushed.
- Phase 14 is committed locally as `feat(infra): complete production operations readiness`, and is not pushed. **Nothing is deployed.**
- Next: push Phase 14 with the owner's approval; the human provisioning and first deployment (`DEPLOYMENT.md` §11–§16); then Phase 15 (final launch readiness, including SEO and the legal review).

See `DEVELOPMENT_STATUS.md`.

| Phase | Name | Status |
|---|---|---|
| 0 | Discovery & architecture | ✅ |
| 1 | Foundation | ✅ |
| 2 | Public website | 🟡 |
| 3 | Database & backend foundation | 🟡 |
| 4 | Programmes & campaigns management | 🟡 |
| 5 | Product donation system | ✅ |
| 6 | One-time donations & Razorpay | 🟡 |
| 7 | Donor accounts & dashboard | 🟡 |
| 8 | Volunteer management (built after 9) | 🟡 |
| 9 | Team, events & impact | ✅ |
| 10 | Umbrella number | — |
| 10.1 | (no document) | — |
| 10.2–10.4 | Admin users, roles, audit, settings (undocumented) | 🟡 |
| 10.5 | Success stories | ✅ |
| 10.6 | Media library & R2 storage | ✅ |
| 10.7 | Blog | ✅ |
| 10.8 | Technical SEO | 🟡 |
| 10.9 | Pages / section composer | ✅ |
| 10.10 | Documents | ✅ |
| 10.11 | Notifications | 🟡 |
| 10.12 | Reports & analytics | ✅ |
| post-10.12 | Design & campaign presentation | 🔵 |
| 11 | Payment & Donation Production Readiness | ✅ implemented; pushed (`5170ce0`, 2026-10-07) |
| 12 | Accounts, Authentication & Security Hardening | ✅ implemented; pushed (`3941ee7`, 2026-10-07) |
| 13 | Admin, CMS & Communications Completeness | ✅ implemented; pushed (`84e77ad`, 2026-10-07) |
| 14 | Infrastructure & Production Operations | ✅ implemented (deployment-ready, **not deployed**); committed locally, not pushed (2026-10-07) |
| 15 | Final launch readiness (2026-10-07 roadmap review) | ⚪ |
| — | Not yet scheduled | ⚪ |

---

## Phase 0 — Discovery & architecture  ✅ COMPLETE (documentation)

| | |
|---|---|
| **Goal** | Product requirements, decisions A1–A14, domain model, information architecture, flows, RBAC, threat model |
| **Completed** | `docs/phase-0-decisions.md`, `product-requirements.md` and the architecture, security, RBAC, IA and SEO documents (dated 2026-09-19) |
| **Remaining** | Open questions: brand (resolved in code), registration numbers (**open**), Razorpay account (**open**), real content (**open**), financial-year convention |
| **Notes** | Several decisions were later changed: A4 webhook queue, A7 receipt format, A8 staff TOTP, A10 audit immutability. See `DEVELOPMENT_STATUS.md` §9. |

## Phase 1 — Foundation  ✅ COMPLETE

| | |
|---|---|
| **Goal** | Monorepo, design system, application shells, API envelope, worker, Drizzle pipeline, CI |
| **Completed** | 3 apps and 5 packages; OKLCH tokens; envelope, health and Swagger; BullMQ worker; `settings` table; `PhasePlaceholder` |
| **Validation** | 50 unit, 43 E2E (as documented) |
| **Notes** | The admin dashboard home still uses `PhasePlaceholder`. CI has never been confirmed green on GitHub. |

## Phase 2 — Public website  🟡 PARTIAL

| | |
|---|---|
| **Goal** | All public routes, components and SEO markup, initially on fixtures |
| **Completed** | The public routes; DemoNotice tied to `FEATURE_MOCK_DATA`; DEMO organisation data; MediaFrame placeholders |
| **Remaining** | ~~`/faq`, search index, donation presets, DEMO organisation data~~ (Phase 13: database-backed, presets deleted). Testimonials stay static by design (no table). Analytics (GA4) was never built. |
| **Validation** | Playwright journeys and shell specs |

## Phase 3 — Database & backend foundation  🟡 PARTIAL

| | |
|---|---|
| **Goal** | Core schema, API modules, authentication, audit, content API, web switched to the API |
| **Completed** | Migrations `0000`–`0004`; Auth (Argon2id, JWT, rotation, re-auth); audit; content endpoints; Supabase lockdown (RLS) |
| **Remaining** | Soft 404s. (JWT `algorithms` pin and atomic refresh rotation: Phase 12. Staff TOTP: not required, by owner decision.) |
| **Dependencies** | none |

## Phase 4 — Programmes & campaigns management  🟡 PARTIAL

| | |
|---|---|
| **Goal** | Admin CRUD and lifecycle for programmes and campaigns, taxonomy, media metadata, FAQs, gallery, preview, BFF and admin login |
| **Completed** | Migrations `0005`–`0007`; admin programmes and campaigns; preview; shared lifecycle in `packages/validation` |
| **Remaining** | Slug 301 redirects for programmes and campaigns in the web app (blog only); programme rollup counters never written; rich-text editor; `campaigns.program_id` not database-enforced. (Cover, gallery and updates admin UI: Phase 13.) |

## Phase 5 — Product donation system  ✅ COMPLETE

| | |
|---|---|
| **Goal** | Product master catalogue, campaign products as a junction, donation builder |
| **Completed** | Migration `0008`; products module; `/admin/products`; recurring toggle removed |
| **Notes** | `sku` and the `products.image` foreign key are unused |

## Phase 6 — One-time donations & Razorpay  🟡 PARTIAL

| | |
|---|---|
| **Goal** | Donation create, verify, webhook, capture, receipts, confirmation email |
| **Completed** | Migration `0009`; `POST /donations`; `/donations/:id/verify-payment`; `/payments/razorpay/webhook`; capture transaction; `SFL-<FY>-NNNNNN` receipts; Brevo confirmation |
| **Remaining** | ~~Reconciliation job and pending expiry; idempotency key; currency check; 401 for a bad webhook signature~~ (401: `e87864b`; the rest: Phase 11, 2026-10-07). Still: receipt PDF; **live Razorpay test** |
| **Validation** | API `donations.spec.ts` (mocked Razorpay); E2E donations spec (no real checkout) |

## Phase 7 — Donor accounts & dashboard  🟡 PARTIAL

| | |
|---|---|
| **Goal** | Donor email OTP, `/dashboard`, saved campaigns, preferences; refunds and recurring giving withdrawn |
| **Completed** | Migrations `0010`–`0011`; `/me` (15 routes); `/admin/donors`; `/dashboard` (11 pages) |
| **Remaining** | ~~PAN encryption; verification of email changes; guest-checkout overwriting of donor details~~ (all Phase 12) |
| **Notes** | `/reports` and `/transparency` were removed here |

## Phase 8 — Volunteer management (built after Phase 9)  🟡 PARTIAL

| | |
|---|---|
| **Goal** | Volunteer application, review, assignments, attendance, certificates; security tooling |
| **Completed** | Migrations `0014`–`0018`; `/admin/volunteers*`, `/me/volunteering`, `/volunteers/apply`, certificate verification; Redis throttler; `db:harden`, `db:create-admin`, database-target guard; E2E isolation |
| **Remaining** | `db:harden` was never run on the hosted Supabase project, which `phase-8.md` calls "staging" but which is **production** (owner, 2026-10-06). The test residue recorded there is therefore on production and must be verified and cleaned by a **human** (see `DEVELOPMENT_STATUS.md` §5.2). Out of scope: certificate PDF, document upload, self-service attendance. |
| **Notes** | Migration `0014` collapsed all roles to `SUPER_ADMIN` and dropped staff TOTP (owner decision). The `0014` file was later edited after it had been applied. |

## Phase 9 — Team, events & impact  ✅ COMPLETE

| | |
|---|---|
| **Goal** | Team pages, event registration and attendance, impact updates |
| **Completed** | Migrations `0012`–`0013`; admin events, team and impact; donor-only registration; `/refund-policy` removed; `jobKey()` queue fix |
| **Notes** | No waitlist and no reminders, by decision. The web build needs the API running. |

## Phase 10 — umbrella number

Referenced as "Phase 10" in phase 8 and phase 9 for deferred items (for example the certificate PDF). There is no `phase-10.md`; work was split into the sub-phases below.

## Phase 10.1 — (no document)

Referenced once, in phase-10.5 §8: it removed Article markup from the blog. **No other trace.** Status unknown.

## Phases 10.2–10.4 — Admin users, roles, audit, settings (undocumented)  🟡 PARTIAL

| | |
|---|---|
| **Evidence** | `apps/web/e2e/admin-staff.spec.ts` header ("The Phase 10.2–10.4 admin screens"); pages `/admin/users`, `/admin/roles`, `/admin/audit-logs`, `/admin/settings`; API `settings` module |
| **Remaining** | No phase document. The roles screen is read-only (single role). (Invite acceptance and password reset: Phase 13. Settings now consumed by the site: Phase 13.) |

## Phase 10.5 — Success stories  ✅ COMPLETE

`/admin/stories`, a consent gate, anonymised public output. No migration.
- **Gap:** `story.archive` is not enforced.
- **Note:** the production seed was not run.

## Phase 10.6 — Media library & R2 storage  ✅ COMPLETE

`StorageService` (two buckets), magic-byte inspection, `/admin/media`. A live R2 round-trip test exists.
- **Gaps:** no re-encoding or EXIF stripping; the web `remotePatterns` is empty.

## Phase 10.7 — Blog  ✅ COMPLETE

Migration `0019`, admin and public blog, a safe markdown renderer, BlogPosting JSON-LD.
- **Not run on production.**

## Phase 10.8 — Technical SEO  🟡 PARTIAL

Segmented sitemaps, robots rules, Article JSON-LD.
- **Remaining:** the soft-404 fix (the root `loading.tsx` cause; an earlier fix was reverted); JSON-LD escaping (XSS); `robots` entries for routes that no longer exist.

## Phase 10.9 — Pages / section composer  ✅ COMPLETE

Migration `0020`, `/admin/pages`, revisions, HMAC preview, `getComposedPage('home')`.
- **Not built (by decision):** an In Review state; composing routes other than `/`.

## Phase 10.10 — Documents  ✅ COMPLETE

Migration `0021`, `/admin/documents`, visibility levels, 5-minute signed downloads, public campaign documents.
- **Note:** deletion added in Phase 13 (`document.delete`, re-authentication, reason).

## Phase 10.11 — Notifications  🟡 PARTIAL

Migration `0022`, the notifications inbox and log, versioned templates, admin alerts.
- **Remaining:** no delivered or bounced statuses; no SMS. (Retry and the newsletter: fixed in Phase 13.)

## Phase 10.12 — Reports & analytics  ✅ COMPLETE

Reports (donations, campaigns, volunteers, impact, reconciliation, tax readiness) and a CSV export (re-auth, 50,000 rows). No migration.
- **Not built:** charts, Form 10BD export.

## Post-10.12 — Design & campaign presentation (no phase number)  🔵 IN PROGRESS

| | |
|---|---|
| **Committed** | 2026-10-04 `8dae087`, `d569fcf`: campaign page design. 2026-10-05 `ae1520b`: homepage and campaign page design (campaigns listing redesign, status menu, cards, homepage campaign grid, autoplay rails, focus strip removed, Impact removed from navigation, 4 new campaigns and 2 new programmes in the seed) |
| **Reverted** | 2026-10-06: the homepage visual refinement (⚫) |
| **Complete (committed)** | ✅ 2026-10-06 `dd64d41` (pushed): admin-controlled featured campaigns; ongoing-by-default campaigns with an optional deadline (`hasEnded`); E2E settle helper |
| **Committed, not yet pushed** | 2026-10-06 `d7f42e3`: documentation/context system. 2026-10-06 `0e94632`: CI migrate/seed `--target=local` fix (not verified on GitHub yet) |
| **Next** | With owner approval, push `main` and verify the first GitHub Actions run (`DEVELOPMENT_STATUS.md` "START HERE"). Work happens directly on `main`. |

## Phase 11 — Payment & Donation Production Readiness  ✅ IMPLEMENTED (`5170ce0`, pushed, 2026-10-07)

| | |
|---|---|
| **Goal** | Make donations and Razorpay production-ready from the application side (payment audit of 2026-10-07: H1, H2, H3, M1, M2, M4, L2–L4) |
| **Completed** | Reconciliation and 24-hour pending expiry (worker-scheduled, API-run); checkout retry on the same order and attempt reuse; `Idempotency-Key` on create; per-client rate limits via a trusted forwarded address; IST receipt financial year; live-key guard; order and currency checks before capture; read-only admin Payment exceptions; `Permissions-Policy` allowing payment for Razorpay. No migration. |
| **Remaining (human)** | Deployment configuration (`INTERNAL_API_SECRET`, `API_INTERNAL_URL`, `CLIENT_IP_HEADER`), Razorpay dashboard settings, a sandbox trial — `DEPLOYMENT.md` §6a |
| **Validation** | `DEVELOPMENT_STATUS.md` §2 |

## Phase 12 — Accounts, Authentication & Security Hardening  ✅ IMPLEMENTED (`3941ee7`, pushed, 2026-10-07)

| | |
|---|---|
| **Goal** | Close the account and authentication gaps from the 2026-10-07 roadmap review, without staff 2FA (owner decision) |
| **Completed** | Volunteers without a donation can sign in by email code; one email normalisation (`normaliseEmail`); email change verified by a code to the new address; guest checkout no longer overwrites a donor; JWT pinned to HS256; atomic refresh rotation with race detection; authentication audit events with no secrets; client addresses only from the trusted forwarding header (18 `X-Forwarded-For` readers removed); PAN encrypted with AES-256-GCM and masked for donors; Content-Security-Policy and production HSTS on the web; Origin check on BFF writes; production fail-closed web environment (mock data, demo organisation, required secrets). No migration, no seed change. |
| **Owner decision** | Staff authenticate with email and password. **Staff TOTP/2FA is not required** and was not built. |
| **Remaining (human)** | Generate and store `FIELD_ENCRYPTION_KEY`; re-encrypt any plaintext PANs in production; set the web's production environment (`APP_ENV=production`, `INTERNAL_API_SECRET`, `CLIENT_IP_HEADER`, `TRUSTED_ORIGINS` if needed) — `DEPLOYMENT.md` §6b |
| **Not in scope** | Staff invite and password reset (Phase 13); SEO (Phase 15) |
| **Validation** | `DEVELOPMENT_STATUS.md` §2 |

## Phase 13 — Admin, CMS & Communications Completeness  ✅ IMPLEMENTED (`84e77ad`, pushed, 2026-10-07)

| | |
|---|---|
| **Goal** | Finish the admin, CMS and communication workflows the roadmap review found incomplete |
| **Owner decisions** | Contact messages stored + inbox + emailed; newsletter double opt-in; organisation settings drive the public site; new permissions inserted by migration with their SUPER_ADMIN grant. Only SUPER_ADMIN; no staff 2FA; no standalone gallery; no refunds or recurring giving |
| **Completed** | Migration `0023` (contact messages, newsletter subscribers, two settings rows, six permissions). Campaign/programme cover from the media library; Campaign Gallery admin (add by media id, remove, reorder); progress updates admin (publish, archive). Admin dashboard with live, permission-filtered counts. Settings consumed by the footer, contact, about, JSON-LD and receipts. Staff invitations and password reset (single-use hashed tokens, sessions revoked on reset). Document deletion. `story.archive` enforced. EXIF/GPS stripped from new uploads. Notification retry fixed; four new email processors. Contact inbox; newsletter double opt-in. General FAQs in the database; `/faq` and search from the API (published only). Dead monthly-giving widget removed, with a regression test |
| **Remaining (human)** | Apply migration `0023` in production; enter organisation details in Admin → Settings; set `MEDIA_PUBLIC_BASE_URL` at web build; optionally strip metadata from images uploaded before Phase 13 — `DEPLOYMENT.md` §6c |
| **Not in scope** | Hosting and deployment (Phase 14); SEO (Phase 15); testimonials CMS (kept static); sending newsletters |
| **Validation** | `DEVELOPMENT_STATUS.md` §2 |

## Phase 14 — Infrastructure & Production Operations  ✅ IMPLEMENTED (committed locally as `feat(infra): complete production operations readiness`, not pushed, 2026-10-07) — **NOT DEPLOYED**

| | |
|---|---|
| **Goal** | Make the platform deployable to Google Cloud Run and operable in production, without touching production |
| **Owner decisions** | Cloud Run; Supabase production; web, API and worker as separate services; production database, secrets, migrations, seeds, deployment, DNS/TLS and Razorpay configuration are human-only; SEO and the legal audit are Phase 15; Campaign Gallery intact; only SUPER_ADMIN; staff TOTP off; no recurring donations |
| **Completed** | Dockerfiles for the API, worker and web (multi-stage, production dependencies, non-root, no `.env`, no migrations at start) and `.dockerignore`; Next standalone output and a start wrapper that validates the environment first; the web build no longer calls the API; Cloud Run service templates and a build-only Cloud Build file; `PORT` support and `DATABASE_POOL_MAX`; the API's database pool closed on shutdown; health endpoints that never disclose error text (API readiness 503 when the database is down; worker `/ready`); structured logs with `severity`; a scrubbed, dependency-free Sentry-compatible error reporter for all three services; the internal secret and idempotency key no longer logged; media base URL validated (exact host, https); production dependency advisories 30 → 4 by overrides; `pnpm check:deploy` and `pnpm check:web-build-isolation`; runbooks for release, secrets, sizing, monitoring, jobs, backups/restore and rollback (`DEPLOYMENT.md` §8, §11–§21) |
| **Deferred / decided** | GA4 not wired (no consent mechanism; Phase 15 legal); browser error tracking not added; no new scheduled jobs (audit found none needed); remaining advisories need major upgrades (drizzle-orm 0.45, Nest 11, vitest 3+) |
| **Remaining (human)** | Everything in `DEPLOYMENT.md` §11–§17 and §19: Google Cloud project, Artifact Registry, Secret Manager entries and service accounts, VPC and Memorystore, the first image build (Docker was not available, so the images have **not** been built yet), deploy, DNS/TLS, Razorpay webhook URL, alerts, backups and a restore drill |
| **Not in scope** | SEO, legal audit, Razorpay trial, R2 migration, DNS/TLS changes (Phase 15 or human) |
| **Validation** | `DEVELOPMENT_STATUS.md` §2 |

Phase 15 (final launch readiness, including SEO and the legal review) comes from the 2026-10-07 roadmap review and is not started.

## Not yet scheduled  ⚪ NOT STARTED

Documented as needed, or deferred:
- **Operations (human):** provisioning and the first deployment on Cloud Run (prepared in Phase 14); a human-led verification and hardening of the existing production database; turning on backups and rehearsing a restore.
- **Scheduled jobs:** counter-drift checks (reviewed in Phase 14: not needed yet). (Payment reconciliation: Phase 11.)
- **Monitoring:** GA4 and browser error tracking (both need a consent decision). (Server-side error tracking: Phase 14.)
- **Staff accounts:** a session-management UI. (Invite and reset: Phase 13. Staff 2FA is not required, by owner decision.)
- **Receipts and tax:** receipt PDF; Form 10BD export.
- **Volunteers and events:** certificate PDF; event reminders.
- **Communication:** sending newsletters (Phase 13 records consent only); a testimonials CMS, if ever wanted.

## ⚫ REMOVED (by decision)

- Recurring donations and subscriptions (Phase 6, migration `0009`)
- Refunds (Phase 7, migration `0010`)
- The `/refund-policy` page (Phase 9)
- The `/reports` and `/transparency` pages (Phase 7)
- The standalone gallery
- Multiple staff roles (Phase 8, migration `0014`)
- Staff TOTP requirement (Phase 8, owner decision)
- The homepage focus-area strip and the Impact navigation link (post-10.12, owner request)
