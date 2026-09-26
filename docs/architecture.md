# System Architecture — Sailent Foundation

**Phase:** 0 · **Date:** 19 September 2026
**Status:** Design only. **Nothing is installed or scaffolded in this phase.**

---

## 1. Topology

```
                            ┌──────────────┐
                            │  Cloudflare  │  DNS · CDN · WAF · rate limiting
                            └──────┬───────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
            ┌───────▼────────┐          ┌─────────▼─────────┐
            │  apps/web      │          │  Razorpay         │
            │  Next.js       │          │  (hosted checkout)│
            │  Vercel        │          └─────────┬─────────┘
            │                │                    │ webhooks
            │  • RSC (public)│                    │ (direct — never via web)
            │  • /api/bff/*  │                    │
            └───────┬────────┘                    │
                    │ server-side only            │
                    │                             │
            ┌───────▼─────────────────────────────▼───────┐
            │  apps/api — NestJS (Render/Railway)         │
            │  REST · OpenAPI · guards · services         │
            └───┬──────────────┬──────────────┬───────────┘
                │              │              │
        ┌───────▼──────┐ ┌─────▼──────┐ ┌────▼────────┐
        │ Neon Postgres│ │  Upstash   │ │ Cloudflare  │
        │ (pooled TCP) │ │   Redis    │ │     R2      │
        └───────┬──────┘ └─────┬──────┘ └─────────────┘
                │              │
            ┌───▼──────────────▼───┐        ┌──────────┐
            │ apps/worker — BullMQ │───────►│  Brevo   │  email
            │ webhooks · receipts  │        └──────────┘
            │ email · reconciliation│
            │ scheduled jobs        │
            └───────────────────────┘

                    Sentry ── both apps + worker
```

Three deployables — web, api, worker — sharing one database and one set of packages.

---

## 2. Why three services

**`apps/web` — Next.js on Vercel.** Public site plus donor and admin UIs. Server components render public content by calling the API server-side. Route handlers under `/api/bff/*` hold the session cookie and proxy authenticated calls (A1). Vercel's edge network and image optimisation are exactly what a photography-led public site needs.

**`apps/api` — NestJS on Render/Railway.** All business logic, all writes, the Razorpay webhook endpoint. **A persistent process, not serverless** — which is what makes the pooled connection and the multi-statement capture transaction possible (A12). Nest's module/guard/interceptor structure maps cleanly onto the permission-and-audit model in `rbac.md`.

**`apps/worker` — BullMQ consumer.** Everything that must not block a request or fail a transaction: webhook processing, receipt PDF generation, email, reconciliation, scheduled jobs.

### Why the worker is separate from the API

Receipt PDF generation is CPU-heavy. Email sending depends on a third party that will occasionally be slow. Reconciliation scans thousands of rows. If any of those shared a process with the donation endpoint, a Brevo outage or a large PDF would degrade the one path that must never degrade.

The separation also makes the failure semantics right: a payment capture commits its transaction and *then* enqueues the receipt. If receipt generation fails, it retries independently — it does not roll back a donation that genuinely succeeded.

### Why not one Next.js application

A single Next.js app with route handlers would be fewer moving parts, and for a simpler product it would be the right answer. It is rejected here for three specific reasons:

1. **Transactions.** The capture path needs `SELECT … FOR UPDATE` across multiple rows in one transaction (A6). Serverless functions with an HTTP database driver cannot do this.
2. **Webhook reliability.** Razorpay's webhook endpoint should not share a cold-start budget with page rendering.
3. **Background work.** Receipt generation and reconciliation need a long-running process regardless, so a third deployable exists either way.

The cost is one extra hop for authenticated requests and a shared-types discipline. Both are handled by the monorepo.

---

## 3. Request paths

**Public page** — Browser → Cloudflare → Vercel edge (cache hit ends here) → RSC → API (server-side, cached) → Postgres. No client JavaScript required for content.

**Authenticated action** — Browser → Next.js route handler (reads httpOnly cookie, attaches bearer) → API (auth → audience → permission → re-auth → audit) → Postgres.

**Donation capture** — Browser → Razorpay (hosted). Razorpay → API `/webhooks/razorpay`: verify raw-body signature → insert with `UNIQUE(razorpay_event_id)` → **return 200** → enqueue. Worker → capture transaction (locks, counters, receipt number) → commit → enqueue PDF and email.

