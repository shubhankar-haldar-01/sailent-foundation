import { describe, expect, it } from 'vitest';

import { campaigns as campaignFixtures } from '../mock/campaigns';
import { programs as programFixtures } from '../mock/programs';
import { countOpenCampaigns } from '../open-campaigns';

const NOW = new Date('2026-10-06T12:00:00+05:30');

const campaign = (status: string, endsAt: string | null, programSlug = 'education') => ({
  programSlug,
  status,
  endsAt,
});

/** A programme card's "N active campaigns": open campaigns only. */
describe('countOpenCampaigns', () => {
  it('counts active campaigns with no end date or one still to come', () => {
    const campaigns = [
      campaign('active', null),
      campaign('active', '2026-12-31T00:00:00+05:30'),
      // The end date is the last day to give: still open on that day.
      campaign('active', '2026-10-06T00:00:00+05:30'),
    ];
    expect(countOpenCampaigns('education', campaigns, NOW)).toBe(3);
  });

  it('leaves out past-deadline, paused, completed and archived campaigns', () => {
    const campaigns = [
      campaign('active', '2026-10-05T00:00:00+05:30'),
      campaign('paused', null),
      campaign('completed', null),
      campaign('archived', null),
    ];
    expect(countOpenCampaigns('education', campaigns, NOW)).toBe(0);
  });

  it('counts only the programme asked about', () => {
    const campaigns = [campaign('active', null, 'education'), campaign('active', null, 'health')];
    expect(countOpenCampaigns('education', campaigns, NOW)).toBe(1);
  });

  it('gives the fixture programmes the counts their fixture campaigns imply', () => {
    // The hand-typed numbers these replace said 3, 2, 1, 1, 1, 0, 0.
    const counts = Object.fromEntries(
      programFixtures.map((program) => [
        program.slug,
        countOpenCampaigns(program.slug, campaignFixtures, NOW),
      ]),
    );
    expect(counts).toEqual({
      education: 1,
      healthcare: 1,
      'child-welfare': 2,
      // Its one fixture campaign is completed.
      'women-empowerment': 0,
      livelihood: 0,
      environment: 1,
      'animal-welfare': 0,
    });
  });
});
