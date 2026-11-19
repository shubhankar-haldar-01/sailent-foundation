import QRCode from 'qrcode';
import { PDFDocument, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';

import { rupeesInWords } from '@sailent/validation';

import { maskEmail, maskPhone, type ReceiptPdfOrganisation } from './organisation.js';
import {
  box,
  fromTop,
  hex,
  printable,
  rupeeFigure,
  rupeeSign,
  rupeeSignWidth,
  text,
  wrap,
} from './pdf-kit.js';
import { SAILENT_LOGO_PNG, SAILENT_LOGO_SIZE } from './sailent-logo.js';

/**
 * The donation receipt as a PDF: an A4 page the donor can keep, print or hand
 * to an accountant.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE OWNER'S LAYOUT (2026-11-19), IN THE BRAND'S COLOURS.
 *
 * Header (logo, organisation, "Donation Receipt", number and date), the
 * organisation's registrations, the amount in figures and words, who gave and
 * how it was paid side by side, the lines of the gift, the tax note beside a
 * computer-generated note, a thank-you band with a verification QR code, and
 * a footer on every page.
 *
 * DRAWN FROM RECORDS ONLY. The gift, the donor's name, the campaign and the
 * registration number come from the receipt row's frozen snapshot. The
 * organisation's address, contacts, PAN, 80G and 12A come from Admin →
 * Settings and are printed only when entered (`organisationFromSettings`).
 * Not printed, because nothing records them or because they would be claims:
 * an 80G validity date, "non-corpus", fee lines, a UTR or UPI id, a signature.
 *
 * TWO COPIES, ONE DRAWING. The emailed copy is private: it carries the payment
 * id and the donor's email and phone (masked here, whatever the caller
 * passes). The copy downloaded through the donation's public link carries the
 * donor's name only and no payment id (owner, 2026-11-19).
 *
 * IT SAYS A RECEIPT, NEVER A CERTIFICATE. Section 80G relief comes from Form
 * 10BE, issued by the Income Tax Department after the organisation's annual
 * Form 10BD filing (decision A7), and the note says so in the approved words.
 *
 * DETERMINISTIC: the same receipt always gives the same bytes (fixed dates,
 * no random document id), so a retried email carries an identical file and
 * its idempotency key still matches.
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface ReceiptPdfLine {
  itemName: string;
  /** `custom` for an amount the donor chose; anything else is a product line. */
  itemType: string;
  quantity: number;
  /** Paise. */
  unitPrice: number;
  /** Paise. */
  totalPrice: number;
}

/**
 * The entries of a receipt's frozen `line_items` that have the shape the
 * capture writes. Anything else is dropped rather than drawn as "undefined".
 */
export function receiptLinesFrom(value: unknown): ReceiptPdfLine[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is ReceiptPdfLine => {
    const line = entry as Partial<ReceiptPdfLine> | null;
    return (
      typeof line === 'object' &&
      line !== null &&
      typeof line.itemName === 'string' &&
      typeof line.itemType === 'string' &&
      Number.isInteger(line.quantity) &&
      Number.isInteger(line.unitPrice) &&
      Number.isInteger(line.totalPrice)
    );
  });
}

export interface ReceiptPdfDonor {
  /** The name on the receipt. */
  name: string;
  /** Printed MASKED. Null on a copy reached through a public link. */
  email?: string | null;
  /** Printed MASKED. Null on a copy reached through a public link. */
  phone?: string | null;
  /** "Pune, Maharashtra". Null on a copy reached through a public link. */
  place?: string | null;
}

export interface ReceiptPdfInput {
  receiptNumber: string;
  /** When the receipt was issued, which is when the payment was captured. */
  issuedAt: Date;
  donor: ReceiptPdfDonor;
  organisation: ReceiptPdfOrganisation;
  campaignTitle: string | null;
  programTitle: string | null;
  /** Paise. */
  amount: number;
  lines: ReceiptPdfLine[];
  donationReference: string;
  /**
   * The Razorpay payment id, or null to leave the row out: the copy downloaded
   * through the donation's public link carries no payment identifier.
   */
  paymentReference: string | null;
  /** The organisation's registration number as it stood at issue, or null. */
  registrationNumber: string | null;
  /** The donation's page, encoded in the "Scan to verify" QR code. */
  verifyUrl?: string | null;
}

