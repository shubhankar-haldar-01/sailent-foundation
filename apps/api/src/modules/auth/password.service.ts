import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Password hashing.
 *
 * Argon2id, which is the current recommendation: it resists both GPU attacks
 * (memory-hard) and side-channel attacks (the `id` variant). Parameters are
 * tuned for roughly 100ms on the deployment target — slow enough to make
 * offline cracking expensive, fast enough not to be its own DoS vector.
 *
 * Applies to STAFF ONLY. Donors authenticate by phone OTP and have no password
 * at all (decision A8), so there is nothing to leak, reuse or phish at scale,
 * and no password-reset flow to secure.
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
  // `raw: false` selects the encoded-string overload. A raw Buffer would lose
  // the embedded parameters, and a hash you cannot read the parameters back
  // out of cannot be upgraded later.
  raw: false,
} as const;

@Injectable()
export class PasswordService {
  hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, ARGON2_OPTIONS);
  }

  /**
   * Verify a password.
   *
   * Returns false rather than throwing on a malformed hash: a corrupt hash is
   * a failed login, not a 500 that tells an attacker something interesting.
   */
  async verify(hash: string | null, plaintext: string): Promise<boolean> {
    if (!hash) return false;
    try {
      return await argon2.verify(hash, plaintext);
    } catch {
      return false;
    }
  }

  /** True when the stored hash was produced with weaker parameters than current. */
  needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, ARGON2_OPTIONS);
    } catch {
      return true;
    }
  }
}
