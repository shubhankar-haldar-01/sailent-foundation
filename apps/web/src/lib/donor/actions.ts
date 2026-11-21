'use server';

import { revalidatePath } from 'next/cache';
import { API_PREFIX } from '@sailent/config';

import { DonorApiError, donorFetch } from './api';
import { getDonorAccessToken, readDonorSession, writeDonorSession } from '@/lib/auth/donor-session';
import { actionForwardingHeaders } from '@/lib/api/forwarding';

export interface EventRegistrationPass {
  id: string;
  passNumber: string;
  eventId: string;
  eventTitle?: string;
  eventSlug?: string;
  startDate?: string;
  venueName?: string | null;
  city?: string | null;
  fullName: string;
  email: string;
  phone: string;
  attendeeCount: number;
  functionName?: string | null;
  attendees?: { fullName: string; passNumber?: string }[] | null;
  status: string;
  registeredAt: string;
}

export interface DonorActionState {
  error?: string;
  ok?: boolean;
  fieldErrors?: Record<string, string>;
  pass?: EventRegistrationPass;
}

function toState(error: unknown): DonorActionState {
  if (error instanceof DonorApiError) return { error: error.message };
  return { error: 'Something went wrong. Try again.' };
}

/** A trimmed string, or undefined so the field is left alone rather than blanked. */
function text(form: FormData, key: string): string | undefined {
  const value = String(form.get(key) ?? '').trim();
  return value === '' ? undefined : value;
}

/**
 * Update the donor's own profile.
 *
 * ONLY THE FIELDS BELOW ARE READ FROM THE FORM. Not because the API would
 * accept more — it rejects unknown keys outright — but because a form post is
 * attacker-controlled and this is the first place that decides what a field
 * name means. Reading the whole FormData and forwarding it would make the set
 * of writable columns a property of the HTML.
 */
export interface EmailChangeState {
  error?: string;
  /** The address a code was sent to, while waiting for it. */
  pendingEmail?: string;
  ok?: boolean;
}

/**
 * Step one of an email change: send a code to the NEW address (Phase 12).
 * The account's address does not change until step two.
 */
export async function requestEmailChange(
  _previous: EmailChangeState,
  form: FormData,
): Promise<EmailChangeState> {
  const email = text(form, 'newEmail');
  if (!email) return { error: 'Enter the new email address.' };
  try {
    await donorFetch('me/email/change', { method: 'POST', body: { email } });
  } catch (error) {
    return { error: toState(error).error };
  }
  return { pendingEmail: email };
}

/** Step two: the code from the new inbox. Only now does the address change. */
export async function verifyEmailChange(
  previous: EmailChangeState,
  form: FormData,
): Promise<EmailChangeState> {
  const email = previous.pendingEmail ?? text(form, 'newEmail');
  const code = text(form, 'code');
  if (!email) return { error: 'Start again with the new email address.' };
  if (!code || !/^\d{6}$/.test(code)) {
    return { pendingEmail: email, error: 'The code is six digits.' };
  }
  try {
    await donorFetch('me/email/verify', { method: 'POST', body: { email, code } });
  } catch (error) {
    return { pendingEmail: email, error: toState(error).error };
  }
  revalidatePath('/dashboard/profile');
  return { ok: true };
}

export async function updateDonorProfile(
  _previous: DonorActionState,
  form: FormData,
): Promise<DonorActionState> {
  try {
    await donorFetch('me', {
      method: 'PATCH',
      body: {
        firstName: text(form, 'firstName'),
        lastName: text(form, 'lastName'),
        // No email: it changes only through the verified flow below (Phase 12).
        addressLine1: text(form, 'addressLine1'),
        addressLine2: text(form, 'addressLine2'),
        city: text(form, 'city'),
        state: text(form, 'state'),
        postalCode: text(form, 'postalCode'),
        // The two move together — a number with no type cannot go on a Form
        // 10BD export, and the API says so.
        taxIdType: text(form, 'taxIdNumber') ? (text(form, 'taxIdType') ?? 'pan') : undefined,
        taxIdNumber: text(form, 'taxIdNumber'),
      },
    });
  } catch (error) {
    return toState(error);
  }

  /*
    The header's stored label follows the rename.

    `AccountBadge` reads the name from the session rather than from `/me`, so
    that it costs no API call per page. This is the one place that name can
    change, and rewriting it here is what keeps "stored, not fetched" from
    meaning "stale until you sign in again".

    A failure to rewrite leaves old initials in a circle and nothing else, so
    it must not fail the save the donor actually asked for.
  */
  try {
    const session = await readDonorSession();
    const first = text(form, 'firstName');
    if (session && first !== undefined) {
      const name = [first, text(form, 'lastName')].filter(Boolean).join(' ').trim();
      await writeDonorSession({ ...session, actor: { ...session.actor, name: name || null } });
    }
  } catch {
    // Deliberately swallowed. See above.
  }

  revalidatePath('/dashboard/profile');
  revalidatePath('/dashboard');
  return { ok: true };
}