const PAGE_W = 595;
const PAGE_H = 842;
const LEFT = 44;
const RIGHT = PAGE_W - 44;
const WIDTH = RIGHT - LEFT;
/** Where a block must end, above the footer. */
const BODY_LIMIT = 792;

const C = {
  white: hex('#FFFFFF'),
  ink: hex('#0F172A'),
  ink2: hex('#475569'),
  ink3: hex('#8A96A8'),
  line: hex('#E6EBF1'),
  panel: hex('#F8FAFC'),
  orange: hex('#EB6A1F'),
  orangeText: hex('#B3450E'),
  orangeSoft: hex('#FFF7ED'),
  orangeLine: hex('#FED7AA'),
  navy: hex('#19013E'),
  navyMuted: hex('#CBC5DC'),
  green: hex('#15803D'),
  greenDot: hex('#16A34A'),
  greenSoft: hex('#ECFDF3'),
  greenLine: hex('#BBF7D0'),
  amberSoft: hex('#FFFBEB'),
  amberLine: hex('#FDE68A'),
  amberInk: hex('#78350F'),
};

const NOTE =
  'This receipt acknowledges your payment. It is not a tax-exemption certificate. ' +
  'If you are claiming relief under Section 80G, the Income Tax Department issues ' +
  'Form 10BE after our annual Form 10BD filing, and it will reach you separately. ' +
  'Please make sure your PAN is correct so your donation can be reported.';

const COMPUTER_GENERATED = 'Computer-generated receipt; no physical signature required.';

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  mono: PDFFont;
  monoBold: PDFFont;
  safe: (value: string, fallback?: string) => string;
}

const IST = { timeZone: 'Asia/Kolkata' } as const;
const ISSUED = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  ...IST,
});
const TIME = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  ...IST,
});

/** "₹1,500" with its last digit at `rightX`. */
function amountRight(
  page: PDFPage,
  paise: number,
  rightX: number,
  y: number,
  size: number,
  font: PDFFont,
  color: (typeof C)['ink'],
): void {
  const figure = rupeeFigure(paise);
  const start = rightX - font.widthOfTextAtSize(figure, size) - rupeeSignWidth(size);
  const advance = rupeeSign(page, start, y, size, color, Math.max(0.9, size * 0.11));
  text(page, figure, { x: start + advance, y, size, font, color });
}

/** "₹1,500" starting at `x`; returns its width. */
function amountAt(
  page: PDFPage,
  paise: number,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color: (typeof C)['ink'],
): number {
  const advance = rupeeSign(page, x, y, size, color, Math.max(0.9, size * 0.11));
  return advance + text(page, rupeeFigure(paise), { x: x + advance, y, size, font, color });
}

function label(page: PDFPage, fonts: Fonts, value: string, x: number, y: number): void {
  text(page, value.toUpperCase(), { x, y, size: 7.5, font: fonts.bold, color: C.ink3 });
}

function hline(page: PDFPage, y: number, x1 = LEFT, x2 = RIGHT, thickness = 1, color = C.line) {
  page.drawLine({
    start: { x: x1, y: fromTop(page, y) },
    end: { x: x2, y: fromTop(page, y) },
    thickness,
    color,
  });
}

