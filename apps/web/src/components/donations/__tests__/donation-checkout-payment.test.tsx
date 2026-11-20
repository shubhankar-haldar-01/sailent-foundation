import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { basketKey } from '@/lib/payments/checkout-attempt';
import { saveAttempt, saveDonor, selectionKey } from '@/lib/payments/checkout-session';
import type { CheckoutOutcome } from '@/lib/payments/razorpay-checkout';

import { DonationCheckout, type CheckoutSelection } from '../donation-checkout';

/*
  The payment flow (Phase 3 of the UI feedback system, 2026-11-19): never two
  donations for one basket, closing Razorpay is "cancelled" not an error, the
  server decides the outcome, and the donor's details survive a retry.
  Razorpay and the network are stand-ins; the server's verification is the
  API's own suite.
*/

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const razorpay = vi.hoisted(() => ({
  open: vi.fn<(handoff: unknown) => Promise<CheckoutOutcome>>(),
}));
vi.mock('@/lib/payments/razorpay-checkout', () => ({
  loadRazorpayScript: async () => undefined,
  openRazorpayCheckout: (handoff: unknown) => razorpay.open(handoff),
}));

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const SELECTION: CheckoutSelection = {
  campaignSlug: 'school-kits-jharkhand',
  campaignTitle: 'School kits',
  items: [{ campaignProductId: 'prod-1', quantity: 1 }],
  customAmount: 50_000,
  displayTotal: 140_000,
};
const DONOR = { name: 'Asha Verma', email: 'asha@example.org', phone: '9876543210' };
const HANDOFF = {
  razorpayKeyId: 'rzp_test_x',
  razorpayOrderId: 'order_1',
  amount: 140_000,
  currency: 'INR',
  donationId: 'don-1',
  reference: 'DON-AAAA1111',
  donor: DONOR,
};

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const posts = () =>
  fetchMock.mock.calls.filter(
    ([url, init]) => url === '/api/bff/donations' && init?.method === 'POST',
  );

beforeEach(() => {
  window.sessionStorage.clear();
  router.push.mockReset();
  router.replace.mockReset();
  razorpay.open.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function fill(values = DONOR) {
  fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: values.name } });
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: values.email } });
  fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: values.phone } });
}
const payButton = () =>
  screen.getByRole('button', { name: /Pay ₹1,400|Waiting|Preparing|Checking|Confirming/ });

describe('the donor form', () => {
  it('checks a field when it is left, links the error to it, and clears it once corrected', () => {
    render(<DonationCheckout selection={SELECTION} />);
    const email = screen.getByLabelText(/^Email/);

    fireEvent.change(email, { target: { value: 'asha@' } });
    fireEvent.blur(email);
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email.getAttribute('aria-describedby')).toContain('email-error');
    expect(document.getElementById('email-error')).toBeVisible();

    fireEvent.change(email, { target: { value: 'asha@example.org' } });
    expect(email).not.toHaveAttribute('aria-invalid');
    expect(document.getElementById('email-error')).toBeNull();
  });

  it('on Pay with mistakes, focuses the first one and sends nothing', () => {
    render(<DonationCheckout selection={SELECTION} />);
    fill({ name: 'Asha Verma', email: 'nope', phone: '12' });

    fireEvent.click(payButton());

    expect(document.activeElement).toBe(screen.getByLabelText(/^Email/));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fills in the details given earlier in this visit', async () => {
    saveDonor({ ...DONOR, anonymous: false });
    render(<DonationCheckout selection={SELECTION} />);

    await waitFor(() => expect(screen.getByLabelText(/Full name/)).toHaveValue('Asha Verma'));
    expect(screen.getByLabelText(/^Email/)).toHaveValue('asha@example.org');
  });
});