The browser is absent from that last path after the payment. That is the design (A3).

---

## 4. Background jobs

| Queue | Job | Trigger | Retry |
|---|---|---|---|
| `webhooks` | Process Razorpay event | On intake | 5×, exponential, then dead-letter + alert |
| `receipts` | Generate PDF → R2 | On capture | 3× |
| `email` | Send via Brevo | Various | 5×, exponential |
| `notifications` | In-app | Various | 3× |
| `exports` | CSV / 10BD generation | On request | 2× |
| `certificates` | Volunteer certificate PDF | On issue | 3× |
| `media` | Image re-encode, blurhash, EXIF strip | On upload | 3× |

### Scheduled

| Schedule | Job |
|---|---|
| Every 15 min | Sweep donations pending over 30 minutes; fetch their state from Razorpay |
| Hourly | Retry dead-lettered webhooks |
| Daily 02:00 | **Reconciliation** — compare local payments against Razorpay; alert on any mismatch |
| Daily 02:30 | **Counter verification** — recompute `amount_raised`, `donor_count`, `provided_quantity` from `donation_items`; **alert on drift, never silently correct** (A6) |
| Daily 03:00 | Logical backup → R2, separate region |
| Daily 06:00 | Transition campaigns past their end date to `completed`; publish scheduled content |
| Daily 09:00 | Event reminders (24h ahead) |
| Weekly | Halted-subscription recovery emails; volunteer inactivity review |
| Monthly | Aggregate volunteer hours; management reports |
| Annually (April) | **Form 10BD readiness report** — donations missing a tax ID, with weekly escalation until 31 May |

Idempotency is required of every job: each must be safe to run twice, because at-least-once delivery is the only guarantee a retrying queue provides.

---

## 5. Repository

```
sailent-foundation/
├── apps/
│   ├── web/          Next.js — public site, donor account, admin dashboard
│   ├── api/          NestJS — REST API, webhooks, business logic
│   └── worker/       BullMQ consumers + scheduler
├── packages/
│   ├── database/     Drizzle schema, migrations, seeds, client factory
│   ├── validation/   Zod schemas shared by web and api
│   ├── types/        Shared TS types + generated OpenAPI client types
│   ├── config/       eslint, tsconfig, tailwind, prettier presets
│   ├── ui/           Design-system components, tokens, primitives
│   └── analytics/    The typed track() wrapper (the only gtag caller)
├── infrastructure/   IaC, deployment config, runbooks, backup/restore
├── docs/             This documentation
├── turbo.json  pnpm-workspace.yaml  package.json
```

### What belongs where

**`packages/database`** — Drizzle schema as the single definition of every table, migrations, seed data, and the connection factory. **The only package that knows SQL exists.** Importing it outside `apps/api` and `apps/worker` is a lint error; the web app reaches data through the API.

**`packages/validation`** — Zod schemas used by the client for fast feedback and by the server for enforcement. **Same schema both sides**, so the two cannot disagree about what is valid. Also owns the paise ↔ string codec (A2) so no endpoint hand-rolls money serialisation.

**`packages/types`** — Hand-written domain types plus types generated from the OpenAPI spec. **A breaking API change fails the web build** rather than reaching production as a runtime error.

**`packages/ui`** — Tokens, primitives, and the domain components (`CampaignCard`, `ProductCard`, `DonationSummary`, `Stat`). **The public theme and the admin theme are two token sets over one component library** (A11) — this package is where "two experiences, one design system" is actually true rather than aspirational.

**`packages/config`** — Shared tool configuration. Existing so that lint and TypeScript rules cannot drift between apps.

**`packages/analytics`** — The typed `track()` wrapper. Sole caller of `gtag`. Enforces the PII whitelist and amount bucketing structurally (`analytics-plan.md` §1).

**`infrastructure`** — Deployment configuration, environment templates, and the runbooks: restore, key rotation, incident response, webhook replay.

### Why a monorepo

Three deployables share types, validation and design tokens. In separate repositories a donation-schema change means three pull requests, a version bump and a window where they disagree. Here, one change fails one CI run. Turborepo caches tasks so the pipeline stays fast as it grows.

---

## 6. Environments

