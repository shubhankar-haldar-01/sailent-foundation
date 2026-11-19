import QRCode from 'qrcode';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from 'pdf-lib';

import { SAILENT_LOGO_PNG, SAILENT_LOGO_SIZE } from '../assets/sailent-logo.js';

/**
 * The event entry pass as a PDF: one page per person.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE SAME PASS AS THE WEBSITE'S DOWNLOAD (`apps/web/src/components/events/
 * download-pass.ts`), drawn with the same layout, colours and wording, in
 * the same 800-wide coordinates — so a printed PDF and a downloaded image of
 * the same booking look alike. Where it differs, it is on purpose:
 *
 *   - Vector, not pixels: the QR code stays sharp at any print size.
 *   - Standard PDF fonts (Helvetica, Courier), so no font file is shipped.
 *     They cannot draw ₹, emoji or non-Latin scripts: ₹ is drawn as a shape,
 *     emoji icons are left out, and a character the font lacks is dropped
 *     (a name made only of such characters reads "Guest"). The email that
 *     carries this PDF shows every name exactly.
 *   - No "Section 12A & 80G Registered NGO": AGENTS.md §10 forbids tax
 *     claims until the owner has provided them, and settings hold none.
 *   - The support line shows only the contact details the organisation has
 *     entered (Admin → Settings), never placeholders.
 *   - No attendee email or phone on a pass: a pass is shown at a gate and
 *     printed, so it carries the name and the seat only.
 *
 * DETERMINISTIC: the same booking always gives the same bytes (fixed dates,
 * no random document id), so a retried email carries an identical file and
 * its idempotency key still matches (lib/email.ts).
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface PassPdfInput {
  eventTitle: string;
  startDate: Date;
  endDate: Date | null;
  /** IANA zone the event's times are given in; India by default. */
  timezone?: string | null;
  venueName: string | null;
  /** The rest of the address, e.g. "Chhatauni Colony, Motihari, Bihar". */
  venueLine: string | null;
  functionName: string | null;
  passes: { fullName: string; passNumber: string }[];
  /** What one pass cost, in paise, from the payment actually made; null if free. */
  feePerPass: number | null;
  /** When the booking was made; the pass is "issued" then. */
  issuedAt: Date;
  /** "hello@… | +91 …" as the organisation entered it, or null. */
  supportLine: string | null;
}

const PAGE_W = 800;
const PAGE_H = 588;
const CARD = { x: 16, y: 16, w: 768, h: 556 };

function hex(value: string): RGB {
  const n = Number.parseInt(value.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const C = {
  page: hex('#F8FAFC'),
  white: hex('#FFFFFF'),
  border: hex('#CBD5E1'),
  line: hex('#E2E8F0'),
  panel: hex('#F8FAFC'),
  ink: hex('#0F172A'),
  ink2: hex('#1E293B'),
  slate700: hex('#334155'),
  slate600: hex('#475569'),
  slate500: hex('#64748B'),
  slate400: hex('#94A3B8'),
  orange: hex('#EB6A1F'),
  orangeSoft: hex('#FFF7ED'),
  orangeLine: hex('#FED7AA'),
  orangePill: hex('#FDBA74'),
  green: hex('#047857'),
  greenSoft: hex('#ECFDF5'),
  greenLine: hex('#A7F3D0'),
};

/** Canvas (top-down) y to PDF (bottom-up) y. */
const Y = (canvasY: number) => PAGE_H - canvasY;

function roundedRect(w: number, h: number, r: number): string {
  return [
    `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r}`,
    `V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H ${r} A ${r} ${r} 0 0 1 0 ${h - r}`,
    `V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`,
  ].join(' ');
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  fill?: RGB;
  stroke?: RGB;
  strokeWidth?: number;
}

function box(page: PDFPage, b: Box): void {
  page.drawSvgPath(roundedRect(b.w, b.h, b.r), {
    x: b.x,
    y: Y(b.y),
    ...(b.fill ? { color: b.fill } : {}),
    ...(b.stroke ? { borderColor: b.stroke, borderWidth: b.strokeWidth ?? 1 } : {}),
  });
}

/** Keeps only what the standard fonts can draw (WinAnsi), so drawing never throws. */
function printable(font: PDFFont): (text: string, fallback?: string) => string {
  const supported = new Set(font.getCharacterSet());
  return (text, fallback = '') => {
    let out = '';
    for (const ch of text.normalize('NFC').replace(/₹/g, 'Rs.')) {
      if (supported.has(ch.codePointAt(0)!)) out += ch;
    }
    out = out.replace(/\s+/g, ' ').trim();
    return out || fallback;
  };
}

function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > maxWidth)
    cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  mono: PDFFont;
  safe: (text: string, fallback?: string) => string;
}

