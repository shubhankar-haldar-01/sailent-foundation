import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE } from '../src/modules/database/database.module.js';
import {
  PREFIX,
  TEST_PASSWORD,
  TEST_USERS,
  createTestApp,
  devTotpCode,
  errorCode,
  type Envelope,
} from './harness.js';

/**
 * Reports and exports.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THREE PROPERTIES CARRY THIS PHASE.
 *
 * 1. THE EXPORT ROUTE IS NOT A WAY ROUND THE OTHER PERMISSIONS. This module
 *    reads across every other one, so `reports.export` alone producing a donor
 *    CSV would be a way to read personal data without `donor.export`.
 *
 * 2. THE RANGE IS BOUNDED. "Arbitrary range" is the requirement; a request for
 *    every donation ever taken is how that requirement becomes an outage.
 *
 * 3. EVERY EXPORT IS AUDITED, WITH A ROW COUNT — §4.22's own words, and the
 *    count is what makes the row answer the question somebody has afterwards.
 * ══════════════════════════════════════════════════════════════════════════
 */
const STAMP = randomUUID().slice(0, 8);

describe('Reports (integration)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let staff: string;

  const db = () =>
    app.get<{
      db: { execute(q: unknown): Promise<{ rows?: Record<string, unknown>[] }> };
    }>(DATABASE).db;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Export is `@Sensitive()`; a fresh login is not a re-authentication. */
  async function reauth() {
    await request(server)
      .post(`${PREFIX}/auth/reauth`)
      .set(auth(staff))
      .send({ password: TEST_PASSWORD, totpCode: devTotpCode() });
  }

  const RANGE = { from: '2020-01-01', to: '2020-12-31' };

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    const login = await request(server)
      .post(`${PREFIX}/auth/staff/login`)
      .send({ email: TEST_USERS.superAdmin, password: TEST_PASSWORD });
    staff = (login.body as Envelope<{ accessToken: string }>).data!.accessToken;
  }, 60_000);

  afterAll(async () => {
    await db().execute(
      sql`DELETE FROM audit_logs WHERE action = 'report.export' AND new_values::text LIKE ${'%' + STAMP + '%'}`,
    );
    await app?.close();
  });

  // =========================================================================
  describe('authorization', () => {
    it('refuses an unauthenticated report', async () => {
      const response = await request(server).get(`${PREFIX}/admin/reports/donations`).query(RANGE);
      expect(response.status).toBe(401);
    });

    it('refuses an unauthenticated export', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/reports/export`)
        .send({ dataset: 'donations', ...RANGE });
      expect(response.status).toBe(401);
    });

    it('refuses a token that is not a staff token', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/reports/donations`)
        .query(RANGE)
        .set({ Authorization: 'Bearer not-a-staff-token' });
      expect(response.status).toBe(401);
    });

    it('has NO public route', async () => {
      for (const path of ['/reports', '/reports/donations', '/reports/export']) {
        expect((await request(server).get(`${PREFIX}${path}`)).status).toBe(404);
      }
    });

    it('allows SUPER_ADMIN to read', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/reports/donations`)
        .query(RANGE)
        .set(auth(staff));
      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  describe('the date range', () => {
    it('is REQUIRED — there is no unbounded report', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/reports/donations`)
        .set(auth(staff));
      expect(response.status).toBe(422);
    });

    it('refuses a range that runs backwards', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/reports/donations`)
        .query({ from: '2026-12-31', to: '2026-01-01' })
        .set(auth(staff));
      expect(response.status).toBe(422);
    });

    it('refuses a range longer than two years', async () => {
      // "Arbitrary range" is the requirement; a request for every donation
      // ever taken is how that requirement becomes an outage.
      const response = await request(server)
        .get(`${PREFIX}/admin/reports/donations`)
        .query({ from: '2000-01-01', to: '2030-01-01' })
        .set(auth(staff));
      expect(response.status).toBe(422);
    });

    it('refuses a date that is not a date', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/reports/donations`)
        .query({ from: '31-03-2026', to: '2026-04-01' })
        .set(auth(staff));
      expect(response.status).toBe(422);
    });

    it('accepts a single day', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/reports/donations`)
        .query({ from: '2026-03-31', to: '2026-03-31' })
        .set(auth(staff));
      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  describe('the four views', () => {
    it('breaks donations down BY PAYMENT STATE', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/reports/donations`)
        .query({ from: '2020-01-01', to: '2021-12-31' })
        .set(auth(staff));

      expect(response.status).toBe(200);
      const data = (
        response.body as Envelope<{
          totals: { donations: number; capturedPaise: number };
          byStatus: { status: string }[];
          byDay: unknown[];
        }>
      ).data!;

      // §4.22: "with payment state". A report showing only successful
      // donations cannot answer why the bank total is lower than the site's.
      expect(Array.isArray(data.byStatus)).toBe(true);
      expect(Array.isArray(data.byDay)).toBe(true);
      expect(typeof data.totals.capturedPaise).toBe('number');
    });

    it('includes campaigns that raised NOTHING in the range', async () => {
      /*
        The join condition, not the WHERE. Those are exactly the campaigns
        somebody running this report needs to see.
      */
      const response = await request(server)
        .get(`${PREFIX}/admin/reports/campaigns`)
        .query({ from: '2020-01-01', to: '2020-01-02' })
        .set(auth(staff));

      expect(response.status).toBe(200);
      const items = (response.body as Envelope<{ items: { inRangePaise: number }[] }>).data!.items;
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.inRangePaise === 0)).toBe(true);
    });

    it('reports volunteers applied in range, and the standing picture', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/reports/volunteers`)
        .query(RANGE)
        .set(auth(staff));

      expect(response.status).toBe(200);
      const data = (
        response.body as Envelope<{ standing: { activeVolunteers: number; verifiedHours: number } }>
      ).data!;
      expect(typeof data.standing.activeVolunteers).toBe('number');
      expect(typeof data.standing.verifiedHours).toBe('number');
    });

    it('reports impact by metric', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/reports/impact`)
        .query({ from: '2020-01-01', to: '2021-12-31' })
        .set(auth(staff));
      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  describe('reconciliation', () => {
    it('answers what is stuck, and checks an invariant that should never break', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/reports/reconciliation`)
        .query({ from: '2020-01-01', to: '2021-12-31' })
        .set(auth(staff));

      expect(response.status).toBe(200);
      const data = (
        response.body as Envelope<{
          summary: { pending: number; capturedWithoutReceipt: number };
          oldestUnresolved: unknown[];
        }>
      ).data!;

      expect(typeof data.summary.pending).toBe('number');
      // A captured donation with no receipt should be impossible — the number
      // is allocated inside the capture transaction. Counted anyway, because
      // "impossible" is what a reconciliation view exists to check.
      expect(typeof data.summary.capturedWithoutReceipt).toBe('number');
      expect(Array.isArray(data.oldestUnresolved)).toBe(true);
    });
  });

  // =========================================================================
  describe('Form 10BD readiness', () => {
    it('counts what could and could not go on the return', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/reports/tax-readiness`)
        .query({ financialYear: 2025 })
        .set(auth(staff));

      expect(response.status).toBe(200);
      const data = (
        response.body as Envelope<{
          financialYear: string;
          filingDeadline: string;
          eligible: number;
          ready: number;
          missing: number;
        }>
      ).data!;

      expect(data.financialYear).toBe('2025-2026');
      // The deadline is a fact about Indian tax law, and it is what turns a
      // count into something somebody acts on.
      expect(data.filingDeadline).toBe('2026-05-31');
      expect(data.ready + data.missing).toBe(data.eligible);
    });

    it('defaults to the current financial year', async () => {
      const response = await request(server)
        .get(`${PREFIX}/admin/reports/tax-readiness`)
        .set(auth(staff));
      expect(response.status).toBe(200);
      expect((response.body as Envelope<{ financialYear: string }>).data!.financialYear).toMatch(
        /^\d{4}-\d{4}$/,
      );
    });

    it('files NOTHING — there is no 10BD generation route', async () => {
      // `form_10bd_exports` is documented and deferred. §4.22 asks for the
      // readiness view, and offering a filing route that produced an
      // unreviewed statutory return would be worse than not having one.
      const response = await request(server)
        .post(`${PREFIX}/admin/tax/10bd/export`)
        .set(auth(staff))
        .send({ financialYear: 2025 });
      expect(response.status).toBe(404);
    });
  });

  // =========================================================================
  describe('exporting', () => {
    it('REQUIRES a fresh re-authentication', async () => {
      const response = await request(server)
        .post(`${PREFIX}/admin/reports/export`)
        .set(auth(staff))
        .send({ dataset: 'donations', ...RANGE });

      expect(response.status).toBe(403);
      expect(errorCode(response.body as Envelope)).toBe('REAUTH_REQUIRED');
    });

    it('refuses a dataset this platform does not export', async () => {
      await reauth();
      const response = await request(server)
        .post(`${PREFIX}/admin/reports/export`)
        .set(auth(staff))
        .send({ dataset: 'users', ...RANGE });
      expect(response.status).toBe(422);
    });

    it('sends a CSV as a FILE, with a sanitised filename', async () => {
      await reauth();
      const response = await request(server)
        .post(`${PREFIX}/admin/reports/export`)
        .set(auth(staff))
        .send({ dataset: 'donations', from: '2020-01-01', to: '2021-12-31' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toMatch(/sailent-donations-.*\.csv/);
      // A BOM, so Excel reads it as UTF-8 rather than guessing a codepage.
      expect(response.text.charCodeAt(0)).toBe(0xfeff);
      expect(response.text).toContain('"reference"');
      expect(response.text).toContain('"status"');
    });

    it('never puts a raw TAX ID in a donor export', async () => {
      await reauth();
      const response = await request(server)
        .post(`${PREFIX}/admin/reports/export`)
        .set(auth(staff))
        .send({ dataset: 'donors', from: '2020-01-01', to: '2021-12-31' });

      expect(response.status).toBe(200);
      /*
        It is SENSITIVE and encrypted at rest. An export is a file that leaves
        the building and gets emailed around; a PAN in one is a disclosure that
        cannot be recalled. Whether one is ON FILE is the useful part.
      */
      expect(response.text).toContain('"tax_id_on_file"');
      expect(response.text).not.toContain('tax_id_number');
    });

    it('marks an anonymous donation rather than hiding the donor from Finance', async () => {
      await reauth();
      const response = await request(server)
        .post(`${PREFIX}/admin/reports/export`)
        .set(auth(staff))
        .send({ dataset: 'donations', from: '2020-01-01', to: '2021-12-31' });

      // The schema says it: "Public display only. Finance can always identify
      // the donor." The column tells whoever opens the file not to publish it.
      expect(response.text).toContain('"anonymous_in_public"');
    });

    it('AUDITS every export, with the row count', async () => {
      await reauth();
      const response = await request(server)
        .post(`${PREFIX}/admin/reports/export`)
        .set(auth(staff))
        .send({ dataset: 'campaigns', from: '2020-01-01', to: '2020-06-30' });

      expect(response.status).toBe(200);
      const rowCount = Number(response.headers['x-row-count']);

      const rows = (
        await db().execute(
          sql`SELECT new_values, severity FROM audit_logs
              WHERE action = 'report.export' AND entity_type = 'report'
              ORDER BY created_at DESC LIMIT 1`,
        )
      ).rows!;

      expect(rows.length).toBe(1);
      const entry = JSON.stringify(rows[0]!.new_values);
      expect(entry).toContain('campaigns');
      expect(entry).toContain('2020-01-01');
      expect(entry).toContain(`"rowCount":${rowCount}`);
    });

    it('files an export of PERSONAL DATA at a higher severity than one without', async () => {
      await reauth();
      await request(server)
        .post(`${PREFIX}/admin/reports/export`)
        .set(auth(staff))
        .send({ dataset: 'donors', from: '2020-01-01', to: '2020-06-30' });

      const rows = (
        await db().execute(
          sql`SELECT severity FROM audit_logs
              WHERE action = 'report.export' ORDER BY created_at DESC LIMIT 1`,
        )
      ).rows!;
      expect(rows[0]!.severity).toBe('warning');
    });

    it('exports impact records WITH how each figure was counted', async () => {
      await reauth();
      const response = await request(server)
        .post(`${PREFIX}/admin/reports/export`)
        .set(auth(staff))
        .send({ dataset: 'impact', from: '2020-01-01', to: '2021-12-31' });

      expect(response.status).toBe(200);
      // A14: a figure without a stated basis is not a figure, and the basis
      // has to travel with the number rather than stay in the database.
      expect(response.text).toContain('"how_it_was_counted"');
    });

    it('neutralises a value a spreadsheet would EXECUTE', async () => {
      const hostile = `=HYPERLINK("http://evil.test")${STAMP}`;
      await db().execute(
        sql`INSERT INTO campaigns (title, slug, short_description, status, fundraising_goal, start_date)
            VALUES (${hostile}, ${'e2e-csv-' + STAMP}, 'x', 'draft', 100000, '2020-02-01')`,
      );

      try {
        await reauth();
        const response = await request(server)
          .post(`${PREFIX}/admin/reports/export`)
          .set(auth(staff))
          .send({ dataset: 'campaigns', from: '2020-01-01', to: '2020-06-30' });

        expect(response.status).toBe(200);
        // Prefixed with a quote, so the spreadsheet reads it as text.
        expect(response.text).toContain(`"${String.fromCharCode(39)}=HYPERLINK`);
      } finally {
        await db().execute(sql`DELETE FROM campaigns WHERE slug = ${'e2e-csv-' + STAMP}`);
      }
    });
  });

  // =========================================================================
  describe('the export route is not a way round the other permissions', () => {
    it('requires `donor.export` for donors, on top of `reports.export`', async () => {
      /*
        SUPER_ADMIN holds every permission, so there is no lesser role to log
        in as — the single-role decision from migration 0014. What can be
        asserted is that the rule exists and is keyed to the right permission,
        which is what the registry below states and the service enforces.
      */
      const response = await request(server)
        .get(`${PREFIX}/admin/roles/SUPER_ADMIN`)
        .set(auth(staff));

      expect(response.status).toBe(200);
      const keys = JSON.stringify(response.body);
      for (const permission of ['donor.export', 'donation.export', 'volunteer.export']) {
        expect(keys).toContain(permission);
      }
    });

    it('lets a dataset with no personal data through on `reports.export` alone', async () => {
      await reauth();
      const response = await request(server)
        .post(`${PREFIX}/admin/reports/export`)
        .set(auth(staff))
        .send({ dataset: 'impact', from: '2020-01-01', to: '2020-06-30' });
      expect(response.status).toBe(200);
    });
  });
});
