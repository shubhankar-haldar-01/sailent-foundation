# Database development

How to work with the Sailent Foundation database: running it locally, changing the schema, seeding it, and the rules that changes must obey.

Canonical entity reference: [`database-architecture.md`](database-architecture.md). This document is about the *workflow*, not the model.

---

## 1. What is where

| Path | Contents |
|---|---|
| `packages/database/src/schema/` | Drizzle table definitions, one file per domain. The source of truth. |
| `packages/database/drizzle/` | Generated SQL migrations. Committed, never edited by hand. |
| `packages/database/src/seed/` | Reference data and development content. |
| `packages/database/drizzle.config.ts` | drizzle-kit configuration. |

---

> **Using Supabase?** The workflow below is unchanged, but three platform details need deliberate handling — which connection string, closing the Data API, and TLS verification. See [`supabase.md`](supabase.md) before you point anything at a project.

## 2. Running Postgres locally

```bash
brew services start postgresql@17        # or Docker, or any 16+
createdb sailent_dev
```

Then in the repository-root `.env`:

```
DATABASE_URL=postgresql://sailent:sailent@localhost:5432/sailent_dev
```

`DATABASE_MIGRATION_URL` is optional and used only when migrations run as a role with DDL rights while the application role has none — the production arrangement described in [`security-architecture.md`](security-architecture.md) §12. Locally, one URL is fine.

---

## 3. The change workflow

Changing the schema is always three steps, in this order:

```bash
# 1. Edit the table definition in packages/database/src/schema/
# 2. Build, then generate the migration
pnpm --filter @sailent/database build
pnpm db:generate --name describe_the_change

# 3. Read the generated SQL, then apply it
cat packages/database/drizzle/NNNN_describe_the_change.sql
pnpm db:migrate
```

### Why generation reads `dist`, not `src`

`drizzle.config.ts` points at `./dist/schema/index.js`. This package compiles to Node ESM, where `.js` specifiers in relative imports are required and correct; drizzle-kit reads TypeScript through a CJS require that cannot map `.js` onto `.ts`. Generating from the build keeps one correct specifier style in the source.

**The consequence is the thing to remember: a schema edit that has not been built is invisible to `db:generate`, which will cheerfully report "No schema changes".** If a change you just made does not appear, you forgot the build.

### Reading the SQL is not optional

Drizzle generates the migration; it does not decide whether the migration is safe. Before applying, check for:

- **A column drop or rename.** Drizzle cannot tell a rename from a drop-plus-add, and will generate the destructive pair. Rewrite it as `ALTER TABLE … RENAME COLUMN` by hand.
- **A `NOT NULL` added to a populated table.** Needs a default or a backfill first, in a separate earlier migration.
- **A new `UNIQUE` index.** Fails on existing duplicates. Deduplicate first. (`0002_team_slug_unique` is exactly this case: `team_members.slug` was indexed but not unique, so every re-seed duplicated the team. The index is correct — it needed the duplicates cleared before it would apply.)

### Never edit an applied migration

Drizzle records a hash of each migration file. Editing one that has already run makes the journal disagree with the database, and the next `db:migrate` on a fresh environment produces a schema nobody has tested. Write a new migration instead.

---

## 4. Seeding

```bash
pnpm db:seed                 # reference data + development content
pnpm db:seed -- --reference  # reference data only — safe anywhere
```

The seed is in two tiers, and the distinction matters:

**Reference data** — the permission catalogue, the six roles, and the settings rows. This is not test data; it is what the application needs in order to work at all. `--reference` is safe to run in production and is idempotent.

**Development content** — demo programmes, campaigns, stories, events, team members, and the development staff accounts. This tier **refuses to run in production**:

```ts
function assertDemoSeedAllowed(): void {
  const appEnv = process.env.APP_ENV ?? 'development';
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (appEnv === 'production' || nodeEnv === 'production') {
    throw new Error('Refusing to seed demo content in production.\n…');
  }
}
```

It throws rather than skipping quietly, because a silent no-op looks identical to a seed that worked.

### The seed must stay idempotent

Running it twice must produce the same database as running it once. Every insert therefore needs a conflict target — which in practice means a UNIQUE index on the natural key:

