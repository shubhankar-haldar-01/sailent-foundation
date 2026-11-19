import { randomInt, randomUUID } from 'node:crypto';

import type { Job } from 'bullmq';
import { inArray, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadRootEnvFile } from '@sailent/config/dotenv';
import {
  createDatabaseClient,
  donationItems,
  donations,
  donors,
  notifications,
  receipts,
  type DatabaseClient,
} from '@sailent/database';

import { createMailer } from '../lib/email.js';
import {
  processDonationConfirmation,
  type DonationConfirmationJob,
} from './donation-confirmation.processor.js';

/*
  The built-in wording is what these tests read. A stored template, when an
  administrator has one active, replaces it (`lib/templates.ts`) — that is
  template content, not this code, so the lookup is taken out here.
*/
vi.mock('../lib/templates.js', () => ({ renderFromTemplate: vi.fn(async () => null) }));

/**
 * The donor's confirmation and receipt, against the REAL local database and a
 * FAKE Resend (the SDK runs; its `fetch` is stubbed). No email leaves the
 * machine. Each test makes its own donor, donation and receipt — in financial
 * year 1990, far from any real receipt book — and they are removed after.
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
let database: DatabaseClient;
const created: { donationId: string; donorId: string }[] = [];

const logs: unknown[] = [];
const logger = {
  info: (...args: unknown[]) => logs.push(args),
  warn: (...args: unknown[]) => logs.push(args),
  error: (...args: unknown[]) => logs.push(args),
  debug: (...args: unknown[]) => logs.push(args),
} as never;

const deps = () => ({
  database,
  mailer: createMailer({
    apiKey: 're_test_worker_key',
    from: 'Sailent Foundation <noreply@worker-test.local>',
  }),
  appUrl: 'https://sailent.example',
});

function job(data: DonationConfirmationJob, attemptsMade = 0): Job<DonationConfirmationJob> {
  return { id: `job-${RUN}`, data, attemptsMade } as Job<DonationConfirmationJob>;
}

/** A donor, a donation with two lines, and — once captured — its receipt. */
async function donation(status: 'successful' | 'pending') {
  const tag = `${RUN}-${created.length + 1}`;
  const { db } = database;
  const [donor] = await db
    .insert(donors)
    .values({
      donorCode: `T-${tag}`,
      firstName: 'Asha',
      lastName: 'Verma',
      phone: `9${randomInt(100_000_000, 1_000_000_000)}`,
      email: `donor-${tag}@worker-test.local`,
    })
    .returning({ id: donors.id, email: donors.email });
  const [row] = await db
    .insert(donations)
    .values({ reference: `TST-${tag}`, amount: 150_000, status, donorId: donor!.id })
    .returning({ id: donations.id, reference: donations.reference });
  created.push({ donationId: row!.id, donorId: donor!.id });
  // Custom amounts: a product line must point at a real catalogue product.
  await db.insert(donationItems).values([
    {
      donationId: row!.id,
      itemType: 'custom',
      itemName: 'School kits',
      quantity: 1,
      unitPrice: 100_000,
      totalPrice: 100_000,
    },
    {
      donationId: row!.id,
      itemType: 'custom',
      itemName: 'Where it is needed most',
      quantity: 1,
      unitPrice: 50_000,
      totalPrice: 50_000,
    },
  ]);

  const receiptNumber = `TST-${tag}`;
  if (status === 'successful') {
    await db.insert(receipts).values({
      receiptNumber,
      financialYear: 1990,
      sequence: randomInt(1, 2_000_000_000),
      donationId: row!.id,
      donorId: donor!.id,
      donorName: 'Asha Verma',
      campaignTitle: 'School kits for Ward 12',
      amount: 150_000,
      lineItems: [],
      paymentReference: `pay_T${RUN}`,
      // 19:00 UTC on the 17th is 00:30 on the 18th in India.
      issuedAt: new Date('2026-11-17T19:00:00.000Z'),
    });
  }
  return { id: row!.id, reference: row!.reference, receiptNumber, email: donor!.email! };
}

