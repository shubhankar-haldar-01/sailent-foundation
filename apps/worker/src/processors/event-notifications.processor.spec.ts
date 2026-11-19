import { randomUUID } from 'node:crypto';

import type { Job } from 'bullmq';
import { eq, inArray, sql } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadRootEnvFile } from '@sailent/config/dotenv';
import {
  createDatabaseClient,
  eventRegistrations,
  events,
  notificationTemplates,
  notifications,
  type DatabaseClient,
} from '@sailent/database';

import { SAILENT_LOGO_PNG } from '../assets/sailent-logo.js';
import { createMailer } from '../lib/email.js';
import { renderPassPdf } from '../lib/pass-pdf.js';
import { renderFromTemplate } from '../lib/templates.js';
import {
  passQrPng,
  processEventRegistrationConfirmed,
  type EventRegistrationConfirmedJob,
} from './event-notifications.processor.js';

/*
  The stored template is the test's to set: the seeded one (version 1), an
  administrator's edit (version 2), or none. Its wording is content, not code.
*/
vi.mock('../lib/templates.js', () => ({ renderFromTemplate: vi.fn() }));
const templateMock = vi.mocked(renderFromTemplate);
// The real PDF, unless a test makes it fail.
vi.mock('../lib/pass-pdf.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/pass-pdf.js')>();
  return { ...actual, renderPassPdf: vi.fn(actual.renderPassPdf) };
});
const pdfMock = vi.mocked(renderPassPdf);
// The send log records the template by id, so it is the real template's.
let templateId = '';
const seeded = () => ({
  subject: 'You’re registered — Mela',
  html: '<p>Seeded wording.</p>',
  text: 'Seeded wording.',
  templateId,
  templateVersion: 1,
});

