# Sailent Foundation Platform

Digital platform for Sailent Foundation: public website, fundraising with
product-based donations, donor and volunteer management, programmes, events,
impact tracking, CMS, and an admin dashboard with RBAC and audit logging.

**Current state: Phase 1 (foundation) complete.** The monorepo, design system,
application shells, API, worker and shared packages are in place and verified.
Business modules are built in later phases — see [Roadmap](#roadmap).

---

## Architecture

```
Browser ──► Next.js (apps/web, same origin)
              ├── Server Components ──► API   (public content, server-side)
              └── /api/bff/* handlers ──► API  (authenticated; holds the session
                                                cookie, attaches the token)

Razorpay ─────────────────────────────► API   /webhooks/razorpay  (Phase 5)
Worker ───────────────────────────────► API / DB

  apps/api (NestJS) ──► Neon Postgres · Upstash Redis · Cloudflare R2
  apps/worker (BullMQ) ──► Brevo
```

Three deployables share one database and one set of packages.

**The browser never calls the API directly.** Authenticated requests pass
through Next.js route handlers acting as a backend-for-frontend, so no access
token ever reaches client-side JavaScript and CORS stays closed on the API.
This is decision A1 in [`docs/phase-0-decisions.md`](docs/phase-0-decisions.md);
that document is the source of truth for why the system is shaped this way.

### Why three services

| Service | Runtime | Reason |
|---|---|---|
| `apps/web` | Vercel | Edge network and image optimisation suit a photography-led site |
| `apps/api` | Render / Railway | **Persistent process.** The donation-capture path needs multi-statement transactions with row locks, which a serverless HTTP database driver cannot do (decision A12) |
| `apps/worker` | Render / Railway | Receipt rendering is CPU-heavy and email depends on a third party; neither may degrade the donation endpoint |

---

## Repository structure

```
sailent-foundation/
├── apps/
│   ├── web/          Next.js — public site, donor account, admin dashboard
│   ├── api/          NestJS — REST API, webhooks, business logic
│   └── worker/       BullMQ consumers and scheduled jobs
├── packages/
│   ├── database/     Drizzle schema, migrations, seeds, pooled client
│   ├── validation/   Zod schemas shared by client and server
│   ├── types/        Shared types + the money/API/auth contracts
│   ├── config/       Environment validation, ESLint and tsconfig presets
│   └── ui/           Design system: tokens, primitives, NGO and admin components
├── infrastructure/   docker-compose for local Postgres and Redis
└── docs/             Phase 0 architecture and Phase 1 records
```

Full detail: [`docs/repository-structure.md`](docs/repository-structure.md).

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 20.9 | Tested on 24 and 26 |
| pnpm | ≥ 9 | `corepack enable && corepack prepare pnpm@9.15.4 --activate` |
| PostgreSQL | 14+ | Via Docker, Homebrew, or a Neon branch |
| Redis | 7+ | Via Docker or Homebrew |
| Docker | optional | Only for `pnpm infra:up` |

---

## Installation

```bash
git clone <repository-url> sailent-foundation
cd sailent-foundation

corepack enable
pnpm install

cp .env.example .env     # fill in as needed; defaults work for local development
```

### Start the infrastructure

With Docker:

```bash
pnpm infra:up            # Postgres 17 + Redis 7 in containers
```

Without Docker (Homebrew):

```bash
brew services start postgresql@17 redis
createuser -s sailent 2>/dev/null || true
psql -d postgres -c "ALTER ROLE sailent PASSWORD 'sailent'"
createdb -O sailent sailent_dev
```

### Prepare the database

```bash
pnpm db:migrate          # apply migrations
pnpm db:seed             # seed base settings (no fabricated content)
```

### Run

```bash
pnpm dev                 # all three apps
```

| Service | URL |
|---|---|
| Web | http://localhost:3000 |
| Admin | http://localhost:3000/admin |
| API | http://localhost:4000/api/v1 |
| OpenAPI docs | http://localhost:4000/api/v1/docs |
| API health | http://localhost:4000/api/v1/health |
| API readiness | http://localhost:4000/api/v1/health/ready |
| Worker health | http://localhost:4001/health |

Step-by-step troubleshooting: [`docs/development-setup.md`](docs/development-setup.md).

---

## Environment variables

Every variable is declared in [`.env.example`](.env.example) and **validated at
boot** by `@sailent/config`. A missing or malformed value fails startup with
every problem listed at once, rather than surfacing as `undefined` later.

Variables marked `[PHASE N]` are declared so the schema stays stable but are
optional until that phase. Nothing in Phase 1 reads them.

Reference: [`docs/environment.md`](docs/environment.md).

**Never commit a real `.env`.** It is gitignored, CI scans for committed
secrets, and production credentials never exist on a developer machine.

---

## Commands

### Development

| Command | Does |
|---|---|
| `pnpm dev` | Run web, API and worker with hot reload |
| `pnpm build` | Build everything (Turborepo-cached) |
| `pnpm lint` | ESLint, zero warnings tolerated |
| `pnpm typecheck` | TypeScript in strict mode across the workspace |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright across four viewports |
| `pnpm format` | Prettier write |
| `pnpm format:check` | Prettier check (CI) |
| `pnpm audit` | Fail on high/critical advisories |
| `pnpm clean` | Remove build output and `node_modules` |

Scope any task to one package: `pnpm --filter @sailent/api dev`.

### Database

| Command | Does |
|---|---|
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:push` | Push schema directly (development only) |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm db:seed` | Seed base settings (idempotent) |

### Infrastructure

| Command | Does |
|---|---|
| `pnpm infra:up` | Start Postgres and Redis containers |
| `pnpm infra:down` | Stop them |
| `pnpm infra:logs` | Follow their logs |

---

## Testing

**Vitest** for units: validation primitives, SEO helpers, design-system
components, the API health and exception-filter behaviour, worker processors.

**Playwright** for the shells at 320px, 390px, 768px and 1280px, including
automated **axe** accessibility checks on the public, admin and 404 pages.

```bash
pnpm test
pnpm --filter @sailent/web exec playwright install chromium   # once
pnpm test:e2e
```

Phase 1 deliberately does not contain extensive business tests — there is no
business logic yet. What is tested is the behaviour later phases depend on.

---

## Code quality

TypeScript strict mode is on everywhere, with `noUncheckedIndexedAccess`,
`noUnusedLocals` and `noImplicitOverride`. `any` is an ESLint error.

Conventions that matter:

- **Money is integer paise.** Never a float, never a decimal. `₹900` is `90000`.
  Formatting happens in exactly one helper.
- **Business logic stays out of UI components** and out of BFF route handlers.
- **No fabricated data.** Every public statistic must trace to a database
  aggregate or a dated impact record; components render nothing rather than
  showing a zero or an invented figure.
- Shared Zod schemas run on both client and server, so the two cannot disagree
  about what is valid.

CI runs lint, typecheck, tests, build, format check, a production dependency
audit and a secret scan on every pull request.

---

## Deployment

Nothing deploys automatically yet — Phase 0 does not authorise it and nothing is
production-ready. Targets are documented in
[`infrastructure/README.md`](infrastructure/README.md).

Production hardening is enforced by the config schema rather than by discipline:
with `APP_ENV=production`, JWT secrets become mandatory, and Swagger and mock
data are refused outright.

---

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 0 | Product, architecture, IA, domain model, design direction | ✅ Complete |
| 1 | Monorepo, design system, shells, API/worker foundations | ✅ Complete |
| 2 | Public website UI from the design system | Next |
| 3 | Auth, RBAC, users, donors | Planned |
| 4 | CMS, campaigns, programmes, media, documents | Planned |
| 5 | Donations, payments, subscriptions, receipts, tax compliance | Planned |
| 6 | Volunteers, events, impact | Planned |
| 7 | Notifications, reports, audit logs | Planned |

---

## Contributing

1. Branch from `main`. `main` is protected and requires review.
2. Read [`docs/phase-0-decisions.md`](docs/phase-0-decisions.md) before changing
   anything architectural. The decisions there have reasons recorded; if one is
   wrong, change the document too.
3. Run `pnpm lint && pnpm typecheck && pnpm test` before opening a pull request.
4. New dependencies need a stated reason in the pull request description.
5. Never commit secrets, real donor data, or fabricated NGO statistics.

---

## Documentation

| Document | Covers |
|---|---|
| [`docs/README.md`](docs/README.md) | Index and reading order |
| [`docs/phase-0-decisions.md`](docs/phase-0-decisions.md) | **Decisions A1–A14 and why** |
| [`docs/phase-1.md`](docs/phase-1.md) | What Phase 1 built, and what it found |
| [`docs/development-setup.md`](docs/development-setup.md) | Local setup and troubleshooting |
| [`docs/repository-structure.md`](docs/repository-structure.md) | What belongs where |
| [`docs/environment.md`](docs/environment.md) | Every environment variable |
| [`docs/architecture.md`](docs/architecture.md) | System architecture |
| [`docs/design-system.md`](docs/design-system.md) | Visual direction and tokens |
| [`docs/api-architecture.md`](docs/api-architecture.md) | Endpoint map and contracts |
| [`docs/database-architecture.md`](docs/database-architecture.md) | Domain model |
| [`docs/rbac.md`](docs/rbac.md) | Roles and permissions |
| [`docs/security-architecture.md`](docs/security-architecture.md) | Threat model and controls |
