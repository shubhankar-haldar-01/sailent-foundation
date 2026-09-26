# Development Setup

Getting the Sailent Foundation platform running locally.

---

## 1. Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | ≥ 20.9 | `node -v` |
| pnpm | ≥ 9 | `pnpm -v` |
| PostgreSQL | 14+ | `psql --version` |
| Redis | 7+ | `redis-cli --version` |
| Docker | optional | `docker info` |

pnpm is managed by corepack, which ships with Node:

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

---

## 2. Install

```bash
git clone <repository-url> sailent-foundation
cd sailent-foundation
pnpm install
cp .env.example .env
```

The defaults in `.env.example` work for local development. Variables marked
`[PHASE N]` may stay blank — the config schema treats a blank value as "not set".

---

## 3. Infrastructure

### Option A — Docker (recommended)

```bash
pnpm infra:up      # Postgres 17 + Redis 7
pnpm infra:logs    # follow
pnpm infra:down    # stop
```

Full reset, including data:

```bash
docker compose -f infrastructure/docker-compose.yml down -v
```

### Option B — Homebrew (macOS, no Docker)

```bash
brew install postgresql@17 redis
brew services start postgresql@17
brew services start redis

createuser -s sailent 2>/dev/null || true
psql -d postgres -c "ALTER ROLE sailent PASSWORD 'sailent'"
createdb -O sailent sailent_dev
```

Verify both:

```bash
pg_isready -h localhost -p 5432    # → accepting connections
redis-cli ping                      # → PONG
```

### Option C — Neon branch

Create a branch in the Neon console and put its **pooled** connection string in
`DATABASE_URL`. Use the pooled/TCP string, **not** the HTTP serverless
endpoint — see decision A12. Redis still runs locally.

---

## 4. Database

```bash
pnpm db:migrate    # apply migrations
pnpm db:seed       # base settings; idempotent, safe to re-run
```

Verify:

```bash
psql -d sailent_dev -c "SELECT key, category FROM settings ORDER BY key;"
```

Expect four rows: `donation_minimum_paise`, `fcra_enabled`,
`organisation_name`, `registration_details`.

The seed creates **no** campaigns, donors or statistics. Seeded demo figures
have a way of surviving into production, and decision A14 forbids fabricated
NGO data.

### Changing the schema

```bash
# 1. edit packages/database/src/schema/*.ts
# 2. add the table to packages/database/src/schema/index.ts
pnpm db:generate   # writes a migration into packages/database/drizzle/
# 3. READ the generated SQL before applying it
pnpm db:migrate
```

`db:generate` runs a build first: drizzle-kit reads the **compiled** schema, not
the TypeScript source. See §7.

---

## 5. Run

```bash
pnpm dev
```

| Service | URL |
|---|---|
| Web | http://localhost:3000 |
| Admin | http://localhost:3000/admin |
| Donor account | http://localhost:3000/account |
| API | http://localhost:4000/api/v1 |
| OpenAPI | http://localhost:4000/api/v1/docs |
| API liveness | http://localhost:4000/api/v1/health |
| API readiness | http://localhost:4000/api/v1/health/ready |
| Worker health | http://localhost:4001/health |

One app at a time:

```bash
pnpm --filter @sailent/web dev
pnpm --filter @sailent/api dev
pnpm --filter @sailent/worker dev
```

Confirm everything is talking to its dependencies:

```bash
curl -s http://localhost:4000/api/v1/health/ready | jq
# → database and redis both "up"
```

---

## 6. Quality gates

Run all four before opening a pull request — CI runs the same commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

End-to-end tests need a browser once, and a built app:

```bash
pnpm --filter @sailent/web exec playwright install chromium
pnpm build
pnpm test:e2e
```

Playwright starts its own server on port 3000. Stop any running `pnpm dev`
first, or it reuses the existing one.

---

## 7. Troubleshooting

### Startup fails listing environment variables

Working as designed — the environment is validated at boot so a bad value fails
loudly rather than surfacing as `undefined` later. The message names every
problem at once. Compare `.env` against `.env.example`.

### `DATABASE_URL is required` when the variable is clearly set

A variable declared as `KEY=` parses as an **empty string**, not `undefined`.
Code reading it must use `||`, not `??` — an empty string is not nullish. The
config schema already handles this via its `optional()` helper.

### `pnpm db:generate` fails to find the schema

drizzle-kit reads `packages/database/dist/schema/index.js`, not the source: it
loads TypeScript through a CommonJS require that cannot map `./x.js` onto
`./x.ts`, while the package must keep `.js` specifiers for its Node ESM output.
`db:generate` builds first, so just re-run it.

### Nest DI tests fail with `Cannot read properties of undefined`

The SWC transform is missing. `apps/api/vitest.config.ts` must include
`unplugin-swc` — esbuild does not implement `emitDecoratorMetadata`, so Nest
cannot resolve constructor dependencies without it.

### `dist` is missing files after a build

Delete `apps/api/dist` and rebuild. `nest build` removes `dist` but a
`.tsbuildinfo` stored outside it survives, so tsc skips re-emitting. The cache
now lives inside `dist`; if you move it, this returns.

### A shared component renders unstyled

Tailwind scans source files as text and only looks inside the project it runs
from. `apps/web/src/styles/globals.css` must keep its
`@source "../../../../packages/ui/src";` directive, or every class used only by
the design system produces no CSS — silently, with no error.

### Text colour is wrong on a component

`tailwind-merge` must be taught this project's custom scales. A custom font size
such as `text-body-lg` is otherwise classified as a text colour and drops the
real colour utility. Add any new scale to `extendTailwindMerge` in
`packages/ui/src/lib/cn.ts`.

### Port already in use

```bash
lsof -ti:3000 | xargs kill    # web
lsof -ti:4000 | xargs kill    # api
lsof -ti:4001 | xargs kill    # worker
```

### Stale Turborepo cache

```bash
pnpm clean && pnpm install
# or for one task
pnpm build --force
```

---

## 8. Editor setup

VS Code, recommended extensions:

- ESLint, Prettier
- Tailwind CSS IntelliSense — set `"tailwindCSS.experimental.configFile":
  "apps/web/src/styles/globals.css"` so v4's CSS-first config is picked up
- Use the workspace TypeScript version, not the bundled one, or path aliases and
  strict-mode errors will differ from CI

---

## 9. Conventions worth knowing before your first change

- **Money is integer paise.** `₹900` is `90000`. Never a float. Formatting
  happens only in `packages/ui/src/lib/format.ts`.
- **The browser never calls the API directly.** Authenticated calls go through
  `/api/bff/*`. Importing `lib/api/server.ts` from a client component is a build
  error by design.
- **Business logic stays out of** UI components and BFF route handlers.
- **No fabricated data.** `ImpactStat` renders nothing rather than showing a
  zero or an invented figure.
- **Validation schemas are shared.** Add to `packages/validation` so client and
  server cannot disagree.
- **Read `docs/phase-0-decisions.md`** before changing anything architectural.

## End-to-end tests

The Playwright suite runs its **own** API and web processes, on ports 4100 and
3100, against its **own** database. It never touches `DATABASE_URL`.

Once, to create it:

```bash
createdb -O sailent sailent_e2e          # needs a role that may create databases
pnpm --filter @sailent/database db:prepare-e2e
```

Then `pnpm --filter @sailent/web test:e2e` as usual. See
[`phase-8.md`](phase-8.md) §14 for why the separation exists.
