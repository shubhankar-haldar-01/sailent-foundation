import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP (RFC 6238).
 *
 * Implemented directly rather than pulled from a package: it is roughly thirty
 * lines of well-specified HMAC, and a dependency for that is a supply-chain
 * surface bought for nothing.
 *
 * Mandatory for Super Admin, Admin and Finance Manager (decision A8) — roles
 * that can move money or change what other roles may do. A password alone is
 * not sufficient for those.
 */
const DIGITS = 6;
const PERIOD_SECONDS = 30;
/** Accept the adjacent windows, so a slightly wrong device clock still works. */
const DRIFT_WINDOWS = 1;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

@Injectable()
export class TotpService {
  /** Base32 secret, the format every authenticator app expects. */
  generateSecret(): string {
    const bytes = randomBytes(20);
    let bits = '';
    for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');

    let secret = '';
    for (let index = 0; index + 5 <= bits.length; index += 5) {
      secret += BASE32_ALPHABET[Number.parseInt(bits.slice(index, index + 5), 2)];
    }
    return secret;
  }

  /** The provisioning URI an authenticator app scans as a QR code. */
  provisioningUri(secret: string, account: string, issuer = 'Sailent Foundation'): string {
    const label = encodeURIComponent(`${issuer}:${account}`);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD_SECONDS}`;
  }

  /** The code for a given moment. Exposed so development tooling can print one. */
  generate(secret: string, atMs: number = Date.now()): string {
    const counter = Math.floor(atMs / 1000 / PERIOD_SECONDS);
    return this.hotp(secret, counter);
  }

  /**
   * Verify a submitted code.
   *
   * Compared in CONSTANT TIME. A naive `===` leaks the correct code one digit
   * at a time under timing analysis — a six-digit space is small enough that
   * this matters.
   */
  verify(secret: string, code: string, atMs: number = Date.now()): boolean {
    if (!/^\d{6}$/.test(code)) return false;

    const counter = Math.floor(atMs / 1000 / PERIOD_SECONDS);

    for (let offset = -DRIFT_WINDOWS; offset <= DRIFT_WINDOWS; offset += 1) {
      const candidate = this.hotp(secret, counter + offset);
      const a = Buffer.from(candidate);
      const b = Buffer.from(code);
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    }
    return false;
  }

  private hotp(secret: string, counter: number): string {
    const key = base32Decode(secret);

    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter));

    const digest = createHmac('sha1', key).update(buffer).digest();
    // Dynamic truncation, per the RFC.
    const offset = digest[digest.length - 1]! & 0x0f;
    const binary =
      ((digest[offset]! & 0x7f) << 24) |
      ((digest[offset + 1]! & 0xff) << 16) |
      ((digest[offset + 2]! & 0xff) << 8) |
      (digest[offset + 3]! & 0xff);

    return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
  }
}

function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/, '').toUpperCase();
  let bits = '';

  for (const character of cleaned) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) continue;
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}
