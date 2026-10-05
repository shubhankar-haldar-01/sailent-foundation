/**
 * Site configuration.
 *
 * Single source of truth for navigation and site identity, so the header,
 * footer, sitemap and breadcrumbs cannot disagree about what exists.
 *
 * Navigation follows the Phase 0 information architecture
 * (docs/information-architecture.md §2.1): seven primary items is the practical
 * ceiling before a nav becomes a menu nobody reads. Stories, Events, Team,
 * Contact and FAQ live in the footer and in contextual links — a nav of
 * thirteen items serves nobody.
 */

export interface NavItem {
  label: string;
  href: string;
  description?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const siteConfig = {
  name: 'Sailent Foundation',
  /**
   * Lockup tagline, shown under the wordmark in the header and footer.
   *
   * PLACEHOLDER. A tagline is a brand decision the organization makes, not one
   * the build makes for it — this is a plain, defensible line that occupies the
   * right amount of space so the lockup can be judged. Replace it.
   */
  tagline: 'People • Progress • Possibilities',
  /**
   * Default meta description. Placeholder copy, replaced with the
   * organization's own wording before launch.
   */
  description:
    'Sailent Foundation works alongside government schools, health centres and village committees across six districts — supporting education, healthcare, child welfare and livelihoods where the barrier is cost rather than willingness.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  locale: 'en_IN',
} as const;

/**
 * Primary navigation.
 *
 * Seven items, two of which group their children into a menu. Phase 0 caps the
 * nav at seven because beyond that it stops being navigation and becomes a
 * menu nobody reads; grouping Get involved and Resources keeps Stories and
 * Impact — the two that build trust — at the top level where they are seen.
 */
export interface NavEntry extends NavItem {
  children?: NavItem[];
}

export const primaryNav: NavEntry[] = [
  /*
    HOME IS LISTED, even though the logo already goes there.

    The wordmark is a link home and always has been, which is why this slot was
    empty — but it is a convention people know rather than one they are told,
    and the approved design spells it out. One extra item is well inside the
    seven-item ceiling this comment sets.
  */
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Programs', href: '/programs' },
  { label: 'Campaigns', href: '/campaigns' },
  /*
    No "Impact" item: taken out of the bar, and out of the footer, at the
    client's request. The /impact page itself still exists.
  */
  { label: 'Stories', href: '/stories' },
  {
    label: 'Get Involved',
    href: '/volunteer',
    children: [
      { label: 'Volunteer', href: '/volunteer', description: 'Give time to a program' },
      { label: 'Events', href: '/events', description: 'Field days and open sessions' },
      { label: 'Our team', href: '/team', description: 'Who runs the organization' },
    ],
  },
  {
    label: 'Resources',
    href: '/blog',
    children: [
      { label: 'Blog', href: '/blog', description: 'Field notes and program thinking' },
      { label: 'FAQ', href: '/faq', description: 'Common questions' },
    ],
  },
];

/** The single primary call to action. Present at every breakpoint. */
export const primaryCta: NavItem = { label: 'Donate Now', href: '/donate' };

/**
 * Footer navigation — four link columns, plus the contact block the footer
 * renders itself.
 *
 * The approved design's fifth heading is "Careers", which has no page, and the
 * slot previously held Transparency — a page that no longer exists either. The
 * platform does not publish documents to the public, so the registration
 * identifiers a visitor actually wants moved onto About, which this column
 * already links to.
 *
 * The Programs column points at the campaign listing filtered by category
 * rather than at a program page per area: the filter is a real route with
 * real results behind it, and it is the same destination the focus-area strip
 * on the homepage uses.
 */
export const footerNav: NavGroup[] = [
  {
    label: 'About',
    items: [
      { label: 'Our Mission', href: '/about' },
      { label: 'Our Team', href: '/team' },
      // No "Our Impact": removed from the footer, as from the header, at the
      // client's request. The /impact page itself is unchanged.
    ],
  },
  {
    label: 'Programs',
    items: [
      { label: 'Education', href: '/campaigns?categorySlug=education' },
      { label: 'Healthcare', href: '/campaigns?categorySlug=healthcare' },
      { label: 'Food Security', href: '/campaigns?categorySlug=food-support' },
      { label: 'Disaster Relief', href: '/campaigns?categorySlug=disaster-relief' },
      { label: 'Women Empowerment', href: '/campaigns?categorySlug=women-empowerment' },
      { label: 'Livelihood', href: '/campaigns?categorySlug=livelihood' },
      { label: 'Animal Welfare', href: '/campaigns?categorySlug=animal-welfare' },
    ],
  },
  {
    label: 'Get Involved',
    items: [
      { label: 'Volunteer', href: '/volunteer' },
      { label: 'Donate', href: '/donate' },
      { label: 'Events', href: '/events' },
      { label: 'Partner With Us', href: '/contact' },
      /*
        The way back in for someone who has already given.

        In the footer rather than the header because the header carries exactly
        one button by design, and a second one competing with Donate would cost
        more than an account link is worth. A donor looking for their receipt
        looks for "Your account", and this is where sites put it.
      */
      { label: 'Your Account', href: '/dashboard' },
    ],
  },
  {
    label: 'Resources',
    items: [
      { label: 'Blog', href: '/blog' },
      { label: 'FAQs', href: '/faq' },
    ],
  },
];

/**
 * The footer's legal row.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THERE IS NO REFUND POLICY LINK, AND THIS IS A DELIBERATE INSTRUCTION RATHER
 * THAN AN OVERSIGHT (Phase 9 §59).
 *
 * The page and the link were both removed in Phase 9: the platform implements
 * no refunds, and the instruction is that it must not display refund policy,
 * links, information or terms.
 *
 * WHAT THAT LEAVES OPEN, recorded here because it is the kind of thing that is
 * discovered at the worst moment: Razorpay's merchant terms require every
 * merchant to publish a visible refund and cancellation policy. "Donations are
 * final" is one, and it now lives nowhere on this site. If Razorpay asks for
 * it during onboarding or a review, it needs hosting somewhere — and this note
 * exists so that whoever is asked knows why it is absent rather than assuming
 * it was forgotten.
 *
 * `/donation-policy` remains, and answers the other question a donor has: what
 * happens to the money.
 * ══════════════════════════════════════════════════════════════════════════
 */
export const legalNav: NavItem[] = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms of Use', href: '/terms' },
  { label: 'Donation Policy', href: '/donation-policy' },
];
