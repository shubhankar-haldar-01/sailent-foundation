import { inflateSync } from 'node:zlib';

import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import {
  maskEmail,
  maskPhone,
  organisationFromSettings,
  type ReceiptPdfOrganisation,
} from '../organisation.js';
import { renderReceiptPdf, type ReceiptPdfInput } from '../receipt-pdf.js';

const ORG: ReceiptPdfOrganisation = {
  name: 'Sailent Foundation',
  addressLine: null,
  email: null,
  phone: null,
  pan: null,
  section80G: null,
  section12A: null,
};

const input = (overrides: Partial<ReceiptPdfInput> = {}): ReceiptPdfInput => ({
  receiptNumber: 'SFL-2026-000123',
  issuedAt: new Date('2026-11-18T20:45:00.000Z'),
  donor: { name: 'Asha Verma' },
  organisation: ORG,
  campaignTitle: 'School kits for Ward 12',
  programTitle: 'Education',
  amount: 251_050,
  lines: [
    {
      itemName: 'School kit',
      itemType: 'product',
      quantity: 3,
      unitPrice: 75_000,
      totalPrice: 225_000,
    },
    {
      itemName: 'Additional donation',
      itemType: 'custom',
      quantity: 1,
      unitPrice: 26_050,
      totalPrice: 26_050,
    },
  ],
  donationReference: 'DON-7K2MPQ4X',
  paymentReference: null,
  registrationNumber: null,
  verifyUrl: 'https://sailent.example/donation/DON-7K2MPQ4X',
  ...overrides,
});

/** Every string drawn in the PDF, as the hex pdf-lib writes it, upper-case. */
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
/** How a string appears in `drawnText` (WinAnsi bytes as hex; • is 0x95). */
const hex = (value: string) =>
  Buffer.from(value.replace(/•/g, '\x95'), 'latin1').toString('hex').toUpperCase();