| | Local | Staging | Production |
|---|---|---|---|
| Web | localhost:3000 | Vercel preview | Vercel |
| API | localhost:4000 | Render | Render |
| DB | Neon branch | Neon branch | Neon primary |
| Razorpay | Test keys | Test keys | **Live keys** |
| Email | Sandbox | Sandbox | Brevo live |

Neon's branching gives every environment — and every pull request — a real database copy without a separate instance. Production credentials never exist on a developer machine (`security-architecture.md` §8), and events whose mode does not match the environment are rejected.

Configuration is environment variables validated by Zod **at boot**. A missing or malformed variable fails startup loudly rather than surfacing as a null three weeks later.

---

## 7. Deliberate simplifications

The brief asks that no unnecessary complexity be introduced. Things considered and rejected, recorded so they are not revisited by default:

| Not doing | Why |
|---|---|
| Microservices | Three deployables split by *runtime need*, not by domain. Domains are Nest modules. |
| Event sourcing | The audit log plus `payment_transactions` answers every question we actually have. |
| GraphQL | REST with OpenAPI generates types and documentation adequately; GraphQL adds a caching and authorization surface for no benefit here. |
| Kubernetes | Managed platforms until they demonstrably do not fit. |
| Separate CMS service | Content is in Postgres with the rest of the data, which is what makes "campaigns this story relates to" a join rather than an integration. |
| Multi-tenancy | One NGO. Tenancy would be dead weight in every query. |
| Read replicas at launch | Added when reporting load justifies it, not before. |
| Redis as primary cache | Next.js and Cloudflare cover page caching; Redis is for queues and rate limits. |
| Feature-flag service | `settings` table plus environment variables. |
| Separate analytics warehouse | Postgres handles this volume comfortably for years. |

Each of these is a reasonable thing to add later on evidence. None is justified by the traffic and team this platform actually has.

---

## 8. Scaling path

Roughly in the order the pressure will appear:

1. **Read replica** for reporting, so an analytical query cannot slow the donation path.
2. **Partition `audit_logs` and `payment_webhooks`** by month once they reach tens of millions of rows.
3. **Materialised views** for public impact aggregates, refreshed on a schedule.
4. **Dedicated webhook service** if Razorpay volume ever justifies isolating intake completely.
5. **Regional CDN tuning** if a significant diaspora audience appears — which, note, would also raise the FCRA question.

None of these are built now. They are written down so that the current design is understood as deliberate rather than naive.

---

## 9. Observability

**Sentry** on all three services, with PII scrubbing configured before the first deploy. Releases tagged; source maps uploaded.

**Structured JSON logging** with a `requestId` propagated from web → API → worker, so a single donation is traceable end to end across three services. The same id appears in error messages shown to donors, which is what makes a support conversation tractable.

**Health endpoints** — `/health` (liveness) and `/health/ready` (database, Redis, R2 reachable).

**Alerts** — any 5xx on the donation path, webhook signature failures, reconciliation mismatches, counter drift, queue depth above threshold, dead-lettered jobs, `critical` audit entries, and certificate or domain expiry.

The alert that matters most is **counter drift**, because it is silent by nature. Everything else announces itself.

---

## 10. What Phase 1 set up

> **Status: complete.** All items below are done and verified — see
> [`phase-1.md`](phase-1.md). Two notes for anyone reading this section as a
> plan: the repository is now its own git repo (it previously sat inside one
> rooted at the user's home directory), and `packages/analytics` was deferred to
> Phase 2 rather than created empty, because an empty analytics package invites
> the direct `gtag` call it exists to prevent (decision P1-5).

Not implemented here — recorded so Phase 1 starts correctly.

1. **`git init` inside the project directory.** The folder currently sits inside a repository rooted at the user's home directory (`git rev-parse --show-toplevel` returns `/Users/shubhankarhaldar`), which is why unrelated files appear staged. This must be fixed before any code lands.
2. **Enable pnpm via corepack** — Node v26.8.2 is present; pnpm is not installed.
3. Turborepo workspace, the six packages as empty typed shells, shared tool configuration.
4. `.env.example` with every variable named and validated, no values.
5. CI: type-check, lint, secret scan, dependency audit.
6. Design tokens in `packages/ui` with the placeholder palette clearly labelled.

---

*Related: [`phase-0-decisions.md`](phase-0-decisions.md) · [`api-architecture.md`](api-architecture.md) · [`security-architecture.md`](security-architecture.md)*
