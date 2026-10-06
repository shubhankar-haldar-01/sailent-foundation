'use server';

import { API_PREFIX } from '@sailent/config';
import { staffPasswordSchema } from '@sailent/validation';

import { actionForwardingHeaders } from '@/lib/api/forwarding';

/**
 * Staff invitation acceptance and password reset (Phase 13).
 *
 * The token comes from the page (read from the link's `#` fragment in the
 * browser, so it was never in a URL a server logged) and goes to the API in a
 * POST body. The API decides everything; these only carry the request.
 */

const API_BASE = process.env.API_URL ?? 'http://localhost:4000';

export interface StaffAccountState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

async function post(path: string, body: unknown): Promise<StaffAccountState> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/${API_PREFIX}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await actionForwardingHeaders()) },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return { error: 'Could not reach the server. Try again in a moment.' };
  }
  if (response.ok) return { ok: true };
  if (response.status === 429) {
    return { error: 'Too many attempts. Please wait a few minutes and try again.' };
  }
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; details?: { field?: string; message?: string }[] };
  };
  const fieldErrors: Record<string, string> = {};
  for (const detail of payload.error?.details ?? []) {
    if (detail.field && detail.message) fieldErrors[detail.field] = detail.message;
  }
  return { error: payload.error?.message ?? 'That did not work. Try again.', fieldErrors };
}

/** Both forms ask for the password twice; the API checks the policy again. */
function checkPasswords(form: FormData): StaffAccountState | null {
  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirmPassword') ?? '');
  const parsed = staffPasswordSchema.safeParse(password);
  if (!parsed.success) {
    return {
      error: 'Choose a stronger password.',
      fieldErrors: { password: parsed.error.issues[0]?.message ?? 'Choose a stronger password.' },
    };
  }
  if (password !== confirm) {
    return {
      error: 'The two passwords do not match.',
      fieldErrors: { confirmPassword: 'Type the same password again.' },
    };
  }
  return null;
}

export async function acceptInvitation(
  _prev: StaffAccountState,
  form: FormData,
): Promise<StaffAccountState> {
  const invalid = checkPasswords(form);
  if (invalid) return invalid;
  return post('auth/staff/invitation/accept', {
    token: String(form.get('token') ?? ''),
    password: String(form.get('password') ?? ''),
  });
}

export async function requestPasswordReset(
  _prev: StaffAccountState,
  form: FormData,
): Promise<StaffAccountState> {
  return post('auth/staff/password/forgot', { email: String(form.get('email') ?? '').trim() });
}

export async function resetPassword(
  _prev: StaffAccountState,
  form: FormData,
): Promise<StaffAccountState> {
  const invalid = checkPasswords(form);
  if (invalid) return invalid;
  return post('auth/staff/password/reset', {
    token: String(form.get('token') ?? ''),
    password: String(form.get('password') ?? ''),
  });
}
