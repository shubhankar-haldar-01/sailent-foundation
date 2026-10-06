'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  AdminApiError,
  adminFetch,
  adminUpload,
  previewNotificationTemplate,
  requestDocumentLink,
} from './api';

/**
 * Server actions for program and campaign administration.
 *
 * Every one of these calls the API and then REVALIDATES the public cache.
 * Publishing a campaign that stays invisible for five minutes because a cached
 * page is still being served looks like a broken publish button, and the
 * operator's next move is to press it again.
 *
 * Nothing here decides whether an action is allowed — the API does, on every
 * call. These functions exist to carry the request and refresh what the change
 * affected.
 */

export interface ActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
  /**
   * Where to go once the action succeeded.
   *
   * Returned rather than redirected server-side, so the form can settle and
   * announce its success before navigating — a `redirect()` inside the action
   * throws past the component and the operator sees a page change with no
   * confirmation that anything was saved.
   */
  redirectTo?: string;
}

/** Turn an API failure into something a form can render beside the right field. */
function toState(error: unknown): ActionState {
  if (error instanceof AdminApiError) {
    const fieldErrors: Record<string, string> = {};
    for (const detail of error.details ?? []) {
      if (detail.field && detail.message) fieldErrors[detail.field] = detail.message;
    }
    return { error: error.message, fieldErrors };
  }
  return { error: 'Something went wrong. Try again.' };
}

/**
 * Refresh everything a catalogue change can affect.
 *
 * Deliberately broad. The alternative — working out precisely which pages
 * mention a campaign — is a calculation that will be wrong the first time
 * somebody adds a new page that lists campaigns, and the failure mode is stale
 * public content nobody notices.
 */
function revalidateCatalogue(slug?: string) {
  for (const tag of ['programs', 'campaigns', 'impact']) revalidateTag(tag);
  revalidatePath('/', 'layout');
  if (slug) {
    revalidateTag(`campaign-${slug}`);
    revalidateTag(`program-${slug}`);
  }
}

