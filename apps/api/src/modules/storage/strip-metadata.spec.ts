import { describe, expect, it } from 'vitest';

import { stripImageMetadata } from './strip-metadata.js';

// ── builders for small, structurally valid files ─────────────────────────────

function segment(marker: number, payload: Buffer): Buffer {
  const header = Buffer.alloc(4);
  header[0] = 0xff;
  header[1] = marker;
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}

/** An Exif APP1 payload: Orientation in IFD0 and a GPS IFD with a latitude. */
function exifPayload(orientation: number): Buffer {
  const tiff = Buffer.alloc(64);
  tiff.write('MM', 0, 'latin1'); // big-endian, to exercise both byte orders
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(2, 8); // two entries
  tiff.writeUInt16BE(0x0112, 10); // Orientation
  tiff.writeUInt16BE(3, 12);
  tiff.writeUInt32BE(1, 14);
  tiff.writeUInt16BE(orientation, 18);
  tiff.writeUInt16BE(0x8825, 22); // GPS IFD pointer
  tiff.writeUInt16BE(4, 24);
  tiff.writeUInt32BE(1, 26);
  tiff.writeUInt32BE(40, 30);
  tiff.write('GPSLatitude18.5204N', 40, 'latin1');
  return Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
}

function jpeg(parts: Buffer[]): Buffer {
  const sof = segment(0xc0, Buffer.from([8, 0, 1, 0, 1, 1, 1, 0x11, 0]));
  const sos = Buffer.concat([
    segment(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])),
    Buffer.from([0x12, 0x34, 0x56]),
    Buffer.from([0xff, 0xd9]),
  ]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), ...parts, sof, sos]);
}

const JFIF = segment(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1'));
const ICC = segment(0xe2, Buffer.from('ICC_PROFILE\0\x01\x01colour-data', 'latin1'));
const XMP = segment(
  0xe1,
  Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>GPS 18.52</x:xmpmeta>', 'latin1'),
);
const COMMENT = segment(0xfe, Buffer.from('Taken at the field office', 'latin1'));

function pngChunk(type: string, data: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  header.write(type, 4, 'latin1');
  return Buffer.concat([header, data, Buffer.alloc(4)]); // CRC not checked here
}

function png(chunks: Buffer[]): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', Buffer.alloc(13, 1)),
    ...chunks,
    pngChunk('IDAT', Buffer.from('pixels')),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function webpChunk(type: string, data: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.write(type, 0, 'latin1');
  header.writeUInt32LE(data.length, 4);
  return Buffer.concat([header, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}

function webp(chunks: Buffer[]): Buffer {
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, body]);
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('stripImageMetadata — JPEG', () => {
  it('removes Exif (with GPS), XMP and comments, and keeps JFIF, ICC and the image data', () => {
    const input = jpeg([JFIF, segment(0xe1, exifPayload(1)), XMP, COMMENT, ICC]);
    const { bytes, stripped, parsed } = stripImageMetadata(input, 'image/jpeg');

    expect(parsed).toBe(true);
    expect(stripped).toBe(true);
    const text = bytes.toString('latin1');
    expect(text).not.toContain('Exif');
    expect(text).not.toContain('GPS');
    expect(text).not.toContain('xmpmeta');
    expect(text).not.toContain('field office');
    expect(text).toContain('JFIF');
    expect(text).toContain('ICC_PROFILE');
    // Starts with SOI, ends with the untouched scan and EOI.
    expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(bytes.subarray(-5)).toEqual(Buffer.from([0x12, 0x34, 0x56, 0xff, 0xd9]));
  });

  it('keeps a non-default orientation as a minimal Exif block with nothing else in it', () => {
    const input = jpeg([JFIF, segment(0xe1, exifPayload(6))]);
    const { bytes } = stripImageMetadata(input, 'image/jpeg');

    const text = bytes.toString('latin1');
    expect(text).not.toContain('GPS');
    const at = bytes.indexOf(Buffer.from('Exif\0\0', 'latin1'));
    expect(at).toBeGreaterThan(0);
    // Right after JFIF, before the frame.
    expect(bytes.indexOf(Buffer.from([0xff, 0xc0]))).toBeGreaterThan(at);
    const tiff = bytes.subarray(at + 6);
    expect(tiff.readUInt16LE(8)).toBe(1); // exactly one tag
    expect(tiff.readUInt16LE(10)).toBe(0x0112);
    expect(tiff.readUInt16LE(18)).toBe(6);
  });

  it('returns a file with no metadata unchanged', () => {
    const input = jpeg([JFIF]);
    const result = stripImageMetadata(input, 'image/jpeg');
    expect(result).toEqual({ bytes: input, stripped: false, parsed: true });
  });

  it('returns a truncated file unchanged rather than guessing', () => {
    const input = jpeg([JFIF, segment(0xe1, exifPayload(1))]).subarray(0, 30);
    const result = stripImageMetadata(input, 'image/jpeg');
    expect(result.parsed).toBe(false);
    expect(result.bytes).toBe(input);
  });
});

describe('stripImageMetadata — PNG', () => {
  it('removes eXIf, text and time chunks, and keeps the image chunks', () => {
    const input = png([
      pngChunk('eXIf', exifPayload(1).subarray(6)),
      pngChunk('tEXt', Buffer.from('Location\0Pune', 'latin1')),
      pngChunk('iTXt', Buffer.from('Author\0\0\0\0\0Field worker', 'latin1')),
      pngChunk('tIME', Buffer.alloc(7)),
      pngChunk('gAMA', Buffer.alloc(4)),
    ]);
    const { bytes, stripped } = stripImageMetadata(input, 'image/png');

    expect(stripped).toBe(true);
    const text = bytes.toString('latin1');
    for (const gone of ['eXIf', 'tEXt', 'iTXt', 'tIME', 'Pune', 'GPS']) {
      expect(text).not.toContain(gone);
    }
    for (const kept of ['IHDR', 'gAMA', 'IDAT', 'IEND']) {
      expect(text).toContain(kept);
    }
  });
});

describe('stripImageMetadata — WebP', () => {
  it('removes EXIF and XMP chunks, clears their VP8X flags and fixes the RIFF size', () => {
    const vp8x = Buffer.alloc(10);
    vp8x[0] = 0x08 | 0x04 | 0x10; // EXIF + XMP + alpha
    const input = webp([
      webpChunk('VP8X', vp8x),
      webpChunk('VP8L', Buffer.from('lossless-pixels')),
      webpChunk('EXIF', exifPayload(1).subarray(6)),
      webpChunk('XMP ', Buffer.from('<x:xmpmeta>GPS</x:xmpmeta>')),
    ]);
    const { bytes, stripped } = stripImageMetadata(input, 'image/webp');

    expect(stripped).toBe(true);
    const text = bytes.toString('latin1');
    expect(text).not.toContain('EXIF');
    expect(text).not.toContain('GPS');
    expect(text).toContain('VP8L');
    expect(bytes.readUInt32LE(4)).toBe(bytes.length - 8);
    expect(bytes[20]).toBe(0x10); // only the alpha flag remains
  });
});

describe('stripImageMetadata — anything else', () => {
  it('leaves other types alone', () => {
    const pdf = Buffer.from('%PDF-1.7 ...');
    expect(stripImageMetadata(pdf, 'application/pdf')).toEqual({
      bytes: pdf,
      stripped: false,
      parsed: false,
    });
  });
});
