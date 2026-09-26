import { describe, expect, it } from 'vitest';

import { UnsupportedImageError, inspectImage } from './image-inspection.js';

/**
 * What is actually in the file.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE DECLARED CONTENT TYPE IS A CLAIM. THESE TESTS ARE ABOUT NOT BELIEVING IT.
 *
 * Every case below passes a declared type that is wrong, or absent, and
 * asserts that the BYTES decided. A validator that can be talked out of its
 * answer by a header is not a validator.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** A 1×1 JPEG, with a real SOF0 frame header so dimensions can be read. */
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
    'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
    'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);

/** A 1×1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** A 1×1 lossy WebP (`VP8 ` chunk). */
const WEBP = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64');

describe('accepted formats', () => {
  it('identifies a JPEG whatever the upload claimed', () => {
    // Declared as PNG. The bytes say JPEG, so it is a JPEG.
    expect(inspectImage(JPEG, 'image/png').mimeType).toBe('image/jpeg');
  });

  it('identifies a PNG, and reads its dimensions', () => {
    const result = inspectImage(PNG, 'application/octet-stream');
    expect(result.mimeType).toBe('image/png');
    expect(result).toMatchObject({ width: 1, height: 1 });
  });

  it('identifies a WebP', () => {
    expect(inspectImage(WEBP).mimeType).toBe('image/webp');
  });

  it('reads JPEG dimensions from the frame header', () => {
    expect(inspectImage(JPEG)).toMatchObject({ width: 1, height: 1 });
  });
});

describe('refusals', () => {
  it('REFUSES an executable that claims to be a PNG', () => {
    /*
      The attack this exists for. A shell script with `Content-Type: image/png`
      is accepted by any check that reads the header and not the file.
    */
    const script = Buffer.from('#!/bin/sh\nrm -rf /\n');
    expect(() => inspectImage(script, 'image/png')).toThrow(UnsupportedImageError);
  });

  it('REFUSES HTML that claims to be an image', () => {
    // Stored in a public bucket and opened directly, this would run script
    // from the organisation's own domain.
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    expect(() => inspectImage(html, 'image/jpeg')).toThrow(UnsupportedImageError);
  });

  it('REFUSES SVG, and says why', () => {
    /*
      SVG is the one people actually try, so the refusal explains itself rather
      than reading as an oversight somebody should go and fix.
    */
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    expect(() => inspectImage(svg, 'image/svg+xml')).toThrow(/SVG is not accepted/);
  });

  it('refuses a GIF — not in the accepted set', () => {
    const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(32)]);
    expect(() => inspectImage(gif, 'image/gif')).toThrow(UnsupportedImageError);
  });

  it('refuses an empty file', () => {
    expect(() => inspectImage(Buffer.alloc(0), 'image/png')).toThrow(/empty/i);
  });

  it('refuses a PDF', () => {
    const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(32)]);
    expect(() => inspectImage(pdf, 'image/png')).toThrow(UnsupportedImageError);
  });

  it('refuses a truncated PNG signature', () => {
    // Seven of the eight signature bytes. Close is not a match.
    expect(() => inspectImage(PNG.subarray(0, 7), 'image/png')).toThrow(UnsupportedImageError);
  });

  it('refuses a RIFF container that is not WebP', () => {
    // A WAV file is RIFF too. The form type is what distinguishes them.
    const wav = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.alloc(4),
      Buffer.from('WAVE'),
      Buffer.alloc(32),
    ]);
    expect(() => inspectImage(wav, 'image/webp')).toThrow(UnsupportedImageError);
  });
});

describe('malformed but plausible input', () => {
  it('returns null dimensions rather than hanging on a corrupt JPEG', () => {
    /*
      JPEG segment lengths come from the file, which means from whoever
      uploaded it. A malformed length must not spin the marker walk forever —
      the loop is bounded, and failing to find dimensions is not a reason to
      reject an otherwise valid image.
    */
    const corrupt = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00]),
      Buffer.alloc(64, 0xff),
    ]);

    const result = inspectImage(corrupt);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.width).toBeNull();
  });

  it('does not hang on a JPEG whose segments never terminate', () => {
    /*
      A REAL JPEG signature (`FF D8 FF`) followed by segments that never
      resolve — every byte is `FF`, so the marker walk finds markers forever
      with zero-length payloads. Without the bounds this is an infinite loop on
      attacker-supplied input.
    */
    const started = Date.now();
    const pathological = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(8192, 0xff)]);

    const result = inspectImage(pathological);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.width).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
