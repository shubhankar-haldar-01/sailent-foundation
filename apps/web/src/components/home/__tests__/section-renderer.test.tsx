import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PageSection } from '@sailent/validation';

/**
 * The composed homepage.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO PROPERTIES, AND BOTH ARE ABOUT NOT TRUSTING THE DATABASE.
 *
 * 1. ORDER IS THE CONTENT. A composer whose output does not follow the stored
 *    order is not a composer. Asserted by rendering the same set twice, in two
 *    orders, and reading the DOM back.
 *
 * 2. NOTHING STORED BECOMES MARKUP. `sections` is jsonb, so a row could in
 *    principle hold anything — the API refuses unapproved types on write, and
 *    the renderer looks a type up in a switch or ignores it. There is no path
 *    by which a stored string is interpreted as HTML, and this proves the
 *    unknown-type branch is a quiet no-op rather than a crash.
 * ══════════════════════════════════════════════════════════════════════════
 */

// The real sections fetch and render a great deal; the subject here is the
// renderer's dispatch and ordering, so each is replaced by a marker.
vi.mock('@/components/home/hero-section', () => ({
  HeroSection: () => <div data-section="hero" />,
}));
vi.mock('@/components/home/campaign-browser', () => ({
  CampaignBrowser: ({ campaigns }: { campaigns: unknown[] }) => (
    <div data-section="campaigns" data-count={campaigns.length} />
  ),
}));
vi.mock('@/components/home/impact-stats', () => ({
  ImpactStats: () => <div data-section="impact" />,
}));
vi.mock('@/components/home/who-we-are', () => ({ WhoWeAre: () => <div data-section="about" /> }));
vi.mock('@/components/home/stories-and-events', () => ({
  StoriesAndEvents: ({ stories }: { stories: unknown[] }) => (
    <div data-section="storiesAndEvents" data-count={stories.length} />
  ),
}));
vi.mock('@/components/home/testimonials', () => ({
  Testimonials: () => <div data-section="testimonials" />,
}));
vi.mock('@/components/home/community-cta', () => ({
  CommunityCta: () => <div data-section="community" />,
}));
vi.mock('@/components/home/partners-section', () => ({
  PartnersSection: () => <div data-section="partners" />,
}));
vi.mock('@/components/home/newsletter-section', () => ({
  NewsletterSection: () => <div data-section="newsletter" />,
}));

const { ComposedSections } = await import('../section-renderer');

const data = {
  metrics: [],
  campaigns: Array.from({ length: 10 }, (_, i) => ({ slug: `c${i}` })),
  stories: Array.from({ length: 8 }, (_, i) => ({ slug: `s${i}` })),
  events: Array.from({ length: 8 }, (_, i) => ({ slug: `e${i}` })),
} as never;

const renderOrder = (sections: unknown[]) => {
  const { container } = render(
    <ComposedSections sections={sections as PageSection[]} data={data} />,
  );
  return [...container.querySelectorAll('[data-section]')].map((node) =>
    node.getAttribute('data-section'),
  );
};

describe('the composed homepage', () => {
  it('renders sections in the order they are stored', () => {
    expect(renderOrder([{ type: 'hero' }, { type: 'impact' }, { type: 'campaigns' }])).toEqual([
      'hero',
      'impact',
      'campaigns',
    ]);
  });

  it('follows a DIFFERENT stored order — the order is not hard-coded', () => {
    // The same three sections, reversed. If the renderer ignored the stored
    // order this would be indistinguishable from the test above.
    expect(renderOrder([{ type: 'campaigns' }, { type: 'impact' }, { type: 'hero' }])).toEqual([
      'campaigns',
      'impact',
      'hero',
    ]);
  });

  it('renders the same section twice when it is listed twice', () => {
    expect(renderOrder([{ type: 'campaigns' }, { type: 'about' }, { type: 'campaigns' }])).toEqual([
      'campaigns',
      'about',
      'campaigns',
    ]);
  });

  it('renders every approved section type', () => {
    const all = [
      'hero',
      'campaigns',
      'impact',
      'about',
      'storiesAndEvents',
      'testimonials',
      'community',
      'partners',
      'newsletter',
    ];
    expect(renderOrder(all.map((type) => ({ type })))).toEqual(all);
  });

  it('IGNORES an unknown type instead of crashing the page', () => {
    /*
      Unreachable while the registry and the renderer agree — but if a section
      type is ever retired while a published page still names it, a homepage
      missing one band is the right outcome. A stack trace is not.
    */
    expect(renderOrder([{ type: 'hero' }, { type: 'retiredBlock' }, { type: 'about' }])).toEqual([
      'hero',
      'about',
    ]);
  });

  it('never turns stored data into markup', () => {
    const { container } = render(
      <ComposedSections
        sections={
          /*
            Cast through `unknown` deliberately: this is exactly the shape the
            TYPE forbids, which is the point — the test is about what the
            renderer does with data that got past the type system, as anything
            read from jsonb could.
          */
          [
            { type: 'hero' },
            { type: '<img src=x onerror=alert(1)>', props: { html: '<script>alert(1)</script>' } },
          ] as unknown as PageSection[]
        }
        data={data}
      />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
    // And the approved section beside it still rendered.
    expect(container.querySelector('[data-section="hero"]')).not.toBeNull();
  });

  it('honours a limit prop, and defaults sensibly without one', () => {
    const { container } = render(
      <ComposedSections
        sections={
          [
            { type: 'campaigns', props: { limit: 3 } },
            { type: 'storiesAndEvents', props: {} },
          ] as unknown as PageSection[]
        }
        data={data}
      />,
    );

    expect(container.querySelector('[data-section="campaigns"]')?.getAttribute('data-count')).toBe(
      '3',
    );
    // Stories default to three, as the hand-written homepage always did.
    expect(
      container.querySelector('[data-section="storiesAndEvents"]')?.getAttribute('data-count'),
    ).toBe('3');
  });

  it('renders nothing at all for an empty composition', () => {
    const { container } = render(<ComposedSections sections={[]} data={data} />);
    expect(container.querySelectorAll('[data-section]')).toHaveLength(0);
  });
});
