import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { AppConfig } from '../../config/app.config.js';
import { ServiceUnavailableException } from '../exceptions.js';

/** Stored values start with this. Anything else is a legacy plaintext value. */
export const ENCRYPTED_PREFIX = 'enc:v1:';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Decode `FIELD_ENCRYPTION_KEY`: 32 bytes, as base64 or 64 hex characters. */
export function decodeFieldKey(raw: string | undefined): Buffer | null {
  if (!raw) return null;
  const value = raw.trim();
  const key = /^[0-9a-f]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64');
  return key.length === 32 ? key : null;
}

/**
 * Encryption at rest for a single sensitive column — the donor's tax id (PAN).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * STANDARD AUTHENTICATED ENCRYPTION, NOTHING INVENTED (Phase 12).
 *
 * AES-256-GCM from Node's own crypto module, a fresh random 96-bit IV per
 * value, the 128-bit authentication tag stored alongside, and the column's
 * name bound in as associated data so a value cannot be moved to another
 * column and still decrypt. Stored as
 *
 *     enc:v1:<iv base64url>:<ciphertext base64url>:<tag base64url>
 *
 * which is also the shape the local databases' `donors_tax_id_encrypted`
 * CHECK (`LIKE 'enc:%'`) expects.
 *
 * THE KEY is `FIELD_ENCRYPTION_KEY`: 32 random bytes, base64 or hex, held only
 * by the API and REQUIRED IN PRODUCTION. Losing it makes every stored PAN
 * unreadable; leaking it makes them readable to whoever holds a database copy
 * as well. Key management — generation, storage, rotation — is a human,
 * deployment-time responsibility (SECURITY.md).
 *
 * WITHOUT A KEY (local development only) a PAN cannot be STORED: `encrypt`
 * refuses with a 503 rather than quietly writing plaintext.
 *
 * LEGACY PLAINTEXT values written before this existed are still READ (no
 * prefix → returned as-is) and are encrypted the next time they are written.
 * Re-encrypting existing rows in bulk is a human-run deployment step.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class FieldEncryptionService {
  private readonly key!: Buffer | null;

  constructor(config: AppConfig) {
    // Held off the enumerable surface, like the Razorpay secrets: a serialised
    // service must not carry the key into a log.
    Object.defineProperty(this, 'key', {
      value: decodeFieldKey(config.env.FIELD_ENCRYPTION_KEY),
      enumerable: false,
      writable: false,
    });
  }

  get isConfigured(): boolean {
    return this.key !== null;
  }

  encrypt(plaintext: string, context: string): string {
    if (!this.key) {
      throw new ServiceUnavailableException(
        'Tax id storage is not configured on this server, so the number was not saved.',
      );
    }
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_BYTES });
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${ENCRYPTED_PREFIX}${iv.toString('base64url')}:${ciphertext.toString('base64url')}:${tag.toString('base64url')}`;
  }

  /**
   * The plaintext of a stored value. A value without the prefix is legacy
   * plaintext and is returned unchanged. Throws if a value is encrypted and
   * there is no key, or if it was tampered with (GCM authentication fails).
   */
  decrypt(stored: string, context: string): string {
    if (!stored.startsWith(ENCRYPTED_PREFIX)) return stored;
    if (!this.key) {
      throw new ServiceUnavailableException('Tax id storage is not configured on this server.');
    }
    const [iv, ciphertext, tag] = stored.slice(ENCRYPTED_PREFIX.length).split(':');
    if (!iv || ciphertext === undefined || !tag) {
      throw new Error('Malformed encrypted value');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(iv, 'base64url'), {
      authTagLength: TAG_BYTES,
    });
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}

/**
 * A PAN with all but its last four characters hidden — what a donor sees of
 * their own number. `ABCDE1234F` → `XXXXXX234F`.
 */
export function maskTaxId(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  const visible = plaintext.slice(-4);
  return `${'X'.repeat(Math.max(plaintext.length - 4, 0))}${visible}`;
}

/** The associated-data label for the donor tax id column. */
export const TAX_ID_CONTEXT = 'donors.tax_id_number';