describe('paying', () => {
  it('creates ONE donation however often Pay is pressed', async () => {
    fetchMock.mockImplementation(async () => json({ success: true, data: HANDOFF }));
    razorpay.open.mockReturnValue(new Promise(() => undefined)); // Checkout left open
    render(<DonationCheckout selection={SELECTION} />);
    fill();

    await act(async () => {
      fireEvent.click(payButton());
      fireEvent.click(payButton());
      fireEvent.submit(payButton().closest('form')!);
    });

    await waitFor(() => expect(razorpay.open).toHaveBeenCalledTimes(1));
    expect(posts()).toHaveLength(1);
    expect(payButton()).toBeDisabled();
    expect(screen.getByText(/Don’t close or refresh this page/)).toBeVisible();
  });

  it('calls a closed payment window "cancelled", not an error, and keeps the details', async () => {
    fetchMock.mockImplementation(async () => json({ success: true, data: HANDOFF }));
    razorpay.open.mockResolvedValue({ kind: 'dismissed' });
    render(<DonationCheckout selection={SELECTION} />);
    fill();

    await act(async () => {
      fireEvent.click(payButton());
    });

    const notice = await screen.findByText(/Payment cancelled\./);
    expect(notice.closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText(/Full name/)).toHaveValue('Asha Verma');
    expect(payButton()).toBeEnabled();
  });

  it('shows a failed payment’s reason and the donation reference', async () => {
    fetchMock.mockImplementation(async () => json({ success: true, data: HANDOFF }));
    razorpay.open.mockResolvedValue({ kind: 'failed', reason: 'Your bank declined the payment.' });
    render(<DonationCheckout selection={SELECTION} />);
    fill();

    await act(async () => {
      fireEvent.click(payButton());
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Your bank declined the payment.');
    expect(alert).toHaveTextContent('DON-AAAA1111');
    expect(alert).not.toHaveTextContent(/refund/i);
  });

  it('waits for the SERVER, full screen, then shows the server’s answer', async () => {
    let verified: (response: Response) => void = () => undefined;
    fetchMock.mockImplementation(async (url) =>
      url.endsWith('/verify-payment')
        ? new Promise<Response>((resolve) => (verified = resolve))
        : json({ success: true, data: HANDOFF }),
    );
    razorpay.open.mockResolvedValue({
      kind: 'paid',
      result: { razorpayOrderId: 'order_1', razorpayPaymentId: 'pay_1', razorpaySignature: 'sig' },
    });
    render(<DonationCheckout selection={SELECTION} />);
    fill();

    await act(async () => {
      fireEvent.click(payButton());
    });

    expect(await screen.findByText('Confirming your payment…', { selector: 'p' })).toBeVisible();
    expect(router.push).not.toHaveBeenCalled();
    await act(async () => {
      verified(json({ success: true }));
    });
    expect(router.push).toHaveBeenCalledWith('/donation/DON-AAAA1111');
  });

  it('says so when offline, and sends nothing', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<DonationCheckout selection={SELECTION} />);
    fill();

    await act(async () => {
      fireEvent.click(payButton());
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('You’re offline');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('an earlier attempt in this tab', () => {
  const requestKey = basketKey({
    campaignSlug: SELECTION.campaignSlug,
    items: SELECTION.items,
    customAmount: SELECTION.customAmount,
    donor: { ...DONOR, anonymous: false, message: undefined },
  });

  it('goes to the receipt when it was already paid, instead of taking a second payment', async () => {
    saveAttempt(selectionKey(SELECTION), {
      key: requestKey,
      idempotencyKey: 'key-1',
      handoff: { ...HANDOFF, reference: 'DON-PAID1234' },
    });
    fetchMock.mockImplementation(async () =>
      json({ success: true, data: { status: 'successful' } }),
    );

    render(<DonationCheckout selection={SELECTION} />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/donation/DON-PAID1234'));
    expect(posts()).toHaveLength(0);
  });

  it('reopens the same order when it is still open, never a second donation', async () => {
    saveAttempt(selectionKey(SELECTION), {
      key: requestKey,
      idempotencyKey: 'key-1',
      handoff: HANDOFF,
    });
    fetchMock.mockImplementation(async () => json({ success: true, data: { status: 'pending' } }));
    razorpay.open.mockResolvedValue({ kind: 'dismissed' });
    render(<DonationCheckout selection={SELECTION} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fill();

    await act(async () => {
      fireEvent.click(payButton());
    });

    await waitFor(() => expect(razorpay.open).toHaveBeenCalledWith(HANDOFF));
    expect(posts()).toHaveLength(0);
  });
});
