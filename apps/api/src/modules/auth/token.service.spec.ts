import { createHash } from 'node:crypto';

import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../../config/app.config.js';
import { ACCESS_TOKEN_ALGORITHM, TokenService } from './token.service.js';

const BASE_SECRET = 's'.repeat(48);
const config = {
  env: {
    JWT_ACCESS_SECRET: BASE_SECRET,
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL_DONOR: '30d',
    JWT_REFRESH_TTL_STAFF: '7d',
  },
} as unknown as AppConfig;

/** The per-audience key the service derives — what an attacker would need. */
const staffKey = createHash('sha256').update(`${BASE_SECRET}:staff`).digest('hex');
const claims = { sub: 'user-1', aud: 'staff', sid: 'session-1' };

/**
 * Phase 12: access tokens are HS256 and NOTHING ELSE is accepted, whatever
 * the token's own header claims.
 */
describe('TokenService algorithm pinning', () => {
  const tokens = new TokenService(config);

  it('signs with HS256 and verifies its own tokens', () => {
    const token = tokens.issueAccessToken({
      subject: 'user-1',
      audience: 'staff',
      sessionId: 's1',
    });
    expect(jwt.decode(token, { complete: true })?.header.alg).toBe(ACCESS_TOKEN_ALGORITHM);
    expect(tokens.verifyAccessToken(token, 'staff')?.sub).toBe('user-1');
  });

  it('refuses a token signed with the right key but another HMAC algorithm', () => {
    for (const algorithm of ['HS384', 'HS512'] as const) {
      const forged = jwt.sign(claims, staffKey, { algorithm, expiresIn: '5m' });
      expect(tokens.verifyAccessToken(forged, 'staff')).toBeNull();
    }
  });

  it('refuses an unsigned token (alg: none)', () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ ...claims, iat: now, exp: now + 300 })}.`;
    expect(tokens.verifyAccessToken(unsigned, 'staff')).toBeNull();
  });

  it('refuses a token for the other audience', () => {
    const token = tokens.issueAccessToken({
      subject: 'user-1',
      audience: 'staff',
      sessionId: 's1',
    });
    expect(tokens.verifyAccessToken(token, 'donor')).toBeNull();
  });

  it('reports the configured access lifetime', () => {
    expect(tokens.accessTtlSeconds()).toBe(900);
  });
});
