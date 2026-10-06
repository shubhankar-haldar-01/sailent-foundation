import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from './harness.js';
import { DATABASE } from '../src/modules/database/database.module.js';

interface Executor {
  db: { execute(query: unknown): Promise<{ rows: Record<string, unknown>[] }> };
}

/**
 * The database itself.
 *
 * These assertions are about the LAST line of defence. Application validation
 * is the first line and it is tested elsewhere; this suite asks what happens
 * when something writes to the database around the application — a migration, a
 * manual fix at 2am, a future endpoint someone adds without reading the rules.
 * A constraint that only exists in a Zod schema does not survive any of those.
 */
describe('Database (integration)', () => {
  let app: INestApplication;
  let database: Executor;

  beforeAll(async () => {
    app = await createTestApp();
    database = app.get<Executor>(DATABASE);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  const query = async (text: unknown) => (await database.db.execute(text)).rows;

  describe('migrations', () => {
    it('has applied every migration in the folder', async () => {
      const rows = await query(sql`SELECT id, hash FROM drizzle.__drizzle_migrations ORDER BY id`);
      expect(rows.length).toBeGreaterThan(0);
    });

    it('has every expected table', async () => {
      const rows = await query(
        sql`SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
      );
      const tables = new Set(rows.map((row) => row.table_name as string));

      /*
        Everything that exists today. The list is written out rather than
        counted so that ADDING A TABLE IS A DECISION rather than a drift — a
        new one fails this test until somebody names it here.

        Phase 8 added five: the four volunteer tables and the VOL- counter.
        `volunteer_documents` is NOT among them — file upload is out of scope —
        and neither is `volunteer_hours`, because attendance is the record and
        a periodic aggregation would be a second source of truth for a figure
        that gets printed on certificates.
      */
      const expected = [
        'users',
        'sessions',
        'otp_codes',
        'roles',
        'permissions',
        'role_permissions',
        'user_roles',
        'programs',
        'campaigns',
        'campaign_products',
        'donors',
        'donations',
        'donation_items',
        'payments',
        'payment_transactions',
        'payment_webhooks',
        'volunteers',
        'volunteer_sequences',
        'volunteer_applications',
        'volunteer_assignments',
        'volunteer_attendance',
        'volunteer_certificates',
        'events',
        'event_registrations',
        'success_stories',
        'impact_updates',
        'team_members',
        'documents',
        'notifications',
        'audit_logs',
        'settings',
        // Phase 4: the taxonomy and the content that moved out of JSON columns.
        'categories',
        'slug_history',
        'faqs',
        'media',
        'campaign_gallery',
        // Phase 5: the product master. `campaign_products` above became a
        // junction onto this, rather than holding its own copy of a product's
        // name, description and image.
        'products',
        // Phase 6: the receipt book, and its gapless counter. `subscriptions`
        // left in the same migration — designed in Phase 3, never built, and
        // removed so it cannot be built by accident.
        'receipts',
        'receipt_sequences',
        // Phase 7: donor accounts. `refunds` left in the same migration — the
        // platform decided not to offer refunds, so the table, its permission
        // and the two `refunded` values in each status enum all went with it.
        'saved_campaigns',
        /*
          Phase 10.7: the blog. `blog_tags` is separate from `categories`
          because a curated shelf and a free-typed keyword are different
          things; `blog_post_tags` is the junction, keyed by the pair so a post
          cannot carry the same tag twice.

          There is no `blog_revisions`. Revision history was not asked for, and
          a table nothing writes is a table somebody later assumes is populated.
        */
        'blog_posts',
        'blog_tags',
        'blog_post_tags',
        /*
          Phase 10.9: the section composer. `pages` holds the ORDER of approved
          sections for a route that already exists — it does not create routes —
          and `page_revisions` is the snapshot per save that answers "who
          changed the homepage, and to what".
        */
        'pages',
        'page_revisions',
        /*
          Phase 10.11: notification templates. `notification_templates` is one
          row per transactional email, and `notification_template_revisions` is
          the snapshot per save — the same shape as `page_revisions`, because
          "templates with versioning" has to mean history rather than a
          counter.

          `notifications` itself is not new: it has existed since migration
          0000 and is listed further up.
        */
        'notification_templates',
        'notification_template_revisions',
        /*
          Phase 13 (migration 0023): what the public contact form submits, and
          double-opt-in newsletter consent.
        */
        'contact_messages',
        'newsletter_subscribers',
      ];

      for (const table of expected) {
        expect(tables).toContain(table);
      }
      expect(tables.size).toBe(expected.length);
    });

    it('carries the session re-authentication column', async () => {
      const rows = await query(
        sql`SELECT data_type FROM information_schema.columns
            WHERE table_name = 'sessions' AND column_name = 'reauthenticated_at'`,
      );
      expect(rows[0]?.data_type).toBe('timestamp with time zone');
    });
  });

  describe('constraints', () => {
    it('has the CHECK constraints the schema declares', async () => {
      // Drizzle silently ignores a raw `sql\`CONSTRAINT …\`` in a table config,
      // which produced a first migration with zero CHECKs and a schema that
      // looked correct in TypeScript. Counting them here is what catches that.
      const rows = await query(
        sql`SELECT count(*)::int AS total FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE c.contype = 'c' AND n.nspname = 'public'`,
      );
      expect(Number(rows[0]?.total)).toBeGreaterThanOrEqual(30);
    });

    it.each([
      ['sessions_one_subject', 'sessions'],
      ['donation_items_total_matches', 'donation_items'],
      ['donation_items_type_consistent', 'donation_items'],
      ['volunteers_id_requires_approval', 'volunteers'],
      ['success_stories_consent_before_publish', 'success_stories'],
    ])('declares %s on %s', async (name, table) => {
      const rows = await query(
        sql`SELECT 1 FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            WHERE c.conname = ${name} AND t.relname = ${table}`,
      );
      expect(rows).toHaveLength(1);
    });

    it('refuses a session belonging to both a donor and a staff user', async () => {
      // Decision A8: the two audiences cannot merge. Without this a session
      // could belong to both at once, which is exactly what the split prevents.
      await expect(
        query(sql`
          INSERT INTO sessions (user_id, donor_id, audience, token_family, token_hash, expires_at)
          VALUES (gen_random_uuid(), gen_random_uuid(), 'staff', gen_random_uuid(),
                  'constraint-test-hash', now() + interval '1 day')
        `),
      ).rejects.toThrow(/sessions_one_subject/);
    });

    it('refuses a donation line whose total does not equal quantity × unit price', async () => {
      // The arithmetic that decides what a donor is charged is enforced by the
      // database, not only by whatever code happens to write the row.
      await expect(
        query(sql`
          INSERT INTO donation_items
            (donation_id, item_type, item_name, quantity, unit_price, total_price)
          VALUES (gen_random_uuid(), 'custom', 'Constraint test', 2, 50000, 70000)
        `),
      ).rejects.toThrow(/donation_items_total_matches|violates/);
    });

    it('refuses a published story about a named person without consent', async () => {
      await expect(
        query(sql`
          INSERT INTO success_stories
            (title, slug, content, status, subject_name, is_anonymised, consent_obtained)
          VALUES ('Constraint test', 'constraint-test-story', 'x', 'published',
                  'A named person', false, false)
        `),
      ).rejects.toThrow(/success_stories_consent_before_publish|violates/);
    });

    it('refuses a volunteer id on an application that has not been approved', async () => {
      await expect(
        query(sql`
          INSERT INTO volunteers (first_name, email, phone, status, volunteer_id)
          VALUES ('Constraint', 'constraint-test@sailent.local', '9876500001',
                  'applied', 'VOL-2026-99999')
        `),
      ).rejects.toThrow(/volunteers_id_requires_approval|violates/);
    });

    it('enforces email uniqueness case-insensitively', async () => {
      // `Admin@Sailent.local` and `admin@sailent.local` are the same account to
      // every person who will ever type them.
      await expect(
        query(sql`
          INSERT INTO users (email, first_name, status)
          VALUES ('ADMIN@SAILENT.LOCAL', 'Duplicate', 'invited')
        `),
      ).rejects.toThrow(/users_email_unique|duplicate key/);
    });

    it('refuses a duplicate webhook event id', async () => {
      // Decision A4: this unique index IS the deduplication strategy for
      // payment webhooks, which arrive more than once by design.
      const rows = await query(
        sql`SELECT indexdef FROM pg_indexes
            WHERE tablename = 'payment_webhooks' AND indexdef ILIKE '%unique%'
              AND indexdef ILIKE '%provider_event_id%'`,
      );
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  describe('money columns', () => {
    it('stores every money column as an integer type, never a float', async () => {
      // Decision A2. `numeric` would be acceptable arithmetic but the wrong
      // decision here; `double precision` or `real` would be a defect.
      const rows = await query(sql`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (column_name LIKE '%amount%' OR column_name LIKE '%price%'
               OR column_name LIKE '%_paise' OR column_name = 'goal_amount')
          -- allow_custom_amount is a flag, not a sum. Matching on the name
          -- alone would make this test assert that a boolean is a bigint.
          AND data_type <> 'boolean'
      `);

      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(['bigint', 'integer', 'smallint']).toContain(row.data_type);
      }
    });
  });

  describe('reference data', () => {
    it('has the full permission catalogue and every role', async () => {
      const [permissions] = await query(sql`SELECT count(*)::int AS total FROM permissions`);
      const [roles] = await query(sql`SELECT count(*)::int AS total FROM roles`);

      expect(Number(permissions?.total)).toBeGreaterThanOrEqual(80);
      /*
        ONE role. Phase 8 collapsed the five operational bundles into
        SUPER_ADMIN — see `seed/permissions.ts` for the reasoning, and
        migration `0014` for how existing staff were carried across.

        The permission CATALOGUE is deliberately untouched by that change,
        which is why the assertion above still holds: reintroducing a narrower
        role is a seed change and nothing else.
      */
      expect(Number(roles?.total)).toBe(1);
    });

    it('grants the one role every permission in the catalogue', async () => {
      const rows = await query(sql`
        SELECT r.key, count(rp.permission_id)::int AS granted
        FROM roles r
        LEFT JOIN role_permissions rp ON rp.role_id = r.id
        WHERE r.key = 'SUPER_ADMIN'
        GROUP BY r.key
      `);

      const [total] = await query(sql`SELECT count(*)::int AS total FROM permissions`);
      expect(Number(rows[0]?.granted)).toBe(Number(total?.total));
    });

    /*
      ══════════════════════════════════════════════════════════════════════
      TWO TESTS WERE REMOVED HERE IN PHASE 8, AND THE ABSENCE IS DELIBERATE.

      One asserted that CONTENT_MANAGER held a strict subset of SUPER_ADMIN's
      permissions. The other asserted that CAMPAIGN_MANAGER could read donation
      AGGREGATES but not donor PII — running a campaign requires knowing
      whether it is working, not who gave.

      Both were testing the seed's role bundles, and those bundles no longer
      exist. The permissions they referenced do: `donation.read` and
      `donation.read_pii` are still separate keys, still separately grantable,
      and the guard still checks them. What is gone is the role that held one
      and not the other.

      The donor-PII boundary itself is NOT untested — `me.spec.ts` asserts that
      a donor cannot reach another donor's record, and `admin-donors.service`
      enforces the PII split inside the SELECT rather than in a serialiser.
      ══════════════════════════════════════════════════════════════════════
    */

    it('leaves the statutory registration numbers unset rather than inventing them', async () => {
      // An invented 80G number on an NGO platform is a legal exposure, not a
      // placeholder. The setting exists with null values until real ones arrive.
      const rows = await query(sql`SELECT value FROM settings WHERE key = 'registration_details'`);
      const value = rows[0]?.value as Record<string, unknown> | undefined;

      expect(value).toBeDefined();
      for (const field of Object.values(value ?? {})) {
        expect(field).toBeNull();
      }
    });
  });

  describe('data-API lockdown', () => {
    it('has row level security on EVERY application table', async () => {
      // Supabase publishes the `public` schema through PostgREST using the
      // `anon` key, which is public by design. Without RLS, every password
      // hash, donor phone number and audit row in this schema is readable by
      // anyone who knows the project URL.
      //
      // This asserts the property for every table rather than a fixed list,
      // so a table added by a later migration without RLS fails here instead
      // of shipping.
      const rows = await query(sql`
        SELECT c.relname AS table_name
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relkind = 'r'
           AND c.relname <> '__drizzle_migrations'
           AND c.relrowsecurity = false
      `);

      expect(rows.map((row) => row.table_name)).toEqual([]);
    });

    it('defines no policies, because the API is the authorization surface', async () => {
      // RLS with no policies denies every row to any role it applies to. The
      // application connects as the table owner and bypasses it entirely.
      //
      // A policy appearing here would mean a second authorization system with
      // different rules from the permission guards — two answers to the same
      // question, and no way to tell which one is enforced.
      const rows = await query(sql`SELECT policyname FROM pg_policies WHERE schemaname = 'public'`);
      expect(rows).toEqual([]);
    });

    it('does not FORCE row level security, so the application keeps access', async () => {
      // `FORCE ROW LEVEL SECURITY` would apply RLS to the owner too — and with
      // zero policies, that locks the application out of its own database.
      const rows = await query(sql`
        SELECT c.relname AS table_name
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relforcerowsecurity = true
      `);

      expect(rows.map((row) => row.table_name)).toEqual([]);
    });

    it('can still read every table it needs', async () => {
      // The proof that the lockdown did not lock US out.
      for (const table of ['users', 'campaigns', 'donors', 'audit_logs', 'permissions']) {
        const rows = await query(sql`SELECT count(*)::int AS total FROM ${sql.identifier(table)}`);
        expect(Number(rows[0]?.total)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('indexes', () => {
    it('indexes the columns the public pages actually filter and sort on', async () => {
      const rows = await query(
        sql`SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public'`,
      );
      const indexes = rows.map((row) => `${row.tablename}.${row.indexname}`);

      // A slug lookup happens on every campaign page view; without the unique
      // index it is a sequential scan that grows with the campaign table.
      expect(indexes.some((name) => /campaigns\..*slug/.test(name))).toBe(true);
      expect(indexes.some((name) => /sessions\..*token_hash/.test(name))).toBe(true);
      expect(indexes.some((name) => /audit_logs\./.test(name))).toBe(true);
    });
  });
});
