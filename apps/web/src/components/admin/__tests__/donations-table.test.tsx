import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DonationsTable, DonationStatusBadge, type AdminDonation } from '../donations-table';

const MOCK_DONATIONS: AdminDonation[] = [
  {
    id: 'don-1',
    reference: 'DON-2026-0001',
    status: 'successful',
    donationType: 'general',
    amount: 150000, // ₹1,500
    createdAt: '2026-10-10T10:00:00.000Z',
    completedAt: '2026-10-10T10:05:00.000Z',
    campaignTitle: 'Clean Water for Rural Schools',
    campaignSlug: 'clean-water',
    receiptNumber: 'REC-2026-0001',
    donorName: 'Aarav Sharma',
    donorEmail: 'aarav@example.com',
  },
  {
    id: 'don-2',
    reference: 'DON-2026-0002',
    status: 'pending',
    donationType: 'product',
    amount: 50000,
    createdAt: '2026-10-11T12:00:00.000Z',
    completedAt: null,
    campaignTitle: 'School Kits Drive',
    campaignSlug: 'school-kits',
    receiptNumber: null,
    donorName: 'Priya Patel',
    donorEmail: 'priya@example.com',
  },
  {
    id: 'don-3',
    reference: 'DON-2026-0003',
    status: 'failed',
    donationType: 'custom',
    amount: 25000,
    createdAt: '2026-10-12T08:00:00.000Z',
    completedAt: null,
    campaignTitle: null,
    campaignSlug: null,
    receiptNumber: null,
    donorName: null,
    donorEmail: null,
  },
];

describe('DonationStatusBadge', () => {
  it('renders accessible label and hidden icon for successful status', () => {
    const { container } = render(<DonationStatusBadge status="successful" />);
    expect(screen.getByText('Successful')).toBeInTheDocument();
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders accessible label and hidden icon for pending status', () => {
    const { container } = render(<DonationStatusBadge status="pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders accessible label and hidden icon for failed status', () => {
    const { container } = render(<DonationStatusBadge status="failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders accessible label and hidden icon for cancelled status', () => {
    const { container } = render(<DonationStatusBadge status="cancelled" />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('DonationsTable', () => {
  it('renders desktop table and mobile stacked cards with all fields', () => {
    const { container } = render(<DonationsTable donations={MOCK_DONATIONS} seesDonors={true} />);

    // Desktop table exists
    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();
    expect(screen.getAllByText('Reference').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Amount').length).toBeGreaterThan(0);
    expect(screen.getAllByText('State').length).toBeGreaterThan(0);

    // Mobile stacked cards list exists
    const mobileList = container.querySelector('ul');
    expect(mobileList).toBeInTheDocument();
    expect(mobileList?.className).toContain('md:hidden');

    // References are rendered as links in both views
    const links = screen.getAllByRole('link', { name: 'DON-2026-0001' });
    expect(links.length).toBeGreaterThanOrEqual(1);

    // Donor identities visible when seesDonors is true
    expect(screen.getAllByText('Aarav Sharma').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('aarav@example.com').length).toBeGreaterThanOrEqual(1);
  });

  it('hides donor identities when seesDonors is false', () => {
    render(<DonationsTable donations={MOCK_DONATIONS} seesDonors={false} />);
    expect(screen.queryByText('Aarav Sharma')).not.toBeInTheDocument();
    expect(screen.queryByText('aarav@example.com')).not.toBeInTheDocument();
  });

  it('renders empty state when donations list is empty', () => {
    render(<DonationsTable donations={[]} seesDonors={false} />);
    expect(screen.getByText('No donations match this filter.')).toBeInTheDocument();
  });
});
