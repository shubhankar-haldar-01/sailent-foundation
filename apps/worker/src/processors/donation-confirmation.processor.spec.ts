import { randomInt, randomUUID } from 'node:crypto';
import { inflateSync } from 'node:zlib';

import type { Job } from 'bullmq';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadRootEnvFile } from '@sailent/config/dotenv';
import {
  createDatabaseClient,
  donationItems,
  donations,
  donors,
  notificationTemplates,
  notifications,
  receipts,
  type DatabaseClient,
} from '@sailent/database';
import { SAILENT_LOGO_PNG, renderReceiptPdf } from '@sailent/documents';

import { PDFDocument } from 'pdf-lib';

import { createMailer } from '../lib/email.js';
import { renderFromTemplate, type RenderedTemplate } from '../lib/templates.js';
import {
  processDonationConfirmation,
  type DonationConfirmationJob,
} from './donation-confirmation.processor.js';

/*
  The stored template is the test's to set: none (the default here), the
  shipped wording, or an administrator's edit. Its wording is content, not code.
*/
vi.mock('../lib/templates.js', () => ({ renderFromTemplate: vi.fn(async () => null) }));
const templateMock = vi.mocked(renderFromTemplate);
// The real PDF, unless a test makes it fail.
vi.mock('@sailent/documents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sailent/documents')>();
  return { ...actual, renderReceiptPdf: vi.fn(actual.renderReceiptPdf) };
});
const pdfMock = vi.mocked(renderReceiptPdf);

// The send log records the template by id, so it is the real template's.
let templateId = '';

/** Every string drawn in a PDF, as the hex pdf-lib writes it, upper-case. */
function drawnText(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  let text = '';
  for (const match of raw.matchAll(/stream\r?\n/g)) {
    const start = match.index + match[0].length;
    try {
      text += inflateSync(pdf.subarray(start, raw.indexOf('endstream', start))).toString('latin1');
    } catch {
      // An image or font stream, not page text.
    }
  }
  return text.toUpperCase();
}
const hex = (value: string) =>
  Buffer.from(value.replace(/•/g, '\x95'), 'latin1').toString('hex').toUpperCase();

/** What `renderFromTemplate` returns for a stored template. */
const template = (overrides: Partial<RenderedTemplate>): RenderedTemplate => ({
  subject: 'Thank you — your donation to School kits for Ward 12',
  html: '<p>Shipped wording.</p>',
  text: 'Shipped wording.',
  templateId,
  templateVersion: 1,
  customised: false,
  ...overrides,
});

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
async function donation(
  status: 'successful' | 'pending',
  receiptLines: {
    itemName: string;
    itemType: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[] = [],
) {
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
      lineItems: receiptLines,
      paymentReference: `pay_T${RUN}`,
      // 19:00 UTC on the 17th is 00:30 on the 18th in India.
      issuedAt: new Date('2026-11-17T19:00:00.000Z'),
    });
  }
  return { id: row!.id, reference: row!.reference, receiptNumber, email: donor!.email! };
}

