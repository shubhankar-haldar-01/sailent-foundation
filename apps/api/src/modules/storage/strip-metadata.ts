/**
 * Remove EXIF, GPS, XMP and text metadata from an uploaded image (Phase 13).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY, AND WHY LIKE THIS.
 *
 * A phone photograph carries where it was taken (GPS), when, and on what
 * device. On a site that photographs beneficiaries — children, villages —
 * publishing those coordinates is a safeguarding failure, not a privacy
 * nicety.
 *
 * This removes the METADATA SEGMENTS and copies everything else byte for
 * byte. Nothing is decoded or re-encoded, so image quality is unchanged and
 * there is no image library to keep patched (`image-inspection.ts` explains
 * why sharp was not adopted). What is removed:
 *
 *   JPEG  APP1 (Exif and XMP), APP3–APP13, APP15 and comments. Kept: APP0
 *         (JFIF), APP2 ICC profiles (colour) and APP14 (Adobe colour
 *         transform), and every non-metadata segment. If the photo had an
 *         Exif Orientation other than "normal", a MINIMAL Exif block holding
 *         only that one tag is written back, so a portrait photo from a phone
 *         does not turn sideways.
 *   PNG   eXIf, tEXt, zTXt, iTXt and tIME chunks.
 *   WebP  EXIF and XMP chunks, with the VP8X flags and RIFF size corrected.
 *
 * Anything it cannot parse is returned UNCHANGED with `stripped: false` and
 * the caller decides; the upload path has already sniffed the type from the
 * bytes, so in practice this means a truncated or unusual file.
 *
 * Applies to NEW uploads. Images already stored before Phase 13 keep their
 * metadata until a human re-processes them (DEPLOYMENT.md §6c).
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface StripResult {
  bytes: Buffer;
  /** True if at least one metadata segment was removed. */
  stripped: boolean;
  /** False if the structure could not be walked; `bytes` is then the input. */
  parsed: boolean;
}

export function stripImageMetadata(input: Buffer, mimeType: string): StripResult {
  try {
    switch (mimeType) {
      case 'image/jpeg':
        return stripJpeg(input);
      case 'image/png':
        return stripPng(input);
      case 'image/webp':
        return stripWebp(input);
      default:
        return { bytes: input, stripped: false, parsed: false };
    }
  } catch {
    return { bytes: input, stripped: false, parsed: false };
  }
}

// ── JPEG ────────────────────────────────────────────────────────────────────

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const APP0 = 0xe0;
const APP1 = 0xe1;
const APP2 = 0xe2;
const COM = 0xfe;

function stripJpeg(input: Buffer): StripResult {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== SOI) {
    return { bytes: input, stripped: false, parsed: false };
  }

  const kept: Buffer[] = [input.subarray(0, 2)];
  let orientation: number | null = null;
  let stripped = false;
  let offset = 2;

  while (offset < input.length) {
    if (input[offset] !== 0xff) return { bytes: input, stripped: false, parsed: false };
    // Fill bytes (0xFF padding) between markers are legal.
    let markerOffset = offset;
    while (input[markerOffset + 1] === 0xff) markerOffset += 1;
    const marker = input[markerOffset + 1];
    if (marker === undefined) return { bytes: input, stripped: false, parsed: false };

    // Standalone markers carry no length.
    if (marker === EOI) {
      kept.push(input.subarray(markerOffset, markerOffset + 2));
      offset = markerOffset + 2;
      break;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      kept.push(input.subarray(markerOffset, markerOffset + 2));
      offset = markerOffset + 2;
      continue;
    }

    if (markerOffset + 4 > input.length) return { bytes: input, stripped: false, parsed: false };
    const length = input.readUInt16BE(markerOffset + 2);
    const end = markerOffset + 2 + length;
    if (length < 2 || end > input.length) return { bytes: input, stripped: false, parsed: false };
    const segment = input.subarray(markerOffset, end);

    if (marker === SOS) {
      // Image data follows until EOI; copy the rest verbatim.
      kept.push(input.subarray(markerOffset));
      offset = input.length;
      break;
    }

    const isMetadata =
      marker === APP1 ||
      (marker >= 0xe3 && marker <= 0xed) ||
      marker === 0xef ||
      marker === COM ||
      (marker === APP2 && !segment.subarray(4, 16).toString('latin1').startsWith('ICC_PROFILE'));

    if (isMetadata) {
      if (marker === APP1 && orientation === null) {
        orientation = readExifOrientation(segment.subarray(4));
      }
      stripped = true;
    } else {
      kept.push(segment);
    }
    offset = end;
  }

  if (!stripped) return { bytes: input, stripped: false, parsed: true };

  if (orientation !== null && orientation !== 1) {
    // After SOI and an APP0 if present: APP1 must precede the frame segments.
    const insertAt = kept.length > 1 && kept[1]![1] === APP0 ? 2 : 1;
    kept.splice(insertAt, 0, minimalExifOrientation(orientation));
  }
  return { bytes: Buffer.concat(kept), stripped: true, parsed: true };
}

