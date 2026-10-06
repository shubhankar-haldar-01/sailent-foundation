import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../../config/app.config.js';
import {
  ENCRYPTED_PREFIX,
  FieldEncryptionService,
  TAX_ID_CONTEXT,
  decodeFieldKey,
  maskTaxId,
} from './field-encryption.service.js';

const KEY = Buffer.alloc(32, 9).toString('base64');
const withKey = (key?: string) =>
  new FieldEncryptionService({ env: { FIELD_ENCRYPTION_KEY: key } } as unknown as AppConfig);

/** Phase 12: the donor tax id at rest — AES-256-GCM, authenticated, keyed. */
describe('FieldEncryptionService', () => {
  const service = withKey(KEY);

  it('round-trips, with a fresh IV every time', () => {
    const a = service.encrypt('ABCDE1234F', TAX_ID_CONTEXT);
    const b = service.encrypt('ABCDE1234F', TAX_ID_CONTEXT);
    expect(a.startsWith(ENCRYPTED_PREFIX)).toBe(true);
    expect(a).not.toBe(b);
    expect(a).not.toContain('ABCDE1234F');
    expect(service.decrypt(a, TAX_ID_CONTEXT)).toBe('ABCDE1234F');
  });

  it('detects tampering', () => {
    const stored = service.encrypt('ABCDE1234F', TAX_ID_CONTEXT);
    const [iv, ciphertext, tag] = stored.slice(ENCRYPTED_PREFIX.length).split(':');
    const flipped = Buffer.from(ciphertext!, 'base64url');
    flipped[0] = flipped[0]! ^ 0xff;
    const tampered = `${ENCRYPTED_PREFIX}${iv}:${flipped.toString('base64url')}:${tag}`;
    expect(() => service.decrypt(tampered, TAX_ID_CONTEXT)).toThrow();
  });

  it('will not decrypt a value moved to another column', () => {
    const stored = service.encrypt('ABCDE1234F', TAX_ID_CONTEXT);
    expect(() => service.decrypt(stored, 'donors.something_else')).toThrow();
  });

  it('will not decrypt with a different key', () => {
    const stored = service.encrypt('ABCDE1234F', TAX_ID_CONTEXT);
    expect(() =>
      withKey(Buffer.alloc(32, 1).toString('base64')).decrypt(stored, TAX_ID_CONTEXT),
    ).toThrow();
  });

  it('refuses to store a value when no key is configured, rather than writing plaintext', () => {
    expect(withKey(undefined).isConfigured).toBe(false);
    expect(() => withKey(undefined).encrypt('ABCDE1234F', TAX_ID_CONTEXT)).toThrow(
      /not configured/i,
    );
  });

  it('still reads a legacy plaintext value', () => {
    expect(service.decrypt('LEGAC1234Y', TAX_ID_CONTEXT)).toBe('LEGAC1234Y');
  });

  it('keeps the key out of anything that serialises the service', () => {
    expect(JSON.stringify(service)).not.toContain(KEY);
    expect(Object.keys(service)).not.toContain('key');
  });
});

describe('decodeFieldKey and maskTaxId', () => {
  it('accepts 32 bytes as base64 or hex, and nothing else', () => {
    expect(decodeFieldKey(KEY)?.length).toBe(32);
    expect(decodeFieldKey('ab'.repeat(32))?.length).toBe(32);
    expect(decodeFieldKey('too-short')).toBeNull();
    expect(decodeFieldKey(undefined)).toBeNull();
  });

  it('shows only the last four characters', () => {
    expect(maskTaxId('ABCDE1234F')).toBe('XXXXXX234F');
    expect(maskTaxId(null)).toBeNull();
  });
});
