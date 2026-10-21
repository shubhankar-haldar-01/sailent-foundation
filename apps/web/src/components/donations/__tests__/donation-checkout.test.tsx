import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { DonationCheckout, type CheckoutSelection } from '../donation-checkout';

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const MOCK_SELECTION: CheckoutSelection = {
  campaignSlug: 'clean-water-project',
  campaignTitle: 'Clean Water for Rural Communities',
  items: [
    { campaignProductId: 'prod-1', quantity: 2 },
    { campaignProductId: 'prod-2', quantity: 1 },
  ],
  customAmount: 150000, // ₹1,500
  displayTotal: 450000, // ₹4,500
};

describe('DonationCheckout', () => {
  it('renders the summary card with the total, and states 80G relief carefully', () => {
    const { container } = render(<DonationCheckout selection={MOCK_SELECTION} />);

    // No eligibility badge: whether a gift qualifies is not this page's to promise.
    expect(screen.queryByText(/80G Eligible/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Relief under Section 80G is claimed separately, through Form 10BE/i),
    ).toBeInTheDocument();

    // Campaign title and total amount
    expect(screen.getByText('Clean Water for Rural Communities')).toBeInTheDocument();
    expect(screen.getByText('₹4,500')).toBeInTheDocument();

    // Elevated card styling
    const summaryCard = container.querySelector('.card-elevated');
    expect(summaryCard).toBeInTheDocument();
  });

  it('renders item breakdown for products and custom donation', () => {
    render(<DonationCheckout selection={MOCK_SELECTION} />);

    // Product add-ons total (2 + 1 = 3 items)
    expect(screen.getByText(/Product add-ons \(3 items\)/i)).toBeInTheDocument();

    // Custom donation line
    expect(screen.getByText('Custom donation')).toBeInTheDocument();
    expect(screen.getByText('₹1,500')).toBeInTheDocument();
  });

  it('offers no refund terms: there is no published refund policy yet', () => {
    render(<DonationCheckout selection={MOCK_SELECTION} />);

    expect(screen.queryByText(/refund/i)).not.toBeInTheDocument();
  });

  it('renders pay button with display total', () => {
    render(<DonationCheckout selection={MOCK_SELECTION} />);

    const payButton = screen.getByRole('button', { name: /Pay ₹4,500/i });
    expect(payButton).toBeInTheDocument();
  });
});
