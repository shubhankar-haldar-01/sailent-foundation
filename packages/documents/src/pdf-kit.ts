import { rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

/**
 * Drawing helpers shared by the PDFs the worker attaches to emails (the event
 * pass and the donation receipt).
 *
 * Coordinates are TOP-DOWN, like a canvas or the web designs they mirror: `y`
 * is the distance from the top of the page. Each helper converts with the
 * page's own height, so one set works for every page size.
 *
 * Text goes through the standard PDF fonts (Helvetica, Courier), so no font
 * file is shipped. They cannot draw ₹ or non-Latin scripts: ₹ is drawn as a
 * shape (`rupeeSign`) and `printable` drops what the font lacks, so drawing
 * never throws.
 */

export function hex(value: string): RGB {
  const n = Number.parseInt(value.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Top-down y to PDF (bottom-up) y. */
export function fromTop(page: PDFPage, y: number): number {
  return page.getHeight() - y;
}

function roundedRect(w: number, h: number, r: number): string {
  return [
    `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r}`,
    `V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H ${r} A ${r} ${r} 0 0 1 0 ${h - r}`,
    `V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`,
  ].join(' ');
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  fill?: RGB;
  stroke?: RGB;
  strokeWidth?: number;
}

export function box(page: PDFPage, b: Box): void {
  page.drawSvgPath(roundedRect(b.w, b.h, b.r), {
    x: b.x,
    y: fromTop(page, b.y),
    ...(b.fill ? { color: b.fill } : {}),
    ...(b.stroke ? { borderColor: b.stroke, borderWidth: b.strokeWidth ?? 1 } : {}),
  });
}

/** Keeps only what the standard fonts can draw (WinAnsi), so drawing never throws. */
export function printable(font: PDFFont): (text: string, fallback?: string) => string {
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

/** `text`, shortened with an ellipsis to fit `maxWidth`. */
export function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > maxWidth)
    cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

export type Align = 'left' | 'center' | 'right';

/** Draws one line of text with its baseline at `y`; returns its width. */
export function text(
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
  page.drawText(shown, {
    x,
    y: fromTop(page, at.y),
    size: at.size,
    font: at.font,
    color: at.color,
  });
  return width;
}

/** Splits `value` into lines no wider than `maxWidth`, breaking at spaces. */
export function wrap(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of value.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** A check mark, `size` wide, its top-left at (x, y). */
export function tick(
  page: PDFPage,
  x: number,
  y: number,
  size: number,
  color: RGB,
  width = 1.6,
): void {
  const s = size / 10;
  page.drawSvgPath('M 0 4.5 L 3.5 8 L 10 0.5', {
    x,
    y: fromTop(page, y),
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
export function rupeeSign(
  page: PDFPage,
  x: number,
  baselineY: number,
  size: number,
  color: RGB,
  stroke = 2.2,
): number {
  // Lucide's "indian-rupee" outline (24-unit box; the sign spans y 3–21).
  const s = (size * 0.72) / 18;
  page.drawSvgPath(
    'M 6 3 H 18 M 6 8 H 18 M 6 13 L 14.5 21 M 6 13 H 9 M 9 13 C 15.667 13 15.667 3 9 3',
    {
      x: x - 6 * s,
      y: fromTop(page, baselineY) + 21 * s,
      scale: s,
      borderColor: color,
      borderWidth: stroke,
    },
  );
  return 12 * s + size * 0.15;
}

/** Width `rupeeSign` advances at `size`, for right-aligned amounts. */
export function rupeeSignWidth(size: number): number {
  return 12 * ((size * 0.72) / 18) + size * 0.15;
}

/**
 * Paise as an Indian-grouped figure, without the sign: 150000 → "1,500",
 * 251050 → "2,510.50" (never "2,510.5").
 */
export function rupeeFigure(paise: number): string {
  const digits = paise % 100 === 0 ? 0 : 2;
  return (paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
