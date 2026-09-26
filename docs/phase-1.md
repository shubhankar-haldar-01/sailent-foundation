# Phase 1 — Foundation

**Date:** 19 September 2026 · **Status:** Complete and verified

Phase 1 built the foundation every later phase sits on: the monorepo, the design
system, the three application shells, the shared packages, and the development
and CI tooling. It deliberately built **no business modules**.

---

## 1. What was built

| Area | Delivered |
|---|---|
| Monorepo | pnpm workspaces + Turborepo; 3 apps, 5 packages |
| Design system | OKLCH token architecture, ~30 primitives, 17 NGO components, 12 admin components |
| Web | Next.js 15 App Router, public/account/admin shells, 24 routes, BFF proxy, SEO foundation |
| API | NestJS, health probes, response envelope, exception filter, structured logging, request IDs, Swagger |
| Worker | BullMQ consumer, queue registry, example processor, health endpoint, graceful shutdown |
| Database | Drizzle with a pooled client, migration and seed pipeline, one table (`settings`) |
| Validation | Shared Zod primitives: phone, email, slug, money, pagination, file, tax ID |
| Tooling | ESLint flat config, Prettier, strict TypeScript, Vitest, Playwright, GitHub Actions |

### Deliberately NOT built

Authentication flows · donations · Razorpay · donor accounts · volunteer
management · campaigns · CMS · file uploads · notifications · reports.

Those belong to Phases 2–7. Building them now would mean building against tables
and contracts that do not exist.

---

## 2. Verification

Every claim below was executed, not assumed.

| Gate | Result |
|---|---|
| `pnpm lint` | 13/13 tasks, zero warnings |
| `pnpm typecheck` | 13/13 tasks, strict mode |
| `pnpm test` | 50 unit tests passing |
| `pnpm build` | 8/8 tasks; 24 routes prerendered; 102 kB shared JS |
| `pnpm test:e2e` | 43 passed, 1 skipped, 0 failed across 4 viewports |
| `pnpm format:check` | Clean |

### Runtime verification

Run against **real Postgres 14 and Redis 7**, not mocks:

- `GET /api/v1/health` → `{"success":true,"data":{"status":"ok",...}}`
- `GET /api/v1/health/ready` → database up (53 ms), redis up (23 ms)
- `GET /api/v1/nope` → 404 with the error envelope and a `requestId`
- Inbound `x-request-id: trace-abc-123` echoed back — correlation works
- Swagger served at `/api/v1/docs`; OpenAPI JSON generated
- Worker health at `:4001/health` listing its registered queues
- `pnpm db:migrate` then `pnpm db:seed` → 4 settings rows in Postgres
- All web routes return their expected status. (`/reports` and `/transparency`
  were removed in Phase 7 — the platform publishes no documents publicly.)
- `/account` serves `noindex, nofollow`; `/campaigns` serves `index, follow`
- **axe: 0 violations** on the public, admin and 404 pages

---

## 3. Problems found and fixed

Phase 1 exists partly to surface exactly this class of problem before a hundred
components depend on it.

### 3.1 tailwind-merge silently dropped text colours — serious

**Symptom.** An automated contrast check measured the Donate button at
**2.42:1** against a required 4.5:1. Investigation showed the computed text
colour was the body default, not `--primary-foreground`.

**Cause.** `tailwind-merge` classifies utilities into conflict groups using
Tailwind's *default* scales. It read our custom font size `text-body-lg` as a
text **colour**, decided it conflicted with `text-primary-foreground`, and
dropped the colour — later class wins.

**Why it mattered.** No error anywhere. It would have degraded text colour on
every component combining a size utility with a colour utility, and the first
casualty was the most important button on the site.

**Fix.** `extendTailwindMerge` in `packages/ui/src/lib/cn.ts` declaring the
custom font-size, text-colour, background and border scales. Any new scale added
to `tokens.css` must be declared there too, or the bug returns.

### 3.2 The primary colour failed WCAG AA

The placeholder accent at step 600 gave white text ~4.0:1. Changed `--primary`
to step 700, which clears 4.5:1. A one-line token change with no component
edits — which is the token architecture doing its job.

### 3.3 Blank optional variables broke boot

`.env.example` declares future variables as `KEY=`. dotenv parses that as an
**empty string**, not `undefined`, so `z.string().min(32).optional()` received
`''`, failed the length check, and the API refused to boot **from its own
documented template**. Same root cause made `DATABASE_MIGRATION_URL ?? DATABASE_URL`
select `''` — an empty string is not nullish.

Fixed with an `optional()` helper that maps `''` to `undefined`, and `||` in
place of `??` where a blank means "not set".

