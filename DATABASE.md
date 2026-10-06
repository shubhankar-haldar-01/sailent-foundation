# DATABASE.md — actual database

Verified on 2026-10-06 against:
- the Drizzle schema in `packages/database/src/schema/*.ts`;
- the SQL migrations `packages/database/drizzle/0000`–`0022`;
- the seed;
- read-only queries against the local `sailent_dev` and `sailent_e2e` databases.

**No credentials appear in this document.**

## 1. Overview

| | |
|---|---|
| Engine | PostgreSQL 17 locally (`sailent_dev`, `sailent_e2e`); the **production** database is a Supabase Postgres project. Its state is unverified, and **agents must not access it** (`AGENTS.md` §8). |
| ORM | Drizzle (`drizzle-orm` 0.38). Client: `packages/database/src/client.ts` (pooled `pg`, TLS verified with `DATABASE_CA_CERT`) |
| Tables | 47 live, all in `public` |
| Keys | UUID primary keys `gen_random_uuid()` (`_shared.ts`), except composite join tables and the sequence tables |
| Timestamps | `created_at`/`updated_at` timestamptz, maintained by the **application**; there are no triggers |
| Soft delete | `deleted_at` on content tables (programmes, campaigns, campaign_products, products, stories, blog, pages, events, team). Donations, payments and receipts are **never** deleted. |
| Money | `bigint` paise (`money()` helper), `currency char(3)` default `INR` |
| RLS | Enabled on **every** table, with **no policies** and no FORCE. The app connects as the owner and bypasses it. The purpose is to lock out Supabase's `anon` and `authenticated` roles (migrations `0004`, `0017`). |
| Functions / triggers / views | **None.** Only anonymous `DO $$` guard and backfill blocks inside migrations. |

## 2. Tables by domain

### Identity and RBAC
- **users** (staff only)
  - email: unique on `lower(email)`
  - `password_hash` (Argon2id; nullable)
  - `status` (`user_status`)
  - TOTP fields (unused in practice)
  - `failed_login_count`, `locked_until`, `must_change_password` (never read)
- **sessions**
  - one subject, either `user_id` (FK CASCADE) or `donor_id` (**no FK**); CHECK `sessions_one_subject`
  - `audience` (`token_audience`)
  - `token_family`, `token_hash` (unique)
  - `expires_at`, `revoked_at`, `reauthenticated_at`
- **otp_codes**
  - `identifier`, `purpose` (varchar, no check), `code_hash`, `expires_at`, `attempts`, `consumed_at`
- **roles**, **permissions**, **role_permissions** (CASCADE), **user_roles**
  - `user_roles.role_id` is RESTRICT; `granted_by` is SET NULL
  - 112 permissions (37 sensitive) and **1 role, `SUPER_ADMIN`** (as of 2026-10-06)

### Donors
- **donors**
  - `donor_code` (unique, `DNR-YYYY-NNNNN`)
  - email: unique index `donors_email_lower_unique` on `lower(btrim(email))`, added by SQL in `0011`; the TS schema declares only a plain index
  - `phone` (not unique since `0011`)
  - `tax_id_type` and `tax_id_number`: **plaintext in code**; CHECK `donors_tax_id_type_required`
  - address fields
  - consent and notify flags
  - `total_donated`, `donation_count`
  - `user_id` → users SET NULL (vestigial)
- **saved_campaigns**
  - `donor_id` and `campaign_id` (both CASCADE); unique per pair

### Volunteers
- **volunteers**
  - `volunteer_id` (`VOL-YYYY-NNNNN`, unique)
  - `status` (`volunteer_status`)
  - partial unique on phone and on `lower(btrim(email))` where status is not rejected or archived
  - CHECK `volunteers_id_requires_approval`
  - `user_id` → users; `donor_id` (**no FK**)
