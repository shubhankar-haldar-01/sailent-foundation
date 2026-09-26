import { describe, expect, it } from 'vitest';

import { TotpService } from './totp.service.js';

/**
 * RFC 6238 test vectors.
 *
 * The RFC publishes these against the ASCII secret `12345678901234567890`,
 * which is `GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ` in base32. Testing against the
 * published vectors rather than against our own output is the whole point: an
 * implementation that is self-consistently wrong passes every round-trip test
 * and fails against every real authenticator app.
 */
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

const RFC_VECTORS: { unixSeconds: number; code: string }[] = [
  { unixSeconds: 59, code: '287082' },
  { unixSeconds: 1111111109, code: '081804' },
  { unixSeconds: 1111111111, code: '050471' },
  { unixSeconds: 1234567890, code: '005924' },
  { unixSeconds: 2000000000, code: '279037' },
];

describe('TotpService', () => {
  const totp = new TotpService();

  it.each(RFC_VECTORS)('matches RFC 6238 vector at t=$unixSeconds', ({ unixSeconds, code }) => {
    expect(totp.generate(RFC_SECRET, unixSeconds * 1000)).toBe(code);
  });

  it('accepts the code for the current window', () => {
    const now = Date.now();
    expect(totp.verify(RFC_SECRET, totp.generate(RFC_SECRET, now), now)).toBe(true);
  });

  it('accepts one window of clock drift in each direction', () => {
    // A phone whose clock is twenty seconds out is common. Refusing it turns
    // 2FA into a support queue.
    const now = Date.now();
    expect(totp.verify(RFC_SECRET, totp.generate(RFC_SECRET, now - 30_000), now)).toBe(true);
    expect(totp.verify(RFC_SECRET, totp.generate(RFC_SECRET, now + 30_000), now)).toBe(true);
  });

  it('refuses a code two windows away', () => {
    // The window has to end somewhere; a code from two minutes ago is either a
    // replay or a badly broken clock, and neither should be let through.
    const now = Date.now();
    expect(totp.verify(RFC_SECRET, totp.generate(RFC_SECRET, now - 90_000), now)).toBe(false);
    expect(totp.verify(RFC_SECRET, totp.generate(RFC_SECRET, now + 90_000), now)).toBe(false);
  });

  it('refuses anything that is not six digits, without touching the secret', () => {
    const now = Date.now();
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 56', '12345a', '-12345']) {
      expect(totp.verify(RFC_SECRET, bad, now)).toBe(false);
    }
  });

  it('refuses a correct-looking code generated from a different secret', () => {
    const now = Date.now();
    const other = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    expect(totp.verify(RFC_SECRET, totp.generate(other, now), now)).toBe(false);
  });

  it('generates a 32-character base32 secret an authenticator app can read', () => {
    const secret = totp.generateSecret();
    expect(secret).toHaveLength(32);
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  it('generates distinct secrets', () => {
    const secrets = new Set(Array.from({ length: 20 }, () => totp.generateSecret()));
    expect(secrets.size).toBe(20);
  });

  it('builds a provisioning URI with the issuer and account escaped', () => {
    const uri = totp.provisioningUri(RFC_SECRET, 'priya@sailentfoundation.org');
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain(`secret=${RFC_SECRET}`);
    expect(uri).toContain('issuer=Sailent%20Foundation');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
    // The label contains an `@` and a `:` — both must survive encoding, or the
    // app shows a mangled account name.
    expect(uri).toContain(encodeURIComponent('Sailent Foundation:priya@sailentfoundation.org'));
  });
});
