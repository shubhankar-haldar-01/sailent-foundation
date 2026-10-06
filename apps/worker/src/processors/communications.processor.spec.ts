import { randomUUID } from 'node:crypto';

import type { Job } from 'bullmq';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadRootEnvFile } from '@sailent/config/dotenv';
import {
  contactMessages,
  createDatabaseClient,
  newsletterSubscribers,
  notifications,
  settings,
  users,
  type DatabaseClient,
} from '@sailent/database';

import {
  escapeHtml,
  processContactReceived,
  processNewsletterConfirm,
  processStaffInvite,
  processStaffPasswordReset,
  readOrganisationEmail,
  type CommunicationsDeps,
} from './communications.processor.js';

/**
 * Phase 13 email processors, against the REAL local database (the same one the
 * API integration tests use) and a FAKE email provider (`fetch` is stubbed).
 *
 * The rows each test creates are tagged with this run's id and removed after.
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
const ORG = `org-${RUN}@worker-test.local`;
let database: DatabaseClient;
const created = { contacts: [] as string[], subscribers: [] as string[], users: [] as string[] };

const logs: unknown[] = [];
const logger = {
  info: (...args: unknown[]) => logs.push(args),
  warn: (...args: unknown[]) => logs.push(args),
  error: (...args: unknown[]) => logs.push(args),
  debug: (...args: unknown[]) => logs.push(args),
} as never;

function deps(overrides: Partial<CommunicationsDeps> = {}): CommunicationsDeps {
  return {
    database,
    brevo: { apiKey: 'test-key', senderEmail: 'noreply@worker-test.local', senderName: 'Test' },
    appUrl: 'https://sailent.example/',
    organisationEmail: async () => ORG,
    ...overrides,
  };
}

function job<T>(data: T, attemptsMade = 0): Job<T> {
  return { id: `job-${RUN}`, data, attemptsMade } as Job<T>;
}

/** Stub Brevo: each call answers with the next status, and the request bodies are kept. */
function brevo(...statuses: number[]) {
  const sent: { to: string; subject: string; html: string; text: string }[] = [];
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      to: { email: string }[];
      subject: string;
      htmlContent: string;
      textContent: string;
    };
    sent.push({
      to: body.to[0]!.email,
      subject: body.subject,
      html: body.htmlContent,
      text: body.textContent,
    });
    const status = statuses.shift() ?? 201;
    return new Response(JSON.stringify(status < 300 ? { messageId: `m-${RUN}` } : {}), { status });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { sent, fetchMock };
}

async function contact(message = 'Hello, I would like to help with the school kits.') {
  const [row] = await database.db
    .insert(contactMessages)
    .values({ name: 'Asha', email: `asha-${RUN}@worker-test.local`, subject: 'general', message })
    .returning({ id: contactMessages.id });
  created.contacts.push(row!.id);
  return row!.id;
}

async function sendLog(type: string, key: string, id: string) {
  return database.db
    .select()
    .from(notifications)
    .where(sql`${notifications.type} = ${type} AND ${notifications.data}->>${key} = ${id}`);
}