- **volunteer_sequences**: gapless per-year counter
- **volunteer_applications**: `volunteer_id` CASCADE
- **volunteer_assignments**: polymorphic `assignable_type`/`assignable_id`, no FK
- **volunteer_attendance**: minutes, 1–1440; unique (assignment, date)
- **volunteer_certificates**: RESTRICT; unique number and verification code; status `issued`/`revoked`

### Programmes, campaigns, catalogue
- **programs**
  - `slug` unique
  - `status` (`publish_status`)
  - `category_id` → categories SET NULL
  - rollups `campaign_count`, `total_raised`, `beneficiaries_reached`: **never written by any code**
- **campaigns**
  - `program_id` → programs RESTRICT, **NULLABLE**
  - `category_id` → categories SET NULL
  - `slug` unique
  - `fundraising_goal`, `amount_raised`, `donor_count` (counts donations, not distinct donors)
  - `status` (`campaign_status`)
  - `stop_at_goal`, `allow_custom_amount`, `min_donation_amount`
  - `is_featured`, `featured_order`
  - `start_date`, `end_date` (NULL = ongoing)
  - CHECKs:
    - `campaigns_goal_positive_when_public` (`status='draft' OR goal>0`)
    - `amount_raised>=0`, `donor_count>=0`
    - `campaigns_dates_ordered` (`end_date > start_date`)
  - partial index `campaigns_featured_idx` where `is_featured`
- **products**: master catalogue; slug unique; `default_price > 0`; `status`
- **campaign_products**
  - `campaign_id` and `product_id`, both RESTRICT; unique per pair
  - `price > 0`, `target_quantity`, `provided_quantity`, `max_per_donation`, `status`, `is_active`
- **campaign_gallery**: campaign CASCADE, media RESTRICT; unique per pair
- **categories**: `key` and `slug` unique; `kind` (`category_kind`). 12 rows are inserted by migration `0005`.
- **slug_history**: unique (`entity_type`, `slug`); `entity_id` has no FK

### Donations, payments, receipts
- **donations**
  - `reference` unique
  - `donor_id`, `campaign_id`, `program_id`, `receipt_id`: all nullable, all RESTRICT
  - `donation_type` (custom, product, hybrid)
  - `amount > 0`
  - `status` (`donation_status`)
  - `anonymous`, `tax_id_captured`, UTM fields
- **donation_items**
  - `donation_id` RESTRICT
  - `campaign_product_id` and `product_id`: both set for `product` lines, both null for `custom` lines (CHECK `donation_items_type_consistent`)
  - `total_price = quantity * unit_price` (CHECK)
- **payments**
  - `donation_id` RESTRICT
  - `provider` (razorpay)
  - `provider_order_id` (indexed), `provider_payment_id` (unique)
  - `status`, `amount`, `currency`
- **payment_transactions**: append-only status ledger
- **payment_webhooks**
  - `provider_event_id` unique: the deduplication key
  - `raw_body` (contains payer PII)
  - `signature_valid`, `processing_status`
- **receipts**
  - `receipt_number` unique; unique (`financial_year`, `sequence`)
  - `donation_id` unique
  - `line_items` jsonb
  - `eighty_g_eligible_at` (null)
  - `superseded_by_id` self-FK: present in SQL, **missing from the TS schema**
- **receipt_sequences**: per-financial-year counter

### Content
- **success_stories**: CHECK `success_stories_consent_before_publish`; programme and campaign FKs SET NULL
- **blog_posts**, **blog_tags**, **blog_post_tags** (`0019`)
- **pages**: `sections` jsonb, validated in the app; `version`. **page_revisions**: unique (`page_id`, `version`) (`0020`)
- **media**
  - `storage_key` unique
  - `visibility`
  - CHECK `media_private_has_no_url`
  - `size_bytes` is an integer (2 GB cap)
- **documents**
  - `file_key` unique
  - `visibility` (public, private, admin_only)
  - CHECKs `documents_url_only_when_public` and `documents_public_has_published_at`
  - polymorphic `related_type`/`related_id`, no FK
