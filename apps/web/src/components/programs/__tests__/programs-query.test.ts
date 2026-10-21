import { describe, expect, it } from 'vitest';

import type { Program } from '@/lib/mock/types';

import {
  PROGRAMS_PAGE_SIZE,
  matchesSearch,
  parseProgramsQuery,
  programAreaOptions,
  programAreas,
  programsHref,
  programsView,
  searchRank,
  type ProgramsQuery,
} from '../programs-query';

/** A programme with only what the listing reads; the rest is irrelevant here. */
function program(
  slug: string,
  category: string | null = slug,
  extra: Partial<
    Pick<Program, 'name' | 'tagline' | 'shortDescription' | 'accentIcon' | 'activeCampaignCount'>
  > = {},
): Program {
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
    ...extra,
  };
}

function many(count: number): Program[] {
  return Array.from({ length: count }, (_, index) => program(`program-${index + 1}`, 'Health'));
}

/** Every programme, first page, no search — the plain listing. */
const ALL: ProgramsQuery = { category: null, q: null, page: 1 };

describe('parseProgramsQuery', () => {
  it('defaults to the first page of every programme, with no search', () => {
    expect(parseProgramsQuery({})).toEqual(ALL);
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

  it('trims the search, treats an empty one as none, and caps a very long one', () => {
    expect(parseProgramsQuery({ q: '  clinic ' }).q).toBe('clinic');
    expect(parseProgramsQuery({ q: '   ' }).q).toBeNull();
    expect(parseProgramsQuery({ q: 'x'.repeat(500) }).q).toHaveLength(200);
  });

  it('takes the first value when a parameter is repeated', () => {
    expect(parseProgramsQuery({ category: ['education', 'healthcare'] }).category).toBe(
      'education',
    );
  });
});

describe('programsHref', () => {
  it('leaves every default out, so the plain listing is a plain URL', () => {
    expect(programsHref(ALL)).toBe('/programs');
  });

  it('slugs an area display name, and round-trips through parseProgramsQuery', () => {
    const href = programsHref({ category: 'Women Empowerment', page: 2 });
    expect(href).toBe('/programs?category=women-empowerment&page=2');

    const params = Object.fromEntries(new URL(href, 'https://example.org').searchParams);
    expect(parseProgramsQuery(params)).toEqual({
      category: 'women-empowerment',
      q: null,
      page: 2,
    });
  });

  it('carries the search, encoded, and round-trips it', () => {
    const href = programsHref({ category: 'Healthcare', q: 'mobile clinics' });
    expect(href).toBe('/programs?category=healthcare&q=mobile+clinics');

    const params = Object.fromEntries(new URL(href, 'https://example.org').searchParams);
    expect(parseProgramsQuery(params).q).toBe('mobile clinics');
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

  it("gives each area the icon of its first programme, for the toolbar's chips", () => {
    const programs = [
      program('a', 'Education', { accentIcon: 'book' }),
      program('b', 'education', { accentIcon: 'paw' }),
      program('c', 'Healthcare', { accentIcon: 'heart' }),
    ];
    expect(programAreaOptions(programs)).toEqual([
      { name: 'Education', accent: 'book' },
      { name: 'Healthcare', accent: 'heart' },
    ]);
  });
});

describe('matchesSearch', () => {
  const healthcare = program('healthcare', 'Healthcare', {
    name: 'Healthcare',
    tagline: 'Basic care, close to home',
    shortDescription: 'Mobile clinics, medicines and maternal health support.',
  });

  it('matches a word anywhere in the name, area, tagline or description, in any case', () => {
    expect(matchesSearch(healthcare, 'CLINIC')).toBe(true);
    expect(matchesSearch(healthcare, 'close to home')).toBe(true);
    expect(matchesSearch(healthcare, 'health')).toBe(true);
  });

  it('needs every word, in any order', () => {
    expect(matchesSearch(healthcare, 'maternal mobile')).toBe(true);
    expect(matchesSearch(healthcare, 'mobile schools')).toBe(false);
  });

  it('does not match a word the programme never uses', () => {
    expect(matchesSearch(healthcare, 'veterinary')).toBe(false);
  });

  it('ranks a word in the name above one in the description, and a miss at 0', () => {
    expect(searchRank(healthcare, 'healthcare')).toBeGreaterThan(searchRank(healthcare, 'clinic'));
    expect(searchRank(healthcare, 'care clinic')).toBe(
      searchRank(healthcare, 'care') + searchRank(healthcare, 'clinic'),
    );
    expect(searchRank(healthcare, 'veterinary')).toBe(0);
    expect(searchRank(healthcare, 'clinic veterinary')).toBe(0);
  });
});

describe('programsView', () => {
  it('shows an empty listing, with nothing more to load, when there are no programmes', () => {
    const view = programsView([], ALL);
    expect(view.visible).toEqual([]);
    expect(view.hasMore).toBe(false);
  });

  it.each([1, 3, PROGRAMS_PAGE_SIZE])('shows all %i programmes with no "View More"', (count) => {
    const view = programsView(many(count), ALL);
    expect(view.visible).toHaveLength(count);
    expect(view.hasMore).toBe(false);
  });

  it('offers "View More" once there are more than one page of programmes', () => {
    const programs = many(PROGRAMS_PAGE_SIZE + 1);

    const first = programsView(programs, ALL);
    expect(first.visible).toHaveLength(PROGRAMS_PAGE_SIZE);
    expect(first.hasMore).toBe(true);

    const second = programsView(programs, { ...ALL, page: 2 });
    expect(second.visible).toHaveLength(PROGRAMS_PAGE_SIZE + 1);
    expect(second.hasMore).toBe(false);
  });

  it('pages through twenty-odd programmes and clamps a page past the end', () => {
    const programs = many(23);
    expect(programsView(programs, { ...ALL, page: 3 }).visible).toHaveLength(18);
    expect(programsView(programs, { ...ALL, page: 3 }).hasMore).toBe(true);

    const past = programsView(programs, { ...ALL, page: 40 });
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
    const view = programsView(programs, { ...ALL, category: 'healthcare' });
    expect(view.activeArea).toBe('Healthcare');
    expect(view.visible.map((item) => item.slug)).toEqual(['clinics', 'camps']);

    expect(programsView(programs, { ...ALL, category: 'women-empowerment' }).activeArea).toBe(
      'Women Empowerment',
    );
  });

  it('shows every programme for an area that does not exist, rather than an empty page', () => {
    const programs = [program('education', 'Education'), program('clinics', 'Healthcare')];
    const view = programsView(programs, { ...ALL, category: 'no-such-area' });
    expect(view.activeArea).toBeNull();
    expect(view.visible).toHaveLength(2);
  });

  it('narrows to the programmes that answer a search, inside the area in force', () => {
    const programs = [
      program('education', 'Education', { shortDescription: 'Learning support in schools.' }),
      program('clinics', 'Healthcare', { shortDescription: 'Mobile clinics for villages.' }),
      program('camps', 'Healthcare', { shortDescription: 'Health camps for villages.' }),
    ];

    const searched = programsView(programs, { ...ALL, q: 'villages' });
    expect(searched.matching.map((item) => item.slug)).toEqual(['clinics', 'camps']);

    const both = programsView(programs, { ...ALL, category: 'healthcare', q: 'mobile' });
    expect(both.activeArea).toBe('Healthcare');
    expect(both.visible.map((item) => item.slug)).toEqual(['clinics']);
  });

  it('is honestly empty when a search matches nothing', () => {
    const view = programsView(many(3), { ...ALL, q: 'veterinary' });
    expect(view.matching).toEqual([]);
    expect(view.visible).toEqual([]);
    expect(view.hasMore).toBe(false);
  });

  describe('order', () => {
    it("keeps the CMS's order when there is no search", () => {
      const programs = [
        program('education', 'Education', { name: 'Education', activeCampaignCount: 1 }),
        program('women', 'Women Empowerment', {
          name: 'Women Empowerment',
          activeCampaignCount: 2,
        }),
        program('animals', 'Animal Welfare', { name: 'Animal Welfare', activeCampaignCount: 1 }),
      ];
      expect(programsView(programs, ALL).matching.map((item) => item.slug)).toEqual([
        'education',
        'women',
        'animals',
      ]);
    });

    it('ranks the closest answers to a search first', () => {
      const searched = [
        program('clinics', 'Healthcare', {
          name: 'Clinics',
          shortDescription: 'Care in villages.',
        }),
        program('care', 'Healthcare', {
          name: 'Village Care',
          shortDescription: 'Mobile clinics.',
        }),
      ];
      // "clinics" is Clinics' NAME and only Village Care's description.
      expect(
        programsView(searched, { ...ALL, q: 'clinics' }).matching.map((item) => item.slug),
      ).toEqual(['clinics', 'care']);
      // And the other way round for "village".
      expect(
        programsView(searched, { ...ALL, q: 'village' }).matching.map((item) => item.slug),
      ).toEqual(['care', 'clinics']);
    });
  });
});