beforeAll(() => {
  database = createDatabaseClient({ connectionString, maxConnections: 2 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(async () => {
  for (const id of created.contacts) {
    await database.db
      .delete(notifications)
      .where(sql`${notifications.data}->>'contactMessageId' = ${id}`);
  }
  for (const id of created.subscribers) {
    await database.db
      .delete(notifications)
      .where(sql`${notifications.data}->>'subscriberId' = ${id}`);
  }
  for (const id of created.users) {
    await database.db.delete(notifications).where(sql`${notifications.data}->>'userId' = ${id}`);
  }
  if (created.contacts.length) {
    await database.db.delete(contactMessages).where(inArray(contactMessages.id, created.contacts));
  }
  if (created.subscribers.length) {
    await database.db
      .delete(newsletterSubscribers)
      .where(inArray(newsletterSubscribers.id, created.subscribers));
  }
  if (created.users.length) {
    await database.db.delete(users).where(inArray(users.id, created.users));
  }
  await database.close();
});

describe('contact.received', () => {
  it('emails the message to the organisation and records the send by id only', async () => {
    const id = await contact();
    const { sent } = brevo(201);

    const result = await processContactReceived(job({ contactMessageId: id }), deps(), logger);

    expect(result).toEqual({ sent: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(ORG);
    expect(sent[0]!.text).toContain('school kits');
    const [row] = await sendLog('contact.received', 'contactMessageId', id);
    expect(row).toMatchObject({ status: 'sent', channel: 'email' });
    expect(row!.data).toEqual({ contactMessageId: id });
  });

  it('does not email the same message twice, whatever re-enqueues it', async () => {
    const id = await contact();
    brevo(201);
    await processContactReceived(job({ contactMessageId: id }), deps(), logger);

    const second = brevo(201);
    const result = await processContactReceived(job({ contactMessageId: id }), deps(), logger);

    expect(result).toEqual({ sent: false, reason: 'already_sent' });
    expect(second.fetchMock).not.toHaveBeenCalled();
  });

  it('throws on an unreachable provider so BullMQ retries, then sends on the retry', async () => {
    const id = await contact();
    brevo(503);
    await expect(
      processContactReceived(job({ contactMessageId: id }), deps(), logger),
    ).rejects.toThrow(/unreachable/);

    brevo(201);
    const retry = await processContactReceived(job({ contactMessageId: id }, 1), deps(), logger);
    expect(retry).toEqual({ sent: true });

    const rows = await sendLog('contact.received', 'contactMessageId', id);
    expect(rows.map((row) => row.status).sort()).toEqual(['failed', 'sent']);
  });

  it('records a permanent rejection as failed without throwing (no retry storm)', async () => {
    const id = await contact();
    brevo(400);

    const result = await processContactReceived(job({ contactMessageId: id }), deps(), logger);

    expect(result).toEqual({ sent: false });
    const [row] = await sendLog('contact.received', 'contactMessageId', id);
    expect(row).toMatchObject({ status: 'failed' });
    expect(row!.error).toMatch(/^rejected/);
  });

  it('keeps the message and records why when no organisation email is set', async () => {
    const id = await contact();
    const { fetchMock } = brevo(201);

    const result = await processContactReceived(
      job({ contactMessageId: id }),
      deps({ organisationEmail: async () => null }),
      logger,
    );

    expect(result).toEqual({ sent: false, reason: 'no_address' });
    expect(fetchMock).not.toHaveBeenCalled();
    const [message] = await database.db
      .select()
      .from(contactMessages)
      .where(eq(contactMessages.id, id));
    expect(message?.status).toBe('new');
    const [row] = await sendLog('contact.received', 'contactMessageId', id);
    expect(row).toMatchObject({ status: 'failed' });
  });

  it('escapes the message in the HTML email', async () => {
    const id = await contact('<script>alert("x")</script> please call me back');
    const { sent } = brevo(201);

    await processContactReceived(job({ contactMessageId: id }), deps(), logger);

    expect(sent[0]!.html).not.toContain('<script>');
    expect(sent[0]!.html).toContain('&lt;script&gt;');
    expect(escapeHtml(`"'<>&`)).toBe('&quot;&#39;&lt;&gt;&amp;');
  });

  it('reads the organisation email from the organization_contact setting', async () => {
    const [row] = await database.db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, 'organization_contact'));
    const expected = (row?.value as { email?: string | null } | undefined)?.email ?? null;
    expect(await readOrganisationEmail(database.db)).toBe(expected);
  });
});

describe('newsletter.confirm', () => {
  async function subscriber(status: 'pending' | 'subscribed') {
    const [row] = await database.db
      .insert(newsletterSubscribers)
      .values({
        email: `reader-${RUN}-${created.subscribers.length}@worker-test.local`,
        status,
        confirmedAt: status === 'subscribed' ? new Date() : null,
      })
      .returning({ id: newsletterSubscribers.id, email: newsletterSubscribers.email });
    created.subscribers.push(row!.id);
    return row!;
  }

  it('sends the confirmation and unsubscribe links, and logs neither token nor address', async () => {
    const reader = await subscriber('pending');
    const { sent } = brevo(201);
    logs.length = 0;
    const confirmToken = 'C'.repeat(43);
    const unsubscribeToken = 'U'.repeat(43);

    const result = await processNewsletterConfirm(
      job({ subscriberId: reader.id, confirmToken, unsubscribeToken }),
      deps(),
      logger,
    );

    expect(result).toEqual({ sent: true });
    expect(sent[0]!.to).toBe(reader.email);
    expect(sent[0]!.text).toContain(
      `https://sailent.example/newsletter/confirm?token=${confirmToken}`,
    );
    expect(sent[0]!.text).toContain(`/newsletter/unsubscribe?token=${unsubscribeToken}`);

    const [row] = await sendLog('newsletter.confirm', 'subscriberId', reader.id);
    expect(row!.data).toEqual({ subscriberId: reader.id });
    expect(JSON.stringify(logs)).not.toContain(confirmToken);
    expect(JSON.stringify(logs)).not.toContain(reader.email);
  });

  it('sends nothing to an address that is already subscribed', async () => {
    const reader = await subscriber('subscribed');
    const { fetchMock } = brevo(201);

    const result = await processNewsletterConfirm(
      job({
        subscriberId: reader.id,
        confirmToken: 'C'.repeat(43),
        unsubscribeToken: 'U'.repeat(43),
      }),
      deps(),
      logger,
    );

    expect(result).toEqual({ sent: false, reason: 'not_pending' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('staff.invite and staff.password_reset', () => {
  async function staff(status: 'invited' | 'active' | 'suspended') {
    const [row] = await database.db
      .insert(users)
      .values({
        email: `staff-${RUN}-${created.users.length}@worker-test.local`,
        firstName: 'Ravi',
        status,
        passwordHash: 'x',
      })
      .returning({ id: users.id, email: users.email });
    created.users.push(row!.id);
    return row!;
  }

  it('emails an invitation link with the token after #, and records no token', async () => {
    const invitee = await staff('invited');
    const { sent } = brevo(201);
    const token = 'T'.repeat(43);

    const result = await processStaffInvite(job({ userId: invitee.id, token }), deps(), logger);

    expect(result).toEqual({ sent: true });
    expect(sent[0]!.to).toBe(invitee.email);
    expect(sent[0]!.text).toContain(`https://sailent.example/admin/accept-invite#token=${token}`);
    const [row] = await sendLog('staff.invite', 'userId', invitee.id);
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it('sends no invitation to an account that is already active', async () => {
    const member = await staff('active');
    const { fetchMock } = brevo(201);
    const result = await processStaffInvite(
      job({ userId: member.id, token: 'T'.repeat(43) }),
      deps(),
      logger,
    );
    expect(result).toEqual({ sent: false, reason: 'not_applicable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('emails a reset link to an active account, and nothing to a suspended one', async () => {
    const member = await staff('active');
    const suspended = await staff('suspended');
    const { sent, fetchMock } = brevo(201);
    const token = 'R'.repeat(43);

    await processStaffPasswordReset(job({ userId: member.id, token }), deps(), logger);
    const refused = await processStaffPasswordReset(
      job({ userId: suspended.id, token }),
      deps(),
      logger,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent[0]!.text).toContain(`/admin/reset-password#token=${token}`);
    expect(refused).toEqual({ sent: false, reason: 'not_applicable' });
  });
});