/** The page header: logo and organisation, "Donation Receipt", number and date. */
function drawHeader(
  page: PDFPage,
  fonts: Fonts,
  logo: PDFImage,
  input: ReceiptPdfInput,
  continued: boolean,
): number {
  const { bold, regular, monoBold, safe } = fonts;
  const org = input.organisation;
  page.drawRectangle({ x: 0, y: fromTop(page, 8), width: PAGE_W, height: 8, color: C.orange });

  const logoH = continued ? 24 : 30;
  const logoW = (SAILENT_LOGO_SIZE.width / SAILENT_LOGO_SIZE.height) * logoH;
  page.drawImage(logo, { x: LEFT, y: fromTop(page, 30 + logoH), width: logoW, height: logoH });

  // Right: the document's title, number and date.
  text(page, continued ? 'Donation Receipt (continued)' : 'Donation Receipt', {
    x: RIGHT,
    y: 46,
    size: continued ? 13 : 18,
    font: bold,
    color: C.ink,
    align: 'right',
  });
  const number = safe(input.receiptNumber);
  const numberW = monoBold.widthOfTextAtSize(number, 9.5);
  text(page, number, { x: RIGHT, y: 64, size: 9.5, font: monoBold, color: C.ink, align: 'right' });
  text(page, 'Receipt no. ', {
    x: RIGHT - numberW,
    y: 64,
    size: 9.5,
    font: regular,
    color: C.ink2,
    align: 'right',
  });
  if (continued) return 88;

  const issued = ISSUED.format(input.issuedAt);
  const issuedW = bold.widthOfTextAtSize(issued, 9.5);
  text(page, issued, { x: RIGHT, y: 78, size: 9.5, font: bold, color: C.ink, align: 'right' });
  text(page, 'Issued on ', {
    x: RIGHT - issuedW,
    y: 78,
    size: 9.5,
    font: regular,
    color: C.ink2,
    align: 'right',
  });

  // Left, under the logo: the organisation as entered in settings.
  let y = 30 + logoH + 16;
  text(page, safe(org.name, 'Sailent Foundation'), {
    x: LEFT,
    y,
    size: 10.5,
    font: bold,
    color: C.ink,
    max: 300,
  });
  const contact = [org.email, org.phone].filter(Boolean).join('  ·  ');
  for (const line of [org.addressLine, contact || null]) {
    if (!line) continue;
    y += 13;
    text(page, safe(line), { x: LEFT, y, size: 8.5, font: regular, color: C.ink2, max: 320 });
  }
  return Math.max(y, 82) + 16;
}

/** The organisation's registrations, only those entered. Returns the height used. */
function drawRegistrations(page: PDFPage, fonts: Fonts, input: ReceiptPdfInput, y: number) {
  const org = input.organisation;
  const entered: [string, string | null][] = [
    ['Organisation PAN', org.pan],
    ['80G registration', org.section80G],
    ['12A registration', org.section12A],
    ['Registration no.', input.registrationNumber],
  ];
  const cells = entered.filter((cell): cell is [string, string] => Boolean(cell[1]));
  if (cells.length === 0) return 0;

  const h = 40;
  box(page, { x: LEFT, y, w: WIDTH, h, r: 8, fill: C.panel, stroke: C.line });
  const cellW = WIDTH / cells.length;
  cells.forEach(([name, value], index) => {
    const x = LEFT + index * cellW;
    if (index > 0) {
      page.drawLine({
        start: { x, y: fromTop(page, y) },
        end: { x, y: fromTop(page, y + h) },
        thickness: 1,
        color: C.line,
      });
    }
    label(page, fonts, name, x + 12, y + 15);
    text(page, fonts.safe(value), {
      x: x + 12,
      y: y + 29,
      size: 9,
      font: fonts.monoBold,
      color: C.ink,
      max: cellW - 20,
    });
  });
  return h + 14;
}

/** A label on the left and a value on the right, as in a statement. */
function keyValue(
  page: PDFPage,
  fonts: Fonts,
  key: string,
  value: string,
  x: number,
  right: number,
  y: number,
  options: { mono?: boolean; color?: (typeof C)['ink'] } = {},
) {
  text(page, key, { x, y, size: 9, font: fonts.regular, color: C.ink2 });
  const keyW = fonts.regular.widthOfTextAtSize(key, 9);
  text(page, value, {
    x: right,
    y,
    size: 9,
    font: options.mono ? fonts.monoBold : fonts.bold,
    color: options.color ?? C.ink,
    align: 'right',
    max: right - x - keyW - 12,
  });
}

