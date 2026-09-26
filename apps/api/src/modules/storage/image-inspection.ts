/**
 * What is actually in this file?
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE CLIENT'S CONTENT TYPE IS A CLAIM, NOT A FACT.
 *
 * A browser sends whatever `Content-Type` the multipart part carries, and an
 * attacker sends whatever they like. Trusting it means a file declared
 * `image/png` can be a shell script, an HTML document that runs script when
 * somebody opens the "image" URL, or a polyglot that is valid as both.
 *
 * So the declared type is used for NOTHING. The bytes are read, and the type
 * is whatever the signature says it is — or the upload is refused.
 *
 * NO DEPENDENCY FOR THIS. `file-type` and `sharp` both do far more than is
 * needed (sharp is a native binary with an install step), and the three
 * formats this phase accepts have short, stable, well-specified headers. The
 * same reasoning that made `TotpService` thirty lines of `node:crypto`.
 *
 * SVG IS DELIBERATELY ABSENT. It is XML, it can carry `<script>`, and serving
 * one from the public bucket is serving active content from the
 * organisation's own domain. Supporting it safely needs sanitisation this
 * project does not have, so it is not accepted at all rather than accepted and
 * hoped about.
 * ══════════════════════════════════════════════════════════════════════════
 */

export type SupportedImageType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface InspectedImage {
  mimeType: SupportedImageType;
  width: number | null;
  height: number | null;
}

export class UnsupportedImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedImageError';
  }
}

/** JPEG: `FF D8 FF`. */
function isJpeg(bytes: Buffer): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** PNG: the eight-byte signature from the specification. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function isPng(bytes: Buffer): boolean {
  return bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE);
}

/** WebP: `RIFF....WEBP` — a RIFF container whose form type is WEBP. */
function isWebp(bytes: Buffer): boolean {
  return (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

/**
 * PNG dimensions: the IHDR chunk starts at byte 16 and is big-endian.
 *
 * Fixed offsets, because IHDR is required by the specification to be the first
 * chunk. There is no scanning to do and no attacker-controlled length to trust.
 */
function pngDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/**
 * JPEG dimensions: walk the segment markers to the first frame header.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE ONLY LOOP HERE, AND IT IS BOUNDED TWICE.
 *
 * A JPEG is a sequence of length-prefixed segments, and the lengths come from
 * the file — which means they come from whoever uploaded it. A malformed
 * length could walk backwards, or not advance at all, and spin forever.
 *
 * So: the offset must strictly increase, the segment length must be at least
 * the two bytes it occupies, and the whole walk is capped. Failing to find the
 * dimensions returns null; it does not hang and it does not throw. Dimensions
 * are a nice-to-have on the record, not a reason to reject a valid image.
 * ══════════════════════════════════════════════════════════════════════════
 */
function jpegDimensions(bytes: Buffer): { width: number; height: number } | null {
  let offset = 2; // Past the SOI marker.
  let segments = 0;

  while (offset + 9 < bytes.length && segments < 512) {
    segments += 1;

    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1]!;

    // Standalone markers carry no length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2) return null;

    /*
      SOF0…SOF15, excluding the four that are not frame headers (DHT `C4`,
      JPG `C8`, DAC `CC`). Height precedes width, both big-endian.
    */
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

    if (isFrameHeader) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }

    offset += 2 + length;
  }

  return null;
}

/**
 * WebP dimensions, for the three chunk layouts.
 *
 * `VP8 ` (lossy), `VP8L` (lossless) and `VP8X` (extended) each encode the size
 * differently, and an animated or extended file is `VP8X`. Anything else
 * returns null rather than guessing.
 */
function webpDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const chunk = bytes.subarray(12, 16).toString('ascii');

  if (chunk === 'VP8 ') {
    // 14 bits each, following the three-byte start code.
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunk === 'VP8L') {
    // 14-bit fields packed across four bytes, each stored minus one.
    const packed = bytes.readUInt32LE(21);
    return {
      width: (packed & 0x3fff) + 1,
      height: ((packed >> 14) & 0x3fff) + 1,
    };
  }

  if (chunk === 'VP8X') {
    // 24-bit little-endian, each stored minus one.
    const width = bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16);
    const height = bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16);
    return { width: width + 1, height: height + 1 };
  }

  return null;
}

/**
 * Determine the real type and dimensions, or refuse.
 *
 * @param declaredMimeType What the client CLAIMED. Used only to produce a
 *   clearer error when it disagrees with the bytes — never to decide anything.
 */
export function inspectImage(bytes: Buffer, declaredMimeType?: string): InspectedImage {
  if (bytes.length === 0) {
    throw new UnsupportedImageError('That file is empty.');
  }

  if (isJpeg(bytes)) {
    return { mimeType: 'image/jpeg', ...(jpegDimensions(bytes) ?? { width: null, height: null }) };
  }

  if (isPng(bytes)) {
    return { mimeType: 'image/png', ...(pngDimensions(bytes) ?? { width: null, height: null }) };
  }

  if (isWebp(bytes)) {
    return { mimeType: 'image/webp', ...(webpDimensions(bytes) ?? { width: null, height: null }) };
  }

  /*
    Named explicitly, because "unsupported file" sends somebody hunting for a
    setting to change. SVG is the one people actually try, and it is refused on
    purpose rather than by omission.
  */
  const looksLikeSvg =
    bytes.subarray(0, 512).toString('utf8').trimStart().toLowerCase().startsWith('<svg') ||
    bytes.subarray(0, 512).toString('utf8').toLowerCase().includes('<svg');

  if (looksLikeSvg) {
    throw new UnsupportedImageError(
      'SVG is not accepted. An SVG is XML and can carry script, so serving one from the ' +
        'public bucket would be serving active content from this organisation’s own domain. ' +
        'Export it as PNG or WebP.',
    );
  }

  throw new UnsupportedImageError(
    declaredMimeType
      ? `That file is not a JPEG, PNG or WebP image — its contents do not match any of them, ` +
          `whatever the upload declared it to be (${declaredMimeType}).`
      : 'That file is not a JPEG, PNG or WebP image.',
  );
}
