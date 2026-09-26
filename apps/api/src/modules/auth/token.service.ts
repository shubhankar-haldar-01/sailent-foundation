import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

import type { AccessTokenClaims, TokenAudience } from '@sailent/types';

import { AppConfig } from '../../config/app.config.js';

/**
 * Token issuing and verification (decision A8).
 *
 * TWO NON-INTERCHANGEABLE AUDIENCES. A donor token presented to a staff
 * endpoint fails on the `aud` claim before any permission lookup runs, and
 * vice versa. They are signed with DIFFERENT SECRETS as well, so a donor token
 * is not merely rejected by the guard — it does not verify at all.
 *
 * Refresh tokens are opaque random strings, not JWTs, and only their SHA-256 is
 * stored. A leaked database therefore cannot be used to mint sessions.
 */
@Injectable()
export class TokenService {
  constructor(private readonly config: AppConfig) {}

  private secretFor(audience: TokenAudience): string {
    const base = this.config.env.JWT_ACCESS_SECRET ?? 'development-only-access-secret-change-me-32';
    // Domain separation: the same base secret produces different keys per
    // audience, so a token minted for one can never verify for the other.
    return createHash('sha256').update(`${base}:${audience}`).digest('hex');
  }

  /**
   * An access token carries WHO and WHICH SESSION, and nothing else.
   *
   * Authorization is resolved per request from the database — see
   * `AuthService.resolveActor`. Keeping it out of the token is what makes a
   * revoked permission take effect immediately, and what keeps the token small
   * enough to sit inside a cookie a browser will actually store.
   */
  issueAccessToken(input: { subject: string; audience: TokenAudience; sessionId: string }): string {
    return jwt.sign(
      {
        sub: input.subject,
        aud: input.audience,
        sid: input.sessionId,
      },
      this.secretFor(input.audience),
      { expiresIn: this.config.env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'] },
    );
  }

  /**
   * Verify an access token.
   *
   * Returns null on ANY failure — expired, malformed, wrong audience, bad
   * signature. The caller gets "not authenticated" and learns nothing about
   * which of those it was, because the difference is useful only to an attacker.
   */
  verifyAccessToken(token: string, audience: TokenAudience): AccessTokenClaims | null {
    try {
      const payload = jwt.verify(token, this.secretFor(audience)) as jwt.JwtPayload;
      if (payload.aud !== audience) return null;

      return {
        sub: String(payload.sub),
        aud: audience,
        iat: Number(payload.iat ?? 0),
        exp: Number(payload.exp ?? 0),
        sid: String(payload.sid ?? ''),
      };
    } catch {
      return null;
    }
  }

  /** Opaque refresh token plus the hash to store. The plaintext is never persisted. */
  issueRefreshToken(): { token: string; hash: string; family: string } {
    const token = randomBytes(48).toString('base64url');
    return { token, hash: this.hashRefreshToken(token), family: randomUUID() };
  }

  rotateRefreshToken(family: string): { token: string; hash: string; family: string } {
    const token = randomBytes(48).toString('base64url');
    return { token, hash: this.hashRefreshToken(token), family };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Refresh TTL differs by audience: staff sessions are shorter because staff can move money. */
  refreshTtlMs(audience: TokenAudience): number {
    const raw =
      audience === 'staff'
        ? this.config.env.JWT_REFRESH_TTL_STAFF
        : this.config.env.JWT_REFRESH_TTL_DONOR;
    return parseDuration(raw);
  }
}

/** Parse `15m`, `7d`, `30d` into milliseconds. */
function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * (multipliers[unit!] ?? 86_400_000);
}
