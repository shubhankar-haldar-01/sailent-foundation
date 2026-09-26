/**
 * CSV, written safely.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A SPREADSHEET EXECUTES SOME CELLS. THAT IS THE WHOLE REASON THIS FILE EXISTS.
 *
 * Excel, LibreOffice and Google Sheets all treat a cell beginning `=`, `+`,
 * `-`, `@`, a tab or a carriage return as a FORMULA. A donor called
 * `=cmd|'/c calc'!A0` — or, far more likely, an ordinary campaign title that
 * begins with a minus sign — becomes something the spreadsheet evaluates when
 * a member of the finance team opens the export.
 *
 * This is not theoretical for this platform specifically: almost every column
 * in these exports is free text somebody outside the organisation typed. A
 * donor name, a dedication, a campaign title, a volunteer's stated skills.
 *
 * So every value is quoted, and any value that STARTS with one of those
 * characters is prefixed with a single quote — the convention every
 * spreadsheet reads as "this is text". The data is unchanged to a human
 * reading it; it is simply no longer executable.
 *
 * RFC 4180 otherwise: fields containing a quote, a comma or a newline are
 * wrapped in double quotes and inner quotes are doubled. `\r\n` line endings,
 * because that is what the RFC says and what Excel expects.
 *
 * NO DEPENDENCY. This is forty lines of string handling with one security
 * rule, and the rule is the part that has to be read and tested — the same
 * reasoning that kept `image-inspection.ts` and `TotpService` dependency-free.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** What a spreadsheet will try to evaluate if it leads a cell. */
const FORMULA_LEADERS = new Set(['=', '+', '-', '@', '\t', '\r']);

/**
 * A byte-order mark, so Excel reads the file as UTF-8.
 *
 * Without it Excel on Windows guesses the local codepage and a donor called
 * "Sunita Devi" is fine but "अनीता" is mojibake. The BOM is three bytes and
 * removes an entire class of "the export is broken" reports.
 */
export const UTF8_BOM = '﻿';

export type CsvValue = string | number | boolean | Date | null | undefined;

/** One cell: neutralised, then quoted per RFC 4180. */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '""';

  let text: string;
  if (value instanceof Date) {
    // ISO, always UTC, always the same width. A locale-formatted date in a CSV
    // is a date somebody's spreadsheet will reinterpret.
    text = value.toISOString();
  } else if (typeof value === 'boolean') {
    text = value ? 'yes' : 'no';
  } else {
    text = String(value);
  }

  /*
    The security rule. Applied BEFORE quoting, because the prefix has to end up
    inside the quotes — a `'` outside them would be part of the CSV grammar
    rather than part of the cell.
  */
  if (text.length > 0 && FORMULA_LEADERS.has(text[0]!)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

/** One row. */
export function csvRow(values: CsvValue[]): string {
  return values.map(csvCell).join(',');
}

/**
 * A whole file, headers first.
 *
 * Built as one string rather than streamed. These exports are bounded to
 * `MAX_EXPORT_ROWS` precisely so that this is a safe thing to do; an unbounded
 * export would need streaming and a different shape of route.
 */
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  return UTF8_BOM + [csvRow(headers), ...rows.map(csvRow)].join('\r\n') + '\r\n';
}

/**
 * A filename that cannot escape a directory or a header.
 *
 * It ends up in a `Content-Disposition` header, where a newline would let a
 * caller inject a second header and a quote would end the filename early.
 */
export function csvFilename(dataset: string, from: string, to: string): string {
  const safe = (part: string) => part.replace(/[^a-zA-Z0-9-]/g, '');
  return `sailent-${safe(dataset)}-${safe(from)}-to-${safe(to)}.csv`;
}