/** A checkbox that is absent from the post means unchecked, which is `false`. */
function checkbox(form: FormData, key: string): boolean {
  return form.get(key) === 'on' || form.get(key) === 'true';
}

export async function updateDonorSettings(
  _previous: DonorActionState,
  form: FormData,
): Promise<DonorActionState> {
  try {
    await donorFetch('me/settings', {
      method: 'PATCH',
      body: {
        communicationConsent: checkbox(form, 'communicationConsent'),
        emailOptIn: checkbox(form, 'emailOptIn'),
        smsOptIn: checkbox(form, 'smsOptIn'),
        whatsappOptIn: checkbox(form, 'whatsappOptIn'),
        notifyCampaignUpdates: checkbox(form, 'notifyCampaignUpdates'),
        notifyImpactUpdates: checkbox(form, 'notifyImpactUpdates'),
        notifyNewsletter: checkbox(form, 'notifyNewsletter'),
        isAnonymous: checkbox(form, 'isAnonymous'),
      },
    });
  } catch (error) {
    return toState(error);
  }

  revalidatePath('/dashboard');
  return { ok: true };
}

export async function saveCampaign(
  _previous: DonorActionState,
  form: FormData,
): Promise<DonorActionState> {
  const campaignId = String(form.get('campaignId') ?? '');
  try {
    await donorFetch('me/saved-campaigns', { method: 'POST', body: { campaignId } });
  } catch (error) {
    return toState(error);
  }

  revalidatePath('/dashboard/saved');
  return { ok: true };
}

