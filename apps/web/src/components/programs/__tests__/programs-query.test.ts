import { describe, expect, it } from 'vitest';

import type { Program } from '@/lib/mock/types';

import {
  PROGRAMS_PAGE_SIZE,
  parseProgramsQuery,
  programAreas,
  programsHref,
  programsView,
} from '../programs-query';

/** A programme with only what the listing reads; the rest is irrelevant here. */
function program(slug: string, category: string | null = slug): Program {
  return {
    slug,
    name: slug,
    category,
    shortDescription: '',
    tagline: '',
    activeCampaignCount: 0,
    cover: { seed: `program-${slug}`, alt: slug },
    accentIcon: 'sprout',
    problem: '',
    approach: '',
    beneficiaries: '',
    goals: [],
    activities: [],
    metrics: [],
    locations: [],
  };
}

function many(count: number): Program[] {
  return Array.from({ length: count }, (_, index) => program(`program-${index + 1}`, 'Health'));
}

describe('parseProgramsQuery', () => {
  it('defaults to the first page of every programme', () => {
    expect(parseProgramsQuery({})).toEqual({ category: null, page: 1 });
  });

  it('falls back to the first page for anything that is not a page number', () => {
    expect(parseProgramsQuery({ page: 'lots' }).page).toBe(1);
    expect(parseProgramsQuery({ page: '-2' }).page).toBe(1);
    expect(parseProgramsQuery({ page: '3' }).page).toBe(3);
  });

  it('trims the area and treats an empty one as none', () => {
    expect(parseProgramsQuery({ category: '  education ' }).category).toBe('education');
    expect(parseProgramsQuery({ category: '   ' }).category).toBeNull();
  });

  it('takes the first value when a parameter is repeated', () => {
    expect(parseProgramsQuery({ category: ['education', 'healthcare'] }).category).toBe(
      'education',
    );
  });
});

describe('programsHref', () => {
  it('leaves every default out, so the plain listing is a plain URL', () => {
    expect(programsHref({ category: null, page: 1 })).toBe('/programs');
  });

  it('slugs an area display name, and round-trips through parseProgramsQuery', () => {
    const href = programsHref({ category: 'Women Empowerment', page: 2 });
    expect(href).toBe('/programs?category=women-empowerment&page=2');

    const params = Object.fromEntries(new URL(href, 'https://example.org').searchParams);
    expect(parseProgramsQuery(params)).toEqual({ category: 'women-empowerment', page: 2 });
  });
});

describe('programAreas', () => {
  it('lists each area once, in the order the programmes come', () => {
    const programs = [
      program('a', 'Education'),
      program('b', 'Healthcare'),
      program('c', 'education'),
      program('d', null),
      program('e', '  '),
      program('f', 'Child Welfare'),
    ];
    expect(programAreas(programs)).toEqual(['Education', 'Healthcare', 'Child Welfare']);
  });

  it('is empty when there are no programmes', () => {
    expect(programAreas([])).toEqual([]);
  });
});

describe('programsView', () => {
  it('shows an empty listing, with nothing more to load, when there are no programmes', () => {
    const view = programsView([], { category: null, page: 1 });
    expect(view.visible).toEqual([]);
    expect(view.hasMore).toBe(false);
  });

  it.each([1, 3, PROGRAMS_PAGE_SIZE])('shows all %i programmes with no "View More"', (count) => {
    const view = programsView(many(count), { category: null, page: 1 });
    expect(view.visible).toHaveLength(count);
    expect(view.hasMore).toBe(false);
  });

  it('offers "View More" once there are more than one page of programmes', () => {
    const programs = many(PROGRAMS_PAGE_SIZE + 1);

    const first = programsView(programs, { category: null, page: 1 });
    expect(first.visible).toHaveLength(PROGRAMS_PAGE_SIZE);
    expect(first.hasMore).toBe(true);

    const second = programsView(programs, { category: null, page: 2 });
    expect(second.visible).toHaveLength(PROGRAMS_PAGE_SIZE + 1);
    expect(second.hasMore).toBe(false);
  });

  it('pages through twenty-odd programmes and clamps a page past the end', () => {
    const programs = many(23);
    expect(programsView(programs, { category: null, page: 3 }).visible).toHaveLength(18);
    expect(programsView(programs, { category: null, page: 3 }).hasMore).toBe(true);

    const past = programsView(programs, { category: null, page: 40 });
    expect(past.page).toBe(4);
    expect(past.visible).toHaveLength(23);
    expect(past.hasMore).toBe(false);
  });

  it('narrows to one area, matched by its slug', () => {
    const programs = [
      program('education', 'Education'),
      program('clinics', 'Healthcare'),
      program('women', 'Women Empowerment'),
      program('camps', 'Healthcare'),
    ];
    const view = programsView(programs, { category: 'healthcare', page: 1 });
    expect(view.activeArea).toBe('Healthcare');
    expect(view.visible.map((item) => item.slug)).toEqual(['clinics', 'camps']);

    expect(programsView(programs, { category: 'women-empowerment', page: 1 }).activeArea).toBe(
      'Women Empowerment',
    );
  });

  it('shows every programme for an area that does not exist, rather than an empty page', () => {
    const programs = [program('education', 'Education'), program('clinics', 'Healthcare')];
    const view = programsView(programs, { category: 'no-such-area', page: 1 });
    expect(view.activeArea).toBeNull();
    expect(view.visible).toHaveLength(2);
  });
});
