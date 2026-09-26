import { describe, expect, it } from 'vitest';

import {
  DOCUMENT_TYPES,
  DOCUMENT_VISIBILITIES,
  PRIVATE_DOCUMENT_VISIBILITIES,
  changeDocumentVisibilitySchema,
  createDocumentSchema,
  documentListQuerySchema,
  financialYearSchema,
  isPubliclyReadable,
  updateDocumentSchema,
} from '../index.js';

/**
 * Document rules.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE TEST THAT MATTERS IS THE ONE ABOUT THE DEFAULT.
 *
 * Everything else here is ordinary schema checking. But `visibility` decides
 * which bucket a file lands in, and a missing value has to resolve to the
 * CLOSED state — a renamed form input or a client that drops an empty field
 * must not be able to publish an audited financial statement.
 * ══════════════════════════════════════════════════════════════════════════
 */
describe('document visibility', () => {
  it('DEFAULTS TO PRIVATE when no visibility is supplied', () => {
    const parsed = createDocumentSchema.parse({ title: 'Annual report' });
    expect(parsed.visibility).toBe('private');
  });

  it('defaults the type to `other` rather than guessing', () => {
    expect(createDocumentSchema.parse({ title: 'Annual report' }).documentType).toBe('other');
  });

  it('accepts each visibility the database enum actually has', () => {
    for (const visibility of DOCUMENT_VISIBILITIES) {
      expect(createDocumentSchema.parse({ title: 'A title', visibility }).visibility).toBe(
        visibility,
      );
    }
  });

  it('REFUSES `restricted`, which the Phase 1 contract wrongly named', () => {
    /*
      `schemas/file.ts` said `restricted`; migration 0000 shipped `admin_only`.
      A value the database has no enum member for would fail at the very last
      moment, as a 500 from Postgres rather than a 422 naming the field.
    */
    expect(
      createDocumentSchema.safeParse({ title: 'A title', visibility: 'restricted' }).success,
    ).toBe(false);
  });

  it('knows which visibilities mean the private bucket', () => {
    expect(PRIVATE_DOCUMENT_VISIBILITIES).toContain('private');
    expect(PRIVATE_DOCUMENT_VISIBILITIES).toContain('admin_only');
    expect(PRIVATE_DOCUMENT_VISIBILITIES).not.toContain('public');
  });

  it('treats only `public` as publicly readable', () => {
    expect(isPubliclyReadable('public')).toBe(true);
    expect(isPubliclyReadable('private')).toBe(false);
    expect(isPubliclyReadable('admin_only')).toBe(false);
  });

  it('covers every type the database enum has, and no more', () => {
    expect([...DOCUMENT_TYPES].sort()).toEqual(
      [
        'annual_report',
        'financial',
        'impact_report',
        'internal',
        'other',
        'policy',
        'registration',
        'utilisation',
      ].sort(),
    );
  });
});

describe('financial year', () => {
  it('accepts a real one', () => {
    expect(financialYearSchema.parse('2025-2026')).toBe('2025-2026');
  });

  it('REFUSES a range that is not consecutive', () => {
    // Matches every sensible regex, and is a typo that would file an audited
    // statement under a year nobody looks in.
    expect(financialYearSchema.safeParse('2025-2030').success).toBe(false);
  });

  it('refuses a backwards range', () => {
    expect(financialYearSchema.safeParse('2026-2025').success).toBe(false);
  });

  it('refuses a single year, and a free-text year', () => {
    expect(financialYearSchema.safeParse('2025').success).toBe(false);
    expect(financialYearSchema.safeParse('FY 2025-26').success).toBe(false);
  });
});

describe('the visibility change', () => {
  it('REQUIRES a reason', () => {
    expect(changeDocumentVisibilitySchema.safeParse({ visibility: 'public' }).success).toBe(false);
  });

  it('refuses a reason too short to mean anything', () => {
    const parsed = changeDocumentVisibilitySchema.safeParse({
      visibility: 'public',
      reason: 'because',
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts a real reason', () => {
    const parsed = changeDocumentVisibilitySchema.parse({
      visibility: 'public',
      reason: 'Approved by the board on 12 March.',
    });
    expect(parsed.visibility).toBe('public');
  });
});

describe('metadata updates', () => {
  it('will not accept an empty patch', () => {
    expect(updateDocumentSchema.safeParse({}).success).toBe(false);
  });

  it('CANNOT change visibility — that route is separate and sensitive', () => {
    const parsed = updateDocumentSchema.parse({ title: 'A new title', visibility: 'public' });
    // Stripped, not rejected: the field simply does not exist on this schema,
    // so a request carrying it changes nothing rather than failing loudly.
    expect('visibility' in parsed).toBe(false);
  });

  it('allows clearing the financial year with an empty string', () => {
    expect(updateDocumentSchema.safeParse({ financialYear: '' }).success).toBe(true);
  });
});

describe('the admin listing query', () => {
  it('defaults to the first page', () => {
    const parsed = documentListQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
  });

  it('caps the page size, so one request cannot pull the whole library', () => {
    expect(documentListQuerySchema.safeParse({ pageSize: 5000 }).success).toBe(false);
  });

  it('coerces the page from a query string', () => {
    expect(documentListQuerySchema.parse({ page: '3' }).page).toBe(3);
  });
});

describe('attachments', () => {
  it('accepts a campaign attachment', () => {
    const parsed = createDocumentSchema.parse({
      title: 'A title',
      relatedType: 'campaign',
      relatedId: '00000000-0000-4000-8000-000000000000',
    });
    expect(parsed.relatedType).toBe('campaign');
  });

  it('refuses an attachment to anything that is not a campaign', () => {
    // §4.20: a public document is reachable only where it is attached to a
    // campaign. Nothing else publishes documents, so nothing else may be named.
    expect(
      createDocumentSchema.safeParse({
        title: 'A title',
        relatedType: 'volunteer',
        relatedId: '00000000-0000-4000-8000-000000000000',
      }).success,
    ).toBe(false);
  });

  it('refuses an id that is not a uuid', () => {
    expect(
      createDocumentSchema.safeParse({
        title: 'A title',
        relatedType: 'campaign',
        relatedId: 'the-school-kits-one',
      }).success,
    ).toBe(false);
  });
});
