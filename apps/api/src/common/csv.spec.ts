import { describe, expect, it } from 'vitest';

import { UTF8_BOM, csvCell, csvFilename, csvRow, toCsv } from './csv.js';

/**
 * CSV.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE TESTS THAT MATTER ARE THE FORMULA ONES.
 *
 * Almost every column in these exports is free text somebody outside the
 * organisation typed — a donor name, a dedication, a campaign title. A cell
 * beginning `=`, `+`, `-` or `@` is executed by every major spreadsheet when
 * a member of the finance team opens the file.
 * ══════════════════════════════════════════════════════════════════════════
 */
describe('formula injection', () => {
  const QUOTE = String.fromCharCode(39); // A single quote, unambiguously.

  it('neutralises a cell that would be EXECUTED by a spreadsheet', () => {
    const hostile = `=cmd|${QUOTE}/c calc${QUOTE}!A0`;
    const cell = csvCell(hostile);

    // Prefixed, so a spreadsheet reads it as text rather than evaluating it.
    expect(cell.startsWith(`"${QUOTE}=`)).toBe(true);
    // And the inner quotes survive intact, just doubled per RFC 4180.
    expect(cell).toContain('/c calc');
  });

  it('neutralises every leader a spreadsheet evaluates', () => {
    for (const leader of ['=', '+', '-', '@', '\t', '\r']) {
      const cell = csvCell(`${leader}SUM(A1:A9)`);
      // The prefix goes INSIDE the quotes, or it would be CSV grammar rather
      // than part of the cell.
      expect(cell.startsWith(`"${QUOTE}`)).toBe(true);
    }
  });

  it('protects an ORDINARY value that happens to start with a minus', () => {
    // The realistic case, and the reason this is not just about attackers: a
    // campaign called "-40% malnutrition in Bastar".
    expect(csvCell('-40% malnutrition')).toBe(`"${QUOTE}-40% malnutrition"`);
  });

  it('leaves a value alone when the character is not leading', () => {
    expect(csvCell('School kits = 2')).toBe('"School kits = 2"');
  });

  it('does not mangle a negative NUMBER, which is not text', () => {
    // Numbers arrive as numbers, are stringified, and a leading `-` is then
    // neutralised — which is correct: a spreadsheet cannot tell the difference
    // once it is in the file, and a wrong total is worse than a quoted one.
    expect(csvCell(-500)).toBe(`"${QUOTE}-500"`);
  });
});

describe('RFC 4180', () => {
  it('doubles an inner quote', () => {
    expect(csvCell('She said "yes"')).toBe('"She said ""yes"""');
  });

  it('survives a comma and a newline inside a cell', () => {
    expect(csvCell('Pune, Maharashtra\nIndia')).toBe('"Pune, Maharashtra\nIndia"');
  });

  it('writes an empty cell for null and undefined', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  it('writes a boolean as a word a human reads', () => {
    expect(csvCell(true)).toBe('"yes"');
    expect(csvCell(false)).toBe('"no"');
  });

  it('writes a date as ISO, in UTC', () => {
    // A locale-formatted date in a CSV is a date somebody's spreadsheet will
    // reinterpret — and 03/04 is two different days either side of an ocean.
    expect(csvCell(new Date('2026-03-31T18:30:00.000Z'))).toBe('"2026-03-31T18:30:00.000Z"');
  });

  it('joins a row with commas', () => {
    expect(csvRow(['a', 1, null])).toBe('"a","1",""');
  });

  it('ends lines with CRLF and carries a BOM', () => {
    const file = toCsv(['name'], [['Meera']]);
    expect(file.startsWith(UTF8_BOM)).toBe(true);
    expect(file).toContain('\r\n');
    expect(file.endsWith('\r\n')).toBe(true);
  });

  it('writes the headers first', () => {
    const file = toCsv(['reference', 'amount'], [['DON-1', 500]]);
    const [header, first] = file.slice(UTF8_BOM.length).split('\r\n');
    expect(header).toBe('"reference","amount"');
    expect(first).toBe('"DON-1","500"');
  });

  it('writes only headers for an empty export', () => {
    expect(toCsv(['a'], [])).toBe(`${UTF8_BOM}"a"\r\n`);
  });
});

describe('the filename', () => {
  it('cannot break out of the Content-Disposition header', () => {
    const name = csvFilename('donations"\r\nX-Injected: 1', '2026-04-01', '2026-04-30');
    expect(name).not.toContain('"');
    expect(name).not.toContain('\r');
    expect(name).not.toContain('\n');
  });

  it('cannot traverse a directory', () => {
    expect(csvFilename('../../etc/passwd', '2026-04-01', '2026-04-30')).not.toContain('..');
  });

  it('names the dataset and the range', () => {
    expect(csvFilename('donations', '2026-04-01', '2026-04-30')).toBe(
      'sailent-donations-2026-04-01-to-2026-04-30.csv',
    );
  });
});
