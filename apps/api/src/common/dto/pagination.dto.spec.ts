import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  buildPagination,
  offsetFor,
  paginate,
  paginationQuerySchema,
  resolveSort,
} from './pagination.dto.js';

describe('paginationQuerySchema', () => {
  it('applies defaults when nothing is supplied', () => {
    expect(paginationQuerySchema.parse({})).toMatchObject({ page: 1, limit: DEFAULT_LIMIT });
  });

  it('coerces the numeric strings a query string actually delivers', () => {
    // Express gives every query parameter as a string. A schema that only
    // accepts numbers passes its unit tests and rejects every real request.
    expect(paginationQuerySchema.parse({ page: '3', limit: '50' })).toMatchObject({
      page: 3,
      limit: 50,
    });
  });

  it('refuses a limit above the ceiling rather than silently clamping it', () => {
    // Clamping would let a caller believe they had asked for 5000 and received
    // it. Rejecting says what happened.
    expect(() => paginationQuerySchema.parse({ limit: MAX_LIMIT + 1 })).toThrow();
    expect(() => paginationQuerySchema.parse({ limit: 100000 })).toThrow();
  });

  it('refuses a page below 1 and non-integers', () => {
    expect(() => paginationQuerySchema.parse({ page: 0 })).toThrow();
    expect(() => paginationQuerySchema.parse({ page: -4 })).toThrow();
    expect(() => paginationQuerySchema.parse({ limit: 2.5 })).toThrow();
  });

  it('refuses a sort field carrying anything but an identifier', () => {
    // The regex is a defence in depth behind `resolveSort`'s allow-list: an
    // injected fragment should never reach the resolver in the first place.
    expect(() => paginationQuerySchema.parse({ sort: '-email; DROP TABLE users' })).toThrow();
    expect(() => paginationQuerySchema.parse({ sort: 'email)' })).toThrow();
    expect(() => paginationQuerySchema.parse({ sort: '1email' })).toThrow();
    expect(paginationQuerySchema.parse({ sort: '-createdAt' }).sort).toBe('-createdAt');
  });
});

describe('resolveSort', () => {
  const columns = { createdAt: 'COL_CREATED', email: 'COL_EMAIL' } as const;

  it('resolves an allowed field and direction', () => {
    expect(resolveSort('email', columns, 'createdAt')).toEqual({
      column: 'COL_EMAIL',
      direction: 'asc',
    });
    expect(resolveSort('-email', columns, 'createdAt')).toEqual({
      column: 'COL_EMAIL',
      direction: 'desc',
    });
  });

  it('falls back to the default for a field that is not on the allow-list', () => {
    // The important property: an unknown field NEVER reaches SQL. It cannot be
    // used to probe the schema by guessing column names either, because the
    // response for `passwordHash` is identical to the response for `nonsense`.
    expect(resolveSort('passwordHash', columns, 'createdAt').column).toBe('COL_CREATED');
    expect(resolveSort('totp_secret', columns, 'createdAt').column).toBe('COL_CREATED');
    expect(resolveSort(undefined, columns, 'createdAt').column).toBe('COL_CREATED');
  });

  it('keeps the requested direction even when the field falls back', () => {
    expect(resolveSort('-nonsense', columns, 'createdAt')).toEqual({
      column: 'COL_CREATED',
      direction: 'desc',
    });
  });
});

describe('buildPagination', () => {
  it('computes page counts and neighbours', () => {
    expect(buildPagination(2, 20, 45)).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasNext: true,
      hasPrevious: true,
    });
  });

  it('reports no pages and no neighbours for an empty result', () => {
    // `Math.ceil(0 / 20)` is 0, but an off-by-one here renders "Page 1 of 0"
    // in the UI, which looks like a bug to the person reading it.
    expect(buildPagination(1, 20, 0)).toMatchObject({
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    });
  });

  it('marks the last page as having no next', () => {
    expect(buildPagination(3, 20, 45)).toMatchObject({ hasNext: false, hasPrevious: true });
  });

  it('handles a total that divides exactly', () => {
    expect(buildPagination(2, 20, 40)).toMatchObject({ totalPages: 2, hasNext: false });
  });
});

describe('offsetFor', () => {
  it('is zero-based from a one-based page', () => {
    expect(offsetFor(1, 20)).toBe(0);
    expect(offsetFor(2, 20)).toBe(20);
    expect(offsetFor(5, 15)).toBe(60);
  });
});

describe('paginate', () => {
  it('wraps items in the documented envelope', () => {
    const result = paginate([{ id: 'a' }], 1, 20, 1);
    expect(result.items).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });
});
