import { describe, expect, it } from 'vitest';

import {
  SECTION_TYPES,
  isApprovedSectionType,
  pageSectionSchema,
  pageSectionsSchema,
} from '../domain/page-sections.js';

/**
 * The allowlist that keeps a composer from becoming a page builder.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * docs/database-architecture.md, on `pages.sections`: "an ordered array of
 * `{ type, props }` where `type` must be one of the APPROVED section
 * components … An unknown section type is rejected. This is what keeps a
 * composer from becoming an unconstrained page builder."
 *
 * These are the tests for that sentence. They matter more than they look: the
 * admin UI offers a fixed list of sections, so in normal use nothing invalid
 * is ever sent — which means the UI proves nothing. The control is the schema,
 * and the only way to show it works is to send it what the UI never would.
 * ══════════════════════════════════════════════════════════════════════════
 */

describe('approved section types', () => {
  it('accepts every registered type with default props', () => {
    for (const type of SECTION_TYPES) {
      const result = pageSectionSchema.safeParse({ type });
      expect(result.success, type).toBe(true);
    }
  });

  it('REJECTS a type that is not in the registry', () => {
    // The whole point. A section the site cannot render must not be storable.
    for (const type of ['iframe', 'html', 'script', 'customBlock', 'Hero', '']) {
      expect(pageSectionSchema.safeParse({ type, props: {} }).success, type).toBe(false);
    }
  });

  it('REJECTS raw markup dressed as a section', () => {
    // There is no section type that takes HTML, so this cannot even be
    // expressed — which is the design, not a filter that has to be maintained.
    expect(
      pageSectionSchema.safeParse({ type: 'html', props: { value: '<script>alert(1)</script>' } })
        .success,
    ).toBe(false);
  });

  it('REJECTS props that belong to a different section', () => {
    // `strict()` on each props schema: a prop the section does not understand
    // is an error, not something quietly dropped and forgotten about.
    expect(pageSectionSchema.safeParse({ type: 'hero', props: { limit: 6 } }).success).toBe(false);
    expect(
      pageSectionSchema.safeParse({ type: 'impact', props: { unknownThing: true } }).success,
    ).toBe(false);
  });

  it('REJECTS an unknown prop on a section that does take props', () => {
    expect(
      pageSectionSchema.safeParse({ type: 'campaigns', props: { heading: 'Ours', rogue: 1 } })
        .success,
    ).toBe(false);
  });

  it('accepts the props a section does declare', () => {
    const parsed = pageSectionSchema.parse({
      type: 'campaigns',
      props: { heading: 'Where your money goes', limit: 6 },
    });
    expect(parsed).toEqual({
      type: 'campaigns',
      props: { heading: 'Where your money goes', limit: 6 },
    });
  });

  it('bounds a limit on both sides, so a section cannot ask for everything', () => {
    expect(pageSectionSchema.safeParse({ type: 'campaigns', props: { limit: 0 } }).success).toBe(
      false,
    );
    expect(pageSectionSchema.safeParse({ type: 'campaigns', props: { limit: 999 } }).success).toBe(
      false,
    );
  });

  it('bounds a heading, so a heading cannot become an article', () => {
    expect(
      pageSectionSchema.safeParse({ type: 'impact', props: { heading: 'x'.repeat(200) } }).success,
    ).toBe(false);
  });
});

describe('a page’s section list', () => {
  it('keeps the order it was given — order IS the content here', () => {
    const sections = pageSectionsSchema.parse([
      { type: 'hero' },
      { type: 'impact' },
      { type: 'campaigns' },
    ]);
    expect(sections.map((section) => section.type)).toEqual(['hero', 'impact', 'campaigns']);
  });

  it('allows the same section twice, which is a real layout', () => {
    // Two campaign bands at different points down a long page is reasonable.
    expect(
      pageSectionsSchema.safeParse([
        { type: 'campaigns' },
        { type: 'about' },
        { type: 'campaigns' },
      ]).success,
    ).toBe(true);
  });

  it('accepts an empty page', () => {
    // A draft with nothing on it yet is a normal state, not an error.
    expect(pageSectionsSchema.parse([])).toEqual([]);
  });

  it('REFUSES an unreasonable number of sections', () => {
    const many = Array.from({ length: 31 }, () => ({ type: 'about' as const }));
    expect(pageSectionsSchema.safeParse(many).success).toBe(false);
  });

  it('REFUSES the whole list when one section is invalid', () => {
    // Partial acceptance would leave a page half-composed and the editor
    // unaware which half.
    expect(
      pageSectionsSchema.safeParse([{ type: 'hero' }, { type: 'nope' }, { type: 'about' }]).success,
    ).toBe(false);
  });
});

describe('isApprovedSectionType', () => {
  it('agrees with the registry', () => {
    for (const type of SECTION_TYPES) expect(isApprovedSectionType(type)).toBe(true);
    for (const type of ['html', 'iframe', 42, null, undefined, {}]) {
      expect(isApprovedSectionType(type)).toBe(false);
    }
  });
});
