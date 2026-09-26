# Sailent Foundation — Platform Documentation

**Phase 0 (Discovery & Architecture) — complete.**
**Phase 1 (Foundation) — complete.** See [`phase-1.md`](phase-1.md).
**Phase 2 (Public website) — complete.** See [`phase-2.md`](phase-2.md).
**Phase 3 (Database & backend foundation) — complete.** See [`phase-3-completion.md`](phase-3-completion.md).
**Phase 4 (Programmes & campaigns management) — complete.** See [`phase-4-completion.md`](phase-4-completion.md).
**Phase 5 (Product donation system) — complete.** See [`phase-5-completion.md`](phase-5-completion.md).
**Phase 6 (One-time donations & Razorpay) — complete.** See [`phase-6.md`](phase-6.md).
**Phase 7 (Donor accounts & donor dashboard) — complete.** See [`phase-7.md`](phase-7.md).
**Phase 9 (Team, events & impact) — complete.** See [`phase-9.md`](phase-9.md).
**Phase 8 (Volunteer management) — complete.** See [`phase-8.md`](phase-8.md).

Phase 8 was built after Phase 9. The numbering follows the brief, not the
order of work: team, events and impact had no prerequisites, and volunteers
did — the five staff roles had to be collapsed into one first, which touched
every authenticated request in the application.

A production-grade digital platform for one NGO: public website, fundraising with product-based donations, donor and volunteer management, programmes, events, impact tracking, CMS, and an admin dashboard with RBAC and audit logging.

---

## Reading order

Start here if you are new to the project:

| # | Document | What it answers |
|---|---|---|
| 1 | [`phase-0-decisions.md`](phase-0-decisions.md) | **Start here.** Decisions A1–A14, why each was made, and what it constrains. Every other document defers to this one. |
| 2 | [`product-requirements.md`](product-requirements.md) | What we are building, for whom, what is out of scope, and the 80G/FCRA compliance requirements. |
| 3 | [`information-architecture.md`](information-architecture.md) | Public routes, homepage composition, campaign and product-donation UX, the admin sidebar. |
| 4 | [`user-flows.md`](user-flows.md) | Donation, payment, donor, volunteer and event flows — plus the full edge-case matrix. Recurring giving and refunds are recorded there as withdrawn. |
| 5 | [`database-architecture.md`](database-architecture.md) | ~45 entities, relationships, indexes, constraints, and the four-tier data-privacy classification. |
| 6 | [`api-architecture.md`](api-architecture.md) | Module ownership, endpoint map by access level, authorization enforcement, webhook contract. |
| 7 | [`rbac.md`](rbac.md) | Seven roles, the permission catalogue, sensitive operations, separation of duties. |
| 8 | [`security-architecture.md`](security-architecture.md) | Threat model, authentication, payment security, uploads, secrets, audit, backups. |
| 9 | [`design-system.md`](design-system.md) | Visual direction, token architecture, components, states, responsive behaviour, accessibility. |
| 10 | [`seo-strategy.md`](seo-strategy.md) | URLs, metadata, structured data, sitemaps, performance targets. |
| 11 | [`analytics-plan.md`](analytics-plan.md) | Event taxonomy, PII rules, consent, funnels, operational KPIs. |
| 12 | [`architecture.md`](architecture.md) | System topology, the three services, background jobs, repository layout, environments. |

### Phase 1 (foundation)

| # | Document | What it answers |
|---|---|---|
| 13 | [`phase-1.md`](phase-1.md) | What Phase 1 built, what it found and fixed, and its limitations. |
| 14 | [`development-setup.md`](development-setup.md) | Running the platform locally, and troubleshooting. |
| 15 | [`repository-structure.md`](repository-structure.md) | What belongs in each app and package. |
| 16 | [`environment.md`](environment.md) | Every environment variable and the secrets policy. |

### Phase 2 (public website)

| # | Document | What it answers |
|---|---|---|
| 17 | [`phase-2.md`](phase-2.md) | What the public site contains, the defects it surfaced, and its limitations. |

### Phase 3 (database & backend foundation)

| # | Document | What it answers |
|---|---|---|
| 18 | [`phase-3-completion.md`](phase-3-completion.md) | What Phase 3 built, how it was verified, the bugs it found, and what it deliberately left out. |
| 19 | [`database-development.md`](database-development.md) | Running Postgres locally, the migration workflow, seeding, and the rules schema changes must obey. |
| 20 | [`backend-development.md`](backend-development.md) | NestJS module structure, cross-cutting behaviour, how to add a module, how to test one. |
| 21 | [`api-development.md`](api-development.md) | REST conventions, the response envelope, error codes, and the full endpoint map. |
| 22 | [`authentication.md`](authentication.md) | The two token audiences, mandatory TOTP, rotation, reuse detection, re-authentication. |
| 23 | [`rbac-implementation.md`](rbac-implementation.md) | The guard chain, deny-by-default, sensitive operations, separation of duties. |
| 24 | [`content-layer.md`](content-layer.md) | How the public website gets its data, and why development fixtures cannot reach production. |
| 25 | [`supabase.md`](supabase.md) | Running the database on Supabase: which connection string, closing the Data API, TLS verification. |

