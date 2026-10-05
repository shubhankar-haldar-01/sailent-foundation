import { describe, expect, it } from 'vitest';

import { CAMPAIGN_STATE_NAMES, STATUS_VISUALS, campaignState } from '../campaign-status';

describe('campaignState', () => {
  it('names the three states a public campaign can be in', () => {
    expect(campaignState('active')).toBe('active');
    expect(campaignState('completed')).toBe('completed');
  });

  it('calls a paused campaign "Closed", as the status menu does', () => {
    expect(campaignState('paused')).toBe('closed');
    expect(CAMPAIGN_STATE_NAMES.closed).toBe('Closed');
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