### 3.4 Nest DI broke under two different transforms

- **Vitest**: esbuild does not implement `emitDecoratorMetadata`, so Nest could
  not resolve constructor dependencies and every DI test failed with
  `Cannot read properties of undefined`. Fixed with `unplugin-swc`.
- **ESLint**: `consistent-type-imports` "fixed" injected classes to
  `import type`, which erases the runtime class reference Nest needs. The rule
  is now off for Node/Nest packages, with the reason recorded in the preset —
  it stays on everywhere else.

### 3.5 Nest's `deleteOutDir` plus incremental builds

`nest build` deletes `dist` but not the `.tsbuildinfo` stored outside it, so tsc
believed the deleted outputs were current and skipped emitting them. The result
was a `dist` silently missing files, failing only at runtime. Fixed by putting
the build cache inside `dist` so the two are deleted together.

### 3.6 `.js` import specifiers and bundlers

`packages/ui` and `apps/web` are consumed as **source** by webpack, which cannot
map `./x.js` onto `./x.tsx`; the compiled packages need `.js` for Node ESM
output. Resolved by specifier style per consumption model, and by pointing
drizzle-kit at the compiled schema rather than the TypeScript source.

### 3.7 A server-only module leaked into the browser bundle

Exporting the dotenv loader from the config barrel pulled `node:fs` into the
client bundle through a shared constant. Moved to a `@sailent/config/dotenv`
subpath export, with a `typesVersions` shim for the API's node10 resolution.

### 3.8 The skip link never appeared on touch devices

It used `:focus-visible`, whose heuristic does not fire on touch devices or for
programmatic focus — so a keyboard user on a tablet, exactly the person it
serves, got nothing. Changed to `:focus`.

---

## 4. Architectural decisions taken in Phase 1

These extend the Phase 0 log rather than changing it.

**P1-1 — The API response envelope reconciles two specifications.**
Phase 0 specified `{ data, meta }` with a rich error object; the Phase 1 brief
specified a `success` discriminant. Both shipped: `{ success: true, data, meta }`
and `{ success: false, error: { code, message, details, requestId } }`. The
discriminant lets clients narrow without inspecting the payload, and the error
keeps Phase 0's contract. `docs/api-architecture.md` §2 records this.

**P1-2 — The donor dashboard is `/account`, not `/dashboard`.**
The Phase 1 brief asked for `/dashboard`; Phase 0's information architecture
names it `/account`, and Phase 0 is the source of truth for this phase. Building
both would mean two routes for one concept and a redirect to untangle later.
The `(account)` route group **is** the dashboard shell the brief asked for.

**P1-3 — Only one database table exists.**
`settings` was implemented because the configuration layer already depends on it
(it holds the `fcra_enabled` gate) and because it proves the
generate → migrate → seed pipeline end to end. Every other entity in the Phase 0
domain model lands in the phase that owns it.

**P1-4 — Shell pages state what is missing.**
`PhasePlaceholder` names the phase that will deliver each section. The
alternative — filling the site with plausible campaigns and statistics —
produces a demo indistinguishable from the real thing, and invented NGO figures
survive into production. Grepping for `PhasePlaceholder` gives an honest
inventory of what remains.

**P1-5 — `packages/analytics` was not created.**
Phase 0 §10 lists six package shells. The analytics package exists to be the
sole caller of `gtag` and enforce the PII whitelist — it has no meaning until
GA4 is wired in Phase 2, and an empty package invites the direct `gtag` call it
was created to prevent. Deferred to Phase 2, with the rule recorded in
`docs/analytics-plan.md`.

---

## 5. Dependencies added, and why

Only where a stated reason exists.

| Package | Where | Reason |
|---|---|---|
| `drizzle-orm`, `pg` | database | Decision A12: pooled TCP driver, not the HTTP serverless driver |
| `zod` | validation, config, api | One schema shared by client and server |
| `@nestjs/*`, `reflect-metadata`, `rxjs` | api | Framework |
| `helmet` | api | Security headers |
| `nestjs-pino`, `pino*` | api, worker | Structured JSON logs with enforced redaction |
| `ioredis` | api, worker | Redis client; BullMQ's required transport |
| `bullmq` | worker | Queues |
| `@radix-ui/*` | ui | Accessible unstyled primitives — focus traps and ARIA are not worth re-implementing |
| `class-variance-authority`, `clsx`, `tailwind-merge` | ui | Variant API and class merging |
| `lucide-react` | ui | Icons |
| `vaul` | ui | Drag-dismissible bottom sheet for the mobile donation summary |
| `@tanstack/react-query` | web | Server-state caching |
| `react-hook-form`, `@hookform/resolvers` | web | Forms with the shared Zod schemas |
| `next-themes` | web | Theme switching matching the `dark` variant |
| `unplugin-swc`, `@swc/core` | api (dev) | **Required**: esbuild cannot emit decorator metadata, so Nest DI tests fail without it |
| `@axe-core/playwright` | web (dev) | Automated accessibility checks |
| `dotenv` | config, database | Load the single root `.env` |