- **impact_updates**: CHECK `impact_updates_has_parent` (campaign, programme or event)
- **events**: capacity and count CHECKs. **event_registrations**: unique (`event_id`, `email`); `donor_id` has **no FK**
- **faqs**: polymorphic `context_type`/`context_id`; CHECK `faqs_context_consistent`
- **team_members**: `slug` unique

### Platform
- **notification_templates**, **notification_template_revisions** (`0022`)
- **notifications**: polymorphic recipient; `template_id`; `retry_count`
- **audit_logs**
  - append-only by convention only
  - `user_id` holds a user **or** a donor ID, with no FK
  - old/new jsonb, `severity`
- **settings**: `key` unique, `value` jsonb, `is_public`

**Dropped tables:** `refunds` (`0010`), `subscriptions` and `subscription_payments` (`0009`).

## 3. Enums (`src/schema/enums.ts`)

| Enum | Values |
|---|---|
| `campaign_status` | draft, published, active, paused, completed, archived |
| `publish_status` | draft, published, archived |
| `donation_type` | custom, product, hybrid |
| `donation_status` | pending, processing, successful, failed, cancelled |
| `payment_status` | created, pending, processing, successful, failed, cancelled |
| `payment_provider` | razorpay |
| `payment_method` | upi, card, netbanking, wallet, emandate |
| `token_audience` | donor, staff |
| `user_status` | invited, active, inactive, suspended |
| `volunteer_status` | applied, under_review, approved, active, inactive, suspended, rejected, archived |
| `document_visibility` | public, private, admin_only |
| `media_visibility` | public, private |
| `category_kind` | program, campaign, both, blog |
| `audit_actor_type` | user, donor, volunteer, system, webhook |
| `audit_severity` | info, warning, critical |

Also defined: `donor_type`, `tax_id_type`, `volunteer_assignment_status`, `volunteer_certificate_type`/`_status`, `team_member_type`, `campaign_product_status`, `product_status`, `event_registration_status`, `document_type`, `notification_channel`/`_status`, `faq_context`.

## 4. Key relationships

### Programme → Campaign → Donation

```
programs 1 ── * campaigns (program_id NULLABLE, RESTRICT)
campaigns 1 ── * campaign_products * ── 1 products
campaigns 1 ── * donations (campaign_id nullable, RESTRICT; API always sets it)
donations 1 ── * donation_items ── campaign_products / products
donations 1 ── * payments 1 ── * payment_transactions
donations 1 ── 1 receipts
```

- **"Every campaign belongs to exactly one programme" is NOT enforced by the database.**
  - The column is nullable, and there is no CHECK.
  - `assertPublishable` (`apps/api/src/modules/catalog/campaigns.service.ts`) enforces it only on the transitions to published or active.
  - An ordinary `PATCH` can set `programId: null` on a live campaign.
  - The seed throws if a campaign names an unknown programme.
  - All 9 dev campaigns currently have a programme.
- **There are no general donations.** The API requires a campaign and copies `campaign.program_id` onto the donation.
- **The database does not check** that a line's campaign product belongs to the donation's campaign (the app checks), or that `donations.amount` equals the sum of its lines.

### User / Donor / Volunteer
- **`users`** = staff only.
- **Donors** authenticate through `sessions.donor_id` with audience `donor`; identity is the unique email. `donors.user_id` is vestigial.
- **Volunteers** are linked to a donor by matching **email** (in `/me/volunteering`). `volunteers.user_id` and `donor_id` exist but are unused.
- **`audit_logs.user_id`** stores either a user ID or a donor ID.

## 5. Migration history

The journal (`meta/_journal.json`) lists 23 entries. Dates come from the journal's `when` field; for `0017`–`0022` those values were hand-assigned.

