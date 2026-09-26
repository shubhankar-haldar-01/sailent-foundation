'use server';

import { API_PREFIX } from '@sailent/config';

/**
 * Submitting a volunteer application.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A SERVER ACTION, NOT A BROWSER FETCH — and not because of authentication,
 * since this endpoint is public.
 *
 * It is here so the API's address never reaches the browser. Everything else
 * on this site goes through the server for that reason (decision A1), and a
 * public endpoint is no reason to make an exception: the moment one page talks
 * to the API directly, that host has to be reachable from the internet and the
 * whole boundary stops meaning anything.
 * ══════════════════════════════════════════════════════════════════════════
 */

const API_BASE = process.env.API_URL ?? 'http://localhost:4000';

export interface VolunteerApplicationState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** Splits a textarea or comma list into the array the API expects. */
function list(value: FormDataEntryValue | null): string[] | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  return raw
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function text(form: FormData, key: string): string | undefined {
  const value = String(form.get(key) ?? '').trim();
  return value === '' ? undefined : value;
}

export async function submitVolunteerApplication(
  _previous: VolunteerApplicationState,
  form: FormData,
): Promise<VolunteerApplicationState> {
  /*
    The name arrives as ONE field because that is how people think of it, and
    is split here rather than asked for twice. A single name with no surname is
    normal across much of India, so the second part is optional by
    construction rather than by a validation rule somebody has to remember.
  */
  const fullName = String(form.get('fullName') ?? '').trim();
  const [firstName, ...rest] = fullName.split(/\s+/);

  const body = {
    firstName: firstName || undefined,
    lastName: rest.length > 0 ? rest.join(' ') : undefined,
    email: text(form, 'email'),
    phone: text(form, 'phone'),
    city: text(form, 'city'),
    experience: text(form, 'experience'),
    skills: list(form.get('skills')),
    interests: list(form.get('interests')),
    availability: { days: text(form, 'days'), mode: text(form, 'mode') },
    emergencyContactName: text(form, 'emergencyName'),
    emergencyContactPhone: text(form, 'emergencyPhone'),
    // Collected by this form since Phase 2 and silently discarded until
    // Phase 8 gave the column a home.
    emergencyContactRelation: text(form, 'emergencyRelation'),
    motivation: text(form, 'motivation'),
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/${API_PREFIX}/volunteers/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return { error: 'Could not reach the server. Try again in a moment.' };
  }

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    error?: { message?: string; details?: { field?: string; message?: string }[] };
  };

  if (!response.ok) {
    const fieldErrors: Record<string, string> = {};
    for (const detail of payload.error?.details ?? []) {
      if (detail.field && detail.message) fieldErrors[detail.field] = detail.message;
    }
    return {
      error: payload.error?.message ?? 'We could not record that application.',
      fieldErrors,
    };
  }

  /*
    NO ID IS RETURNED TO THE PAGE, even though the API sends one.

    There is nothing an applicant could do with it: there is no status-check
    route, deliberately, because one would let anybody who guessed an id learn
    whether a given person had applied. The confirmation says what happens next
    and nothing more.
  */
  return { ok: true };
}
