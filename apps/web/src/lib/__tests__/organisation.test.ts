import { describe, expect, it } from 'vitest';

import { formatRegisteredOn, toOrganisation } from '@/lib/content/organisation';

const empty = {
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

/**
 * Organisation details come from Admin → Settings (Phase 13). The DEMO values
 * in `lib/demo-org.ts` may fill gaps ONLY while mock data is on — never in
 * production, where `useDemo` is always false.
 */
describe('toOrganisation', () => {
  it('without demo data, an unset field is null and nothing is marked demo', () => {
    const organisation = toOrganisation(empty, false);
    expect(organisation.email).toBeNull();
    expect(organisation.phoneDisplay).toBeNull();
    expect(organisation.addressLine).toBeNull();
    expect(organisation.registration.pan).toBeNull();
    expect(organisation.social).toEqual([]);
    expect(organisation.isDemo).toBe(false);
    expect(JSON.stringify(organisation)).not.toMatch(/DEMO|example\.org|123 Hope Street/);
  });

  it('uses saved settings, and derives the tel: link from the displayed number', () => {
    const organisation = toOrganisation(
      {
        ...empty,
        organization_contact: {
          ...empty.organization_contact,
          email: 'office@sailent.org',
          phone: '+91 20 4000 1234',
          address: { ...empty.organization_contact.address, line1: '1 Main Road', city: 'Pune' },
        },
        organization_social: [{ label: 'Instagram', url: 'https://instagram.com/sailent' }],
      },
      false,
    );
    expect(organisation.email).toBe('office@sailent.org');
    expect(organisation.phoneHref).toBe('+912040001234');
    expect(organisation.addressLine).toBe('1 Main Road, Pune');
    expect(organisation.social).toHaveLength(1);
    expect(organisation.isDemo).toBe(false);
  });

  it('in development fills only the gaps with DEMO values, and says so', () => {
    const organisation = toOrganisation(
      {
        ...empty,
        organization_contact: { ...empty.organization_contact, email: 'office@sailent.org' },
      },
      true,
    );
    expect(organisation.email).toBe('office@sailent.org');
    expect(organisation.registration.pan).toMatch(/DEMO/);
    expect(organisation.isDemo).toBe(true);
  });
});

describe('formatRegisteredOn', () => {
  it('formats an ISO date and leaves other text alone', () => {
    expect(formatRegisteredOn('2019-03-12')).toBe('12 March 2019');
    expect(formatRegisteredOn('12 March 2019')).toBe('12 March 2019');
    expect(formatRegisteredOn(null)).toBeNull();
  });
});