/**
 * The registration confirmation, against the REAL local database and a FAKE
 * Resend (the SDK runs; its `fetch` is stubbed). No email leaves the machine.
 * Each test makes its own event and booking, removed after.
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
const created = { events: [] as string[], registrations: [] as string[] };

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

function job(registrationId: string): Job<EventRegistrationConfirmedJob> {
  return {
    id: `job-${RUN}`,
    data: { registrationId },
    attemptsMade: 0,
  } as Job<EventRegistrationConfirmedJob>;
}

async function event(isPaid: boolean) {
  const [row] = await database.db
    .insert(events)
    .values({
      title: `Mela ${RUN}`,
      slug: `mela-${RUN}-${created.events.length + 1}`,
      startDate: new Date('2026-12-20T04:30:00.000Z'),
      venueName: 'Ramson Plaza',
      city: 'Patna',
      isPaid,
      feeAmount: isPaid ? 5_100 : null,
    })
    .returning({ id: events.id, slug: events.slug });
  created.events.push(row!.id);
  return row!;
}

async function booking(eventId: string, values: Partial<typeof eventRegistrations.$inferInsert>) {
  const [row] = await database.db
    .insert(eventRegistrations)
    .values({
      eventId,
      fullName: 'Asha Verma',
      email: `asha-${RUN}-${created.registrations.length + 1}@worker-test.local`,
      phone: '9876543210',
      ...values,
    })
    .returning({ id: eventRegistrations.id, email: eventRegistrations.email });
  created.registrations.push(row!.id);
  return row!;
}

interface SentEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments: { filename: string; content: string; content_type?: string; content_id?: string }[];
}

function resend() {
  const sent: SentEmail[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as SentEmail & { to: string[] };
      sent.push({ ...body, to: body.to[0]!, attachments: body.attachments ?? [] });
      return new Response(JSON.stringify({ id: `m-${RUN}-${sent.length}` }), { status: 200 });
    }),
  );
  return sent;
}

beforeAll(async () => {
  database = createDatabaseClient({ connectionString, maxConnections: 2 });
  const [template] = await database.db
    .select({ id: notificationTemplates.id })
    .from(notificationTemplates)
    .where(eq(notificationTemplates.slug, 'event.registration.confirmed'))
    .limit(1);
  templateId = template!.id;
});

beforeEach(() => {
  templateMock.mockReset().mockResolvedValue(seeded());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(async () => {
  const { db } = database;
  for (const id of created.registrations) {
    await db.delete(notifications).where(sql`${notifications.data}->>'registrationId' = ${id}`);
  }
  if (created.registrations.length) {
    await db
      .delete(eventRegistrations)
      .where(inArray(eventRegistrations.id, created.registrations));
  }
  if (created.events.length) {
    await db.delete(events).where(inArray(events.id, created.events));
  }
  await database.close();
});

describe('event.registration.confirmed', () => {
  it('sends a paid group booking its PDF passes and the payment summary', async () => {
    const paidEvent = await event(true);
    const passes = [
      { fullName: 'Asha Verma', passNumber: `SF-EVT-${RUN.toUpperCase()}-1` },
      { fullName: 'Deep Kumar', passNumber: `SF-EVT-${RUN.toUpperCase()}-2` },
    ];
    const group = await booking(paidEvent.id, {
      attendeeCount: 2,
      attendees: passes,
      paidAmount: 10_200,
      paymentId: `pay_T${RUN}`,
      orderId: `order_T${RUN}`,
      registeredAt: new Date('2026-11-18T17:25:24.000Z'),
    });
    const sent = resend();

    const result = await processEventRegistrationConfirmed(job(group.id), deps(), logger);

    expect(result).toEqual({ sent: true });
    expect(sent).toHaveLength(1);
    const email = sent[0]!;
    expect(email.to).toBe(group.email);
    // The stored template still sets the subject.
    expect(email.subject).toBe('You’re registered — Mela');

    // The professional layout: logo, confirmation, event, payment. The passes
    // are the attached PDF's, so the body does not list them.
    expect(email.html).toContain('src="cid:sailent-logo"');
    expect(email.html).toContain('BOOKING CONFIRMED');
    expect(email.html).toContain(`going to Mela ${RUN}!`);
    expect(email.html).toContain('attached to this email as a PDF');
    for (const pass of passes) {
      expect(email.html).not.toContain(pass.passNumber);
      expect(email.text).not.toContain(pass.passNumber);
    }
    expect(email.html).not.toContain('cid:pass-');
    expect(email.text).toContain('Entry passes x 2 (₹51 each): ₹102');
    expect(email.text).toContain('Total paid: ₹102');
    expect(email.text).toContain('Payment method: Online (Razorpay)');
    expect(email.text).toContain(`Payment reference: pay_T${RUN}`);
    expect(email.text).toContain('Paid on: 18 November 2026 at 10:55 pm');
    // The seeded template's body is not repeated in the new layout.
    expect(email.html).not.toContain('Seeded wording.');

    // Attachments: the logo inline, and the passes as a PDF — nothing else.
    const byName = new Map(email.attachments.map((file) => [file.filename, file]));
    expect(byName.get('sailent-foundation.png')).toMatchObject({ content_id: 'sailent-logo' });
    expect(byName.get('sailent-foundation.png')!.content).toBe(SAILENT_LOGO_PNG.toString('base64'));
    expect(email.attachments).toHaveLength(2);
    const reference = `SF-EVT-${group.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const pdfFile = byName.get(`Entry-passes-${reference}.pdf`)!;
    expect(pdfFile).toBeDefined();
    expect(pdfFile.content_type).toBe('application/pdf');
    const pdf = await PDFDocument.load(Buffer.from(pdfFile.content, 'base64'));
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getTitle()).toBe(`Entry passes – Mela ${RUN}`);
  });

  it('sends a free booking its pass and PDF, and no payment section', async () => {
    const freeEvent = await event(false);
    const single = await booking(freeEvent.id, { attendeeCount: 1, attendees: [] });
    const sent = resend();

    const result = await processEventRegistrationConfirmed(job(single.id), deps(), logger);

    expect(result).toEqual({ sent: true });
    const email = sent[0]!;
    const passNumber = `SF-EVT-${single.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    expect(email.text).not.toContain(passNumber);
    expect(email.html).not.toContain('Payment summary');
    const files = email.attachments.map((file) => file.filename);
    expect(files).toEqual(['sailent-foundation.png', `Entry-pass-${passNumber}.pdf`]);
    const pdfFile = email.attachments.find((file) => file.filename.endsWith('.pdf'))!;
    expect((await PDFDocument.load(Buffer.from(pdfFile.content, 'base64'))).getPageCount()).toBe(1);
  });

  it('shows an administrator’s edited template as a note, and uses its subject', async () => {
    templateMock.mockResolvedValue({
      ...seeded(),
      subject: 'See you at the Mela',
      html: '<p>Bring a water bottle.</p>',
      text: 'Bring a water bottle.',
      templateVersion: 2,
    });
    const freeEvent = await event(false);
    const single = await booking(freeEvent.id, { attendeeCount: 1, attendees: [] });
    const sent = resend();

    await processEventRegistrationConfirmed(job(single.id), deps(), logger);

    expect(sent[0]!.subject).toBe('See you at the Mela');
    expect(sent[0]!.html).toContain('A note from the organisers');
    expect(sent[0]!.html).toContain('<p>Bring a water bottle.</p>');
  });

  it('falls back to listing the passes with their QR codes when the PDF cannot be made', async () => {
    pdfMock.mockRejectedValueOnce(new Error('cannot draw'));
    const freeEvent = await event(false);
    const single = await booking(freeEvent.id, { attendeeCount: 1, attendees: [] });
    const sent = resend();

    const result = await processEventRegistrationConfirmed(job(single.id), deps(), logger);

    expect(result).toEqual({ sent: true });
    const email = sent[0]!;
    const passNumber = `SF-EVT-${single.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    expect(email.html).toContain('>Your entry pass</h2>');
    expect(email.html).toContain('src="cid:pass-1"');
    expect(email.text).toContain(`Asha Verma, ${passNumber}`);
    const files = email.attachments.map((file) => file.filename);
    expect(files).toEqual(['sailent-foundation.png', `${passNumber}.png`]);
    const qr = email.attachments.find((file) => file.filename === `${passNumber}.png`)!;
    expect(qr.content).toBe((await passQrPng(passNumber)).toString('base64'));
  });
});
