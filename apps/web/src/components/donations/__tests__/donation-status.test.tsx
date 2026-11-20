import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DonationStatus } from '../donation-status';

/*
  The status page decides what a donor is told after paying, from the SERVER.
  Phase 3 of the UI feedback system (2026-11-19): a connection that comes back
  makes it ask again at once, even after it had given up waiting.
*/

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const ORGANISATION = {
  name: 'Sailent Foundation',
  email: null,
  phoneDisplay: null,
  phoneHref: null,
  pan: null,
  section80G: null,
  section12A: null,
  registrationNumber: null,
};

const DONATION = {
  reference: 'DON-AAAA1111',
  amount: 50_000,
  donationType: 'custom',
  campaignSlug: 'mountain',
  campaignTitle: 'mountain',
  donorName: 'Asha',
  completedAt: '2026-11-19T08:24:00.000Z',
  items: [
    {
      itemType: 'custom',
      itemName: 'Additional donation',
      quantity: 1,
      unitPrice: 50_000,
      totalPrice: 50_000,
    },
  ],
};

let status = 'pending';
const json = (body: unknown, code = 200) => new Response(JSON.stringify(body), { status: code });

beforeEach(() => {
  vi.useFakeTimers();
  status = 'pending';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.endsWith('/receipt')
        ? json({ success: false }, 404)
        : json({ success: true, data: { ...DONATION, status } }),
    ),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function flush(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('DonationStatus', () => {
  it('waits for the server, tells the donor not to pay again, and asks again once back online', async () => {
    render(<DonationStatus reference="DON-AAAA1111" organisation={ORGANISATION} />);

    await flush(0);
    expect(screen.getByText('Confirming your payment')).toBeVisible();

    // The whole backoff passes with the payment still pending.
    await flush(120_000);
    expect(screen.getByText('This is taking longer than usual')).toBeVisible();
    expect(screen.getByText(/Please do not pay again/)).toBeVisible();

    // The webhook recorded it meanwhile; the connection returns.
    status = 'successful';
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await flush(0);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Thank you, Asha!');
  });

  it('never calls a pending payment a success or a failure', async () => {
    render(<DonationStatus reference="DON-AAAA1111" organisation={ORGANISATION} />);
    await flush(10_000);

    expect(screen.queryByText(/Thank you/)).toBeNull();
    expect(screen.queryByText(/was not completed/)).toBeNull();
  });
});
