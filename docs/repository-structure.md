# Repository Structure

What belongs where, and why the boundaries are drawn as they are.

---

## Layout

```
sailent-foundation/
├── apps/
│   ├── web/                    Next.js — public site, donor account, admin
│   ├── api/                    NestJS — REST API, webhooks, business logic
│   └── worker/                 BullMQ consumers and scheduled jobs
├── packages/
│   ├── database/               Drizzle schema, migrations, seeds, client
│   ├── validation/             Zod schemas shared by client and server
│   ├── types/                  Shared contracts (money, API, auth)
│   ├── config/                 Env validation, ESLint and tsconfig presets
│   └── ui/                     Design system
├── infrastructure/             Local Postgres + Redis, deployment notes
├── docs/                       Phase 0 architecture, Phase 1 records
├── .github/workflows/ci.yml    Lint, typecheck, test, build, audit, secrets
├── .env.example                Every variable, no values
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json          Strict-mode settings inherited everywhere
```

---

## Why a monorepo

Three deployables share types, validation and design tokens. In separate
repositories a change to the donation schema means three pull requests, a
version bump, and a window where the three disagree. Here it is one change and
one CI run, and a breaking API change fails the web build rather than reaching
production.

Turborepo caches tasks by input hash, so the pipeline stays fast as this grows.

---

## Applications

### `apps/web` — Next.js

```
src/
├── app/
│   ├── (public)/               Public route group: header + footer shell
│   ├── (account)/              Donor dashboard (Phase 0 IA calls it /account)
│   ├── admin/                  Admin shell, data-surface="admin"
│   ├── api/bff/[...path]/      BFF proxy — the ONLY way the browser reaches the API
│   ├── api/health/             Liveness for the web app itself
│   ├── layout.tsx              Root: fonts, providers, metadata
│   ├── error.tsx               Route error boundary
│   ├── global-error.tsx        Root boundary — no providers, inline styles only
│   ├── not-found.tsx           404
│   ├── robots.ts, sitemap.ts   Generated SEO surfaces
├── components/
│   ├── layout/                 Header, footer, page shell
│   ├── admin/                  Admin shell, sidebar, header
│   └── phase-placeholder.tsx   Honest "not built yet" marker
├── lib/
│   ├── api/                    client.ts (shared) · server.ts · browser.ts
│   ├── query/                  TanStack Query client and key factory
│   ├── seo/                    Metadata and structured-data helpers
│   ├── mock/                   DEV-ONLY fixtures, three guards
│   └── site-config.ts          Navigation — one source for header, footer, sitemap
├── providers/                  Theme, Query, Tooltip, Toast
└── styles/globals.css          Tailwind entry + the @source directive
```

**Route groups** exist because the three areas need different chrome: public
gets header and footer, account gets a sidebar inside that chrome, admin gets
neither and a different visual density.

**`lib/api` is split three ways** deliberately:

| File | Runs | Notes |
|---|---|---|
| `client.ts` | Both | Transport, error mapping, timeouts |
| `server.ts` | Server only | Marked `server-only`, so importing it from a client component is a **build error**. This is the enforcement behind decision A1. |
| `browser.ts` | Browser only | Points at `/api/bff`, never at the API |

### `apps/api` — NestJS

```
src/
├── common/
│   ├── decorators/      @Public, @RequirePermission, @RequireAudience, @Sensitive, @RawResponse
│   ├── filters/         Global exception filter → the error envelope
│   ├── interceptors/    Response envelope
│   ├── middleware/      Request ID correlation
│   ├── pipes/           Zod validation
│   └── exceptions.ts    Typed domain exceptions with stable codes
├── config/              Env validation; nothing else reads process.env
├── modules/
│   ├── database/        Pooled Drizzle client (decision A12)
│   ├── redis/           ioredis client
│   ├── health/          Liveness and readiness
│   └── auth/            BOUNDARY ONLY — contracts, no implementation
└── main.ts              Bootstrap: helmet, CORS, prefix, Swagger, rawBody
```

**One module per bounded context.** A module owns its tables and exposes a
service; no module reads another module's tables directly, so a schema change
has one blast radius.