/** Resend answering each call with the next status; requests are kept. */
function resend(...statuses: number[]) {
  const sent: {
    to: string;
    subject: string;
    html: string;
    text: string;
    key: string | null;
    attachments: { filename: string; content: string; content_id?: string }[];
  }[] = [];
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      to: string[];
      subject: string;
      html: string;
      text: string;
      attachments?: { filename: string; content: string; content_id?: string }[];
    };
    sent.push({
      to: body.to[0]!,
      subject: body.subject,
      html: body.html,
      text: body.text,
      key: new Headers(init.headers).get('idempotency-key'),
      attachments: body.attachments ?? [],
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

beforeAll(async () => {
  database = createDatabaseClient({ connectionString, maxConnections: 2 });
  const [row] = await database.db
    .select({ id: notificationTemplates.id })
    .from(notificationTemplates)
    .where(eq(notificationTemplates.slug, 'donation.confirmation'))
    .limit(1);
  templateId = row!.id;
});

afterEach(() => {
  vi.unstubAllGlobals();
  templateMock.mockResolvedValue(null);
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
  it('attaches the receipt as a PDF, with the logo inline, in a thank-you laid out as a receipt', async () => {
    const gift = await donation('successful');
    const { sent } = resend();

    await processDonationConfirmation(
      job({ donationId: gift.id, receiptNumber: gift.receiptNumber }),
      deps(),
      logger,
    );

    const email = sent[0]!;
    expect(email.attachments.map((file) => file.filename)).toEqual([
      'sailent-foundation.png',
      `Donation-receipt-${gift.receiptNumber}.pdf`,
    ]);
    const logo = email.attachments[0]!;
    expect(logo.content_id).toBe('sailent-logo');
    expect(logo.content).toBe(SAILENT_LOGO_PNG.toString('base64'));
    const pdf = await PDFDocument.load(Buffer.from(email.attachments[1]!.content, 'base64'));
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe(`Donation receipt ${gift.receiptNumber}`);

    // The emailed copy is the donor's own: the payment id, and their email masked.
    const raw = Buffer.from(email.attachments[1]!.content, 'base64');
    const text = drawnText(raw);
    expect(text).toContain(hex(`pay_T${RUN}`));
    expect(text).toContain(hex('don•••••@worker-test.local'));
    expect(text).not.toContain(hex(gift.email));

    // The order a donor reads it in.
    const order = [
      'DONATION RECEIVED',
      'Thank you, Asha!',
      'Amount donated',
      'Your gift',
      'Receipt details',
      'About your receipt',
      'Need help?',
    ].map((marker) => email.html.indexOf(marker));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(email.html).toContain('src="cid:sailent-logo"');
    expect(email.html).toContain('attached to this email as a PDF');
    expect(email.html).not.toContain('A note from our team');
  });

  it('shows the lines the receipt froze, not the ones the donation has now', async () => {
    const gift = await donation('successful', [
      {
        itemName: 'Frozen line',
        itemType: 'custom',
        quantity: 1,
        unitPrice: 150_000,
        totalPrice: 150_000,
      },
    ]);
    const { sent } = resend();

    await processDonationConfirmation(
      job({ donationId: gift.id, receiptNumber: gift.receiptNumber }),
      deps(),
      logger,
    );

    expect(sent[0]!.html).toContain('Frozen line');
    // The donation's own second line, which the receipt did not freeze.
    expect(sent[0]!.html).not.toContain('Where it is needed most');
  });

  it('shows an administrator’s edited template as a note, and uses its subject', async () => {
    templateMock.mockResolvedValue(
      template({
        subject: 'With thanks from the whole team',
        html: '<p>Your kits reach Ward 12 next week.</p>',
        text: 'Your kits reach Ward 12 next week.',
        templateVersion: 7,
        customised: true,
      }),
    );
    const gift = await donation('successful');
    const { sent } = resend();

    await processDonationConfirmation(
      job({ donationId: gift.id, receiptNumber: gift.receiptNumber }),
      deps(),
      logger,
    );

    expect(sent[0]!.subject).toBe('With thanks from the whole team');
    expect(sent[0]!.html).toContain('A note from our team');
    expect(sent[0]!.html).toContain('<p>Your kits reach Ward 12 next week.</p>');
    expect(sent[0]!.text).toContain('Your kits reach Ward 12 next week.');
  });

  it('does not repeat the shipped wording as a note, however high its version', async () => {
    // Reverts and test runs raise the version without anyone writing a word.
    templateMock.mockResolvedValue(template({ templateVersion: 104, customised: false }));
    const gift = await donation('successful');
    const { sent } = resend();

    await processDonationConfirmation(
      job({ donationId: gift.id, receiptNumber: gift.receiptNumber }),
      deps(),
      logger,
    );

    expect(sent[0]!.html).not.toContain('A note from our team');
    expect(sent[0]!.html).not.toContain('Shipped wording.');
  });

  it('still sends every receipt detail when the PDF cannot be made', async () => {
    pdfMock.mockRejectedValueOnce(new Error('cannot draw'));
    const gift = await donation('successful');
    const { sent } = resend();

    const result = await processDonationConfirmation(
      job({ donationId: gift.id, receiptNumber: gift.receiptNumber }),
      deps(),
      logger,
    );

    expect(result).toEqual({ sent: true });
    const email = sent[0]!;
    expect(email.attachments.map((file) => file.filename)).toEqual(['sailent-foundation.png']);
    expect(email.html).not.toContain('attached to this email as a PDF');
    for (const detail of [gift.receiptNumber, gift.reference, `pay_T${RUN}`, '₹1,500']) {
      expect(email.html).toContain(detail);
    }
    expect(email.text).toContain('not a tax-exemption certificate');
  });
});