function text(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  if (value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * The homepage "featured" pair from a campaign form.
 *
 * Unticked sends `false` and clears the order, so un-featuring a campaign
 * leaves no stale position behind to resurface if it is featured again. A
 * blank order is null — featured, after the numbered ones. Anything that is
 * not a whole number is passed through as-is for the API to refuse by name.
 */
function featuredFields(form: FormData): { isFeatured: boolean; featuredOrder: number | null } {
  const isFeatured = form.get('isFeatured') === 'on';
  const raw = text(form, 'featuredOrder');
  return {
    isFeatured,
    featuredOrder: isFeatured && raw !== undefined ? Number(raw) : null,
  };
}

/** Rupees in the form, paise on the wire (decision A2). */
function rupeesToPaise(form: FormData, key: string): number | undefined {
  const raw = text(form, key);
  if (raw === undefined) return undefined;
  const rupees = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(rupees)) return undefined;
  // Rounded, not truncated, and only at this one boundary. Everything past
  // here is an integer count of paise.
  return Math.round(rupees * 100);
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export async function createProgram(_prev: ActionState, form: FormData): Promise<ActionState> {
  let created: { id: string };
  try {
    created = await adminFetch<{ id: string }>('admin/programs', {
      method: 'POST',
      body: {
        title: text(form, 'title'),
        slug: text(form, 'slug'),
        shortDescription: text(form, 'shortDescription'),
        description: text(form, 'description'),
        categoryId: text(form, 'categoryId'),
        displayOrder: text(form, 'displayOrder') ? Number(text(form, 'displayOrder')) : undefined,
      },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateCatalogue();
  redirect(`/admin/programs/${created.id}/edit`);
}

export async function updateProgram(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id'));
  try {
    await adminFetch(`admin/programs/${id}`, {
      method: 'PATCH',
      body: {
        title: text(form, 'title'),
        slug: text(form, 'slug'),
        shortDescription: text(form, 'shortDescription'),
        description: text(form, 'description'),
        problem: text(form, 'problem'),
        approach: text(form, 'approach'),
        beneficiaries: text(form, 'beneficiaries'),
        categoryId: text(form, 'categoryId') ?? null,
        displayOrder: text(form, 'displayOrder') ? Number(text(form, 'displayOrder')) : undefined,
      },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateCatalogue();
  revalidatePath(`/admin/programs/${id}/edit`);
  return { ok: true };
}

export async function changeProgramStatus(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = String(form.get('id'));
  const action = String(form.get('action'));
  try {
    await adminFetch(`admin/programs/${id}/${action}`, {
      method: 'POST',
      body: { reason: text(form, 'reason') },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateCatalogue();
  revalidatePath(`/admin/programs/${id}/edit`);
  revalidatePath('/admin/programs');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export async function createCampaign(_prev: ActionState, form: FormData): Promise<ActionState> {
  let created: { id: string };
  try {
    created = await adminFetch<{ id: string }>('admin/campaigns', {
      method: 'POST',
      body: {
        title: text(form, 'title'),
        slug: text(form, 'slug'),
        programId: text(form, 'programId'),
        categoryId: text(form, 'categoryId'),
        shortDescription: text(form, 'shortDescription'),
        location: text(form, 'location'),
        state: text(form, 'state'),
        fundraisingGoal: rupeesToPaise(form, 'fundraisingGoal'),
        beneficiaryTarget: text(form, 'beneficiaryTarget')
          ? Number(text(form, 'beneficiaryTarget'))
          : undefined,
        startDate: text(form, 'startDate'),
        endDate: text(form, 'endDate'),
        ...featuredFields(form),
      },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateCatalogue();
  redirect(`/admin/campaigns/${created.id}/edit`);
}

export async function updateCampaign(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id'));
  try {
    await adminFetch(`admin/campaigns/${id}`, {
      method: 'PATCH',
      body: {
        title: text(form, 'title'),
        slug: text(form, 'slug'),
        programId: text(form, 'programId') ?? null,
        categoryId: text(form, 'categoryId') ?? null,
        shortDescription: text(form, 'shortDescription'),
        description: text(form, 'description'),
        beneficiaryContext: text(form, 'beneficiaryContext'),
        location: text(form, 'location'),
        state: text(form, 'state'),
        fundraisingGoal: rupeesToPaise(form, 'fundraisingGoal'),
        beneficiaryTarget: text(form, 'beneficiaryTarget')
          ? Number(text(form, 'beneficiaryTarget'))
          : undefined,
        startDate: text(form, 'startDate') ?? null,
        endDate: text(form, 'endDate') ?? null,
        fundUtilization: text(form, 'fundUtilization'),
        internalNotes: text(form, 'internalNotes'),
        ...featuredFields(form),
      },
    });
  } catch (error) {
    return toState(error);
  }

  // Revalidates the `campaigns` tag and the homepage, so a change to what is
  // featured shows on the next visit rather than after the cache expires.
  revalidateCatalogue(text(form, 'slug'));
  revalidatePath(`/admin/campaigns/${id}/edit`);
  return { ok: true };
}

/**
 * Move a campaign through its lifecycle.
 *
 * The button set is built from the transition table the API also enforces, so
 * an operator is only offered moves that will succeed — but the API validates
 * the transition again regardless of which button was pressed.
 */
export async function changeCampaignStatus(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = String(form.get('id'));
  const action = String(form.get('action'));
  try {
    await adminFetch(`admin/campaigns/${id}/${action}`, {
      method: 'POST',
      body: { reason: text(form, 'reason') },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateCatalogue(text(form, 'slug'));
  revalidatePath(`/admin/campaigns/${id}/edit`);
  revalidatePath('/admin/campaigns');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Campaign sub-resources
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The product catalogue
//
// A product exists independently of any campaign, so these revalidate the
// catalogue pages as well as the public ones. `revalidateCatalogue` is the
// blunt instrument on purpose — a product edit can surface on any campaign page
// that offers it, and working out precisely which is a calculation that will be
// wrong the first time somebody adds a new page listing campaigns.
// ---------------------------------------------------------------------------

function revalidateProducts(productId?: string) {
  revalidatePath('/admin/products');
  if (productId) revalidatePath(`/admin/products/${productId}`);
}

export async function createProduct(_prev: ActionState, form: FormData): Promise<ActionState> {
  let created: { id: string };
  try {
    created = await adminFetch<{ id: string }>('admin/products', {
      method: 'POST',
      body: {
        name: text(form, 'name'),
        slug: text(form, 'slug'),
        description: text(form, 'description'),
        // Rupees in the form, paise on the wire. This is the ONLY boundary
        // where money is a decimal (decision A2).
        defaultPrice: rupeesToPaise(form, 'defaultPrice'),
        unit: text(form, 'unit'),
      },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateProducts();
  redirect(`/admin/products/${created.id}`);
}

export async function updateProduct(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id'));
  try {
    await adminFetch(`admin/products/${id}`, {
      method: 'PATCH',
      body: {
        name: text(form, 'name'),
        slug: text(form, 'slug'),
        description: text(form, 'description'),
        defaultPrice: rupeesToPaise(form, 'defaultPrice'),
        unit: text(form, 'unit'),
      },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateProducts(id);
  revalidateCatalogue();
  return { ok: true };
}

export async function setProductStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id'));
  const status = String(form.get('status'));

  try {
    // Archiving has its own route because it requires a re-authentication that
    // the generic status route does not. Sending `archived` to the wrong one
    // would be refused, so the client picks correctly rather than discovering
    // it in an error.
    const path =
      status === 'archived' ? `admin/products/${id}/archive` : `admin/products/${id}/status`;

    await adminFetch(path, {
      method: 'POST',
      body:
        status === 'archived'
          ? { reason: text(form, 'reason') }
          : { status, reason: text(form, 'reason') },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateProducts(id);
  revalidateCatalogue();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Campaign offerings
// ---------------------------------------------------------------------------

/**
 * Offer an EXISTING catalogue product on a campaign.
 *
 * There is no name or description in this payload, and that absence is the
 * design: this action cannot create a product, so it cannot create a duplicate
 * one. An operator who needs something new goes to the catalogue first.
 *
 * An omitted price means "copy the catalogue default at this moment". The two
 * are unrelated numbers from then on.
 */
export async function addCampaignProduct(_prev: ActionState, form: FormData): Promise<ActionState> {
  const campaignId = String(form.get('campaignId'));
  try {
    await adminFetch(`admin/campaigns/${campaignId}/products`, {
      method: 'POST',
      body: {
        productId: text(form, 'productId'),
        price: rupeesToPaise(form, 'price'),
        targetQuantity: text(form, 'targetQuantity')
          ? Number(text(form, 'targetQuantity'))
          : undefined,
      },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateCatalogue();
  revalidatePath(`/admin/campaigns/${campaignId}/edit`);
  return { ok: true };
}

export async function updateCampaignProduct(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const campaignId = String(form.get('campaignId'));
  const productId = String(form.get('productId'));
  try {
    await adminFetch(`admin/campaigns/${campaignId}/products/${productId}`, {
      method: 'PATCH',
      body: {
        price: rupeesToPaise(form, 'price'),
        targetQuantity:
          text(form, 'targetQuantity') === undefined
            ? undefined
            : Number(text(form, 'targetQuantity')),
        maxPerDonation: text(form, 'maxPerDonation')
          ? Number(text(form, 'maxPerDonation'))
          : undefined,
      },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateCatalogue();
  revalidatePath(`/admin/campaigns/${campaignId}/edit`);
  return { ok: true };
}

export async function setProductActive(_prev: ActionState, form: FormData): Promise<ActionState> {
  const campaignId = String(form.get('campaignId'));
  const productId = String(form.get('productId'));
  try {
    await adminFetch(`admin/campaigns/${campaignId}/products/${productId}/active`, {
      method: 'POST',
      body: { isActive: form.get('active') === 'true', reason: text(form, 'reason') },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateCatalogue();
  revalidatePath(`/admin/campaigns/${campaignId}/edit`);
  return { ok: true };
}

export async function removeCampaignProduct(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const campaignId = String(form.get('campaignId'));
  const productId = String(form.get('productId'));
  try {
    await adminFetch(`admin/campaigns/${campaignId}/products/${productId}`, {
      method: 'DELETE',
      body: { reason: text(form, 'reason') },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateCatalogue();
  revalidatePath(`/admin/campaigns/${campaignId}/edit`);
  return { ok: true };
}

export async function createFaq(_prev: ActionState, form: FormData): Promise<ActionState> {
  const campaignId = String(form.get('campaignId'));
  try {
    await adminFetch(`admin/campaigns/${campaignId}/faqs`, {
      method: 'POST',
      body: {
        question: text(form, 'question'),
        answer: text(form, 'answer'),
        isPublished: form.get('isPublished') === 'on',
      },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateCatalogue();
  revalidatePath(`/admin/campaigns/${campaignId}/edit`);
  return { ok: true };
}

export async function setFaqPublished(_prev: ActionState, form: FormData): Promise<ActionState> {
  const campaignId = String(form.get('campaignId'));
  const faqId = String(form.get('faqId'));
  try {
    await adminFetch(`admin/campaigns/${campaignId}/faqs/${faqId}`, {
      method: 'PATCH',
      body: { isPublished: form.get('isPublished') === 'true' },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateCatalogue();
  revalidatePath(`/admin/campaigns/${campaignId}/edit`);
  return { ok: true };
}

export async function deleteFaq(_prev: ActionState, form: FormData): Promise<ActionState> {
  const campaignId = String(form.get('campaignId'));
  const faqId = String(form.get('faqId'));
  try {
    await adminFetch(`admin/campaigns/${campaignId}/faqs/${faqId}`, { method: 'DELETE' });
  } catch (error) {
    return toState(error);
  }

  revalidateCatalogue();
  revalidatePath(`/admin/campaigns/${campaignId}/edit`);
  return { ok: true };
}

/**
 * Correct a donor record.
 *
 * The reason is mandatory at the API and is not defaulted here — a server
 * action that invented "Corrected via admin" would defeat the field's purpose,
 * which is that somebody wrote down why at the time.
 *
 * Only the correctable fields are read from the form. The API rejects
 * server-controlled ones outright, but this is the first place that decides
 * what a field name means, and a form post is attacker-controlled.
 */
export async function correctDonor(_prev: ActionState, form: FormData): Promise<ActionState> {
  const donorId = String(form.get('donorId'));
  try {
    await adminFetch(`admin/donors/${donorId}`, {
      method: 'PATCH',
      body: {
        firstName: text(form, 'firstName'),
        lastName: text(form, 'lastName'),
        email: text(form, 'email'),
        addressLine1: text(form, 'addressLine1'),
        addressLine2: text(form, 'addressLine2'),
        city: text(form, 'city'),
        state: text(form, 'state'),
        postalCode: text(form, 'postalCode'),
        taxIdType: text(form, 'taxIdNumber') ? (text(form, 'taxIdType') ?? 'pan') : undefined,
        taxIdNumber: text(form, 'taxIdNumber'),
        internalNotes: text(form, 'internalNotes'),
        reason: text(form, 'reason'),
      },
    });
  } catch (error) {
    return toState(error);
  }

  revalidatePath(`/admin/donors/${donorId}`);
  revalidatePath('/admin/donors');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

/**
 * Social links arrive as two parallel textareas — one label per line, one URL
 * per line — rather than as a repeating field set.
 *
 * A dynamic row editor is a client component with add/remove state, and this is
 * a list of at most a handful of entries that an editor touches twice a year.
 * Lines that are blank on either side are DROPPED rather than sent as half a
 * link, so an uneven paste cannot produce a link with no address.
 */
function socialLinks(form: FormData): { label: string; url: string }[] | undefined {
  const labels = String(form.get('socialLabels') ?? '').split(/\r?\n/);
  const urls = String(form.get('socialUrls') ?? '').split(/\r?\n/);
  if (labels.every((line) => !line.trim()) && urls.every((line) => !line.trim())) return undefined;

  const pairs: { label: string; url: string }[] = [];
  for (let index = 0; index < Math.max(labels.length, urls.length); index += 1) {
    const label = (labels[index] ?? '').trim();
    const url = (urls[index] ?? '').trim();
    if (label && url) pairs.push({ label, url });
  }
  return pairs;
}

function revalidateTeam(slug?: string) {
  revalidateTag('team');
  if (slug) revalidateTag(`team-${slug}`);
  revalidatePath('/team');
  revalidatePath('/admin/team');
}

export async function createTeamMember(_prev: ActionState, form: FormData): Promise<ActionState> {
  let created: { id: string };
  try {
    created = await adminFetch<{ id: string }>('admin/team', {
      method: 'POST',
      body: {
        name: text(form, 'name'),
        slug: text(form, 'slug'),
        designation: text(form, 'designation'),
        department: text(form, 'department'),
        memberType: text(form, 'memberType'),
        bio: text(form, 'bio'),
        experience: text(form, 'experience'),
        photoUrl: text(form, 'photoUrl'),
        emailPublic: text(form, 'emailPublic'),
        socialLinks: socialLinks(form),
        displayOrder: text(form, 'displayOrder') ? Number(text(form, 'displayOrder')) : undefined,
      },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateTeam();
  redirect(`/admin/team/${created.id}/edit`);
}

export async function updateTeamMember(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id'));
  try {
    await adminFetch(`admin/team/${id}`, {
      method: 'PATCH',
      body: {
        name: text(form, 'name'),
        slug: text(form, 'slug'),
        designation: text(form, 'designation'),
        // `?? null` rather than `undefined`: an emptied field must CLEAR the
        // value, and `undefined` would leave the old one in place — which on a
        // department or a public email address is the wrong way to fail.
        department: text(form, 'department') ?? null,
        memberType: text(form, 'memberType'),
        bio: text(form, 'bio') ?? null,
        experience: text(form, 'experience') ?? null,
        photoUrl: text(form, 'photoUrl') ?? null,
        emailPublic: text(form, 'emailPublic') ?? null,
        socialLinks: socialLinks(form) ?? null,
        displayOrder: text(form, 'displayOrder') ? Number(text(form, 'displayOrder')) : undefined,
      },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateTeam(text(form, 'slug'));
  revalidatePath(`/admin/team/${id}/edit`);
  return { ok: true };
}

export async function changeTeamStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id'));
  try {
    await adminFetch(`admin/team/${id}/status`, {
      method: 'PATCH',
      // `action` carries the TARGET STATUS, which is what `StatusActions` puts
      // in the field it calls `endpoint`. The catalogue routes take a segment;
      // these take a body. One component, two shapes, translated here.
      body: { status: String(form.get('action')), reason: text(form, 'reason') },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateTeam(text(form, 'slug'));
  revalidatePath(`/admin/team/${id}/edit`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function revalidateEvents(slug?: string) {
  revalidateTag('events');
  if (slug) revalidateTag(`event-${slug}`);
  revalidatePath('/events');
  revalidatePath('/admin/events');
}

/**
 * A `datetime-local` value, turned into an instant.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE BROWSER SENDS NO TIMEZONE, and that is the whole problem.
 *
 * `datetime-local` produces `2026-11-04T09:30` — a wall-clock time with no
 * offset. Passing it to `new Date()` interprets it in the SERVER's zone, which
 * on Render is UTC, and an event an organiser typed as half past nine in the
 * morning becomes three in the afternoon on the public page.
 *
 * So the offset is appended explicitly. `+05:30` is India Standard Time, which
 * has no daylight saving and one offset for the whole country — the assumption
 * is safe here in a way it would not be for a platform operating elsewhere,
 * and it matches the `Asia/Kolkata` default on `events.timezone`.
 * ══════════════════════════════════════════════════════════════════════════
 */
function localInstant(form: FormData, key: string): string | undefined {
  const raw = text(form, key);
  if (!raw) return undefined;
  // Already carries an offset (a value round-tripped from the API).
  if (/[+-]\d{2}:\d{2}$/.test(raw) || raw.endsWith('Z')) return raw;
  const withSeconds = raw.length === 16 ? `${raw}:00` : raw;
  return `${withSeconds}+05:30`;
}

function eventBody(form: FormData, { partial }: { partial: boolean }) {
  const blank = partial ? null : undefined;
  return {
    title: text(form, 'title'),
    slug: text(form, 'slug'),
    summary: text(form, 'summary') ?? blank,
    description: text(form, 'description') ?? blank,
    coverImage: text(form, 'coverImage') ?? blank,
    startDate: localInstant(form, 'startDate'),
    endDate: localInstant(form, 'endDate') ?? blank,
    venueName: text(form, 'venueName') ?? blank,
    address: text(form, 'address') ?? blank,
    city: text(form, 'city') ?? blank,
    state: text(form, 'state') ?? blank,
    isOnline: form.get('isOnline') === 'on',
    meetingUrl: text(form, 'meetingUrl') ?? blank,
    organizer: text(form, 'organizer') ?? blank,
    registrationDeadline: localInstant(form, 'registrationDeadline') ?? blank,
    // An empty capacity field means UNCAPPED, which is `null` — not zero, which
    // would be an event nobody may join.
    capacity: text(form, 'capacity') ? Number(text(form, 'capacity')) : blank,
    programId: text(form, 'programId') ?? blank,
    campaignId: text(form, 'campaignId') ?? blank,
  };
}

export async function createEvent(_prev: ActionState, form: FormData): Promise<ActionState> {
  let created: { id: string };
  try {
    created = await adminFetch<{ id: string }>('admin/events', {
      method: 'POST',
      body: eventBody(form, { partial: false }),
    });
  } catch (error) {
    return toState(error);
  }

  revalidateEvents();
  redirect(`/admin/events/${created.id}/edit`);
}

export async function updateEvent(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id'));
  try {
    await adminFetch(`admin/events/${id}`, {
      method: 'PATCH',
      body: eventBody(form, { partial: true }),
    });
  } catch (error) {
    return toState(error);
  }

  revalidateEvents(text(form, 'slug'));
  revalidatePath(`/admin/events/${id}/edit`);
  return { ok: true };
}

export async function changeEventStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id'));
  try {
    await adminFetch(`admin/events/${id}/status`, {
      method: 'PATCH',
      body: { status: String(form.get('action')), reason: text(form, 'reason') },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateEvents(text(form, 'slug'));
  revalidatePath(`/admin/events/${id}/edit`);
  return { ok: true };
}

/**
 * Open, close, cancel or complete.
 *
 * SEPARATE from publication, and cancelling here emails every registrant — the
 * reason is quoted to them, which is why the API refuses a cancellation without
 * one and why `StatusActions` is told to collect it first.
 */
export async function changeEventLifecycle(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = String(form.get('id'));
  try {
    await adminFetch(`admin/events/${id}/lifecycle`, {
      method: 'PATCH',
      body: { lifecycle: String(form.get('action')), reason: text(form, 'reason') },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateEvents(text(form, 'slug'));
  revalidatePath(`/admin/events/${id}/edit`);
  revalidatePath(`/admin/events/${id}/registrations`);
  return { ok: true };
}

export async function recordAttendance(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id'));

  /*
    One radio group per person, named `mark-<registrationId>`, whose value is
    `attended` or `no_show` — or which is left on an option with NO value at
    all, meaning "leave this row alone".

    That third option is the reason this is not a pair of checkbox lists. A
    register submitted with everybody defaulted to absent would mark a hundred
    people as no-shows because an organiser saved early, and `no_show` is a
    claim about a person rather than an absence of data. A row that submits
    nothing is a row this function never mentions.
  */
  const entries: { registrationId: string; status: 'attended' | 'no_show' }[] = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith('mark-')) continue;
    const status = String(value);
    if (status !== 'attended' && status !== 'no_show') continue;
    entries.push({ registrationId: key.slice('mark-'.length), status });
  }

  if (entries.length === 0) {
    return { error: 'Mark at least one person before saving.' };
  }

  try {
    await adminFetch(`admin/events/${id}/attendance`, { method: 'POST', body: { entries } });
  } catch (error) {
    return toState(error);
  }

  revalidatePath(`/admin/events/${id}/registrations`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Impact
// ---------------------------------------------------------------------------

function revalidateImpact(slug?: string) {
  revalidateTag('impact');
  if (slug) revalidateTag(`impact-${slug}`);
  revalidatePath('/impact');
  revalidatePath('/admin/impact');
}

function impactBody(form: FormData, { partial }: { partial: boolean }) {
  const blank = partial ? null : undefined;
  return {
    title: text(form, 'title'),
    slug: text(form, 'slug'),
    description: text(form, 'description'),
    coverImage: text(form, 'coverImage') ?? blank,
    impactDate: text(form, 'impactDate'),
    location: text(form, 'location') ?? blank,
    state: text(form, 'state') ?? blank,
    campaignId: text(form, 'campaignId') ?? blank,
    programId: text(form, 'programId') ?? blank,
    eventId: text(form, 'eventId') ?? blank,
    metricType: text(form, 'metricType') ?? blank,
    metricValue: text(form, 'metricValue') ? Number(text(form, 'metricValue')) : blank,
    metricUnit: text(form, 'metricUnit') ?? blank,
    verificationMethod: text(form, 'verificationMethod') ?? blank,
  };
}

export async function createImpactRecord(_prev: ActionState, form: FormData): Promise<ActionState> {
  let created: { id: string };
  try {
    created = await adminFetch<{ id: string }>('admin/impact', {
      method: 'POST',
      body: impactBody(form, { partial: false }),
    });
  } catch (error) {
    return toState(error);
  }

  revalidateImpact();
  redirect(`/admin/impact/${created.id}/edit`);
}

export async function updateImpactRecord(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id'));
  try {
    await adminFetch(`admin/impact/${id}`, {
      method: 'PATCH',
      body: impactBody(form, { partial: true }),
    });
  } catch (error) {
    return toState(error);
  }

  revalidateImpact(text(form, 'slug'));
  revalidatePath(`/admin/impact/${id}/edit`);
  return { ok: true };
}

export async function changeImpactStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id'));
  try {
    await adminFetch(`admin/impact/${id}/status`, {
      method: 'PATCH',
      body: { status: String(form.get('action')), reason: text(form, 'reason') },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateImpact(text(form, 'slug'));
  revalidatePath(`/admin/impact/${id}/edit`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Re-authentication
// ---------------------------------------------------------------------------

/**
 * Open the sensitive-operation window.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A SENSITIVE ROUTE IS NOT REACHABLE WITHOUT THIS, so somewhere in the UI has
 * to offer it — otherwise `@Sensitive()` is a permanent 403 and the feature
 * behind it does not exist.
 *
 * Decision A9: an operation like reading a full attendee list, with everyone's
 * name, email and phone number in one response, requires a re-authentication
 * within the last five minutes. The window is opened deliberately, by typing a
 * password, and it closes on its own.
 *
 * The password is NOT kept anywhere. It goes straight to the API, which records
 * only the fact and the time of the re-authentication on the session row.
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function reauthenticate(_prev: ActionState, form: FormData): Promise<ActionState> {
  const password = String(form.get('password') ?? '');
  const totpCode = text(form, 'totpCode');

  if (!password) {
    return { error: 'Enter your password.', fieldErrors: { password: 'Required' } };
  }

  try {
    await adminFetch('auth/reauth', { method: 'POST', body: { password, totpCode } });
  } catch (error) {
    return toState(error);
  }

  // The caller's own page is refreshed, so the operator lands on the content
  // they were trying to reach rather than on a "now try again" message.
  const back = text(form, 'returnTo');
  if (back?.startsWith('/') && !back.startsWith('//')) revalidatePath(back);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Volunteers
// ---------------------------------------------------------------------------

function revalidateVolunteers(id?: string) {
  revalidatePath('/admin/volunteers');
  if (id) revalidatePath(`/admin/volunteers/${id}`);
  // `/impact` publishes `activeVolunteers` and `verifiedVolunteerHours` as
  // live aggregates, so an approval or a verified hour changes a public page.
  revalidateTag('impact');
  revalidatePath('/impact');
}

/**
 * Approve, reject, activate, suspend or archive.
 *
 * `reason` is ADMIN-ONLY on every branch. It is recorded on the application
 * and in the audit log, and the applicant is never shown it — see the
 * notification processor for why.
 */
export async function decideVolunteer(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id'));
  try {
    await adminFetch(`admin/volunteers/${id}/decision`, {
      method: 'PATCH',
      body: {
        // `StatusActions` puts the target status in the field it calls
        // `endpoint`; this route takes it in the body.
        status: String(form.get('action')),
        reason: text(form, 'reason'),
        reviewNotes: text(form, 'reviewNotes'),
        coolingPeriodDays: text(form, 'coolingPeriodDays')
          ? Number(text(form, 'coolingPeriodDays'))
          : undefined,
      },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateVolunteers(id);
  return { ok: true };
}

export async function updateVolunteer(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id'));
  try {
    await adminFetch(`admin/volunteers/${id}`, {
      method: 'PATCH',
      body: {
        firstName: text(form, 'firstName'),
        lastName: text(form, 'lastName') ?? null,
        email: text(form, 'email') ?? null,
        phone: text(form, 'phone'),
        city: text(form, 'city') ?? null,
        state: text(form, 'state') ?? null,
        occupation: text(form, 'occupation') ?? null,
        emergencyContactName: text(form, 'emergencyContactName') ?? null,
        emergencyContactPhone: text(form, 'emergencyContactPhone') ?? null,
        emergencyContactRelation: text(form, 'emergencyContactRelation') ?? null,
        internalNotes: text(form, 'internalNotes') ?? null,
      },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateVolunteers(id);
  return { ok: true };
}

export async function createVolunteerAssignment(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = String(form.get('id'));
  try {
    await adminFetch(`admin/volunteers/${id}/assignments`, {
      method: 'POST',
      body: {
        role: text(form, 'role'),
        description: text(form, 'description'),
        location: text(form, 'location'),
        // Same India-Standard-Time reasoning as the event form: a
        // `datetime-local` value carries no offset, and interpreting it in the
        // server's zone would move every assignment by five and a half hours.
        startsAt: localInstant(form, 'startsAt'),
        endsAt: localInstant(form, 'endsAt'),
        expectedHours: text(form, 'expectedHours')
          ? Number(text(form, 'expectedHours'))
          : undefined,
      },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateVolunteers(id);
  return { ok: true };
}

export async function setAssignmentStatus(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = String(form.get('id'));
  const assignmentId = String(form.get('assignmentId'));
  try {
    await adminFetch(`admin/volunteers/${id}/assignments/${assignmentId}`, {
      method: 'PATCH',
      body: { status: String(form.get('status')), reason: text(form, 'reason') },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateVolunteers(id);
  return { ok: true };
}

/**
 * Record what was worked.
 *
 * MINUTES, not hours — the form asks for minutes because somebody who worked
 * 90 of them should not have to decide whether that is "1" or "1.5", and a
 * float becomes a rounding argument on a figure that ends up on a certificate.
 */
export async function recordVolunteerAttendance(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = String(form.get('id'));
  const assignmentId = String(form.get('assignmentId'));
  try {
    await adminFetch(`admin/volunteers/${id}/assignments/${assignmentId}/attendance`, {
      method: 'POST',
      body: {
        date: text(form, 'date'),
        durationMinutes: Number(text(form, 'durationMinutes') ?? 0),
        notes: text(form, 'notes'),
        verified: form.get('verified') === 'on',
      },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateVolunteers(id);
  return { ok: true };
}

export async function verifyVolunteerAttendance(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = String(form.get('id'));
  const attendanceIds = form.getAll('attendanceId').map(String);

  if (attendanceIds.length === 0) {
    return { error: 'Select at least one record.' };
  }

  try {
    await adminFetch(`admin/volunteers/${id}/attendance/verify`, {
      method: 'POST',
      body: { attendanceIds, verified: form.get('unverify') !== 'true' },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateVolunteers(id);
  return { ok: true };
}

/**
 * Issue a certificate.
 *
 * The hours are NOT sent: they are computed by the API from verified
 * attendance in the period and frozen at issue. A client-supplied figure would
 * make the document worth nothing.
 */
export async function issueVolunteerCertificate(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = String(form.get('id'));
  try {
    await adminFetch(`admin/volunteers/${id}/certificates`, {
      method: 'POST',
      body: {
        certificateType: text(form, 'certificateType'),
        title: text(form, 'title'),
        periodStart: text(form, 'periodStart'),
        periodEnd: text(form, 'periodEnd'),
      },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateVolunteers(id);
  return { ok: true };
}

export async function revokeVolunteerCertificate(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const certificateId = String(form.get('certificateId'));
  try {
    await adminFetch(`admin/certificates/${certificateId}/revoke`, {
      method: 'PATCH',
      body: { reason: text(form, 'reason') },
    });
  } catch (error) {
    return toState(error);
  }

  revalidateVolunteers(text(form, 'id'));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Staff administration
// ---------------------------------------------------------------------------

/**
 * Every write here is `@Sensitive()` on the API and needs a re-authentication
 * within the last five minutes. That is not re-implemented — the API refuses
 * with `REAUTH_REQUIRED` and the page shows the existing re-auth panel. The
 * check lives in one place, and it is the place that can enforce it.
 */
function revalidateStaff(id?: string) {
  revalidatePath('/admin/users');
  if (id) revalidatePath(`/admin/users/${id}`);
  // A role or status change shows up in the log immediately.
  revalidatePath('/admin/audit-logs');
}

export async function inviteUser(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    /*
      ROLES ARE NOT TAKEN FROM THE FORM AS FREE TEXT.

      `roleKeys` is fixed to SUPER_ADMIN, the only role that exists. Posting
      whatever a select happened to contain would let a stale page — or a
      crafted request — ask for a role this application deliberately retired.
      The API would reject an unknown key, but the UI should not be the thing
      offering it.
    */
    await adminFetch('admin/users', {
      method: 'POST',
      body: {
        email: String(form.get('email') ?? '').trim(),
        firstName: String(form.get('firstName') ?? '').trim(),
        lastName: String(form.get('lastName') ?? '').trim() || undefined,
        phone: String(form.get('phone') ?? '').trim() || undefined,
        roleKeys: ['SUPER_ADMIN'],
      },
    });
    revalidateStaff();
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export async function updateUser(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  try {
    // Name and phone only — the API accepts nothing else, and an email change
    // would move the identity the audit snapshots are keyed to.
    await adminFetch(`admin/users/${id}`, {
      method: 'PATCH',
      body: {
        firstName: String(form.get('firstName') ?? '').trim(),
        lastName: String(form.get('lastName') ?? '').trim(),
        phone: String(form.get('phone') ?? '').trim(),
      },
    });
    revalidateStaff(id);
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export async function assignUserRoles(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  try {
    await adminFetch(`admin/users/${id}/roles`, {
      method: 'POST',
      body: {
        roleKeys: ['SUPER_ADMIN'],
        reason: String(form.get('reason') ?? '').trim() || undefined,
      },
    });
    revalidateStaff(id);
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export async function suspendUser(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  try {
    // A reason is mandatory on the API. Suspension revokes every session that
    // account holds, in the same transaction — it takes effect now, not when a
    // token expires.
    await adminFetch(`admin/users/${id}/suspend`, {
      method: 'POST',
      body: { reason: String(form.get('reason') ?? '').trim() },
    });
    revalidateStaff(id);
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export async function reactivateUser(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  try {
    await adminFetch(`admin/users/${id}/reactivate`, {
      method: 'POST',
      body: { reason: String(form.get('reason') ?? '').trim() },
    });
    revalidateStaff(id);
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Change site settings.
 *
 * `@Sensitive()` on the API, so a stale session gets `REAUTH_REQUIRED` and the
 * page shows the re-auth panel. Only the fields present in the form are sent,
 * so a partially-filled form does not blank the rest.
 *
 * `fcra_enabled` is deliberately NOT accepted here. Nothing in the application
 * reads it — the FCRA handling in the donation flow is hard-coded — so a
 * toggle would change no behaviour while appearing to authorise foreign
 * contributions the organisation is not registered to accept. The API still
 * validates it for completeness; the UI does not offer it.
 */
export async function updateSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  const text = (name: string) => String(form.get(name) ?? '').trim();
  const orNull = (value: string) => (value.length > 0 ? value : null);

  try {
    const minimum = Number(text('donation_minimum_paise'));
    if (!Number.isInteger(minimum) || minimum < 0) {
      return {
        error: 'The minimum donation must be a whole, non-negative number of paise.',
        fieldErrors: { donation_minimum_paise: 'Whole number of paise, 0 or more.' },
      };
    }

    await adminFetch('admin/settings', {
      method: 'PATCH',
      body: {
        organization_name: text('organization_name'),
        registration_details: {
          registrationNumber: orNull(text('registrationNumber')),
          pan: orNull(text('pan').toUpperCase()),
          section12A: orNull(text('section12A')),
          section80G: orNull(text('section80G')),
        },
        donation_minimum_paise: minimum,
        reason: text('reason') || undefined,
      },
    });

    revalidatePath('/admin/settings');
    revalidatePath('/admin/audit-logs');
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

// ---------------------------------------------------------------------------
// Success stories
// ---------------------------------------------------------------------------

function revalidateStories(slug?: string) {
  revalidateTag('stories');
  revalidatePath('/admin/stories');
  revalidatePath('/stories');
  if (slug) revalidatePath(`/stories/${slug}`);
  revalidatePath('/admin/audit-logs');
}

/** Empty string means "cleared", which is not the same as "not supplied". */
function storyFields(form: FormData) {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value.trim() : '';
  };
  const orNull = (name: string) => text(name) || null;

  return {
    title: text('title'),
    excerpt: orNull('excerpt'),
    content: orNull('content'),
    challenge: orNull('challenge'),
    intervention: orNull('intervention'),
    journey: orNull('journey'),
    outcome: orNull('outcome'),
    impact: orNull('impact'),
    category: orNull('category'),
    location: orNull('location'),
    subjectName: orNull('subjectName'),
    coverImage: orNull('coverImage'),
    programId: orNull('programId'),
    campaignId: orNull('campaignId'),
    // Checkboxes are absent from the payload when unticked.
    consentObtained: form.get('consentObtained') === 'on',
    isAnonymised: form.get('isAnonymised') === 'on',
    metaTitle: orNull('metaTitle'),
    metaDescription: orNull('metaDescription'),
  };
}

export async function createStory(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const story = await adminFetch<{ id: string }>('admin/stories', {
      method: 'POST',
      body: storyFields(form),
    });
    revalidateStories();
    // The editor lands on the story they just made, not back on a list.
    return { ok: true, redirectTo: `/admin/stories/${story.id}` };
  } catch (error) {
    return toState(error);
  }
}

export async function updateStory(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  try {
    await adminFetch(`admin/stories/${id}`, { method: 'PATCH', body: storyFields(form) });
    revalidateStories(String(form.get('slug') ?? ''));
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Publish, unpublish or archive.
 *
 * `@Sensitive()` on the API, so a stale session gets `REAUTH_REQUIRED` and the
 * page shows the re-auth panel. The consent gate is the API's too — this does
 * not re-implement it, it renders what the API says is missing.
 */
export async function setStoryStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  try {
    await adminFetch(`admin/stories/${id}/status`, {
      method: 'PATCH',
      body: {
        status: String(form.get('status') ?? ''),
        reason: String(form.get('reason') ?? '').trim() || undefined,
      },
    });
    revalidateStories(String(form.get('slug') ?? ''));
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

// ---------------------------------------------------------------------------
// Media library
// ---------------------------------------------------------------------------

function revalidateMedia(id?: string) {
  revalidatePath('/admin/media');
  if (id) revalidatePath(`/admin/media/${id}`);
  revalidatePath('/admin/audit-logs');
}

/**
 * Upload an image.
 *
 * The file is forwarded to the API untouched — no validation happens here, and
 * that is deliberate. A check in a server action is a check the API must repeat
 * anyway, and two copies of a rule drift. The API sniffs the bytes, enforces
 * the size, and builds the storage key; this only carries the request.
 */
export async function uploadMedia(_prev: ActionState, form: FormData): Promise<ActionState> {
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose an image to upload.', fieldErrors: { file: 'Required.' } };
  }

  try {
    const forwarded = new FormData();
    forwarded.append('file', file);
    forwarded.append('altText', String(form.get('altText') ?? '').trim());
    const caption = String(form.get('caption') ?? '').trim();
    if (caption) forwarded.append('caption', caption);
    forwarded.append('visibility', String(form.get('visibility') ?? 'public'));

    await adminUpload('admin/media', forwarded);
    revalidateMedia();
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export async function updateMedia(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  try {
    const body: Record<string, unknown> = {};
    const altText = String(form.get('altText') ?? '').trim();
    if (altText) body.altText = altText;

    // An empty caption means "cleared", which is not the same as "unchanged".
    if (form.has('caption')) body.caption = String(form.get('caption') ?? '').trim() || null;
    if (form.has('visibility')) body.visibility = String(form.get('visibility'));

    await adminFetch(`admin/media/${id}`, { method: 'PATCH', body });
    revalidateMedia(id);
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Delete an image and its object.
 *
 * `@Sensitive()` on the API, and refused with 409 when the image is in use —
 * the UI renders that refusal rather than trying to predict it.
 */
export async function deleteMedia(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  try {
    await adminFetch(`admin/media/${id}`, { method: 'DELETE' });
    revalidateMedia();
    return { ok: true, redirectTo: '/admin/media' };
  } catch (error) {
    return toState(error);
  }
}

// ---------------------------------------------------------------------------
// Blog (Phase 10.7)
// ---------------------------------------------------------------------------

function revalidateBlog(slug?: string) {
  revalidateTag('blog');
  revalidatePath('/admin/blog');
  revalidatePath('/blog');
  if (slug) revalidatePath(`/blog/${slug}`);
  // A publish or an archive writes an audit row, and the log is a page too.
  revalidatePath('/admin/audit-logs');
  /*
    THE SITEMAP IS NOT REVALIDATED BY PATH, deliberately.

    `revalidatePath('/sitemap.xml')` looks right and is both redundant and
    harmful. Redundant because `sitemap.ts` reads the blog through the same
    tagged fetch that `revalidateTag('blog')` above already invalidates; and
    harmful because revalidating a non-page route from an action invalidated
    enough of the client router that the form REMOUNTED — which reset
    `useActionState`, so the `redirectTo` it had just returned was discarded
    and the editor sat on a "Saved." banner instead of landing on their post.
  */
}

function blogFields(form: FormData) {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value.trim() : '';
  };
  const orNull = (name: string) => text(name) || null;

  return {
    title: text('title'),
    // Absent rather than empty: the API derives one from the title when it is
    // not supplied, and sending '' would fail the slug pattern instead.
    ...(text('slug') ? { slug: text('slug') } : {}),
    excerpt: orNull('excerpt'),
    content: orNull('content'),
    featuredMediaId: orNull('featuredMediaId'),
    categoryId: orNull('categoryId'),
    /*
      A comma-separated field, split here rather than in the API. The API takes
      a list of names because that is the honest shape of the data; the comma
      is a detail of this one input control.
    */
    tags: text('tags')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    metaTitle: orNull('metaTitle'),
    metaDescription: orNull('metaDescription'),
    canonicalUrl: orNull('canonicalUrl'),
  };
}

export async function createBlogPost(_prev: ActionState, form: FormData): Promise<ActionState> {
  let id: string;

  try {
    const post = await adminFetch<{ id: string }>('admin/blog', {
      method: 'POST',
      body: blogFields(form),
    });
    id = post.id;
    revalidateBlog();
  } catch (error) {
    return toState(error);
  }

  /*
    REDIRECTED ON THE SERVER, not by returning `redirectTo` for the client to
    act on.

    The `{ ok, redirectTo }` shape used elsewhere relies on the form component
    surviving long enough to run an effect. This action revalidates paths, and
    that invalidation sometimes remounted the form before the effect ran — so
    `useActionState` reset, the returned `redirectTo` was discarded, and the
    editor was left looking at a "Saved." banner on an empty form while their
    post existed somewhere they had not been taken to.

    `redirect()` throws a NEXT_REDIRECT that the framework handles, so it must
    sit OUTSIDE the try above or the catch would swallow it and report the
    navigation as a failure.
  */
  redirect(`/admin/blog/${id}`);
}

export async function updateBlogPost(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  try {
    await adminFetch(`admin/blog/${id}`, { method: 'PATCH', body: blogFields(form) });
    /*
      BOTH slugs are revalidated. Renaming a published post leaves the old URL
      serving a 301 and the new one serving the article; revalidating only the
      new one leaves a stale page cached at the old address.
    */
    revalidateBlog(String(form.get('slug') ?? ''));
    revalidateBlog(String(form.get('previousSlug') ?? ''));
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Publish, unpublish or archive.
 *
 * `@Sensitive()` on the API, so a stale session gets `REAUTH_REQUIRED` and the
 * page shows the re-auth panel. The publish gate is the API's too — this does
 * not re-implement it, it renders what the API says is missing.
 */
export async function setBlogStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  try {
    await adminFetch(`admin/blog/${id}/status`, {
      method: 'PATCH',
      body: {
        status: String(form.get('status') ?? ''),
        reason: String(form.get('reason') ?? '').trim() || undefined,
      },
    });
    revalidateBlog(String(form.get('slug') ?? ''));
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

// ---------------------------------------------------------------------------
// Pages — the section composer (Phase 10.9)
// ---------------------------------------------------------------------------

function revalidatePages(slug?: string) {
  revalidateTag('pages');
  revalidatePath('/admin/pages');
  // A composed page changes a public route, and `home` is `/`.
  if (slug) revalidatePath(slug === 'home' ? '/' : `/${slug}`);
  revalidatePath('/admin/audit-logs');
}

/**
 * The sections, as the form carries them.
 *
 * A single hidden field holding JSON, because the control is a reorderable
 * list rather than a set of inputs — and because the API validates the array
 * against the approved registry anyway. Anything malformed is refused there,
 * which is the only place that can be authoritative.
 */
function sectionsFrom(form: FormData): unknown {
  const raw = form.get('sections');
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  try {
    return JSON.parse(raw);
  } catch {
    // Left as a string so the API's validation reports it, rather than this
    // silently sending an empty page and wiping somebody's layout.
    return raw;
  }
}

export async function createPage(_prev: ActionState, form: FormData): Promise<ActionState> {
  let id: string;

  try {
    const page = await adminFetch<{ id: string }>('admin/pages', {
      method: 'POST',
      body: {
        slug: String(form.get('slug') ?? '').trim(),
        title: String(form.get('title') ?? '').trim(),
        sections: sectionsFrom(form),
      },
    });
    id = page.id;
    revalidatePages();
  } catch (error) {
    return toState(error);
  }

  // Redirected on the SERVER, for the reason `createBlogPost` documents: a
  // returned `redirectTo` can be lost when a revalidation remounts the form.
  redirect(`/admin/pages/${id}`);
}

export async function updatePage(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  try {
    await adminFetch(`admin/pages/${id}`, {
      method: 'PATCH',
      body: {
        title: String(form.get('title') ?? '').trim(),
        sections: sectionsFrom(form),
        metaTitle: String(form.get('metaTitle') ?? '').trim() || null,
        metaDescription: String(form.get('metaDescription') ?? '').trim() || null,
        note: String(form.get('note') ?? '').trim() || undefined,
      },
    });
    revalidatePages(String(form.get('slug') ?? ''));
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Publish, schedule, unpublish or archive.
 *
 * `@Sensitive()` on the API: a stale session gets `REAUTH_REQUIRED`. A future
 * `scheduledAt` keeps the page invisible until then, enforced on every public
 * read rather than by a job.
 */
export async function setPageStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  const scheduledAt = String(form.get('scheduledAt') ?? '').trim();

  try {
    await adminFetch(`admin/pages/${id}/status`, {
      method: 'PATCH',
      body: {
        status: String(form.get('status') ?? ''),
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        reason: String(form.get('reason') ?? '').trim() || undefined,
      },
    });
    revalidatePages(String(form.get('slug') ?? ''));
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/** Restore an earlier version. A new save of old content, never a rewind. */
export async function revertPage(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  try {
    await adminFetch(`admin/pages/${id}/revert`, {
      method: 'POST',
      body: {
        version: Number(form.get('version')),
        reason: String(form.get('reason') ?? '').trim() || undefined,
      },
    });
    revalidatePages(String(form.get('slug') ?? ''));
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

// ---------------------------------------------------------------------------
// Documents (Phase 10.10)
// ---------------------------------------------------------------------------

function revalidateDocuments(id?: string) {
  revalidatePath('/admin/documents');
  if (id) revalidatePath(`/admin/documents/${id}`);
}

/**
 * Upload a document.
 *
 * The visibility field is forwarded ONLY when the form actually carried one.
 * The API defaults a missing value to `private`, and that default is the
 * safety net — sending `String(form.get('visibility') ?? 'public')`, as the
 * media action does, would turn a renamed input into a public annual report.
 */
export async function uploadDocument(_prev: ActionState, form: FormData): Promise<ActionState> {
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a document to upload.', fieldErrors: { file: 'Required.' } };
  }

  try {
    const forwarded = new FormData();
    forwarded.append('file', file);
    forwarded.append('title', String(form.get('title') ?? '').trim());

    for (const field of ['description', 'documentType', 'visibility', 'financialYear'] as const) {
      const value = String(form.get(field) ?? '').trim();
      if (value) forwarded.append(field, value);
    }

    const campaignId = String(form.get('relatedId') ?? '').trim();
    if (campaignId) {
      forwarded.append('relatedType', 'campaign');
      forwarded.append('relatedId', campaignId);
    }

    await adminUpload('admin/documents', forwarded);
    revalidateDocuments();
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export async function updateDocument(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  try {
    const body: Record<string, unknown> = {};
    for (const field of ['title', 'documentType'] as const) {
      const value = String(form.get(field) ?? '').trim();
      if (value) body[field] = value;
    }
    // Empty means "cleared", which is not the same as "unchanged" — so these
    // are sent whenever the field was present on the form at all.
    if (form.has('description')) body.description = String(form.get('description') ?? '').trim();
    if (form.has('financialYear')) {
      body.financialYear = String(form.get('financialYear') ?? '').trim();
    }

    await adminFetch(`admin/documents/${id}`, { method: 'PATCH', body });
    revalidateDocuments(id);
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Change a document's visibility.
 *
 * `@Sensitive()` on the API, so an operator without a fresh re-authentication
 * gets `REAUTH_REQUIRED` back and the panel asks for a password. The reason is
 * required by the schema and lands on the audit row — this is the action §4.20
 * singles out, and "private → public" without a why is not much of a record.
 */
export async function changeDocumentVisibility(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  const visibility = String(form.get('visibility') ?? '');
  const reason = String(form.get('reason') ?? '').trim();

  if (!visibility) {
    return { error: 'Choose a visibility.', fieldErrors: { visibility: 'Required.' } };
  }

  try {
    await adminFetch(`admin/documents/${id}/visibility`, {
      method: 'PATCH',
      body: { visibility, reason },
    });
    revalidateDocuments(id);
    // A public document appears on its campaign's page, which is cached.
    revalidatePath('/campaigns', 'layout');
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Ask the API for a link to a document's bytes.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A SERVER ACTION, NOT A CLIENT FETCH. Decision A1.
 *
 * The browser never calls the API directly — it has no token, and giving it
 * one to fetch a signed URL would put a staff credential in JavaScript to save
 * a hop. The first version of this imported `requestDocumentLink` straight
 * into the client component and the build refused it, which was the right
 * answer for the right reason: `api.ts` is `server-only`.
 *
 * Returns the URL rather than redirecting, so the component can open it in a
 * new tab and leave the administrator where they were.
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function getDocumentLink(
  id: string,
): Promise<{ url?: string; fileName?: string; error?: string }> {
  try {
    const link = await requestDocumentLink(id);
    return { url: link.url, fileName: link.fileName };
  } catch (error) {
    return { error: toState(error).error ?? 'Could not open that document.' };
  }
}

// ---------------------------------------------------------------------------
// Notifications (Phase 10.11)
// ---------------------------------------------------------------------------

function revalidateNotifications(id?: string) {
  revalidatePath('/admin/notifications');
  revalidatePath('/admin/notifications/log');
  revalidatePath('/admin', 'layout');
  if (id) revalidatePath(`/admin/notification-templates/${id}`);
}

export async function markNotificationRead(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  try {
    await adminFetch(`admin/notifications/${id}/read`, { method: 'PATCH' });
    revalidateNotifications();
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export async function markAllNotificationsRead(): Promise<ActionState> {
  try {
    await adminFetch('admin/notifications/read-all', { method: 'POST' });
    revalidateNotifications();
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Try a failed send again.
 *
 * `@Sensitive()` on the API, so an operator without a fresh re-authentication
 * gets `REAUTH_REQUIRED` back and the panel asks for a password. It enqueues a
 * fresh attempt; the failed entry stays exactly as it is.
 */
export async function retryNotification(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  try {
    await adminFetch(`admin/notifications/log/${id}/retry`, { method: 'POST' });
    revalidateNotifications();
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Save a new version of a template.
 *
 * Every save is a version, so there is no "are you sure" — going back is a
 * revert, and a revert is itself a version.
 */
export async function updateNotificationTemplate(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  try {
    const body: Record<string, unknown> = {};
    for (const field of ['subject', 'bodyHtml', 'bodyText', 'note'] as const) {
      const value = String(form.get(field) ?? '').trim();
      if (value) body[field] = value;
    }
    if (form.has('isActive')) body.isActive = form.get('isActive') === 'on';

    await adminFetch(`admin/notification-templates/${id}`, { method: 'PATCH', body });
    revalidateNotifications(id);
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export async function revertNotificationTemplate(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = String(form.get('id') ?? '');
  const version = Number(form.get('version') ?? 0);
  try {
    await adminFetch(`admin/notification-templates/${id}/revert`, {
      method: 'POST',
      body: { version },
    });
    revalidateNotifications(id);
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/** Render a draft without sending it. Returns the preview rather than a state. */
export async function previewTemplate(
  id: string,
  body: { subject: string; bodyHtml: string; bodyText: string },
): Promise<{ subject?: string; html?: string; text?: string; missing?: string[]; error?: string }> {
  try {
    return await previewNotificationTemplate(id, body);
  } catch (error) {
    return { error: toState(error).error ?? 'Could not render that.' };
  }
}