### Phase 4 (programmes & campaigns management)

| # | Document | What it answers |
|---|---|---|
| 26 | [`phase-4-completion.md`](phase-4-completion.md) | What Phase 4 built, how it was verified, the bugs it found, and what it left out. |
| 27 | [`program-management.md`](program-management.md) | Programme lifecycle, categories, slugs and redirects, ordering, visibility. |
| 28 | [`campaign-management.md`](campaign-management.md) | Campaign fields, money handling, progress, sub-resources, caching, concurrency. |
| 29 | [`campaign-products.md`](campaign-products.md) | Product-based giving as Phase 4 built it. **Superseded in part by Phase 5** — products are now a master entity and `fulfilled_quantity` is `provided_quantity`. |
| 30 | [`campaign-status-transitions.md`](campaign-status-transitions.md) | Both lifecycles, every refusal and why, and what the public can see. |

### Phase 5 (product donation system)

| # | Document | What it answers |
|---|---|---|
| 31 | [`phase-5-completion.md`](phase-5-completion.md) | The product master and the copied-price rule, the backfill migration, the subscriptions retirement plan, the Drizzle subquery bug, and what Phase 6 inherits. |

### Phase 6 (one-time donations & Razorpay)

| # | Document | What it answers |
|---|---|---|
| 32 | [`phase-6.md`](phase-6.md) | The donation and payment flow, signature verification, webhook idempotency, the capture transaction, concurrency and reservations, gapless receipt numbering, and why programmes became Admin-only. Its refund section is superseded by Phase 7. |
| 33 | [`phase-7.md`](phase-7.md) | Donor accounts and the donor dashboard — and the withdrawal of refunds and the standalone gallery. Ownership as a WHERE clause, the donor session, sign-in code delivery, admin donor management, and the defects found on the way. |
| 34 | [`phase-8.md`](phase-8.md) | Volunteer management — and the phase in which five staff roles became one. The volunteer lifecycle from application to certificate, why hours round down, why a volunteer cannot record their own attendance, the RBAC migration that moves everybody before deleting anything, and the 4642-byte session cookie that collapse produced. |
| 35 | [`phase-9.md`](phase-9.md) | Team, events and impact. Why an event has two states, how capacity survives concurrent registration, decision A14 at the publish transition, the removal of the refund policy page — and the donation confirmation email that had never been enqueued. |

---

## The decisions that shape everything else

If you read nothing else, read these:

- **A3 — The browser is never the source of truth about a payment.** A donation is `pending` until a signature-verified webhook or a server-side fetch confirms capture. There is no static thank-you page; there is a polling status page.
- **A4 — Webhooks are duplicated and arrive out of order.** `UNIQUE(razorpay_event_id)` plus a forward-only state machine is what makes that safe.
- **A5 — Prices are snapshotted onto donation line items.** A price change next quarter never rewrites a receipt issued today.
- **A7 — A receipt is not an 80G certificate.** We issue receipts; the Income Tax Department issues Form 10BE after we file Form 10BD by 31 May.
- **A14 — No public number appears unless the database can produce it.** If a value is unavailable, the section does not render.

---

## Confirmed product decisions

| | |
|---|---|
| Compliance | 12A + 80G registered. **Not FCRA** — foreign contributions are blocked, not merely unbuilt. |
| Peer-to-peer fundraising | Out of scope. NGO-run campaigns only. |
| Donor authentication | Guest donation always; account claimed later via **email OTP**. No donor passwords, ever. |
| CMS | Structured typed content + a section composer for the homepage and marketing pages only. |

---

## Open questions

Eight items are blocked on client input, listed in [`phase-0-decisions.md`](phase-0-decisions.md#open-questions-carried-into-phase-1). The two on the critical path:

- **Registration numbers** (12A, 80G, PAN, CIN) — receipts are legally required to carry them. Donations cannot launch without them.
- **SMS/OTP vendor** — Indian DLT registration and template approval have a lead time that will not compress.

---

## Status

Phase 0 is documentation. Phase 1 built the foundation: monorepo, design system,
application shells, API and worker, shared packages, tooling and CI — all
verified against real Postgres and Redis.

Phase 2 built the complete public website on that design system, verified with
223 end-to-end assertions across four viewports and two browser engines.

Phase 3 implements authentication, RBAC and the donor module — the first phase
to touch real data. See [`phase-2.md`](phase-2.md) §10.