| # | Date (IST) | Change | Risk |
|---|---|---|---|
| 0000 | 2026-09-19 | 30 tables, 23 enums, FKs, indexes | |
| 0001 | 2026-09-19 | `sessions.reauthenticated_at` | |
| 0002 | 2026-09-19 | Team slug unique | Fails on duplicates |
| 0003 | 2026-09-19 | Editorial jsonb columns | |
| 0004 | 2026-09-19 | Revoke `anon`/`authenticated`; RLS on every table | |
| 0005 | 2026-09-19 | Categories, slug_history, faqs, media, campaign_gallery; 12 categories seeded | |
| 0006 | 2026-09-19 | Moves jsonb FAQs, updates and gallery into tables; **drops** the jsonb columns | **Data rewrite.** The gallery CTE bug lost gallery links (demo data only). |
| 0007 | 2026-09-19 | Goal CHECK allows drafts without a goal | |
| 0008 | 2026-09-20 | Products master; campaign_products becomes a junction; drops columns; renames `fulfilled_quantity` → `provided_quantity` | **Data rewrite** |
| 0009 | 2026-09-20 | Receipts and sequences; one-time donations only; drops subscriptions | Guarded |
| 0010 | 2026-09-20 | Drops refunds; narrows statuses; saved_campaigns; notify flags | Guarded |
| 0011 | 2026-09-20 | Donor email unique on `lower(btrim)`; phone not unique | Aborts on duplicates |
| 0012 | 2026-09-21 | Impact slug and event link; event deadline and organiser | Backfill |
| 0013 | 2026-09-21 | Impact parent CHECK includes event | |
| 0014 | 2026-09-21 | Collapses all roles into `SUPER_ADMIN` | **Data rewrite; file edited after it was applied** |
| 0015 | 2026-09-21 | Volunteer tables | No RLS until 0017 |
| 0016 | 2026-09-21 | Volunteer sequence backfill | |
| 0017 | 2026-09-23* | Volunteer RLS plus a schema-wide RLS assertion | |
| 0018 | 2026-09-23* | Live volunteer email unique | Inner BEGIN/COMMIT |
| 0019 | 2026-09-23* | Blog tables; `category_kind` gains `blog` | Inner BEGIN/COMMIT |
| 0020 | 2026-09-23* | Pages and revisions | Inner BEGIN/COMMIT |
| 0021 | 2026-09-23* | Documents `file_key` unique; public needs `published_at` | Unguarded constraints; inner BEGIN/COMMIT |
| 0022 | 2026-09-23* | Notification templates and revisions; notification columns | Inner BEGIN/COMMIT |

\* Hand-assigned timestamps.

### Applied state vs repository (local databases)

`drizzle.__drizzle_migrations` has **24 rows** in both `sailent_dev` and `sailent_e2e`.
- Matching the hashes against the repo files gives `0000`–`0013` and `0015`–`0022` as exact matches.
- Row 15 (`0014`) **does not match**: the file was edited after it was applied.
- Row 24 matches **no file**. The only database object absent from the repo SQL is the CHECK `donors_tax_id_encrypted` (`tax_id_number IS NULL OR tax_id_number LIKE 'enc:%'`). It breaks `PATCH /me` with a PAN, and accounts for the 4 failing API tests.
- See `DEVELOPMENT_STATUS.md` §5.1. **The repository is the canonical schema;** the local databases have drifted.

### Migration workflow (authoritative rule; identical to `AGENTS.md` §5)

The scripts are in `packages/database/package.json`:
- `db:migrate` = `tsx src/migrate.ts` (drizzle `migrate()` over `./drizzle`, with the target guard);
- `db:generate` = build + `drizzle-kit generate`;
- `db:push` = build + `drizzle-guarded push` (uses `DRIZZLE_AUTHORISED_URL`).

