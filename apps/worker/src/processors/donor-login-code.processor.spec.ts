import { randomInt, randomUUID } from 'node:crypto';

import type { Job } from 'bullmq';
import { and, eq, gte, like, or, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadRootEnvFile } from '@sailent/config/dotenv';
import { createDatabaseClient, notifications, type DatabaseClient } from '@sailent/database';

import { createMailer } from '../lib/email.js';
import { processDonorLoginCode, type DonorLoginCodeJob } from './donor-login-code.processor.js';

/**
 * Sign-in and verification codes, against the REAL local database and a FAKE
 * Resend (the SDK runs; its `fetch` is stubbed). No email leaves the machine.
 *
 * The code is a credential: these tests check it reaches the email and
 * nowhere else — not the logs, not the send log.
 */
loadRootEnvFile();
const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
const host = (() => {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return '';
  }
})();
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  throw new Error('These tests write rows: point TEST_DATABASE_URL at a LOCAL database.');
}

const RUN = randomUUID().slice(0, 8);
/** Rows this run writes without a provider id carry this as `retry_count`. */
const MARKER = randomInt(100_000, 1_000_000);
const STARTED = new Date();
const CODE = '482913';
const ADDRESS = `donor-${RUN}@worker-test.local`;
let database: DatabaseClient;
let sends = 0;

const logs: unknown[] = [];
const logger = {
  info: (...args: unknown[]) => logs.push(args),
  warn: (...args: unknown[]) => logs.push(args),
  error: (...args: unknown[]) => logs.push(args),
  debug: (...args: unknown[]) => logs.push(args),
} as never;

const configured = () =>
  createMailer({
    apiKey: 're_test_worker_key',
    from: 'Sailent Foundation <noreply@worker-test.local>',
  });

function job(data: Partial<DonorLoginCodeJob>, attemptsMade = 0): Job<DonorLoginCodeJob> {
  return {
    id: `job-${RUN}`,
    data: { email: ADDRESS, name: 'Asha', code: CODE, ttlMinutes: 10, ...data },
    attemptsMade,
  } as Job<DonorLoginCodeJob>;
}

/** Resend accepting every send, each with its own message id. */
function resend() {
  const sent: { to: string; subject: string; html: string; text: string }[] = [];
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      to: string[];
      subject: string;
      html: string;
      text: string;
    };
    sent.push({ to: body.to[0]!, subject: body.subject, html: body.html, text: body.text });
    sends += 1;
    return new Response(JSON.stringify({ id: `m-${RUN}-${sends}` }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { sent, fetchMock };
}

async function rowFor(providerMessageId: string) {
  const [row] = await database.db
    .select()
    .from(notifications)
    .where(eq(notifications.providerMessageId, providerMessageId));
  return row;
}

beforeAll(() => {
  database = createDatabaseClient({ connectionString, maxConnections: 2 });
});

afterEach(() => {
  vi.unstubAllGlobals();
  logs.length = 0;
});

afterAll(async () => {
  await database.db
    .delete(notifications)
    .where(
      or(
        like(notifications.providerMessageId, `m-${RUN}-%`),
        and(
          eq(notifications.type, 'donor.login_code'),
          eq(notifications.retryCount, MARKER),
          gte(notifications.createdAt, STARTED),
        ),
      ),
    );
  await database.close();
});

describe('donor.login_code', () => {
  it('emails a sign-in code, and keeps it out of the logs and the send log', async () => {
    const { sent } = resend();

    const result = await processDonorLoginCode(
      job({ purpose: 'login' }),
      { mailer: configured(), appUrl: 'https://sailent.example', database },
      logger,
    );

    expect(result).toEqual({ sent: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(ADDRESS);
    expect(sent[0]!.text).toContain(CODE);
    expect(sent[0]!.html).toContain(CODE);
    // In the branded layout, with a preview line that is not the code.
    expect(sent[0]!.html.startsWith('<!doctype html>')).toBe(true);
    expect(sent[0]!.html).toContain('Valid for 10 minutes. Never share this code with anyone.');

    expect(JSON.stringify(logs)).not.toContain(CODE);
    expect(JSON.stringify(logs)).not.toContain(ADDRESS);
    const row = await rowFor(`m-${RUN}-${sends}`);
    expect(row).toMatchObject({
      status: 'sent',
      channel: 'email',
      title: 'Sign-in code',
      data: null,
    });
    expect(JSON.stringify(row)).not.toContain(CODE);
    expect(JSON.stringify(row)).not.toContain(ADDRESS);
  });

  it('gives an event registration code its own wording, expiry, warning and label', async () => {
    const { sent } = resend();

    const result = await processDonorLoginCode(
      job({ purpose: 'event_registration' }),
      { mailer: configured(), appUrl: 'https://sailent.example', database },
      logger,
    );

    expect(result).toEqual({ sent: true });
    expect(sent[0]!.subject).toBe('Your event registration verification code');
    expect(sent[0]!.text).toContain(`event registration is ${CODE}`);
    expect(sent[0]!.text).toContain('valid for 10 minutes and can be used once');
    expect(sent[0]!.text).toContain('We will never ask you for this code');
    expect(sent[0]!.html).toContain(CODE);
    const row = await rowFor(`m-${RUN}-${sends}`);
    expect(row).toMatchObject({ status: 'sent', title: 'Event registration code', data: null });
  });

  it('without Resend configured, sends nothing and records the code as not sent', async () => {
    const { fetchMock } = resend();

    const result = await processDonorLoginCode(
      job({ purpose: 'login' }, MARKER),
      { mailer: createMailer({}), appUrl: 'https://sailent.example', database },
      logger,
    );

    expect(result).toEqual({ sent: false });
    expect(fetchMock).not.toHaveBeenCalled();
    const [row] = await database.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.type, 'donor.login_code'),
          eq(notifications.retryCount, MARKER),
          gte(notifications.createdAt, STARTED),
        ),
      );
    expect(row).toMatchObject({ status: 'failed', error: 'not_configured' });
    expect(JSON.stringify(row)).not.toContain(CODE);
    // Not an incident: no staff alert for a machine with no email set up.
    const alerts = await database.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.type, 'notification.send_failed'),
          sql`${notifications.data}->>'failedType' = 'donor.login_code'`,
          gte(notifications.createdAt, STARTED),
        ),
      );
    expect(alerts).toHaveLength(0);
  });
});