- Slug-keyed tables use `onConflictDoUpdate` / `onConflictDoNothing` on the slug.
- `impact_updates` has no natural key (one dated observation, and two identical ones are legitimate data), so the demo seed **deletes them before inserting**. That is safe only because the demo tier cannot run in production.

If you add a demo table, give it a conflict target or add it to the reset. A table with neither grows by its own size on every run, and the public page then double-counts.

### Development credentials

All development accounts use the password `DevPassword123!`. They exist only in the development tier.

| Email | Role | Second factor |
|---|---|---|
| `admin@sailent.local` | SUPER_ADMIN | required |
| `finance@sailent.local` | FINANCE_MANAGER | required |
| `campaigns@sailent.local` | CAMPAIGN_MANAGER | — |
| `volunteers@sailent.local` | VOLUNTEER_MANAGER | — |
| `content@sailent.local` | CONTENT_MANAGER | — |

There is one account per role on purpose. RBAC exercised only as a Super Admin is not exercised at all: every request succeeds, so a guard that never runs looks exactly like a guard that works.

> **These credentials are published, and that is the point — in development.**
> Before this database serves production, run
> `pnpm --filter @sailent/database db:harden` (dry-run by default) to suspend
> every `@sailent.local` account and revoke its sessions. See
> [`phase-8.md`](phase-8.md) §12.3. Create a real administrator first.

The two privileged accounts share a published development TOTP secret, `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP`. Print the current code with:

```bash
pnpm --filter @sailent/api totp:dev
```

---

## 5. Rules that changes must obey

These come from [`phase-0-decisions.md`](phase-0-decisions.md) and are enforced by CHECK constraints, not by convention.

**Money is integer paise** (A2). `bigint`, never `numeric`, never a float. A money column whose type is `double precision` is a defect, and `test/database.spec.ts` asserts that none exists.

**Snapshot prices onto the line** (A5). `donation_items` stores the unit price at the time of the gift. Later price changes must never rewrite history. The database enforces the arithmetic:

```sql
CHECK (total_price = quantity * unit_price)
```

**Derived counters move only in the capture transaction** (A6). `amount_raised` and `fulfilled_quantity` are caches. They are incremented inside the transaction that marks a payment captured, under `SELECT … FOR UPDATE` on the campaign row, and are reconcilable from `donation_items`. Nothing else writes them — in particular, no request from a browser.

**Soft-delete financial records.** `deleted_at` rather than `DELETE`, and foreign keys from financial tables use `ON DELETE RESTRICT`. A cascade that removes donations when a campaign is deleted destroys the audit trail for money that actually moved.

**One subject per session** (A8). Enforced, not assumed:

```sql
CHECK ((user_id IS NOT NULL AND donor_id IS NULL) OR (user_id IS NULL AND donor_id IS NOT NULL))
```

**Consent before publication.** A story naming a person cannot be published without recorded consent:

```sql
CHECK (status <> 'published' OR subject_name IS NULL OR is_anonymised = true OR consent_obtained = true)
```

**Volunteer IDs are assigned at approval** (A13), never at application, and never reused.

---

## 6. Verifying the whole thing from scratch

The only test that proves the migrations work is running them on a database that has never seen them:

```bash
createdb sailent_check
DATABASE_URL=postgresql://…/sailent_check pnpm db:migrate
DATABASE_URL=postgresql://…/sailent_check pnpm db:seed
dropdb sailent_check
```

The current schema produces **28 tables, 33 CHECK constraints, 40 foreign keys, 49 unique indexes, 118 indexes and 23 enums**, with 63 permissions, 6 roles and 185 role-permission grants seeded. Row level security is enabled on all 28 tables with zero policies — see [`supabase.md`](supabase.md) §2 for why.

`apps/api/test/database.spec.ts` asserts these properties in CI, including that eight specific constraints actually reject invalid data — because a constraint that exists in the schema file and not in the database is worse than no constraint at all.

---

## 7. Useful commands

| Command | Does |
|---|---|
| `pnpm db:generate --name x` | Generate a migration from the built schema |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:seed` | Reference data + development content |
| `pnpm db:seed -- --reference` | Reference data only |
| `pnpm db:studio` | Drizzle Studio, a browser UI over the data |
| `pnpm --filter @sailent/database build` | Compile the schema — **required before generate** |
