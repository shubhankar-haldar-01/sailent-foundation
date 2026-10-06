'use server';

import { API_PREFIX } from '@sailent/config';

import { actionForwardingHeaders } from '@/lib/api/forwarding';

/**
 * The public contact form and newsletter sign-up (Phase 13).
 *
 * Server actions rather than browser fetches, for the same reason as the
 * volunteer application: the API's address never reaches the browser
 * (decision A1). The real client address is forwarded so the API's per-client
 * limits apply per person (Phase 11), and the API validates everything again.
 */

const API_BASE = process.env.API_URL ?? 'http://localhost:4000';

export interface PublicFormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

async function post(path: string, body: unknown): Promise<PublicFormState> {
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

  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; details?: { field?: string; message?: string }[] };
  };
  if (response.status === 429) {
    return { error: 'Too many attempts from here. Please wait a while and try again.' };
  }
  const fieldErrors: Record<string, string> = {};
  for (const detail of payload.error?.details ?? []) {
    if (detail.field && detail.message) fieldErrors[detail.field] = detail.message;
  }
  return { error: payload.error?.message ?? 'That did not go through. Try again.', fieldErrors };
}

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export async function submitContactMessage(form: FormData): Promise<PublicFormState> {
  return post('contact', {
    name: text(form, 'name'),
    email: text(form, 'email'),
    subject: text(form, 'subject') || 'general',
    message: text(form, 'message'),
    // The honeypot travels as typed; the API discards anything that fills it.
    website: text(form, 'website') || undefined,
  });
}

export async function subscribeToNewsletter(form: FormData): Promise<PublicFormState> {
  return post('newsletter/subscribe', {
    email: text(form, 'email'),
    website: text(form, 'website') || undefined,
  });
}

export async function confirmNewsletter(
  _prev: PublicFormState,
  form: FormData,
): Promise<PublicFormState> {
  return post('newsletter/confirm', { token: text(form, 'token') });
}

export async function unsubscribeNewsletter(
  _prev: PublicFormState,
  form: FormData,
): Promise<PublicFormState> {
  return post('newsletter/unsubscribe', { token: text(form, 'token') });
}