| Activity | When | Snapshot regeneration needed? |
|---|---|---|
| Write a migration (normal development) | Any schema change: hand-write `NNNN_*.sql`, add the journal entry, update the TS schema | **No** |
| Apply migrations (`pnpm db:migrate --target=local`) | After writing or pulling migrations | **No** |
| `pnpm db:generate` | **Not used.** Allowed only after the snapshot baseline has been rebuilt, which is a dedicated, owner-approved task that has not been done | Yes, the rebuild comes first |
| `pnpm db:push` | **Not used**, on any database. It diffs a live database against the TS schema and can drop objects | n/a |
| Rebuild the snapshot baseline | Only as that dedicated task, if the owner wants `db:generate` back | That task *is* the regeneration |

### Migration tooling risks
1. **Snapshots** exist only for `0000`–`0007`. `db:generate` would diff against `0007`, and `db:push` could drop objects the TS schema does not declare: `donors_email_lower_unique`, the `receipts.superseded_by_id` FK, and the DESC index. That is why both are unused.
2. **Inner `BEGIN`/`COMMIT`** in `0018`–`0022` ends the migrator's outer transaction early, so a failure part-way leaves the chain partially applied and recorded.
3. **Hand-assigned journal timestamps.** A migration inserted out of order would be skipped silently.
4. **Unguarded constraints.** `0021` adds unique and CHECK constraints with no data guard.

## 6. Data integrity rules (application-enforced)

- Derived counters change only in the capture transaction (`donation-capture.service.ts`) under `FOR UPDATE`. The seed is the sanctioned exception, demo tier only.
- Receipt numbers are gapless per financial year (`receipt_sequences` row lock), in the format `SFL-<FY>-NNNNNN`.
- Volunteer IDs are gapless per year (`volunteer_sequences`).
- The campaign lifecycle is limited to the transitions in `packages/validation` `CAMPAIGN_TRANSITIONS`.
- The end-date deadline (`hasEnded`) is application logic only.
- `featured_order` uniqueness is not enforced.

## 7. Indexing gaps

These foreign keys have **no index**:
- `donations.program_id`, `donations.receipt_id`
- `campaign_gallery.media_id` (RESTRICT, so deleting media triggers a scan)
- `programs.category_id`, `campaigns.category_id`
- `payment_webhooks.related_payment_id`
- `notifications.template_id`
- most `*_by` user columns

These ID columns have **no FK at all**:
- `sessions.donor_id`, `event_registrations.donor_id`, `volunteers.donor_id`
- `audit_logs.user_id`, `slug_history.changed_by`, `settings.updated_by`
- the polymorphic `*_id` columns

## 8. Seed (`packages/database/src/seed/index.ts`)

### Reference tier (always runs)
- 112 permissions and 1 role (`SUPER_ADMIN`)
- 12 categories, 4 settings, 9 notification templates

### Demo tier
**Two separate checks run, and they look at different things:**
1. **The target guard** (`resolveDatabaseTarget`) runs **before connecting**, for every seed mode. It requires `--target=local` or `--target=production --confirm-host=<host>`, and validates that `DATABASE_URL` matches the declared target.
2. **The demo-data gate** (`assertDemoSeedAllowed`) runs only for the demo tier. It refuses **only** when `APP_ENV` or `NODE_ENV` is `production`, and **does not use `--target` at all**. A run with `--target=production` and `APP_ENV=development` passes both checks. **Never** run the demo tier against production (`DEPLOYMENT.md` §10).

**Staff and content:**
- 2 development staff accounts, `admin@sailent.local` and `staff@sailent.local`. Their published dev credentials are neutralised by `db:harden`.
- 7 programmes, 8 products
- 9 campaigns: 8 active, 1 completed, 4 featured, every end date null (as of 2026-10-06, an uncommitted change)
- 7 campaign products, 27 FAQs, 27 media / gallery rows

**People and activity:**
- 5 team members, 3 stories, 4 events (152 registrations), 2 impact updates
- 5 donors and 45 demo donations (no items, payments or receipts)
- 13 volunteers

