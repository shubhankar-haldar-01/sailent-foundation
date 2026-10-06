'use server';

import { redirect } from 'next/navigation';

import { API_PREFIX } from '@sailent/config';

import { actionForwardingHeaders } from '@/lib/api/forwarding';

import { clearSession, readSession, writeSession } from './session';

const API_BASE = process.env.API_URL ?? 'http://localhost:4000';

export interface LoginState {
  error?: string;
  /** True when the account needs a second factor — the form then shows the field. */
  needsTotp?: boolean;
}

/**
 * Staff sign-in.
 *
 * A server action, so the password never travels to client-side JavaScript and
 * the resulting tokens are written straight into an httpOnly cookie without
 * passing through the browser at all.
 */
export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const totpCode = String(formData.get('totpCode') ?? '').trim();

  if (!email || !password) {
    return { error: 'Enter your email address and password.' };
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/${API_PREFIX}/auth/staff/login`, {
      method: 'POST',
      // The real client, so the API's limits apply per person (Phase 11).
      headers: { 'Content-Type': 'application/json', ...(await actionForwardingHeaders()) },
      body: JSON.stringify({ email, password, ...(totpCode ? { totpCode } : {}) }),
      cache: 'no-store',
    });
  } catch {
    return { error: 'Could not reach the server. Try again in a moment.' };
  }

  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      actor: { id: string; permissions: string[] };
    };
    error?: { code?: string; message?: string };
  };

  if (!response.ok || !body.data) {
    const message = body.error?.message ?? 'Those details do not match an account.';

    /**
     * The API asks for a second factor with a 401 and a specific message. The
     * form reveals the field only at that point, so the many accounts that do
     * not use TOTP are not shown a box they must leave empty — and so that the
     * field's presence does not advertise which accounts are privileged.
     */
    const needsTotp = /6-digit code|authenticator/i.test(message);
    return {
      error: needsTotp ? 'Enter the code from your authenticator app.' : message,
      needsTotp,
    };
  }

  await writeSession({
    accessToken: body.data.accessToken,
    refreshToken: body.data.refreshToken,
    expiresAt: Date.now() + body.data.expiresIn * 1000,
    actor: body.data.actor,
  });

  redirect('/admin');
}

/** Sign out, revoking the session family server-side as well as dropping the cookie. */
export async function signOut(): Promise<void> {
  const session = await readSession();

  if (session) {
    // Best effort: the cookie is cleared regardless, so a failure here cannot
    // leave somebody apparently signed in.
    await fetch(`${API_BASE}/${API_PREFIX}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
      cache: 'no-store',
    }).catch(() => undefined);
  }

  await clearSession();
  redirect('/admin/login');
}