/** Resend answering each call with the next status; requests are kept. */
function resend(...statuses: number[]) {
  const sent: { to: string; subject: string; html: string; text: string; key: string | null }[] =
    [];
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      to: string[];
      subject: string;
      html: string;
      text: string;
    };
    sent.push({
      to: body.to[0]!,
      subject: body.subject,
      html: body.html,
      text: body.text,
      key: new Headers(init.headers).get('idempotency-key'),
    });
    const status = statuses.shift() ?? 200;
    const answer =
      status < 300
        ? { id: `m-${RUN}-${sent.length}` }
        : { statusCode: status, name: 'internal_server_error', message: 'stubbed outage' };
    return new Response(JSON.stringify(answer), { status });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { sent, fetchMock };
}

async function sendLog(donationId: string) {
  return database.db
    .select()
    .from(notifications)
    .where(
      sql`${notifications.type} = 'donation.confirmation' AND ${notifications.data}->>'donationId' = ${donationId}`,
    );
}

beforeAll(() => {
  database = createDatabaseClient({ connectionString, maxConnections: 2 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(async () => {
  const { db } = database;
  const donationIds = created.map((entry) => entry.donationId);
  if (donationIds.length) {
    // The send log and any staff alert both carry the donation id.
    for (const id of donationIds) {
      await db.delete(notifications).where(sql`${notifications.data}->>'donationId' = ${id}`);
    }
    await db.delete(receipts).where(inArray(receipts.donationId, donationIds));
    await db.delete(donationItems).where(inArray(donationItems.donationId, donationIds));
    await db.delete(donations).where(inArray(donations.id, donationIds));
    await db.delete(donors).where(
      inArray(
        donors.id,
        created.map((entry) => entry.donorId),
      ),
    );
  }
  await database.close();
});

describe('donation.confirmation', () => {
  it('sends the receipt for a captured donation, with the real figures and the date in IST', async () => {
    const gift = await donation('successful');
    const { sent } = resend(200);

    const result = await processDonationConfirmation(
      job({ donationId: gift.id, receiptNumber: gift.receiptNumber }),
      deps(),
      logger,
    );

    expect(result).toEqual({ sent: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(gift.email);
    expect(sent[0]!.subject).toBe('Thank you — your donation to School kits for Ward 12');
    for (const body of [sent[0]!.text, sent[0]!.html]) {
      expect(body).toContain('Asha Verma');
      expect(body).toContain('₹1,500');
      expect(body).toContain(gift.receiptNumber);
      expect(body).toContain(gift.reference);
      expect(body).toContain(`pay_T${RUN}`);
      expect(body).toContain('18 November 2026');
    }
    expect(sent[0]!.text).toContain('not a tax-exemption certificate');
    expect(sent[0]!.html.startsWith('<!doctype html>')).toBe(true);

    const [row] = await sendLog(gift.id);
    expect(row).toMatchObject({ status: 'sent', providerMessageId: `m-${RUN}-1` });
    expect(row!.data).toEqual({
      donationId: gift.id,
      receiptNumber: gift.receiptNumber,
      reference: gift.reference,
    });
  });

  it('sends nothing for a donation that is not captured', async () => {
    const gift = await donation('pending');
    const { fetchMock } = resend(200);

    const result = await processDonationConfirmation(
      job({ donationId: gift.id, receiptNumber: gift.receiptNumber }),
      deps(),
      logger,
    );

    expect(result).toEqual({ sent: false, reason: 'status_pending' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await sendLog(gift.id)).toHaveLength(0);
  });

  it('repeats the same idempotency key when the same confirmation runs again', async () => {
    const gift = await donation('successful');
    const { sent } = resend(200, 200);

    for (const attempt of [0, 1]) {
      await processDonationConfirmation(
        job({ donationId: gift.id, receiptNumber: gift.receiptNumber }, attempt),
        deps(),
        logger,
      );
    }

    expect(sent).toHaveLength(2);
    expect(sent[0]!.key).toMatch(/^donation-confirmation-[0-9a-f]{32}$/);
    // Resend answers a repeated key without sending the email again.
    expect(sent[1]!.key).toBe(sent[0]!.key);
  });

  it('records a Resend outage and throws, so the queue tries again', async () => {
    const gift = await donation('successful');
    resend(500);

    await expect(
      processDonationConfirmation(
        job({ donationId: gift.id, receiptNumber: gift.receiptNumber }),
        deps(),
        logger,
      ),
    ).rejects.toThrow(/unreachable/);

    const [row] = await sendLog(gift.id);
    expect(row).toMatchObject({ status: 'failed' });
    expect(row!.error).toMatch(/^unreachable: internal_server_error \(500\)/);
  });
});