**Destructive behaviour:** the demo tier deletes **all** `impact_updates`, `faqs` and `campaign_gallery` rows.

### E2E preparation
`src/prepare-e2e.ts`: requires `E2E_DATABASE_URL` (local, and different from `DATABASE_URL`), then runs migrate and seed with `--target=local`.

## 9. Environment variable names

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `DATABASE_MIGRATION_URL` | Runtime and migration connections |
| `TEST_DATABASE_URL` | API tests; currently the dev database |
| `ALLOW_REMOTE_TEST_DB` | Lets API tests use a non-local database |
| `E2E_DATABASE_URL` | Playwright database |
| `DRIZZLE_AUTHORISED_URL` | Used by `db:push`/`db:studio` |
| `DATABASE_CA_CERT`, `DATABASE_INSECURE_TLS` | TLS |
| `APP_ENV`, `NODE_ENV` | Environment |
| `PRODUCTION_DATABASE_HOST` | Target guard (a shared regional pooler host; it cannot distinguish two projects in the same region) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME` | Admin CLI scripts |

## 10. Database commands and seed behaviour

**Always declare the target.**

LOCAL / E2E (agents may run these):
```
pnpm db:migrate --target=local
pnpm db:seed --target=local                       # reference + demo tiers (LOCAL only)
pnpm db:seed --reference --target=local           # reference tier only
pnpm --filter @sailent/database db:prepare-e2e    # migrates + seeds sailent_e2e
```

Human-only on production, with explicit approval; agents never run these against production:
```
pnpm --filter @sailent/database db:harden                 # dry run unless --confirm
pnpm --filter @sailent/database db:create-admin           # uses ADMIN_* variables
pnpm --filter @sailent/database db:rotate-admin-password
```

**The seed reads only `DATABASE_URL`**, never `DATABASE_MIGRATION_URL`.

**`--reference` is not harmless.** It deletes and re-inserts every `SUPER_ADMIN` grant, which opens an admin-lockout window. It also prunes permissions, retires legacy roles and upserts category names and slugs. Existing setting values and edited template bodies are kept. The full description is in `DEPLOYMENT.md` §10.

## 11. Adding a permission

1. **Add the key** to `PERMISSIONS` in `packages/database/src/seed/permissions.ts`, as `{ key: 'resource.action', description: '…', sensitive?: true }`.
   - Mark it `sensitive` if it changes money, permissions, PII visibility or published state.
   - The single role `SUPER_ADMIN` has `permissions: '*'` in `ROLES`, so it receives every catalogue key automatically.
2. **Use it in the API:** `@RequirePermission('resource.action')` on the controller method. Add `@Sensitive()` if it needs 5-minute re-authentication, and `AuditService.record` for mutations.
3. **Apply it locally** with `pnpm db:seed --reference --target=local`. This upserts the permission, rebuilds the `SUPER_ADMIN` grants and prunes keys no longer in the catalogue. The API resolves permissions from the database on every request, so the API honours the change immediately. The web keeps a copy of the actor's permissions in the session cookie, for UI gating only, so the admin UI may show the new capability only after signing in again.
4. **Production:** a **human** runs the reference seed with explicit approval, mindful of the lockout window (`DEPLOYMENT.md` §10). Agents never do this.
5. **Tests:** add or extend `apps/api/test/rbac.spec.ts`, or the module's integration spec:
   - a staff token **without** the permission gets 403;
   - **with** it, the request succeeds;
   - for `@Sensitive`, an un-reauthenticated session gets `REAUTH_REQUIRED`.

   Run `pnpm --filter @sailent/api exec vitest run test/rbac.spec.ts`.
6. **Verify the behaviour** in the admin UI as a `SUPER_ADMIN`.
   - The web `can()` helper only hides UI; the API is the enforcement point.
   - Update the documented count (112 as of 2026-10-06) where it appears: `SECURITY.md`, `PROJECT.md`, this file.
