/**
 * Homepage content that has no backing table yet.
 *
 * ⚠️  DEVELOPMENT CONTENT. Everything here is illustrative and is replaced by
 * API data as each table arrives. Structured so that swap is a change to one
 * import, not a rewrite of a component:
 *
 *   focusAreas   → `categories` (Phase 4) — already live, see lib/content
 *   testimonials → a `testimonials` table, Phase 7 CMS
 *   partners     → a `partners` table, Phase 7 CMS
 *
 * NOTHING HERE ASSERTS A REAL-WORLD CLAIM. The people are fictional, and the
 * partner list is deliberately unbranded — a logo on a partner strip claims
 * that an organization endorses us, and an unearned one is the most damaging
 * kind of placeholder a charity site can carry.
 */

export interface FocusArea {
  slug: string;
  title: string;
  blurb: string;
  icon: 'book' | 'heart' | 'utensils' | 'shield' | 'users' | 'sprout' | 'paw';
  wash: 'blue' | 'rose' | 'amber' | 'violet' | 'pink' | 'mint';
}

/** Mirrors the seeded `categories` rows, so the live list drops straight in. */
export const focusAreas: FocusArea[] = [
  { slug: 'education', title: 'Education', blurb: 'Brighter Futures', icon: 'book', wash: 'blue' },
  {
    slug: 'healthcare',
    title: 'Healthcare',
    blurb: 'Healthier Communities',
    icon: 'heart',
    wash: 'rose',
  },
  {
    slug: 'food-support',
    title: 'Food Security',
    blurb: 'Hunger-Free Tomorrow',
    icon: 'utensils',
    wash: 'amber',
  },
  {
    slug: 'disaster-relief',
    title: 'Disaster Relief',
    blurb: 'Support When It Matters',
    icon: 'shield',
    wash: 'violet',
  },
  {
    slug: 'women-empowerment',
    title: 'Women Empowerment',
    blurb: 'Equal Opportunities',
    icon: 'users',
    wash: 'pink',
  },
  {
    slug: 'livelihood',
    title: 'Livelihood',
    blurb: 'Sustainable Growth',
    icon: 'sprout',
    wash: 'mint',
  },
  {
    slug: 'animal-welfare',
    title: 'Animal Welfare',
    blurb: 'Care for Voiceless',
    icon: 'paw',
    wash: 'blue',
  },
];

export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
  kind: 'parent' | 'community' | 'volunteer' | 'donor' | 'partner';
  /** Seed for the deterministic portrait placeholder. */
  photoSeed: string;
  /**
   * A real photograph, if one has been supplied.
   *
   * Written here rather than resolved from disk the way every other slot is:
   * the testimonial row is a CLIENT component — it has to be, it scrolls — and
   * the filesystem is not reachable from one. The path is checked by eye, and
   * a missing file shows a broken image rather than falling back, so keep this
   * in step with what is actually in `public/images/`.
   */
  photoUrl?: string;
}

export const testimonials: Testimonial[] = [
  {
    id: 't1',
    quote: 'Sailent Foundation gave my daughter the opportunity to study. I am forever grateful!',
    name: 'Anjali Sharma',
    role: 'Parent',
    kind: 'parent',
    photoSeed: 'team-testimonial-1',
    photoUrl: '/images/team-testimonial-1.webp',
  },
  {
    id: 't2',
    quote: 'The support during the floods came when we needed it the most. Truly life-changing.',
    name: 'Rohit Verma',
    role: 'Community Member',
    kind: 'community',
    photoSeed: 'team-testimonial-2',
    photoUrl: '/images/team-testimonial-2.webp',
  },
  {
    id: 't3',
    quote:
      'Volunteering with Sailent Foundation has been one of the most meaningful experiences of my life.',
    name: 'Priya Nair',
    role: 'Volunteer',
    kind: 'volunteer',
    photoSeed: 'team-testimonial-3',
    photoUrl: '/images/team-testimonial-3.webp',
  },
  {
    id: 't4',
    quote: 'The reporting shows me exactly where each donation went.',
    name: 'Sanjay Iyer',
    // Phase 13: was "Monthly Donor". Donations are one-time only.
    role: 'Donor',
    kind: 'donor',
    photoSeed: 'team-testimonial-4',
  },
];

export interface Partner {
  id: string;
  name: string;
  /** Null until a real logo is supplied; the component renders a wordmark. */
  logoUrl: string | null;
}

/**
 * ⚠️  THESE ARE REAL ORGANISATIONS, AND THIS STRIP IS A CLAIM ABOUT THEM.
 *
 * A logo here says the organisation works with or endorses Sailent Foundation.
 * UNICEF, the WHO, GuideStar, Microsoft, AWS and Google all have trademark
 * terms governing use of their marks, and several run formal partner
 * programmes with their own badge rules.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * EMPTY ON PURPOSE. THE BAND DOES NOT RENDER.
 *
 * This list used to hold eight real marks — UNICEF, the World Health
 * Organization, GivingTuesday, GuideStar, NGO Partnership, Microsoft, AWS and
 * Google for Nonprofits — supplied with the approved design and wired up
 * pending a check that never happened. A logo on a partner strip is a claim
 * that the organization endorses us, and eight unverified ones are the most
 * damaging placeholder a charity site can carry: the visitor most likely to
 * recognise those names is the visitor deciding whether to trust us with money.
 *
 * Removed on the owner's instruction, 25 September 2026, because nobody could
 * confirm the relationships existed or that the marks could be used.
 *
 * TO RESTORE: add a row per confirmed partner. `logoUrl` is optional — without
 * one the strip renders the name as a wordmark, which needs no asset and no
 * permission beyond the partnership itself. The section renders nothing while
 * this list is empty, so there is no empty heading to hide.
 * ══════════════════════════════════════════════════════════════════════════
 */
export const partners: Partner[] = [];