/** The Orientation tag (0x0112) of IFD0 in an APP1 Exif payload, if present. */
function readExifOrientation(payload: Buffer): number | null {
  if (payload.subarray(0, 6).toString('latin1') !== 'Exif\0\0') return null;
  const tiff = payload.subarray(6);
  if (tiff.length < 8) return null;
  const little = tiff.toString('latin1', 0, 2) === 'II';
  const u16 = (at: number) => (little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at));
  const u32 = (at: number) => (little ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at));
  const ifd = u32(4);
  if (ifd + 2 > tiff.length) return null;
  const entries = u16(ifd);
  for (let index = 0; index < entries; index += 1) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > tiff.length) return null;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

/** An APP1 segment holding a TIFF header and ONE tag: Orientation. */
function minimalExifOrientation(orientation: number): Buffer {
  const tiff = Buffer.alloc(8 + 2 + 12 + 4);
  tiff.write('II', 0, 'latin1');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4); // IFD0 offset
  tiff.writeUInt16LE(1, 8); // one entry
  tiff.writeUInt16LE(0x0112, 10); // Orientation
  tiff.writeUInt16LE(3, 12); // SHORT
  tiff.writeUInt32LE(1, 14); // count
  tiff.writeUInt16LE(orientation, 18);
  tiff.writeUInt32LE(0, 22); // no next IFD
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const header = Buffer.alloc(4);
  header[0] = 0xff;
  header[1] = APP1;
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}

// ── PNG ─────────────────────────────────────────────────────────────────────

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_METADATA = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

function stripPng(input: Buffer): StripResult {
  if (input.length < 8 || !input.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { bytes: input, stripped: false, parsed: false };
  }
  const kept: Buffer[] = [input.subarray(0, 8)];
  let stripped = false;
  let offset = 8;
  while (offset < input.length) {
    if (offset + 12 > input.length) return { bytes: input, stripped: false, parsed: false };
    const length = input.readUInt32BE(offset);
    const type = input.toString('latin1', offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > input.length) return { bytes: input, stripped: false, parsed: false };
    if (PNG_METADATA.has(type)) stripped = true;
    else kept.push(input.subarray(offset, end));
    offset = end;
    if (type === 'IEND') break;
  }
  return stripped
    ? { bytes: Buffer.concat(kept), stripped: true, parsed: true }
    : { bytes: input, stripped: false, parsed: true };
}

// ── WebP ────────────────────────────────────────────────────────────────────

const VP8X_FLAG_EXIF = 0x08;
const VP8X_FLAG_XMP = 0x04;

function stripWebp(input: Buffer): StripResult {
  if (
    input.length < 12 ||
    input.toString('latin1', 0, 4) !== 'RIFF' ||
    input.toString('latin1', 8, 12) !== 'WEBP'
  ) {
    return { bytes: input, stripped: false, parsed: false };
  }
  const kept: Buffer[] = [];
  let stripped = false;
  let offset = 12;
  while (offset < input.length) {
    if (offset + 8 > input.length) return { bytes: input, stripped: false, parsed: false };
    const type = input.toString('latin1', offset, offset + 4);
    const size = input.readUInt32LE(offset + 4);
    const end = offset + 8 + size + (size % 2);
    if (end > input.length + (size % 2)) return { bytes: input, stripped: false, parsed: false };
    const chunk = Buffer.from(input.subarray(offset, Math.min(end, input.length)));
    if (type === 'EXIF' || type === 'XMP ') {
      stripped = true;
    } else {
      if (type === 'VP8X' && chunk.length > 8) {
        chunk[8] = chunk[8]! & ~(VP8X_FLAG_EXIF | VP8X_FLAG_XMP);
      }
      kept.push(chunk);
    }
    offset = end;
  }
  if (!stripped) return { bytes: input, stripped: false, parsed: true };
  const body = Buffer.concat(kept);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return { bytes: Buffer.concat([header, body]), stripped: true, parsed: true };
}
