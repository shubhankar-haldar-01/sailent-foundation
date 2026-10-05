import { describe, expect, it } from 'vitest';

import { categoryKey, categorySlug } from '@/lib/categories';

import { API_STATUS, MAX_PAGES, listingHref, parseListingQuery } from '../listing-query';

describe('parseListingQuery', () => {
  it('defaults to the first page of active campaigns with no search', () => {
    expect(parseListingQuery({})).toEqual({ q: '', category: null, status: 'active', page: 1 });
  });

  it('honours the footer’s `categorySlug` as well as the homepage’s `category`', () => {
    expect(parseListingQuery({ category: 'education' }).category).toBe('education');
    expect(parseListingQuery({ categorySlug: 'education' }).category).toBe('education');
  });

  it('falls back to safe values for anything it does not recognise', () => {
    const query = parseListingQuery({ status: 'draft', page: 'lots' });
    // `draft` is never reachable from the public listing.
    expect(query.status).toBe('active');
    expect(query.page).toBe(1);
  });

  it('keeps the page count inside what one API request can serve', () => {
    expect(parseListingQuery({ page: '999' }).page).toBe(MAX_PAGES);
    expect(parseListingQuery({ page: '-3' }).page).toBe(1);
  });

  it('trims the search and caps it at the API’s 200-character limit', () => {
    expect(parseListingQuery({ q: '  school kits  ' }).q).toBe('school kits');
    expect(parseListingQuery({ q: 'x'.repeat(500) }).q).toHaveLength(200);
  });

  it('accepts "closed", and asks the API for the paused campaigns it means', () => {
    expect(parseListingQuery({ status: 'closed' }).status).toBe('closed');
    expect(API_STATUS.closed).toBe('paused');
    expect(listingHref({ status: 'closed' })).toBe('/campaigns?status=closed');
  });

  it('takes the first value when a parameter is repeated', () => {
    expect(parseListingQuery({ q: ['first', 'second'] }).q).toBe('first');
  });
});

describe('listingHref', () => {
  it('leaves every default out, so the plain listing is a plain URL', () => {
    expect(listingHref({ q: '', category: null, status: 'active', page: 1 })).toBe('/campaigns');
  });

  it('round-trips through parseListingQuery', () => {
    const query = { q: 'clinic', category: 'healthcare', status: 'all' as const, page: 3 };
    const href = listingHref(query);
    const params = Object.fromEntries(new URL(href, 'https://example.org').searchParams);
    expect(parseListingQuery(params)).toEqual(query);
  });
});

describe('categorySlug', () => {
  it('produces a slug the category matcher maps back to the same name', () => {
    for (const name of [
      'Women Empowerment',
      'Disaster Relief',
      'Health & Nutrition',
      'Education',
    ]) {
      expect(categoryKey(categorySlug(name))).toBe(categoryKey(name));
    }
    expect(categorySlug('Women Empowerment')).toBe('women-empowerment');
  });
});