describe('renderReceiptPdf', () => {
  it('draws an ordinary gift on one A4 page, titled with the receipt number', async () => {
    const pdf = await PDFDocument.load(await renderReceiptPdf(input()));

    expect(pdf.getPageCount()).toBe(1);
    const { width, height } = pdf.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([595, 842]);
    expect(pdf.getTitle()).toBe('Donation receipt SFL-2026-000123');
  });

  it('gives the same bytes for the same receipt, so a retried email carries the same file', async () => {
    const first = await renderReceiptPdf(input());
    const second = await renderReceiptPdf(input());

    expect(Buffer.compare(first, second)).toBe(0);
  });

  it('prints the donor’s email and phone masked, never as given', async () => {
    const text = drawnText(
      await renderReceiptPdf(
        input({
          donor: {
            name: 'Asha Verma',
            email: 'asha.verma@example.org',
            phone: '+91 98765 43210',
            place: 'Pune, Maharashtra',
          },
          paymentReference: 'pay_TEST123',
        }),
      ),
    );

    expect(text).toContain(hex('ash•••••@example.org'));
    expect(text).toContain(hex('+91 •••••• 3210'));
    expect(text).toContain(hex('Pune, Maharashtra'));
    expect(text).toContain(hex('pay_TEST123'));
    expect(text).not.toContain(hex('asha.verma@'));
    expect(text).not.toContain(hex('98765'));
  });

  it('carries no contact details or payment id on the copy for a public link', async () => {
    const text = drawnText(await renderReceiptPdf(input()));

    expect(text).toContain(hex('Asha Verma'));
    expect(text).not.toContain(hex('Email'));
    expect(text).not.toContain(hex('Phone'));
    expect(text).not.toContain(hex('Transaction ID'));
  });

  it('shows the organisation’s registrations only when they were entered', async () => {
    const without = drawnText(await renderReceiptPdf(input()));
    expect(without).not.toContain(hex('ORGANISATION PAN'));
    expect(without).not.toContain(hex('80G REGISTRATION'));

    const withNumbers = drawnText(
      await renderReceiptPdf(
        input({
          organisation: { ...ORG, pan: 'AAATS1234F', section80G: 'AAATS1234FF20214' },
          registrationNumber: 'REG/2019/42',
        }),
      ),
    );
    expect(withNumbers).toContain(hex('AAATS1234F'));
    expect(withNumbers).toContain(hex('AAATS1234FF20214'));
    expect(withNumbers).toContain(hex('REG/2019/42'));
    expect(withNumbers).not.toContain(hex('12A REGISTRATION'));
  });

  it('says a receipt, never a certificate, and claims nothing that is not a record', async () => {
    const text = drawnText(await renderReceiptPdf(input()));

    // The note wraps, so its words are checked rather than the whole sentence.
    expect(text).toContain(hex('About this receipt'));
    for (const word of ['tax-exemption', '80G,', '10BE', '10BD']) {
      expect(text).toContain(hex(word));
    }
    for (const claim of ['Non-corpus', 'valid till', 'Authorised signatory', 'charges']) {
      expect(text).not.toContain(hex(claim));
    }
  });

  it('adds the verification QR only when there is a page to verify against', async () => {
    const withQr = await renderReceiptPdf(input());
    const withoutQr = await renderReceiptPdf(input({ verifyUrl: null }));

    expect(drawnText(withQr)).toContain(hex('Scan to verify'));
    expect(drawnText(withoutQr)).not.toContain(hex('Scan to verify'));
  });

  it('continues a long gift onto further pages rather than drawing past the footer', async () => {
    const lines = Array.from({ length: 40 }, (_, index) => ({
      itemName: `Ration kit ${index + 1}`,
      itemType: 'product',
      quantity: 1,
      unitPrice: 120_000,
      totalPrice: 120_000,
    }));

    const pdf = await PDFDocument.load(
      await renderReceiptPdf(input({ lines, amount: 40 * 120_000 })),
    );

    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it('draws names the standard fonts cannot, without failing', async () => {
    const pdf = await renderReceiptPdf(
      input({ donor: { name: 'आशा वर्मा' }, campaignTitle: 'स्कूल किट 🎒', lines: [] }),
    );

    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
  });
});

describe('organisationFromSettings', () => {
  it('takes only what was entered, and never a placeholder', () => {
    expect(organisationFromSettings([])).toEqual({ ...ORG });

    expect(
      organisationFromSettings([
        { key: 'organization_name', value: 'Sailent Foundation Trust' },
        {
          key: 'organization_contact',
          value: {
            email: 'help@example.org',
            phone: ' ',
            address: {
              line1: '12 Gandhi Road',
              city: 'Motihari',
              postalCode: '845401',
              state: 'Bihar',
            },
          },
        },
        { key: 'registration_details', value: { pan: 'AAATS1234F', section80G: null } },
      ]),
    ).toEqual({
      name: 'Sailent Foundation Trust',
      addressLine: '12 Gandhi Road, Motihari 845401, Bihar',
      email: 'help@example.org',
      phone: null,
      pan: 'AAATS1234F',
      section80G: null,
      section12A: null,
    });
  });
});

describe('masking', () => {
  it.each([
    ['shubhankarroy974@gmail.com', 'shu•••••@gmail.com'],
    ['asha@example.org', 'a•••••@example.org'],
    ['not-an-address', '•••••'],
  ])('maskEmail(%s) → %s', (email, masked) => {
    expect(maskEmail(email)).toBe(masked);
  });

  it.each([
    ['+91 98765 44321', '+91 •••••• 4321'],
    ['919876544321', '+91 •••••• 4321'],
    ['020 4000 1234', '•••••• 1234'],
    ['12', '••••••'],
  ])('maskPhone(%s) → %s', (phone, masked) => {
    expect(maskPhone(phone)).toBe(masked);
  });
});
