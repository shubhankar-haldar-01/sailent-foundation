import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_TRANSITIONS,
  PROGRAM_TRANSITIONS,
  acceptsDonations,
  hasEnded,
  campaignProgress,
  canTransitionCampaign,
  canTransitionProgram,
  daysRemaining,
  donationAvailability,
  isPubliclyVisible,
  isValidSlug,
  quantityProgress,
  slugify,
  uniqueSlug,
  type CampaignStatus,
} from '../index.js';

describe('slugify', () => {
  it.each([
    ['Help Children Return to School', 'help-children-return-to-school'],
    ['  Extra   spaces  ', 'extra-spaces'],
    ['Punctuation!? Removed.', 'punctuation-removed'],
    ['Flood Relief 2026', 'flood-relief-2026'],
    ['UPPER CASE', 'upper-case'],
  ])('turns %s into %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('decomposes diacritics rather than dropping the letter', () => {
    // "malnutricin" would be the result of stripping non-ASCII naively, and it
    // is not a word anybody would search for or recognise.
    expect(slugify('Malnutrición')).toBe('malnutricion');
    expect(slugify('Café Support')).toBe('cafe-support');
  });

  it('joins words across an apostrophe instead of splitting them', () => {
    expect(slugify("Children's Fund")).toBe('childrens-fund');
    expect(slugify('Children’s Fund')).toBe('childrens-fund');
  });

  it('spells out an ampersand', () => {
    expect(slugify('Food & Nutrition')).toBe('food-and-nutrition');
  });

  it('never leaves a leading or trailing hyphen', () => {
    for (const input of ['---hello---', '!!!hello!!!', '  -hello-  ']) {
      const slug = slugify(input);
      expect(slug.startsWith('-')).toBe(false);
      expect(slug.endsWith('-')).toBe(false);
    }
  });

  it('truncates long titles without leaving a trailing hyphen', () => {
    const slug = slugify(
      'Help us provide school kits to underprivileged children across rural Jharkhand in 2026',
    );
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
    expect(isValidSlug(slug)).toBe(true);
  });

  it('returns empty for input with no ASCII equivalent, rather than guessing', () => {
    // The caller's signal to ask for a slug explicitly. Inventing one here
    // would produce a URL nobody could have predicted.
    expect(slugify('शिक्षा')).toBe('');
  });
});

