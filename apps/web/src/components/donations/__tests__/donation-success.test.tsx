import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Toaster, resetToastsForTests } from '@sailent/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DonationSuccess,
  type ReceiptOrganisation,
  type SuccessDonation,
  type SuccessReceipt,
} from '../donation-success';

const donation = (overrides: Partial<SuccessDonation> = {}): SuccessDonation => ({
  reference: 'DON-TX7B7Z8D',
  amount: 50_000,
  donationType: 'custom',
  campaignSlug: 'mountain',
  campaignTitle: 'mountain',
  donorName: 'Shubhankar',
  // 08:24 UTC is 1:54 pm in India.
  completedAt: '2026-11-19T08:24:00.000Z',
  items: [{ itemType: 'custom', itemName: 'Additional donation', quantity: 1, totalPrice: 50_000 }],
  ...overrides,
});

const receipt: SuccessReceipt = {
  receiptNumber: 'SFL-2026-003176',
  issuedAt: '2026-11-19T08:24:01.000Z',
  donorName: 'Shubhankar Haldar',
  programTitle: null,
};

const organisation = (overrides: Partial<ReceiptOrganisation> = {}): ReceiptOrganisation => ({
  name: 'Sailent Foundation',
  email: null,
  phoneDisplay: null,
  phoneHref: null,
  pan: null,
  section80G: null,
  section12A: null,
  registrationNumber: null,
  ...overrides,
});

afterEach(() => {
  resetToastsForTests();
  vi.unstubAllGlobals();
});

describe('DonationSuccess', () => {
  it('thanks the donor and states the amount in figures and words, dated in IST', () => {
    render(
      <DonationSuccess donation={donation()} receipt={receipt} organisation={organisation()} />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Thank you, Shubhankar!' })).toBeVisible();
    expect(screen.getByText('Rupees Five Hundred Only · INR')).toBeVisible();
    expect(screen.getByText('19 Nov 2026')).toBeVisible();
    expect(screen.getByText(/1:54 pm IST/i)).toBeVisible();
    expect(screen.getByText('Payment successful')).toBeVisible();
    // The receipt's full name, not only the first name typed at checkout.
    expect(screen.getByText('Shubhankar Haldar')).toBeVisible();
    expect(screen.getByText('SFL-2026-003176')).toBeVisible();
    expect(screen.getByText('One-time · Amount of your choice')).toBeVisible();
  });

  it('carries no payment identifier, no fee lines and no claims that are not records', () => {
    const { container } = render(
      <DonationSuccess donation={donation()} receipt={receipt} organisation={organisation()} />,
    );
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/pay_|UTR|Transaction ID|UPI/);
    expect(text).not.toMatch(/fee|Gateway charges|Inclusive of all charges/i);
    expect(text).not.toMatch(/256-bit|PCI|80G eligible|tax exempt/i);
    expect(text).toContain('Payment processed securely by Razorpay');
    expect(text).toContain('it is not a tax-exemption certificate');
  });

  it('shows the organisation’s numbers only when they have been entered', () => {
    const { rerender } = render(
      <DonationSuccess donation={donation()} receipt={receipt} organisation={organisation()} />,
    );
    expect(screen.queryByText('Organisation PAN')).toBeNull();
    expect(screen.queryByText('80G registration no.')).toBeNull();

    rerender(
      <DonationSuccess
        donation={donation()}
        receipt={receipt}
        organisation={organisation({ pan: 'AAATS1234F', section80G: 'AAATS1234FF20214' })}
      />,
    );
    expect(screen.getByText('AAATS1234F')).toBeVisible();
    expect(screen.getByText('AAATS1234FF20214')).toBeVisible();
    expect(screen.queryByText('12A registration no.')).toBeNull();
  });

  it('downloads the receipt through the BFF, with a loading state and a toast', async () => {
    let finish: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => (finish = resolve)));
    vi.stubGlobal('fetch', fetchMock);
    const createObjectURL = vi.fn(() => 'blob:receipt');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const clicked = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    render(
      <>
        <DonationSuccess donation={donation()} receipt={receipt} organisation={organisation()} />
        <Toaster />
      </>,
    );

    const button = screen.getByRole('button', { name: /download receipt \(pdf\)/i });
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledWith('/api/bff/donations/DON-TX7B7Z8D/receipt/pdf', {
      cache: 'no-store',
    });
    // Busy, and a second press does nothing.
    expect(screen.getByRole('button', { name: /preparing receipt/i })).toBeDisabled();

    await act(async () => {
      finish(new Response(new Blob(['%PDF-']), { status: 200 }));
    });
    const anchor = clicked.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('Donation-receipt-SFL-2026-003176.pdf');
    expect(await screen.findByText('Receipt downloaded')).toBeVisible();
  });

  it('says so when the receipt cannot be downloaded, and offers to try again', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503 })),
    );
    render(
      <>
        <DonationSuccess donation={donation()} receipt={receipt} organisation={organisation()} />
        <Toaster />
      </>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download receipt \(pdf\)/i }));
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Couldn’t download the receipt');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  it('offers no download before there is a receipt', () => {
    render(<DonationSuccess donation={donation()} receipt={null} organisation={organisation()} />);
    expect(screen.queryByRole('button', { name: /download receipt/i })).toBeNull();
  });

  it('shares the campaign’s link, never this page’s', async () => {
    const share = vi.fn(async (_data: ShareData) => undefined);
    vi.stubGlobal('navigator', { ...navigator, share });
    render(
      <DonationSuccess donation={donation()} receipt={receipt} organisation={organisation()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /share this campaign/i }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const shared = share.mock.calls[0]![0];
    expect(shared.url).toBe(`${window.location.origin}/campaigns/mountain`);
    expect(shared.url).not.toContain('DON-');
  });

  it('copies the campaign link where the browser cannot share', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });
    render(
      <>
        <DonationSuccess donation={donation()} receipt={receipt} organisation={organisation()} />
        <Toaster />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: /share this campaign/i }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/campaigns/mountain`),
    );
    // The "Copied" pill.
    expect(await screen.findByText('Campaign link copied')).toBeVisible();
  });

  it('leaves out the campaign links and sharing when the donation has no campaign', () => {
    render(
      <DonationSuccess
        donation={donation({ campaignSlug: null, campaignTitle: null })}
        receipt={receipt}
        organisation={organisation()}
      />,
    );

    expect(screen.queryByRole('link', { name: /back to the campaign/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /share/i })).toBeNull();
    expect(screen.getByRole('link', { name: /see other campaigns/i })).toBeVisible();
  });

  it('points to help through the contacts entered, or the contact page when there are none', () => {
    const { rerender } = render(
      <DonationSuccess donation={donation()} receipt={receipt} organisation={organisation()} />,
    );
    const help = screen.getByText(/need help with this payment/i);
    expect(within(help).getByRole('link', { name: 'contact us' })).toHaveAttribute(
      'href',
      '/contact',
    );

    rerender(
      <DonationSuccess
        donation={donation()}
        receipt={receipt}
        organisation={organisation({
          email: 'help@example.org',
          phoneDisplay: '+91 90000 00000',
          phoneHref: 'tel:+919000000000',
        })}
      />,
    );
    expect(screen.getByRole('link', { name: 'help@example.org' })).toHaveAttribute(
      'href',
      'mailto:help@example.org',
    );
    expect(screen.getByRole('link', { name: '+91 90000 00000' })).toHaveAttribute(
      'href',
      'tel:+919000000000',
    );
  });
});
