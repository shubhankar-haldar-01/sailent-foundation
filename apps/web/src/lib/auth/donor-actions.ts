'use server';

import { redirect } from 'next/navigation';

import { API_PREFIX } from '@sailent/config';

import { clearDonorSession, readDonorSession, writeDonorSession } from './donor-session';

const API_BASE = process.env.API_URL ?? 'http://localhost:4000';

export interface DonorSignInState {
  error?: string;
  /** Set once a code has been sent, so the form shows the code field. */
  email?: string;
  sent?: boolean;
}

/**
 * An address, loosely checked and consistently normalised.
 *
 * Deliberately permissive: it trims, lower-cases and asks only for something
 * shaped like an address. A stricter rule here would reject valid addresses for
 * the sake of an error the API produces anyway — this exists so somebody who
 * typed their name in the box is told immediately rather than after a round
 * trip.
 *
 * The lower-casing matters beyond tidiness. The API normalises the same way and
 * the database's unique index is on `lower(btrim(email))`, so a capital first
 * letter from a phone keyboard must not become a second rate-limit bucket or a
 * lookup that misses the donor it belongs to.
 */
function normaliseEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? value : null;
}

/**
 * Ask for a sign-in code.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS ALWAYS REPORTS SUCCESS, AND THAT IS THE POINT.
 *
 * The API answers identically whether or not the number belongs to a donor,
 * because anything else makes this a way to ask "has this person donated?" —
 * exactly the fact a donor expects us to keep. The UI must not undo that by
 * being more helpful: it moves to the code step either way.
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function requestSignInCode(
  _previous: DonorSignInState,
  formData: FormData,
): Promise<DonorSignInState> {
  const email = normaliseEmail(String(formData.get('email') ?? ''));

  if (!email) {
    return { error: 'Enter the email address you gave with your donation.' };
  }

  try {
    await fetch(`${API_BASE}/${API_PREFIX}/auth/donor/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      cache: 'no-store',
    });
  } catch {
    return { error: 'Could not reach the server. Try again in a moment.' };
  }

  // Note what is NOT returned: whether the address was known, and whether
  // anything was actually sent.
  return { sent: true, email };
}

/**
 * Where to send somebody after they sign in.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * AN OPEN REDIRECT IS THE CLASSIC BUG IN THIS THREE-LINE FEATURE, so the rule
 * is an ALLOW-LIST OF SHAPES rather than a list of things to reject.
 *
 * A path is accepted only if it starts with a single `/` and is not `//`. That
 * excludes every absolute URL (`https://evil.test`), every protocol-relative
 * one (`//evil.test`, which a browser treats as absolute), and anything with a
 * scheme. Rejecting known-bad prefixes instead would mean maintaining a list
 * against a parser that has more ways to express a host than anybody remembers.
 *
 * It matters here because the value arrives in a query string on a page that
 * asks for a one-time code: "sign in and you will be taken somewhere" is
 * exactly the shape of a credential-phishing link.
 * ══════════════════════════════════════════════════════════════════════════
 */
function safeReturnPath(value: FormDataEntryValue | null): string {
  const path = String(value ?? '').trim();
  if (!path.startsWith('/') || path.startsWith('//')) return '/dashboard';
  return path;
}

/** Exchange the code for a session. */
export async function verifySignInCode(
  previous: DonorSignInState,
  formData: FormData,
): Promise<DonorSignInState> {
  const email = normaliseEmail(String(formData.get('email') ?? ''));
  const code = String(formData.get('code') ?? '').trim();

  if (!email) return { error: 'Enter your email address again.', sent: false };
  if (!/^\d{6}$/.test(code)) {
    return { ...previous, sent: true, email, error: 'The code is six digits.' };
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/${API_PREFIX}/auth/donor/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
      cache: 'no-store',
    });
  } catch {
    return { ...previous, sent: true, email, error: 'Could not reach the server.' };
  }

  const body = (await response.json().catch(() => ({}))) as {
    data?: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      actor: { id: string; permissions: string[]; name?: string | null };
    };
    error?: { message?: string };
  };

  if (!response.ok || !body.data) {
    return {
      sent: true,
      email,
      error: body.error?.message ?? 'That code is not correct.',
    };
  }

  await writeDonorSession({
    accessToken: body.data.accessToken,
    refreshToken: body.data.refreshToken,
    expiresAt: Date.now() + body.data.expiresIn * 1000,
    actor: body.data.actor,
  });

  redirect(safeReturnPath(formData.get('next')));
}

/**
 * Sign out.
 *
 * Revokes the session family server-side as well as dropping the cookie, so a
 * refresh token captured earlier stops working. Best effort on the API call —
 * the cookie goes regardless, because a failure there must not leave somebody
 * apparently signed in.
 *
 * Only the DONOR session is touched. Somebody who is also staff stays signed
 * into the admin, which is correct: they are different accounts.
 */
export async function signOutDonor(): Promise<void> {
  const session = await readDonorSession();

  if (session) {
    await fetch(`${API_BASE}/${API_PREFIX}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
      cache: 'no-store',
    }).catch(() => undefined);
  }

  await clearDonorSession();
  redirect('/sign-in');
}