export async function renderReceiptPdf(input: ReceiptPdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  // Fixed metadata: the same receipt always produces the same bytes.
  doc.setTitle(`Donation receipt ${input.receiptNumber}`);
  doc.setAuthor('Sailent Foundation');
  doc.setCreator('Sailent Foundation');
  doc.setProducer('Sailent Foundation');
  doc.setCreationDate(input.issuedAt);
  doc.setModificationDate(input.issuedAt);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const fonts: Fonts = {
    regular,
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    mono: await doc.embedFont(StandardFonts.Courier),
    monoBold: await doc.embedFont(StandardFonts.CourierBold),
    safe: printable(regular),
  };
  const { bold, safe } = fonts;
  const logo = await doc.embedPng(SAILENT_LOGO_PNG);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = drawHeader(page, fonts, logo, input, false);
  y += drawRegistrations(page, fonts, input, y);

  /** Starts a new page when `height` more would run into the footer. */
  const ensure = (height: number) => {
    if (y + height <= BODY_LIMIT) return;
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = drawHeader(page, fonts, logo, input, true);
  };

  // ── The amount ───────────────────────────────────────────────────────────
  const words = wrap(rupeesInWords(input.amount), regular, 9.5, 300);
  const heroH = 64 + words.length * 12;
  box(page, { x: LEFT, y, w: WIDTH, h: heroH, r: 12, fill: C.panel, stroke: C.line });
  label(page, fonts, 'Amount received', LEFT + 20, y + 22);
  amountAt(page, input.amount, LEFT + 20, y + 52, 28, bold, C.ink);
  words.forEach((line, index) =>
    text(page, line, {
      x: LEFT + 20,
      y: y + 68 + index * 12,
      size: 9.5,
      font: regular,
      color: C.ink2,
    }),
  );

  const pill = 'Payment received';
  const pillW = bold.widthOfTextAtSize(pill, 8.5) + 26;
  box(page, {
    x: RIGHT - 20 - pillW,
    y: y + 14,
    w: pillW,
    h: 19,
    r: 9.5,
    fill: C.greenSoft,
    stroke: C.greenLine,
  });
  page.drawCircle({
    x: RIGHT - 20 - pillW + 11,
    y: fromTop(page, y + 23.5),
    size: 2.5,
    color: C.greenDot,
  });
  text(page, pill, {
    x: RIGHT - 20 - pillW + 18,
    y: y + 27,
    size: 8.5,
    font: bold,
    color: C.green,
  });
  const paidAt = `${ISSUED.format(input.issuedAt)}, ${TIME.format(input.issuedAt)} IST`;
  const paidW = bold.widthOfTextAtSize(paidAt, 9.5);
  text(page, paidAt, {
    x: RIGHT - 20,
    y: y + 52,
    size: 9.5,
    font: bold,
    color: C.ink,
    align: 'right',
  });
  text(page, 'Paid on ', {
    x: RIGHT - 20 - paidW,
    y: y + 52,
    size: 9.5,
    font: regular,
    color: C.ink2,
    align: 'right',
  });
  text(page, 'Online · Razorpay', {
    x: RIGHT - 20,
    y: y + 66,
    size: 9.5,
    font: regular,
    color: C.ink2,
    align: 'right',
  });
  y += heroH + 14;

  // ── Who gave, and how it was paid ───────────────────────────────────────
  const donor = input.donor;
  const donorRows = [
    donor.email ? ['Email', maskEmail(donor.email)] : null,
    donor.phone ? ['Phone', maskPhone(donor.phone)] : null,
    donor.place ? ['Place', safe(donor.place)] : null,
  ].filter((row): row is [string, string] => row !== null);
  const paymentRows: [string, string, boolean, boolean][] = [
    ['Donation reference', safe(input.donationReference), true, false],
    ...(input.paymentReference
      ? [
          ['Transaction ID', safe(input.paymentReference), true, false] as [
            string,
            string,
            boolean,
            boolean,
          ],
        ]
      : []),
    ['Payment method', 'Online · Razorpay', false, false],
    ['Status', 'Successful', false, true],
  ];
  const boxW = (WIDTH - 14) / 2;
  const boxH = Math.max(52 + donorRows.length * 16, 30 + paymentRows.length * 16) + 10;
  ensure(boxH);
  box(page, { x: LEFT, y, w: boxW, h: boxH, r: 10, stroke: C.line });
  label(page, fonts, 'Received with thanks from', LEFT + 16, y + 18);
  text(page, safe(donor.name, 'Donor'), {
    x: LEFT + 16,
    y: y + 38,
    size: 13,
    font: bold,
    color: C.ink,
    max: boxW - 32,
  });
  donorRows.forEach(([key, value], index) =>
    keyValue(page, fonts, key, value, LEFT + 16, LEFT + boxW - 16, y + 58 + index * 16),
  );

  const px = LEFT + boxW + 14;
  box(page, { x: px, y, w: boxW, h: boxH, r: 10, stroke: C.line });
  label(page, fonts, 'Payment details', px + 16, y + 18);
  paymentRows.forEach(([key, value, mono, success], index) =>
    keyValue(page, fonts, key, value, px + 16, px + boxW - 16, y + 36 + index * 16, {
      mono,
      ...(success ? { color: C.green } : {}),
    }),
  );
  y += boxH + 16;

  // ── The lines of the gift ────────────────────────────────────────────────
  const lines: ReceiptPdfLine[] =
    input.lines.length > 0
      ? input.lines
      : [
          {
            itemName: 'Donation',
            itemType: 'custom',
            quantity: 1,
            unitPrice: input.amount,
            totalPrice: input.amount,
          },
        ];
  const COL = { item: LEFT + 10, campaign: LEFT + 186, programme: LEFT + 290, type: LEFT + 388 };
  const campaign = safe(input.campaignTitle ?? '', 'General donation');
  const programme = safe(input.programTitle ?? '', '-');

  const tableHeader = () => {
    page.drawRectangle({
      x: LEFT,
      y: fromTop(page, y + 24),
      width: WIDTH,
      height: 24,
      color: C.panel,
    });
    hline(page, y);
    hline(page, y + 24);
    const hy = y + 15.5;
    label(page, fonts, 'Details of your gift', COL.item, hy);
    label(page, fonts, 'Campaign', COL.campaign, hy);
    label(page, fonts, 'Programme', COL.programme, hy);
    label(page, fonts, 'Type', COL.type, hy);
    text(page, 'AMOUNT', {
      x: RIGHT - 10,
      y: hy,
      size: 7.5,
      font: bold,
      color: C.ink3,
      align: 'right',
    });
    y += 24;
  };

  ensure(24 + 36 + 34);
  tableHeader();
  for (const line of lines) {
    if (y + 36 > BODY_LIMIT) {
      ensure(BODY_LIMIT);
      tableHeader();
    }
    const custom = line.itemType === 'custom';
    text(page, safe(line.itemName, 'Donation'), {
      x: COL.item,
      y: y + 15,
      size: 9.5,
      font: bold,
      color: C.ink,
      max: COL.campaign - COL.item - 12,
    });
    if (custom) {
      text(page, 'Amount of your choice', {
        x: COL.item,
        y: y + 27,
        size: 8,
        font: regular,
        color: C.ink3,
      });
    } else {
      const qty = text(page, `${line.quantity} × `, {
        x: COL.item,
        y: y + 27,
        size: 8,
        font: regular,
        color: C.ink3,
      });
      amountAt(page, line.unitPrice, COL.item + qty, y + 27, 8, regular, C.ink3);
    }
    const cell = { y: y + 20, size: 9, font: regular, color: C.ink2 } as const;
    text(page, campaign, { ...cell, x: COL.campaign, max: COL.programme - COL.campaign - 10 });
    text(page, programme, { ...cell, x: COL.programme, max: COL.type - COL.programme - 10 });
    text(page, 'One-time', { ...cell, x: COL.type });
    amountRight(page, line.totalPrice, RIGHT - 10, y + 20, 9.5, bold, C.ink);
    hline(page, y + 36);
    y += 36;
  }
  ensure(36);
  hline(page, y + 4, LEFT, RIGHT, 1.5, C.ink);
  text(page, 'Total received', {
    x: RIGHT - 110,
    y: y + 24,
    size: 11,
    font: bold,
    color: C.ink,
    align: 'right',
  });
  amountRight(page, input.amount, RIGHT - 10, y + 24, 12, bold, C.ink);
  y += 44;

  // ── The tax note, and the computer-generated note ───────────────────────
  const signW = 176;
  const noteW = WIDTH - signW - 14;
  const noteLines = wrap(NOTE, regular, 8.5, noteW - 30);
  const signLines = wrap(COMPUTER_GENERATED, regular, 8, signW - 28);
  const bottomH = Math.max(32 + noteLines.length * 11.5, 74);
  ensure(bottomH + 14 + 58);
  box(page, {
    x: LEFT,
    y,
    w: noteW,
    h: bottomH,
    r: 10,
    fill: C.amberSoft,
    stroke: C.amberLine,
  });
  text(page, 'About this receipt', {
    x: LEFT + 15,
    y: y + 18,
    size: 9,
    font: bold,
    color: C.amberInk,
  });
  noteLines.forEach((line, index) =>
    text(page, line, {
      x: LEFT + 15,
      y: y + 32 + index * 11.5,
      size: 8.5,
      font: regular,
      color: C.amberInk,
    }),
  );

  const sx = LEFT + noteW + 14;
  box(page, { x: sx, y, w: signW, h: bottomH, r: 10, stroke: C.line });
  text(page, safe(input.organisation.name, 'Sailent Foundation'), {
    x: sx + 14,
    y: y + 24,
    size: 11,
    font: bold,
    color: C.navy,
    max: signW - 28,
  });
  const signTop = y + bottomH - 12 - signLines.length * 10.5;
  hline(page, signTop - 6, sx + 14, sx + signW - 14);
  signLines.forEach((line, index) =>
    text(page, line, {
      x: sx + 14,
      y: signTop + 6 + index * 10.5,
      size: 8,
      font: regular,
      color: C.ink2,
    }),
  );
  y += bottomH + 14;

  // ── Thank you, and the verification QR ──────────────────────────────────
  const thanksH = 58;
  box(page, { x: LEFT, y, w: WIDTH, h: thanksH, r: 10, fill: C.navy });
  const firstName = safe(donor.name).split(' ')[0] ?? '';
  text(page, `Thank you for your generosity${firstName ? `, ${firstName}` : ''}.`, {
    x: LEFT + 18,
    y: y + 24,
    size: 11.5,
    font: bold,
    color: C.white,
    max: WIDTH - 180,
  });
  const supports = input.programTitle
    ? `Your gift supports ${campaign}, in our ${safe(input.programTitle)} programme.`
    : `Your gift supports ${campaign}.`;
  text(page, supports, {
    x: LEFT + 18,
    y: y + 40,
    size: 9,
    font: regular,
    color: C.navyMuted,
    max: WIDTH - 180,
  });

  if (input.verifyUrl) {
    // 44pt of code (about 15mm printed): small enough for the band, large enough to scan.
    const tile = 50;
    const tx = RIGHT - 14 - tile;
    const ty = y + (thanksH - tile) / 2;
    box(page, { x: tx, y: ty, w: tile, h: tile, r: 5, fill: C.white });
    const qr = QRCode.create(input.verifyUrl, { errorCorrectionLevel: 'M' });
    const modules = qr.modules.size;
    const unit = (tile - 6) / modules;
    for (let r = 0; r < modules; r += 1) {
      for (let c = 0; c < modules; c += 1) {
        if (!qr.modules.get(r, c)) continue;
        page.drawRectangle({
          x: tx + 3 + c * unit,
          y: fromTop(page, ty + 3 + (r + 1) * unit),
          width: unit + 0.05,
          height: unit + 0.05,
          color: C.ink,
        });
      }
    }
    const caption = { size: 8, font: regular, color: C.navyMuted, align: 'right' as const };
    text(page, 'Scan to verify', { ...caption, x: tx - 10, y: y + 26 });
    text(page, 'this receipt', { ...caption, x: tx - 10, y: y + 37 });
  }

  // ── Footer on every page, once the page count is known ──────────────────
  const pages = doc.getPages();
  pages.forEach((each, index) => {
    hline(each, 806);
    text(
      each,
      `${safe(input.organisation.name, 'Sailent Foundation')} · Computer-generated receipt`,
      {
        x: LEFT,
        y: 820,
        size: 8,
        font: regular,
        color: C.ink3,
        max: 300,
      },
    );
    text(each, `Receipt ${safe(input.receiptNumber)} · Page ${index + 1} of ${pages.length}`, {
      x: RIGHT,
      y: 820,
      size: 8,
      font: regular,
      color: C.ink3,
      align: 'right',
    });
  });

  return Buffer.from(await doc.save());
}
