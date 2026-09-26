/**
 * Dummy organization details.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️  EVERY VALUE HERE IS FAKE. Replace this one file with the real details.
 *
 * Earlier phases left these blank, because an invented statutory identifier on
 * an NGO website is a legal exposure rather than a placeholder. They are filled
 * now so the site can be reviewed as a finished design.
 *
 * Two safeguards keep that honest:
 *
 *   1. The statutory identifiers are deliberately shaped like the real thing
 *      but carry an unmistakable marker — `DEMO`, or an all-zero sequence — so
 *      nobody can mistake one for a genuine registration, and a search for
 *      "DEMO" finds every one of them.
 *   2. The site-wide demo notice names them explicitly while
 *      `FEATURE_MOCK_DATA` is on, and the config schema REFUSES to leave that
 *      flag enabled in production.
 *
 * When the real details arrive: replace the values below, delete the
 * `isDemo` flag, and the notice disappears on its own.
 * ══════════════════════════════════════════════════════════════════════════
 */

export const demoOrg = {
  /** Flips to false when real details replace the dummy ones. */
  isDemo: true,

  legalName: 'Sailent Foundation',
  registeredAs: 'Public Charitable Trust',

  address: {
    line1: '123 Hope Street',
    line2: 'Shivaji Nagar',
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '411005',
    country: 'India',
  },

  email: 'hello@sailentfoundation.org',
  pressEmail: 'press@sailentfoundation.org',
  /** E.164 for the tel: href. */
  phoneHref: '+919876543210',
  phoneDisplay: '+91 98765 43210',

  officeHours: 'Monday to Friday, 10:00 – 18:00 IST',

  /**
   * Statutory identifiers — ALL FAKE.
   * Shaped correctly so the layout is honest about how much room real values
   * need, marked so they cannot be mistaken for genuine registrations.
   */
  registration: {
    trustDeedNumber: 'DEMO/TRUST/2019/00000',
    registeredOn: '12 March 2019',
    pan: 'DEMOP0000A',
    section12A: 'DEMO-12A-00000000',
    section80G: 'DEMO-80G-00000000',
    csr1: 'DEMO-CSR-00000000',
  },

  /** Order matches the approved footer: Facebook, Instagram, LinkedIn, YouTube. */
  social: [
    { label: 'Facebook', url: 'https://example.org/sailent' },
    { label: 'Instagram', url: 'https://example.org/sailent' },
    { label: 'LinkedIn', url: 'https://example.org/sailent' },
    { label: 'YouTube', url: 'https://example.org/sailent' },
  ],

  bankingNote:
    'Donations are accepted in Indian rupees only. We are not registered under the Foreign Contribution (Regulation) Act and cannot accept foreign contributions.',
} as const;

/** Single-line postal address, for compact contexts. */
export const demoAddressLine = [
  demoOrg.address.line1,
  demoOrg.address.line2,
  `${demoOrg.address.city} ${demoOrg.address.postalCode}`,
  demoOrg.address.state,
].join(', ');