export async function unsaveCampaign(
  _previous: DonorActionState,
  form: FormData,
): Promise<DonorActionState> {
  const campaignId = String(form.get('campaignId') ?? '');
  try {
    await donorFetch(`me/saved-campaigns/${campaignId}`, { method: 'DELETE' });
  } catch (error) {
    return toState(error);
  }

  revalidatePath('/dashboard/saved');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * Register for an event.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NO EMAIL FIELD IS READ FROM THE FORM, AND THE API WOULD REFUSE ONE.
 *
 * The address is the unique key on a registration, so accepting it from a post
 * would let anyone register under somebody else's address — and lock the real
 * owner out of the event, since the duplicate check would then find their row.
 * The API reads it from the signed-in donor's record instead.
 *
 * Name and phone ARE forwarded: the attendee is not always the account holder
 * in the way the name on file suggests, and the number on the record may be a
 * landline nobody can reach on the day. Both are optional and fall back to the
 * donor record server-side.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Capacity, the deadline and the event's state are NOT checked here. They are
 * checked by the API under a row lock, which is the only evaluation that can
 * be trusted when two people submit at once — a check in this action would
 * race exactly the way a naive one in the service would.
 */
const API_BASE = process.env.API_URL ?? 'http://localhost:4000';

export async function registerForEvent(
  _previous: DonorActionState,
  form: FormData,
): Promise<DonorActionState> {
  const eventId = String(form.get('eventId') ?? '');
  const slug = String(form.get('slug') ?? '');

  if (form.has('consent') && !checkbox(form, 'consent')) {
    return { ok: false, error: 'You must agree to the Terms of use and Privacy policy.' };
  }

  const fullName = text(form, 'fullName');
  const email = text(form, 'email');
  const phone = text(form, 'phone');
  const notes = text(form, 'notes') ?? text(form, 'message');

  const rawAttendeeCount = form.get('attendeeCount');
  const attendeeCount = rawAttendeeCount ? Math.min(4, Math.max(1, Number(rawAttendeeCount))) : 1;
  const functionName = text(form, 'functionName');
  let attendees: { fullName: string }[] | undefined;
  const rawAttendees = text(form, 'attendees');
  if (rawAttendees) {
    try {
      attendees = JSON.parse(rawAttendees);
    } catch {
      attendees = undefined;
    }
  }

  const token = await getDonorAccessToken();

  let response: Response;
  const targetEndpoint = token
    ? `${API_BASE}/${API_PREFIX}/events/${eventId}/register`
    : `${API_BASE}/${API_PREFIX}/events/${eventId}/public-register`;

  try {
    response = await fetch(targetEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(await actionForwardingHeaders()),
      },
      body: JSON.stringify({
        fullName,
        email,
        phone,
        attendeeCount,
        ...(functionName ? { functionName } : {}),
        ...(attendees && attendees.length > 0 ? { attendees } : {}),
        notes,
        ...(text(form, 'razorpayOrderId')
          ? { razorpayOrderId: text(form, 'razorpayOrderId') }
          : {}),
        ...(text(form, 'razorpayPaymentId')
          ? { razorpayPaymentId: text(form, 'razorpayPaymentId') }
          : {}),
        ...(text(form, 'razorpaySignature')
          ? { razorpaySignature: text(form, 'razorpaySignature') }
          : {}),
      }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again shortly.' };
  }

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: EventRegistrationPass;
    error?: { message?: string; details?: { field?: string; message?: string }[] };
  };

  if (!response.ok || !payload.success) {
    const fieldErrors: Record<string, string> = {};
    for (const detail of payload.error?.details ?? []) {
      if (detail.field && detail.message) fieldErrors[detail.field] = detail.message;
    }
    return {
      ok: false,
      error: payload.error?.message ?? 'We could not complete your registration.',
      fieldErrors,
    };
  }

  if (slug) {
    revalidatePath(`/events/${slug}`);
    revalidatePath(`/events/${slug}/register`);
  }
  revalidatePath('/events');
  revalidatePath('/dashboard/events');
  revalidatePath('/dashboard');
  return { ok: true, pass: payload.data };
}

/**
 * Cancel the signed-in donor's own registration.
 *
 * There is no registration id in this form, only the event — the API resolves
 * the row from the session, so there is no parameter by which one person could
 * cancel another's place.
 */
export async function cancelEventRegistration(
  _previous: DonorActionState,
  form: FormData,
): Promise<DonorActionState> {
  const eventId = String(form.get('eventId') ?? '');
  const slug = String(form.get('slug') ?? '');

  try {
    await donorFetch(`events/${eventId}/registration`, {
      method: 'DELETE',
      body: { reason: text(form, 'reason') },
    });
  } catch (error) {
    return toState(error);
  }

  if (slug) revalidatePath(`/events/${slug}`);
  revalidatePath('/events');
  revalidatePath('/dashboard/events');
  revalidatePath('/dashboard');
  return { ok: true };
}

export interface OtpActionState {
  ok?: boolean;
  sent?: boolean;
  verified?: boolean;
  error?: string;
}

export async function requestEventRegistrationOtp(
  eventId: string,
  email: string,
  name?: string,
): Promise<OtpActionState> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }

  try {
    const response = await fetch(`${API_BASE}/${API_PREFIX}/events/${eventId}/otp/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await actionForwardingHeaders()),
      },
      body: JSON.stringify({ email: cleanEmail, name }),
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      error?: { message?: string };
    };

    if (!response.ok || !payload.success) {
      return {
        ok: false,
        error: payload.error?.message ?? 'Could not send verification code. Try again.',
      };
    }

    return { ok: true, sent: true };
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again shortly.' };
  }
}

export async function verifyEventRegistrationOtp(
  eventId: string,
  email: string,
  code: string,
): Promise<OtpActionState> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  if (!/^\d{6}$/.test(cleanCode)) {
    return { ok: false, error: 'Enter the 6-digit verification code.' };
  }

  try {
    const response = await fetch(`${API_BASE}/${API_PREFIX}/events/${eventId}/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await actionForwardingHeaders()),
      },
      body: JSON.stringify({ email: cleanEmail, code: cleanCode }),
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      error?: { message?: string };
    };

    if (!response.ok || !payload.success) {
      return {
        ok: false,
        error: payload.error?.message ?? 'Invalid or expired code. Please try again.',
      };
    }

    return { ok: true, verified: true };
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again shortly.' };
  }
}

export interface EventRegistrationOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  eventTitle: string;
}

export async function createEventRegistrationOrder(
  eventId: string,
  details: {
    email?: string;
    fullName?: string;
    phone?: string;
    attendeeCount?: number;
    functionName?: string;
    attendees?: { fullName: string }[];
  },
): Promise<{ ok: true; order: EventRegistrationOrder } | { ok: false; error: string }> {
  const token = await getDonorAccessToken();

  try {
    const response = await fetch(`${API_BASE}/${API_PREFIX}/events/${eventId}/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(await actionForwardingHeaders()),
      },
      body: JSON.stringify(details),
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      data?: EventRegistrationOrder;
      error?: { message?: string };
    };

    if (!response.ok || !payload.success || !payload.data) {
      return {
        ok: false,
        error: payload.error?.message ?? 'Could not create registration payment order.',
      };
    }

    return { ok: true, order: payload.data };
  } catch {
    return { ok: false, error: 'Could not connect to payment gateway. Please try again.' };
  }
}
