import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { campaigns } from '@/lib/mock/campaigns';
import type { Campaign } from '@/lib/mock/types';

import { DonationBuilder } from '../donation-builder';

/*
  A campaign that is not taking donations offers no way to pay (owner,
  2026-11-19, Phase 4 of the UI feedback system): the donation card gives way
  to a banner saying why, with a way on to the open campaigns.
*/

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const BASE = campaigns[0]!;
const DONATE = /^(Donate( ₹[\d,.]+)?|Proceed to Donate|Continue)$/;

function renderWith(overrides: Partial<Campaign>) {
  return render(<DonationBuilder campaign={{ ...BASE, ...overrides }} preselectSmallestAmount />);
}

describe('a campaign not taking donations', () => {
  it('ended: says so, links to the open campaigns, and has no Donate button', () => {
    renderWith({ status: 'completed' });

    expect(screen.getAllByText('This campaign has ended').length).toBeGreaterThan(0);
    for (const link of screen.getAllByRole('link', { name: 'See open campaigns' })) {
      expect(link).toHaveAttribute('href', '/campaigns');
    }
    expect(screen.queryByRole('button', { name: DONATE })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: /How would you like to give/ })).toBeNull();
  });

  it('past its end date counts as ended', () => {
    renderWith({ status: 'active', donation: { state: 'ended' } } as Partial<Campaign>);
    expect(screen.getAllByText('This campaign has ended').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: DONATE })).toBeNull();
  });

  it('paused: says donations are paused, with no reason invented, and no Donate button', () => {
    renderWith({ status: 'paused' });

    expect(screen.getAllByText('Donations are paused for now').length).toBeGreaterThan(0);
    expect(screen.queryByText(/reviews delivery/)).toBeNull();
    expect(screen.queryByRole('button', { name: DONATE })).toBeNull();
  });

  it('without products, no amount field either: a disabled field is no way to give', () => {
    const { unmount } = renderWith({ status: 'completed', products: [] });
    expect(screen.queryByLabelText('Custom donation amount in rupees')).toBeNull();
    unmount();

    renderWith({ status: 'active', products: [] });
    expect(screen.getByLabelText('Custom donation amount in rupees')).toBeEnabled();
  });

  it('an open campaign keeps its donation card and no closed banner', () => {
    renderWith({ status: 'active' });

    expect(screen.getAllByRole('button', { name: DONATE }).length).toBeGreaterThan(0);
    expect(screen.queryByText('This campaign has ended')).toBeNull();
    expect(screen.queryByText('Donations are paused for now')).toBeNull();
  });
});
