import 'server-only';

import { cache } from 'react';

import { phoneHref } from '@sailent/validation';

import { demoOrg } from '@/lib/demo-org';

import { loadContent, publicCache, fixturesEnabled, requestTimeOnly } from './source';

/**
 * The organisation's public details, from Admin → Settings (Phase 13).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * SETTINGS FIRST; DEMO VALUES ONLY IN DEVELOPMENT.
 *
 * Every value the footer, contact page, About page and structured data show
 * comes from `GET /settings/public`. A field staff have not filled in is
 * NULL and the page leaves it out.
 *
 * Only while mock data is on (never with `APP_ENV=production`,
 * `lib/runtime-flags.ts`) does an empty field fall back to the DEMO value in
 * `lib/demo-org.ts`, so the design can be reviewed before the real details
 * exist — and `isDemo` then says so. In production nothing from `demo-org.ts`
 * can reach a page, which is why the start-up guard no longer needs to refuse
 * on it (Phase 12's guard moved here, to the source).
 * ══════════════════════════════════════════════════════════════════════════
 */

interface ApiOrganisationSettings {
  organization_name: string;
  registration_details: {
    registrationNumber: string | null;
    pan: string | null;
    section12A: string | null;
    section80G: string | null;
    registeredAs?: string | null;
    trustDeedNumber?: string | null;
    registeredOn?: string | null;
    csr1?: string | null;
  };
  organization_contact: {
    email: string | null;
    pressEmail: string | null;
    phone: string | null;
    officeHours: string | null;
    address: {
      line1: string | null;
      line2: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;
      country: string | null;
    };
  };
  organization_social: { label: string; url: string }[];
}

export interface Organisation {
  name: string;
  registeredAs: string | null;
  email: string | null;
  pressEmail: string | null;
  phoneDisplay: string | null;
  phoneHref: string | null;
  officeHours: string | null;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  };
  /** One line, for compact places; null if no part of the address is set. */
  addressLine: string | null;
  registration: {
    registrationNumber: string | null;
    trustDeedNumber: string | null;
    /** As stored: an ISO date from settings, or the demo's display text. */
    registeredOn: string | null;
    pan: string | null;
    section12A: string | null;
    section80G: string | null;
    csr1: string | null;
  };
  social: { label: string; url: string }[];
  /** True when any value shown came from the development DEMO data. */
  isDemo: boolean;
}

const EMPTY: ApiOrganisationSettings = {
  organization_name: 'Sailent Foundation',
  registration_details: { registrationNumber: null, pan: null, section12A: null, section80G: null },
  organization_contact: {
    email: null,
    pressEmail: null,
    phone: null,
    officeHours: null,
    address: { line1: null, line2: null, city: null, state: null, postalCode: null, country: null },
  },
  organization_social: [],
};

/** Pure, for tests: settings merged with the demo values when `useDemo`. */
export function toOrganisation(settings: ApiOrganisationSettings, useDemo: boolean): Organisation {
  let demoUsed = false;
  const pick = <T>(value: T | null | undefined, demo: T): T | null => {
    if (value !== null && value !== undefined && value !== '') return value;
    if (!useDemo) return null;
    demoUsed = true;
    return demo;
  };

  const contact = settings.organization_contact;
  const reg = settings.registration_details;
  const address = {
    line1: pick(contact.address.line1, demoOrg.address.line1),
    line2: pick(contact.address.line2, demoOrg.address.line2),
    city: pick(contact.address.city, demoOrg.address.city),
    state: pick(contact.address.state, demoOrg.address.state),
    postalCode: pick(contact.address.postalCode, demoOrg.address.postalCode),
    country: pick(contact.address.country, demoOrg.address.country),
  };
  const phoneDisplay = pick(contact.phone, demoOrg.phoneDisplay);
  const social =
    settings.organization_social.length > 0
      ? settings.organization_social
      : useDemo
        ? ((demoUsed = true), demoOrg.social.map((link) => ({ ...link })))
        : [];

  const addressParts = [
    address.line1,
    address.line2,
    [address.city, address.postalCode].filter(Boolean).join(' ') || null,
    address.state,
  ].filter(Boolean);

  return {
    name: settings.organization_name || demoOrg.legalName,
    registeredAs: pick(reg.registeredAs, demoOrg.registeredAs),
    email: pick(contact.email, demoOrg.email),
    pressEmail: pick(contact.pressEmail, demoOrg.pressEmail),
    phoneDisplay,
    phoneHref: phoneDisplay ? phoneHref(phoneDisplay) : null,
    officeHours: pick(contact.officeHours, demoOrg.officeHours),
    address,
    addressLine: addressParts.length > 0 ? addressParts.join(', ') : null,
    registration: {
      registrationNumber: pick(reg.registrationNumber, demoOrg.registration.trustDeedNumber),
      trustDeedNumber: pick(reg.trustDeedNumber, demoOrg.registration.trustDeedNumber),
      registeredOn: pick(reg.registeredOn, demoOrg.registration.registeredOn),
      pan: pick(reg.pan, demoOrg.registration.pan),
      section12A: pick(reg.section12A, demoOrg.registration.section12A),
      section80G: pick(reg.section80G, demoOrg.registration.section80G),
      csr1: pick(reg.csr1, demoOrg.registration.csr1),
    },
    social,
    isDemo: demoUsed,
  };
}

/**
 * The organisation's public details, once per request.
 *
 * Never throws: it feeds the footer of every page, including 404s, and a
 * contact block that cannot load must not take the page down with it. On
 * failure the details are simply absent (and logged).
 */
export const getOrganisation = cache(async (): Promise<Organisation> => {
  // Outside the try: during `next build` this must bail the route out of
  // prerendering, not be caught as a failure (Phase 14, see requestTimeOnly).
  await requestTimeOnly();
  try {
    const settings = await loadContent<ApiOrganisationSettings>({
      label: 'organisation settings',
      fromApi: (api) =>
        api.get<ApiOrganisationSettings>('settings/public', publicCache('settings')),
      fallback: () => EMPTY,
    });
    return toOrganisation(settings, fixturesEnabled);
  } catch (error) {
    console.error(
      `[content] organisation settings unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
    return toOrganisation(EMPTY, fixturesEnabled);
  }
});

/** "12 March 2019" from an ISO date; other text unchanged. */
export function formatRegisteredOn(value: string | null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}
