import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_STATE_NAMES,
  STATUS_VISUALS,
  acceptsDonationsNow,
  campaignState,
} from '../campaign-status';

describe('campaignState', () => {
  it('names the three states a public campaign can be in', () => {
    expect(campaignState('active')).toBe('active');
    expect(campaignState('completed')).toBe('completed');
  });

  it('calls a paused campaign "Closed", as the status menu does', () => {
    expect(campaignState('paused')).toBe('closed');
    expect(CAMPAIGN_STATE_NAMES.closed).toBe('Closed');
  });

  it('calls an active campaign past its end date "Closed" — it takes no donations', () => {
    expect(campaignState('active', 'ended')).toBe('closed');
    expect(campaignState('active', 'open')).toBe('active');
  });

  it('badges nothing it does not recognise rather than guessing', () => {
    expect(campaignState('archived')).toBeNull();
    expect(campaignState('draft')).toBeNull();
  });

  it('gives every state the same mark the menu uses for it', () => {
    for (const state of ['active', 'closed', 'completed'] as const) {
      expect(STATUS_VISUALS[state].icon).toBeTruthy();
    }
  });
});

describe('acceptsDonationsNow', () => {
  it('is open for an active campaign, with or without a stated availability', () => {
    expect(acceptsDonationsNow({ status: 'active' })).toBe(true);
    expect(acceptsDonationsNow({ status: 'active', donation: { state: 'open' } })).toBe(true);
  });

  it('is closed once the end date has passed, or the campaign is not active', () => {
    expect(acceptsDonationsNow({ status: 'active', donation: { state: 'ended' } })).toBe(false);
    expect(acceptsDonationsNow({ status: 'paused' })).toBe(false);
    expect(acceptsDonationsNow({ status: 'completed' })).toBe(false);
  });
});