describe('isValidSlug', () => {
  it.each(['education', 'school-kits-2026', 'a1'])('accepts %s', (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each([
    'Education',
    'school kits',
    'school--kits',
    '-leading',
    'trailing-',
    '',
    'a'.repeat(81),
  ])('rejects %s', (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });
});

describe('uniqueSlug', () => {
  it('returns the base when it is free', async () => {
    expect(await uniqueSlug('Flood Relief', async () => false)).toBe('flood-relief');
  });

  it('appends a counter until it finds a free slug', async () => {
    const used = new Set(['flood-relief', 'flood-relief-2']);
    expect(await uniqueSlug('Flood Relief', async (c) => used.has(c))).toBe('flood-relief-3');
  });

  it('keeps the suffixed slug within the length limit', async () => {
    const long = 'a'.repeat(100);
    const slug = await uniqueSlug(long, async (c) => c === 'a'.repeat(80));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-2')).toBe(true);
  });

  it('throws rather than inventing a slug it cannot derive', async () => {
    await expect(uniqueSlug('शिक्षा', async () => false)).rejects.toThrow(/Supply one explicitly/);
  });

  it('gives up after a bounded number of attempts', async () => {
    await expect(uniqueSlug('taken', async () => true, { maxAttempts: 3 })).rejects.toThrow(
      /after 3 attempts/,
    );
  });
});

describe('programme lifecycle', () => {
  it.each([
    ['draft', 'published'],
    ['draft', 'archived'],
    ['published', 'draft'],
    ['published', 'archived'],
    ['archived', 'draft'],
  ] as const)('allows %s → %s', (from, to) => {
    expect(canTransitionProgram(from, to)).toBe(true);
  });

  it.each([
    ['archived', 'published'],
    ['draft', 'draft'],
    ['published', 'published'],
  ] as const)('refuses %s → %s', (from, to) => {
    expect(canTransitionProgram(from, to)).toBe(false);
  });

  it('never lets archived go straight back to published', () => {
    // Restoring is deliberate: bring it back as a draft, review it, republish.
    expect(PROGRAM_TRANSITIONS.archived).toEqual(['draft']);
  });
});

describe('campaign lifecycle', () => {
  it.each([
    ['draft', 'published'],
    ['published', 'active'],
    ['active', 'paused'],
    ['paused', 'active'],
    ['active', 'completed'],
    ['paused', 'completed'],
    ['completed', 'archived'],
    ['published', 'archived'],
    ['archived', 'draft'],
  ] as const)('allows %s → %s', (from, to) => {
    expect(canTransitionCampaign(from, to)).toBe(true);
  });

  it.each([
    ['draft', 'active'],
    ['draft', 'completed'],
    ['completed', 'active'],
    ['completed', 'paused'],
    ['archived', 'active'],
    ['archived', 'published'],
    ['active', 'published'],
    ['active', 'draft'],
  ] as const)('refuses %s → %s', (from, to) => {
    expect(canTransitionCampaign(from, to)).toBe(false);
  });

  it('refuses every self-transition', () => {
    for (const status of Object.keys(CAMPAIGN_TRANSITIONS) as CampaignStatus[]) {
      expect(canTransitionCampaign(status, status)).toBe(false);
    }
  });

  it('never routes a completed campaign back into a donatable state', () => {
    // Reopening a finished campaign means accepting money for work already
    // reported as done.
    expect(CAMPAIGN_TRANSITIONS.completed).toEqual(['archived']);
  });
});

describe('public visibility', () => {
  it.each(['published', 'active', 'paused', 'completed'] as const)('shows %s', (status) => {
    expect(isPubliclyVisible(status)).toBe(true);
  });

  it.each(['draft', 'archived'] as const)('hides %s', (status) => {
    expect(isPubliclyVisible(status)).toBe(false);
  });
});

describe('acceptsDonations', () => {
  it('is true for active only', () => {
    expect(acceptsDonations('active')).toBe(true);
    for (const status of ['draft', 'published', 'paused', 'completed', 'archived'] as const) {
      expect(acceptsDonations(status)).toBe(false);
    }
  });

  it('describes why, for every state that refuses', () => {
    expect(donationAvailability('active').state).toBe('open');
    expect(donationAvailability('paused')).toMatchObject({ state: 'paused' });
    expect(donationAvailability('completed')).toMatchObject({ state: 'completed' });
    expect(donationAvailability('published')).toMatchObject({ state: 'not-open' });
    // Narrowed rather than asserted on the union: `open` carries no reason,
    // which is the point of the discriminated union.
    const draft = donationAvailability('draft');
    expect(draft.state).not.toBe('open');
    if (draft.state !== 'open') expect(draft.reason).toBeTruthy();
  });
});

describe('hasEnded', () => {
  // 13 Oct 2026 as an administrator picks it in the form: midnight UTC.
  const END = new Date('2026-10-13T00:00:00Z');

  it('treats no end date as no deadline', () => {
    expect(hasEnded(null)).toBe(false);
    expect(hasEnded(undefined)).toBe(false);
    expect(hasEnded('not a date')).toBe(false);
  });

  it('keeps the whole last day open, in India time', () => {
    expect(hasEnded(END, new Date('2026-10-13T08:00:00+05:30'))).toBe(false);
    expect(hasEnded(END, new Date('2026-10-13T23:59:59+05:30'))).toBe(false);
    expect(hasEnded(END, new Date('2026-10-14T00:00:01+05:30'))).toBe(true);
  });

  it('reads a date written with an India offset as that same day', () => {
    const written = '2027-03-31T00:00:00+05:30';
    expect(hasEnded(written, new Date('2027-03-31T20:00:00+05:30'))).toBe(false);
    expect(hasEnded(written, new Date('2027-04-01T00:00:01+05:30'))).toBe(true);
  });
});

describe('donations and the end date', () => {
  const PAST = '2020-01-01T00:00:00Z';
  const FUTURE = '2999-01-01T00:00:00Z';

  it('closes an active campaign once its end date has passed', () => {
    expect(donationAvailability('active', PAST)).toMatchObject({ state: 'ended' });
    expect(acceptsDonations('active', PAST)).toBe(false);
  });

  it('keeps it open before the end date, and with none', () => {
    expect(donationAvailability('active', FUTURE).state).toBe('open');
    expect(donationAvailability('active', null).state).toBe('open');
    expect(acceptsDonations('active', FUTURE)).toBe(true);
    expect(acceptsDonations('active')).toBe(true);
  });

  it('leaves every other state as it was — the status speaks first', () => {
    expect(donationAvailability('paused', PAST)).toMatchObject({ state: 'paused' });
    expect(donationAvailability('completed', PAST)).toMatchObject({ state: 'completed' });
  });
});

describe('campaignProgress', () => {
  it('computes the ordinary case', () => {
    // ₹1,00,000 goal, ₹45,000 raised.
    expect(campaignProgress(10_000_000, 4_500_000)).toMatchObject({
      percent: 45,
      rawPercent: 45,
      remaining: 5_500_000,
      goalReached: false,
      surplus: 0,
    });
  });

  it('caps the BAR at 100 while reporting the true figure', () => {
    // The distinction that matters: the bar cannot render past its own end,
    // but the money raised is what it is.
    const progress = campaignProgress(10_000_000, 13_000_000);
    expect(progress.percent).toBe(100);
    expect(progress.rawPercent).toBe(130);
    expect(progress.raised).toBe(13_000_000);
    expect(progress.surplus).toBe(3_000_000);
    expect(progress.goalReached).toBe(true);
  });

  it('never reports a negative remaining amount', () => {
    expect(campaignProgress(10_000_000, 12_000_000).remaining).toBe(0);
  });

  it('handles an open-ended campaign without dividing by zero', () => {
    expect(campaignProgress(0, 500_000)).toMatchObject({
      percent: 0,
      rawPercent: 0,
      goal: 0,
      raised: 500_000,
    });
  });

  it('floors negative inputs rather than propagating them', () => {
    expect(campaignProgress(-1, -1)).toMatchObject({ goal: 0, raised: 0 });
  });

  it('reports 100 exactly at the goal', () => {
    expect(campaignProgress(10_000_000, 10_000_000)).toMatchObject({
      percent: 100,
      rawPercent: 100,
      goalReached: true,
      remaining: 0,
      surplus: 0,
    });
  });

  it('keeps every monetary value an integer', () => {
    const progress = campaignProgress(3_333_333, 1_111_111);
    for (const value of [progress.goal, progress.raised, progress.remaining, progress.surplus]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe('quantityProgress', () => {
  it('computes fulfilment against a target', () => {
    expect(quantityProgress(500, 320)).toMatchObject({
      percent: 64,
      remaining: 180,
      targetReached: false,
    });
  });

  it('treats a null target as open-ended', () => {
    expect(quantityProgress(null, 40)).toMatchObject({
      target: null,
      remaining: null,
      percent: 0,
      fulfilled: 40,
    });
  });

  it('caps the bar but reports over-fulfilment', () => {
    const progress = quantityProgress(100, 140);
    expect(progress.percent).toBe(100);
    expect(progress.rawPercent).toBe(140);
    expect(progress.targetReached).toBe(true);
  });
});

describe('daysRemaining', () => {
  const now = new Date('2026-03-15T14:30:00+05:30');

  it('counts whole days from the start of today', () => {
    expect(daysRemaining('2026-03-20T00:00:00+05:30', now)).toBe(5);
  });

  it('does not tick down during the day', () => {
    // Two loads an hour apart must show the same number.
    const morning = new Date('2026-03-15T06:00:00+05:30');
    const evening = new Date('2026-03-15T23:00:00+05:30');
    expect(daysRemaining('2026-03-20T00:00:00+05:30', morning)).toBe(
      daysRemaining('2026-03-20T00:00:00+05:30', evening),
    );
  });

  it('returns 0 rather than a negative for a past deadline', () => {
    expect(daysRemaining('2026-03-01T00:00:00+05:30', now)).toBe(0);
  });

  it('returns null when there is no deadline — no manufactured urgency', () => {
    expect(daysRemaining(null, now)).toBeNull();
    expect(daysRemaining('not a date', now)).toBeNull();
  });
});