Nothing was installed "because the stack list mentioned it". Razorpay, Brevo,
R2 and Sentry SDKs are **not** installed — their phases will add them.

---

## 6. Design review

Measured against the Phase 0 brief.

**Public — human, trustworthy, NGO-oriented, accessible, donation-ready?**
Editorial rather than promotional: serif display face, generous 96–128px section
rhythm, warm neutrals, borders instead of shadows, one accent used only for
action. Donate is the only button in the header and present at every breakpoint.
No gradient hero, no glassmorphism, no scroll animations, no counters. Zero axe
violations. The honest limitation is that it cannot yet feel *warm* — warmth in
this design comes from photography, and there is none.

**Admin — professional, operational, data-focused, consistent, responsive?**
Same primitives at higher density: cool neutrals via one attribute, 16–24px
rhythm, compressed type scale, tabular figures, tighter radii. Sidebar is
persistent at `lg`, off-canvas below. Zero axe violations.

**Do they read as one system?** Same type families, radius language, accent and
component primitives. Only density and neutral temperature differ — which is how
two experiences come from one token set rather than two.

**Does the public site look like a SaaS dashboard, or the admin like marketing?**
No. The gap is in the intended direction: the public site is editorial and
spacious, the admin is dense and quiet.

---

## 7. Known limitations

1. **The palette is a placeholder.** Labelled as such in `tokens.css`. Swapping
   the real brand in is a change to four variables.
2. **Typography is provisional.** DM Sans and Source Serif 4 stand in. Neither
   has a Devanagari companion selected, which matters before any Hindi content.
3. **No photography**, so the public shell cannot yet demonstrate the
   photography-led direction.
4. **Auth is a boundary, not an implementation.** `AuthService.resolveActor`
   returns `null`; every route is `@Public()` or unreachable. Correct
   deny-by-default posture, but route protection is untested because there are
   no sessions to test.
5. **One database table.** The domain model is documented, not implemented.
6. **No file uploads.** R2 buckets are designed, not provisioned.
7. **CI has never run on GitHub** — the workflow is written and the same
   commands pass locally, but there is no remote yet.
8. **Docker was unavailable in this environment**, so `docker-compose.yml` is
   written but unverified; verification used Homebrew Postgres 14 and Redis
   instead. The compose file specifies Postgres 17 — worth confirming on first
   use.
9. **No deployment configuration.** Phase 0 does not authorise automatic
   deployment and nothing is production-ready.

---

## 8. Open questions still blocking

Unchanged from Phase 0, and Phase 1 did not resolve them:

1. **Brand palette, logo, typography licence** — blocks design finalisation.
2. **Registration numbers (12A, 80G, PAN)** — receipts are legally required to
   carry them. **Blocks any donation work.** The seed deliberately stores
   `null`s rather than placeholders.
3. **SMS/OTP vendor** — Indian DLT registration and template approval have a
   lead time that will not compress. Blocks donor auth in Phase 3.
4. Razorpay account type and settlement cycle.
5. Real programme, campaign and story content — likely the launch critical path.
6. Whether volunteer document upload requires ID proof.
7. Refund policy specifics.
8. Financial-year convention for receipt numbering (assumed 1 April – 31 March).

---

## 9. What Phase 2 will build

The complete public website UI, using this design system and mock data, with no
API dependency:

- Homepage: the 12-section composition from `information-architecture.md` §3.2,
  with the mobile reordering that promotes featured campaigns above the mission
- `/about`, `/programs`, `/campaigns` with filtering and sorting, `/impact`,
  `/stories`, `/volunteer`, `/events`, `/blog`, `/about`, `/contact`
- Campaign detail with the sticky donation panel and tabbed sections
- The donation builder UI — product selection, custom amount, hybrid, and the
  mobile bottom-sheet summary — **presentation only**, no payment
- Consent-gated GA4 via a new `packages/analytics`, enforcing the PII whitelist
- Sentry with PII scrubbing configured before the first deploy
- Real metadata, OG images and structured data
- Playwright coverage of the public pages at all four viewports

Phase 2 does **not** touch the API, the database, or authentication.
