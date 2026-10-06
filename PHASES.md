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

**Where development stopped (as of 2026-10-06):** post-10.12 polish.
- The featured/deadline work is complete and committed (`dd64d41`, pushed).
- The documentation (`d7f42e3`) and the CI target fix (`0e94632`) are committed but not yet pushed.
- Next: push `main` with approval, and verify the first GitHub Actions run.

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
| 11 | Payment & Donation Production Readiness | ✅ implemented; committed locally, not pushed (2026-10-07) |
| 12–15 | Accounts & security · Admin, CMS & communications · Infrastructure · Final launch readiness (2026-10-07 roadmap review) | ⚪ |
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
| **Remaining** | Replace the remaining fixtures: `/faq`, testimonials, search index, donation presets. Replace the DEMO organisation data. Analytics (GA4) was never built. |
| **Validation** | Playwright journeys and shell specs |

## Phase 3 — Database & backend foundation  🟡 PARTIAL

| | |
|---|---|
| **Goal** | Core schema, API modules, authentication, audit, content API, web switched to the API |
| **Completed** | Migrations `0000`–`0004`; Auth (Argon2id, JWT, rotation, re-auth); audit; content endpoints; Supabase lockdown (RLS) |
| **Remaining** | Soft 404s; TOTP built but not in effect after Phase 8; JWT `algorithms` pin; refresh rotation atomicity |
| **Dependencies** | none |

## Phase 4 — Programmes & campaigns management  🟡 PARTIAL

| | |
|---|---|
| **Goal** | Admin CRUD and lifecycle for programmes and campaigns, taxonomy, media metadata, FAQs, gallery, preview, BFF and admin login |
| **Completed** | Migrations `0005`–`0007`; admin programmes and campaigns; preview; shared lifecycle in `packages/validation` |
| **Remaining** | Slug 301 redirects for programmes and campaigns in the web app (blog only); programme rollup counters never written; rich-text editor; `campaigns.program_id` not database-enforced |

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
| **Remaining** | **PAN encryption, which the docs claim exists but the code does not implement**; verification of email changes; guest-checkout overwriting of donor details |
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
| **Remaining** | No phase document. Invite acceptance and password set or reset are missing. The roles screen is read-only (single role). |

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
- **Note:** no delete.

## Phase 10.11 — Notifications  🟡 PARTIAL

Migration `0022`, the notifications inbox and log, versioned templates, admin alerts.
- **Remaining:** **retry is a no-op** (its queue has no consumer); the newsletter stores nothing; no delivered or bounced statuses; no SMS.

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

## Phase 11 — Payment & Donation Production Readiness  ✅ IMPLEMENTED (committed locally as `feat(payments): complete payment production readiness`, not pushed, 2026-10-07)

| | |
|---|---|
| **Goal** | Make donations and Razorpay production-ready from the application side (payment audit of 2026-10-07: H1, H2, H3, M1, M2, M4, L2–L4) |
| **Completed** | Reconciliation and 24-hour pending expiry (worker-scheduled, API-run); checkout retry on the same order and attempt reuse; `Idempotency-Key` on create; per-client rate limits via a trusted forwarded address; IST receipt financial year; live-key guard; order and currency checks before capture; read-only admin Payment exceptions; `Permissions-Policy` allowing payment for Razorpay. No migration. |
| **Remaining (human)** | Deployment configuration (`INTERNAL_API_SECRET`, `API_INTERNAL_URL`, `CLIENT_IP_HEADER`), Razorpay dashboard settings, a sandbox trial — `DEPLOYMENT.md` §6a |
| **Validation** | `DEVELOPMENT_STATUS.md` §2 |

Phases 12–15 (accounts and security hardening; admin, CMS and communications; infrastructure and operations; final launch readiness) come from the 2026-10-07 roadmap review and are not started.

## Not yet scheduled  ⚪ NOT STARTED

Documented as needed, or deferred:
- **Operations:** deployment configuration and hosting; a human-led verification and hardening of the existing production database; backups.
- **Scheduled jobs:** counter-drift checks. (Payment reconciliation: Phase 11.)
- **Monitoring:** Sentry; GA4.
- **Staff accounts:** staff 2FA enrolment; invite and password reset.
- **Receipts and tax:** receipt PDF; Form 10BD export.
- **Volunteers and events:** certificate PDF; event reminders.
- **Communication:** newsletter subscriptions.
- **Admin:** the admin dashboard home.

## ⚫ REMOVED (by decision)

- Recurring donations and subscriptions (Phase 6, migration `0009`)
- Refunds (Phase 7, migration `0010`)
- The `/refund-policy` page (Phase 9)
- The `/reports` and `/transparency` pages (Phase 7)
- The standalone gallery
- Multiple staff roles (Phase 8, migration `0014`)
- Staff TOTP requirement (Phase 8, owner decision)
- The homepage focus-area strip and the Impact navigation link (post-10.12, owner request)
