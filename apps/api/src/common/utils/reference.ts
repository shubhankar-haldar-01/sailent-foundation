import { randomBytes } from 'node:crypto';

/**
 * Human-usable reference codes.
 *
 * These appear in URLs, emails and support conversations, so they avoid
 * characters a person reads back wrongly over the phone: no 0/O, no 1/I/L.
 * A uuid is correct for a primary key and hopeless for "can you read me your
 * donation reference".
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function referenceCode(prefix: string, length = 6): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let index = 0; index < length; index += 1) {
    out += ALPHABET[bytes[index]! % ALPHABET.length];
  }
  return `${prefix}-${out}`;
}

/** Sequential yearly code: DNR-2026-00001, VOL-2026-00001. */
export function sequentialCode(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(5, '0')}`;
}
