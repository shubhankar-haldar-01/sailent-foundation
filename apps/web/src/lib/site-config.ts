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
 * Seven items, one of which (Get Involved) groups its children into a menu.
 * Phase 0 caps the nav at seven because beyond that it stops being navigation
 * and becomes a menu nobody reads. Blog is a plain link: the Resources menu
 * it sat in was taken off at the owner's request (2026-10-16), once FAQ had
 * left it and Blog was its only item.
 */
export interface NavEntry extends NavItem {
  children?: NavItem[];
  /**
   * The group's links in the phone menu, where they differ from the desktop
   * dropdown — the owner's mobile menu design (2026-10-07) lists its own.
   * Falls back to `children`.
   */
  mobileChildren?: NavItem[];
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
    ],
    mobileChildren: [
      { label: 'Donate', href: '/donate' },
      { label: 'Volunteer with Us', href: '/volunteer' },
      // The same destination the footer's "Partner With Us" uses.
      { label: 'Partner with Us', href: '/contact' },
    ],
  },
  /*
    BLOG, NOT A "RESOURCES" MENU (owner, 2026-10-16). No FAQ item either, on
    a desktop or in the phone menu: /faq still exists and the footer's
    Information column links to it.
  */
  { label: 'Blog', href: '/blog' },
];

/** The single primary call to action. Present at every breakpoint. */
export const primaryCta: NavItem = { label: 'Donate Now', href: '/donate' };

/**
 * Footer navigation — two short link columns, plus the contact block the
 * footer renders itself (owner decision, 2026-10-15: "like the reference").
 *
 * EVERY LINK IS A REAL, DISTINCT PAGE. The earlier sixteen links included
 * ones that were dead or misleading, and they were removed rather than kept
 * for their labels:
 *   • "Our Impact" — `AGENTS.md` §11 item 5 says no Impact link in the footer;
 *   • "Transparency" — `/about#transparency`, an anchor that does not exist;
 *   • "Careers" and "Partner With Us" — no such pages, both opened Contact;
 *   • the seven area links — campaign filters, two of them ("Food Security",
 *     "Livelihood") for areas no programme has; Programs is one link now;
 *   • "Donate" — the footer's Donate Now button stood beside it; that button
 *     was itself taken out on 2026-10-16 (owner), so the footer has no donate
 *     action — the pages' own buttons and the phone menu's carry it;
 *   • "Your Account" — the header carries Login / Sign Up on every page.
 */
export const footerNav: NavGroup[] = [
  {
    label: 'Explore',
    items: [
      { label: 'Programs', href: '/programs' },
      { label: 'Campaigns', href: '/campaigns' },
      { label: 'Stories', href: '/stories' },
      { label: 'Events', href: '/events' },
    ],
  },
  {
    label: 'Information',
    items: [
      { label: 'About Us', href: '/about' },
      { label: 'Volunteer', href: '/volunteer' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Contact Us', href: '/contact' },
    ],
  },
];

/**
 * The mobile footer's "Campaigns" group.
 *
 * The phone design adds this fifth group; the desktop footer's column grid has
 * no slot for it, so it is kept apart from `footerNav`. Each link is a real
 * view of the campaign listing — its status filter — not a page of its own.
 */
export const footerCampaignsGroup: NavGroup = {
  label: 'Campaigns',
  items: [
    { label: 'All Campaigns', href: '/campaigns' },
    { label: 'Closed Campaigns', href: '/campaigns?status=closed' },
    { label: 'Completed Campaigns', href: '/campaigns?status=completed' },
  ],
};

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
