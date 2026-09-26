/**
 * Print the current TOTP code for the development admin.
 *
 * Development convenience only — the secret is the published one from the seed,
 * which is safe because the seed never runs outside development.
 *
 * Usage: pnpm --filter @sailent/api totp:dev
 */
import { createHmac } from 'node:crypto';

const SECRET = process.argv[2] ?? 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input) {
  let bits = '';
  for (const character of input.replace(/=+$/, '').toUpperCase()) {
    const index = ALPHABET.indexOf(character);
    if (index !== -1) bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

const counter = Math.floor(Date.now() / 1000 / 30);
const buf = Buffer.alloc(8);
buf.writeBigUInt64BE(BigInt(counter));

const digest = createHmac('sha1', base32Decode(SECRET)).update(buf).digest();
const offset = digest[digest.length - 1] & 0x0f;
const binary =
  ((digest[offset] & 0x7f) << 24) |
  ((digest[offset + 1] & 0xff) << 16) |
  ((digest[offset + 2] & 0xff) << 8) |
  (digest[offset + 3] & 0xff);

const code = String(binary % 1_000_000).padStart(6, '0');
const secondsLeft = 30 - Math.floor((Date.now() / 1000) % 30);
console.log(`TOTP code: ${code}  (valid for ${secondsLeft}s)`);
