import 'server-only';

import { API_PREFIX } from '@sailent/config';

/**
 * Check a certificate's verification code.
 *
 * NOT CACHED. A withdrawn certificate must stop verifying immediately — the
 * whole point of revocation is that somebody relying on the document finds out
 * — and a cached "valid" would keep answering for as long as the cache lived.
 */

const API_BASE = process.env.API_URL ?? 'http://localhost:4000';

export interface VerifiedCertificate {
  certificateNumber: string;
  certificateType: string;
  title: string;
  hoursCredited: number;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  status: 'issued' | 'revoked';
  revokedAt: string | null;
  volunteerName: string;
  volunteerCode: string | null;
  valid: boolean;
}

export async function verifyCertificate(code: string): Promise<VerifiedCertificate | null> {
  let response: Response;
  try {
    response = await fetch(
      `${API_BASE}/${API_PREFIX}/verify/certificate/${encodeURIComponent(code)}`,
      { cache: 'no-store' },
    );
  } catch {
    // An unreachable API is NOT "this certificate is fake". Returning null
    // shows "we cannot find that certificate", which is the honest answer
    // either way — we could not find it.
    return null;
  }

  if (!response.ok) return null;

  const payload = (await response.json().catch(() => ({}))) as {
    data?: VerifiedCertificate;
  };
  return payload.data ?? null;
}