type Align = 'left' | 'center' | 'right';

function text(
  page: PDFPage,
  value: string,
  at: {
    x: number;
    y: number;
    size: number;
    font: PDFFont;
    color: RGB;
    align?: Align;
    max?: number;
  },
): number {
  const shown = at.max ? fit(value, at.font, at.size, at.max) : value;
  const width = at.font.widthOfTextAtSize(shown, at.size);
  const x = at.align === 'center' ? at.x - width / 2 : at.align === 'right' ? at.x - width : at.x;
  page.drawText(shown, { x, y: Y(at.y), size: at.size, font: at.font, color: at.color });
  return width;
}

/** A check mark, `size` wide, its top-left at (x, y). */
function tick(page: PDFPage, x: number, y: number, size: number, color: RGB, width = 1.6): void {
  const s = size / 10;
  page.drawSvgPath('M 0 4.5 L 3.5 8 L 10 0.5', {
    x,
    y: Y(y),
    scale: s,
    borderColor: color,
    borderWidth: width / s,
  });
}

/**
 * The ₹ sign, drawn (the standard fonts have no glyph for it), sitting on
 * the baseline at `baselineY` like a capital letter of `size`. Returns its
 * advance width.
 */
function rupeeSign(page: PDFPage, x: number, baselineY: number, size: number, color: RGB): number {
  // Lucide's "indian-rupee" outline (24-unit box; the sign spans y 3–21).
  const s = (size * 0.72) / 18;
  page.drawSvgPath(
    'M 6 3 H 18 M 6 8 H 18 M 6 13 L 14.5 21 M 6 13 H 9 M 9 13 C 15.667 13 15.667 3 9 3',
    {
      x: x - 6 * s,
      y: Y(baselineY) + 21 * s,
      scale: s,
      borderColor: color,
      borderWidth: 2.2,
    },
  );
  return 12 * s + size * 0.15;
}

function rupees(paise: number): string {
  return (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function formats(input: PassPdfInput) {
  const timeZone = input.timezone || 'Asia/Kolkata';
  const date = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(input.startDate);
  const time = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  });
  const range = input.endDate
    ? `${time.format(input.startDate)} – ${time.format(input.endDate)}`
    : time.format(input.startDate);
  const issued = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(input.issuedAt);
  return { date, range, issued };
}

