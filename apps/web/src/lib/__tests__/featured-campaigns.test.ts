import { describe, expect, it } from 'vitest';

import {
  FEATURED_BAND_SIZE,
  orderFeaturedFirst,
  type FeaturedCandidate,
} from '../featured-campaigns';

type Row = FeaturedCandidate & { slug: string };

const row = (slug: string, overrides: Partial<Row> = {}): Row => ({
  slug,
  status: 'active',
  isFeatured: false,
  featuredOrder: null,
  endsAt: null,
  ...overrides,
});

const slugs = (rows: Row[]) => rows.map((entry) => entry.slug);

describe('orderFeaturedFirst', () => {
  it('puts featured campaigns first, in their featured order', () => {
    const ordered = orderFeaturedFirst([
      row('ordinary', { endsAt: '2999-01-01' }),
      row('featured-second', { isFeatured: true, featuredOrder: 2 }),
      row('featured-first', { isFeatured: true, featuredOrder: 1 }),
    ]);

    expect(slugs(ordered)).toEqual(['featured-first', 'featured-second', 'ordinary']);
  });

  it('places a featured campaign with no order after the numbered ones', () => {
    const ordered = orderFeaturedFirst([
      row('featured-unnumbered', { isFeatured: true }),
      row('featured-numbered', { isFeatured: true, featuredOrder: 5 }),
    ]);

    expect(slugs(ordered)).toEqual(['featured-numbered', 'featured-unnumbered']);
  });

  it('orders the rest by deadline, soonest first, with no deadline last', () => {
    const ordered = orderFeaturedFirst([
      row('no-deadline'),
      row('later', { endsAt: '2999-03-31' }),
      row('sooner', { endsAt: '2998-11-30' }),
    ]);

    expect(slugs(ordered)).toEqual(['sooner', 'later', 'no-deadline']);
  });

  it('shows only active campaigns — a paused one cannot take a donation', () => {
    const ordered = orderFeaturedFirst([
      row('paused-but-featured', { status: 'paused', isFeatured: true, featuredOrder: 0 }),
      row('completed', { status: 'completed' }),
      row('active'),
    ]);

    expect(slugs(ordered)).toEqual(['active']);
  });

  it('drops an active campaign whose end date has passed — it cannot take a donation', () => {
    const ordered = orderFeaturedFirst([
      row('ended-but-featured', { isFeatured: true, featuredOrder: 0, endsAt: '2020-01-01' }),
      row('still-open', { endsAt: '2999-01-01' }),
    ]);

    expect(slugs(ordered)).toEqual(['still-open']);
  });

  it('caps the band, and leaves its input untouched', () => {
    const input = Array.from({ length: FEATURED_BAND_SIZE + 3 }, (_, index) => row(`c${index}`));
    const before = slugs(input);

    expect(orderFeaturedFirst(input)).toHaveLength(FEATURED_BAND_SIZE);
    expect(slugs(input)).toEqual(before);
  });

  it('keeps the incoming order where the rule cannot tell campaigns apart', () => {
    const ordered = orderFeaturedFirst([row('a'), row('b'), row('c')]);
    expect(slugs(ordered)).toEqual(['a', 'b', 'c']);
  });
});
