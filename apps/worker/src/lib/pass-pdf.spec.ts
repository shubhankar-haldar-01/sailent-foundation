import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { renderPassPdf, type PassPdfInput } from './pass-pdf.js';

const BASE: PassPdfInput = {
  eventTitle: 'Champaran Mahotsav',
  startDate: new Date('2026-11-20T04:30:00.000Z'),
  endDate: new Date('2026-11-20T14:30:00.000Z'),
  timezone: 'Asia/Kolkata',
  venueName: 'Ramson Plaza',
  venueLine: 'Chhatauni Colony, Motihari, Bihar',
  functionName: 'Dance',
  passes: [
    { fullName: 'Asha Verma', passNumber: 'SF-EVT-AAAA0001-1' },
    { fullName: 'Deep Kumar', passNumber: 'SF-EVT-AAAA0001-2' },
  ],
  feePerPass: 5_100,
  issuedAt: new Date('2026-11-18T17:25:24.000Z'),
  supportLine: null,
};

/** The PDF pass: one page per person, the website pass's size and layout. */
describe('renderPassPdf', () => {
  it('makes one 800 × 588 page per pass, titled for the event', async () => {
    const pdf = await renderPassPdf(BASE);

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(2);
    for (const page of doc.getPages()) {
      expect(page.getSize()).toEqual({ width: 800, height: 588 });
    }
    expect(doc.getTitle()).toBe('Entry passes – Champaran Mahotsav');
  });

  it('gives the same bytes for the same booking, so a retried email matches', async () => {
    const first = await renderPassPdf(BASE);
    const second = await renderPassPdf(BASE);
    expect(first.equals(second)).toBe(true);
    expect(first.equals(await renderPassPdf({ ...BASE, eventTitle: 'Another event' }))).toBe(false);
  });

  it('does not fail on text the PDF fonts cannot draw', async () => {
    const pdf = await renderPassPdf({
      ...BASE,
      eventTitle: 'चंपारण महोत्सव 🎉',
      functionName: 'नृत्य',
      venueName: null,
      venueLine: null,
      passes: [{ fullName: 'दीप', passNumber: 'SF-EVT-AAAA0001' }],
      feePerPass: null,
      supportLine: 'help@example.org | +91 90000 00000',
    });

    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
    // The document title keeps the real name; only the drawn text is limited.
    expect(doc.getTitle()).toBe('Entry pass – चंपारण महोत्सव 🎉');
  });

  it('fits a very long event title without failing', async () => {
    const pdf = await renderPassPdf({ ...BASE, eventTitle: 'A '.repeat(200).trim() });
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(2);
  });
});