function drawPassPage(
  page: PDFPage,
  fonts: Fonts,
  logo: PDFImage,
  input: PassPdfInput,
  pass: { fullName: string; passNumber: string },
  seat: number,
): void {
  const { regular, bold, mono, safe } = fonts;
  const total = input.passes.length;
  const { date, range, issued } = formats(input);
  const cardY = CARD.y;

  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: C.page });
  box(page, { ...CARD, r: 20, fill: C.white, stroke: C.border, strokeWidth: 2 });

  // ── Header: logo and name; CONFIRMED ADMISSION ──────────────────────────
  const logoH = 36;
  const logoW = (SAILENT_LOGO_SIZE.width / SAILENT_LOGO_SIZE.height) * logoH;
  page.drawImage(logo, { x: 40, y: Y(cardY + 20 + logoH), width: logoW, height: logoH });
  text(page, 'SAILENT FOUNDATION', {
    x: 196,
    y: cardY + 42,
    size: 10,
    font: bold,
    color: C.slate600,
  });

  box(page, {
    x: 552,
    y: cardY + 18,
    w: 200,
    h: 32,
    r: 16,
    fill: C.greenSoft,
    stroke: C.greenLine,
    strokeWidth: 1.5,
  });
  const badge = 'CONFIRMED ADMISSION';
  const badgeW = bold.widthOfTextAtSize(badge, 11) + 16;
  const badgeX = 552 + (200 - badgeW) / 2;
  tick(page, badgeX, cardY + 29, 10, C.green);
  text(page, badge, { x: badgeX + 16, y: cardY + 38, size: 11, font: bold, color: C.green });
  text(page, 'OFFICIAL EVENT ENTRY PASS', {
    x: 752,
    y: cardY + 64,
    size: 9.5,
    font: bold,
    color: C.slate600,
    align: 'right',
  });

  // ── Perforation, with a notch at each end ───────────────────────────────
  const lineY = cardY + 80;
  page.drawLine({
    start: { x: CARD.x, y: Y(lineY) },
    end: { x: CARD.x + CARD.w, y: Y(lineY) },
    thickness: 1.5,
    color: C.border,
    dashArray: [6, 6],
  });
  page.drawSvgPath('M 0 -10 A 10 10 0 0 1 0 10 Z', {
    x: CARD.x,
    y: Y(lineY),
    color: C.page,
    borderColor: C.border,
    borderWidth: 2,
  });
  page.drawSvgPath('M 0 10 A 10 10 0 0 1 0 -10 Z', {
    x: CARD.x + CARD.w,
    y: Y(lineY),
    color: C.page,
    borderColor: C.border,
    borderWidth: 2,
  });

  // ── Pass ID bar ──────────────────────────────────────────────────────────
  const heroY = cardY + 96;
  box(page, {
    x: 40,
    y: heroY,
    w: 720,
    h: 68,
    r: 14,
    fill: C.orangeSoft,
    stroke: C.orangeLine,
    strokeWidth: 1.5,
  });
  text(page, 'UNIQUE PASS ID / ENTRY CODE', {
    x: 58,
    y: heroY + 22,
    size: 10,
    font: bold,
    color: C.slate500,
  });
  text(page, pass.passNumber, { x: 58, y: heroY + 50, size: 22, font: mono, color: C.orange });
  box(page, { x: 592, y: heroY + 18, w: 152, h: 32, r: 8, fill: C.white, stroke: C.orangePill });
  text(page, total > 1 ? `Pass ${seat} of ${total}` : '1 Seat Reserved', {
    x: 668,
    y: heroY + 38,
    size: 11,
    font: bold,
    color: C.slate700,
    align: 'center',
  });

  // ── Event title and activity ────────────────────────────────────────────
  const titleY = cardY + 188;
  const activity = input.functionName ? safe(input.functionName).toUpperCase() : '';
  text(page, activity ? `EVENT TITLE • ACTIVITY: ${activity}` : 'EVENT TITLE', {
    x: 40,
    y: titleY,
    size: 10,
    font: bold,
    color: C.orange,
    max: 470,
  });
  text(page, safe(input.eventTitle, 'Event'), {
    x: 40,
    y: titleY + 22,
    size: 17,
    font: bold,
    color: C.ink,
    max: 470,
  });

  // ── The four detail cards ────────────────────────────────────────────────
  const card = (
    x: number,
    y: number,
    label: string,
    line1: string,
    line2: string,
    line2Color = C.slate600,
  ) => {
    box(page, { x, y, w: 230, h: 74, r: 10, fill: C.panel, stroke: C.line });
    text(page, label, { x: x + 12, y: y + 20, size: 10, font: bold, color: C.slate500 });
    text(page, line1, { x: x + 12, y: y + 42, size: 12.5, font: bold, color: C.ink, max: 206 });
    text(page, line2, {
      x: x + 12,
      y: y + 60,
      size: 11,
      font: regular,
      color: line2Color,
      max: 206,
    });
  };
  const gridY = cardY + 228;
  card(40, gridY, 'Date & Schedule', safe(date), `${safe(range)} (IST)`);
  card(
    280,
    gridY,
    'Venue & Location',
    safe(input.venueName ?? '', 'Venue to be confirmed'),
    safe(input.venueLine ?? '', 'Venue details on the event page'),
  );
  const fn = input.functionName ? safe(input.functionName) : '';
  card(
    40,
    gridY + 82,
    'Registered Attendee',
    safe(pass.fullName, 'Guest'),
    fn ? `${fn} • Seat ${seat} of ${total}` : `Seat ${seat} of ${total}`,
    C.slate500,
  );

  // Admission fee: "Paid ₹51" needs the drawn ₹.
  const feeX = 280;
  const feeY = gridY + 82;
  box(page, { x: feeX, y: feeY, w: 230, h: 74, r: 10, fill: C.panel, stroke: C.line });
  text(page, 'Admission Fee', {
    x: feeX + 12,
    y: feeY + 20,
    size: 10,
    font: bold,
    color: C.slate500,
  });
  if (input.feePerPass && input.feePerPass > 0) {
    let x = feeX + 12;
    x += text(page, 'Paid ', { x, y: feeY + 42, size: 12.5, font: bold, color: C.ink });
    x += rupeeSign(page, x, feeY + 42, 12.5, C.ink);
    text(page, rupees(input.feePerPass), { x, y: feeY + 42, size: 12.5, font: bold, color: C.ink });
  } else {
    text(page, 'Free Entry Pass', {
      x: feeX + 12,
      y: feeY + 42,
      size: 12.5,
      font: bold,
      color: C.ink,
    });
  }
  tick(page, feeX + 12, feeY + 52, 8, C.green, 1.4);
  text(page, input.feePerPass ? 'Payment Verified (Online)' : 'Complimentary NGO Entry', {
    x: feeX + 24,
    y: feeY + 60,
    size: 11,
    font: regular,
    color: C.green,
  });

  // ── Security box: QR, seal, pass ID ─────────────────────────────────────
  const sec = { x: 524, y: cardY + 180, w: 236, h: 204 };
  box(page, { ...sec, r: 12, fill: C.panel, stroke: C.line });
  const plate = { x: 538, y: sec.y + 10, w: 88, h: 88 };
  box(page, { ...plate, r: 8, fill: C.white, stroke: C.line });
  // Corner brackets.
  const bracket = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) =>
    page.drawSvgPath(`M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3}`, {
      x: 0,
      y: PAGE_H,
      borderColor: C.orange,
      borderWidth: 1.5,
    });
  const L = 6;
  const [px, py, pw, ph] = [plate.x, plate.y, plate.w, plate.h];
  bracket(px + 3, py + 3 + L, px + 3, py + 3, px + 3 + L, py + 3);
  bracket(px + pw - 3 - L, py + 3, px + pw - 3, py + 3, px + pw - 3, py + 3 + L);
  bracket(px + 3, py + ph - 3 - L, px + 3, py + ph - 3, px + 3 + L, py + ph - 3);
  bracket(px + pw - 3 - L, py + ph - 3, px + pw - 3, py + ph - 3, px + pw - 3, py + ph - 3 - L);

  // The QR code: the pass number, exactly as the gate scanner reads it.
  const qr = QRCode.create(pass.passNumber, { errorCorrectionLevel: 'M' });
  const modules = qr.modules.size;
  const unit = 70 / modules;
  const qrX = plate.x + plate.w / 2 - 35;
  const qrY = plate.y + plate.h / 2 - 35;
  for (let r = 0; r < modules; r += 1) {
    for (let c = 0; c < modules; c += 1) {
      if (qr.modules.get(r, c)) {
        page.drawRectangle({
          x: qrX + c * unit,
          y: Y(qrY + (r + 1) * unit),
          width: unit + 0.05,
          height: unit + 0.05,
          color: C.ink,
        });
      }
    }
  }
  text(page, 'SCAN AT ENTRANCE', {
    x: plate.x + plate.w / 2,
    y: sec.y + 109,
    size: 7.5,
    font: bold,
    color: C.slate500,
    align: 'center',
  });

  // The seal.
  const seal = { x: 696, y: sec.y + 50, r: 27 };
  page.drawCircle({
    x: seal.x,
    y: Y(seal.y),
    size: seal.r,
    color: C.orangeSoft,
    borderColor: C.orange,
    borderWidth: 1.5,
    borderDashArray: [4, 3],
  });
  page.drawCircle({
    x: seal.x,
    y: Y(seal.y),
    size: seal.r - 4.5,
    borderColor: C.orangeLine,
    borderWidth: 1,
  });
  tick(page, seal.x - 5.5, seal.y - 16, 11, C.orange, 2.2);
  text(page, 'VERIFIED', {
    x: seal.x,
    y: seal.y + 3,
    size: 8,
    font: bold,
    color: C.orange,
    align: 'center',
  });
  text(page, 'SAILENT PASS', {
    x: seal.x,
    y: seal.y + 12,
    size: 6.5,
    font: bold,
    color: C.slate700,
    align: 'center',
  });

  box(page, { x: 656, y: sec.y + 86, w: 80, h: 18, r: 9, fill: C.greenSoft, stroke: C.greenLine });
  const valid = 'VALID ENTRY';
  const validW = bold.widthOfTextAtSize(valid, 7.5) + 10;
  tick(page, seal.x - validW / 2, sec.y + 91.5, 6.5, C.green, 1.2);
  text(page, valid, {
    x: seal.x - validW / 2 + 10,
    y: sec.y + 98,
    size: 7.5,
    font: bold,
    color: C.green,
  });

  page.drawLine({
    start: { x: 536, y: Y(sec.y + 120) },
    end: { x: 748, y: Y(sec.y + 120) },
    thickness: 1,
    color: C.line,
    dashArray: [4, 4],
  });
  text(page, pass.passNumber, {
    x: 642,
    y: sec.y + 161,
    size: 12,
    font: mono,
    color: C.ink2,
    align: 'center',
  });
  text(page, 'PASS ID • NON-TRANSFERABLE', {
    x: 642,
    y: sec.y + 174,
    size: 6.5,
    font: bold,
    color: C.slate400,
    align: 'center',
  });

  // ── Guidelines ───────────────────────────────────────────────────────────
  const guideY = cardY + 396;
  box(page, { x: 40, y: guideY, w: 720, h: 102, r: 10, fill: C.panel, stroke: C.line });
  text(page, 'IMPORTANT CHECK-IN GUIDELINES & ENTRY TERMS', {
    x: 54,
    y: guideY + 18,
    size: 10.5,
    font: bold,
    color: C.ink,
  });
  const rule = (value: string, x: number, y: number) =>
    text(page, value, { x, y, size: 9.5, font: regular, color: C.slate600, max: 340 });
  rule('1. Photo ID Required: Carry valid Govt. photo ID matching attendee name.', 54, guideY + 40);
  rule(
    '3. Check-in Desk: Present this digital pass or physical printout at entrance.',
    54,
    guideY + 62,
  );
  rule(
    '2. Non-Transferable: Admits 1 person only; cannot be exchanged or resold.',
    410,
    guideY + 40,
  );
  rule(
    '4. Reporting Time: Arrive 20 mins before start; right of admission reserved.',
    410,
    guideY + 62,
  );

  // ── Footer ───────────────────────────────────────────────────────────────
  const footerY = cardY + 510;
  page.drawLine({
    start: { x: 40, y: Y(footerY) },
    end: { x: 760, y: Y(footerY) },
    thickness: 1,
    color: C.line,
  });
  const support = input.supportLine ? safe(input.supportLine) : '';
  text(page, support ? `Sailent Foundation • Support: ${support}` : 'Sailent Foundation', {
    x: 40,
    y: footerY + 20,
    size: 9.5,
    font: regular,
    color: C.slate500,
    max: 400,
  });
  text(page, `Issued on ${safe(issued)} • Computer-generated valid entry document`, {
    x: 760,
    y: footerY + 20,
    size: 9,
    font: regular,
    color: C.slate400,
    align: 'right',
  });
}

/** One page per pass, in booking order. */
export async function renderPassPdf(input: PassPdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  // Fixed metadata: the same booking always produces the same bytes. (A PDF
  // title is Unicode text, so the event's name is kept as it is.)
  doc.setTitle(`Entry pass${input.passes.length > 1 ? 'es' : ''} – ${input.eventTitle}`);
  doc.setAuthor('Sailent Foundation');
  doc.setCreator('Sailent Foundation');
  doc.setProducer('Sailent Foundation');
  doc.setCreationDate(input.issuedAt);
  doc.setModificationDate(input.issuedAt);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const fonts: Fonts = {
    regular,
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    mono: await doc.embedFont(StandardFonts.CourierBold),
    safe: printable(regular),
  };
  const logo = await doc.embedPng(SAILENT_LOGO_PNG);

  input.passes.forEach((pass, index) => {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    drawPassPage(page, fonts, logo, input, pass, index + 1);
  });

  return Buffer.from(await doc.save());
}