`main.ts` sets `rawBody: true` at bootstrap because the Razorpay webhook must
verify its HMAC against the exact bytes received. Re-serialising parsed JSON
changes the byte sequence and the signature fails — this cannot be retrofitted.

### `apps/worker` — BullMQ

```
src/
├── queues/index.ts         Registry + default job options
├── processors/             One file per job type
├── lib/logger.ts           Structured logging with redaction
└── main.ts                 Bootstrap, health endpoint, graceful shutdown
```

Separate from the API because receipt rendering is CPU-heavy, email depends on a
third party that will occasionally be slow, and reconciliation scans thousands
of rows. None of those may degrade the donation endpoint.

**Every processor must be idempotent.** At-least-once is the only guarantee a
retrying queue provides.

---

## Packages

### `packages/database`

The **only** package that knows SQL exists. Importing it outside `apps/api` and
`apps/worker` is wrong by design — the web app reaches data through the API.

Uses the **pooled** node-postgres driver, not Neon's HTTP serverless driver:
the donation-capture path needs multi-statement transactions with row locks, and
the HTTP driver cannot run them (decision A12).

Currently one table, `settings`. `schema/index.ts` records which phase owns each
planned table.

### `packages/validation`

Zod schemas used by the client for fast feedback **and** by the server for
enforcement. Same schema both sides, so the two cannot disagree about what is
valid. Also owns the paise ↔ string codec, so no endpoint hand-rolls money
serialisation.

### `packages/types`

Shared contracts only — money (branded `Paise`), the API envelope, auth claims,
pagination, common shapes. Not a dumping ground: a type used in one place lives
in that place.

### `packages/config`

Environment validation per surface (api / worker / web / database), shared
ESLint flat configs and tsconfig presets.

Exports:
- `.` — schemas and constants, safe anywhere
- `./dotenv` — **server-only**; kept off the main barrel because it imports
  `node:fs`, which would otherwise reach the browser bundle
- `./eslint/*`, `./typescript/*` — tool presets

### `packages/ui`

```
src/
├── styles/tokens.css       Token architecture — the file to edit for rebranding
├── lib/                    cn() with custom-scale awareness, formatters
├── primitives/             ~30 Radix-based components
├── patterns/               Empty, error and loading states
├── ngo/                    Campaign card, product card, donation summary, stats
└── admin/                  Page header, stats card, data table, filter bar
```

Consumed as **source** via `transpilePackages`, so a token change is visible
without a build step. Its relative imports therefore carry **no** `.js`
extension — webpack cannot map `./x.js` onto `./x.tsx`. The compiled packages
keep `.js`, which is correct for their Node ESM output.

---

## Boundaries that matter

| Rule | Why |
|---|---|
| Browser → BFF → API. Never browser → API. | No token in JavaScript; CORS closed (A1) |
| Only `api` and `worker` import `@sailent/database` | One code path can mutate a donation |
| No business logic in BFF route handlers | It belongs in a Nest service, where it is testable and auditable |
| No business logic in UI components | Components take props and render |
| No raw colour values in components | Rebranding is a token change, not a refactor (A11) |
| No `gtag` outside `packages/analytics` (Phase 2) | The PII whitelist is enforced structurally |
| Money formatting only in `packages/ui/src/lib/format.ts` | One place to get Indian digit grouping right |

---

## Conventions

**Naming.** Packages `@sailent/*`. Files kebab-case. Components PascalCase.
Database tables `snake_case` plural.

**Imports.** External, then workspace, then relative. Enforced by Prettier and
ESLint.

**`.js` specifiers.** Present in compiled packages (`config`, `types`,
`validation`, `database`) because Node ESM requires them. Absent in
source-consumed ones (`ui`, `web`) because bundlers cannot resolve them. This is
a consequence of how each is consumed, not an inconsistency.

**Adding a package.**

1. `packages/<name>/` with `package.json`, `tsconfig.json`, `eslint.config.mjs`
2. Extend the shared presets from `@sailent/config`
3. Standard scripts: `build`, `typecheck`, `lint`, `test`, `clean`
4. Add it as `workspace:*` where it is consumed
5. Record in this document what belongs in it — a package without a stated
   boundary becomes a second `utils`
