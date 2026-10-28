import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProfileForm } from '../profile-form';
import type { DonorProfile } from '@/lib/donor/api';

vi.mock('@/lib/donor/actions', () => ({
  updateDonorProfile: vi.fn(),
  requestEmailChange: vi.fn(),
  verifyEmailChange: vi.fn(),
}));

const mockProfile: DonorProfile = {
  id: 'donor-1',
  email: 'donor@example.com',
  firstName: 'Demo',
  lastName: 'Donor',
  phone: '+919876543210',
  city: 'New Delhi',
  state: 'Delhi',
  postalCode: '110016',
  addressLine1: '456 Palm Avenue',
  addressLine2: null,
  taxIdType: 'pan',
  taxIdNumberMasked: 'XXXXXX234F',
  hasTaxId: true,
  donorCode: 'SF-100',
  country: 'India',
  totalDonated: 1000,
  donationCount: 2,
  firstDonatedAt: null,
  lastDonatedAt: null,
};

describe('ProfileForm', () => {
  it('renders the responsive State select dropdown with initial value', () => {
    render(<ProfileForm profile={mockProfile} />);

    expect(screen.getByText('State')).toBeDefined();
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeDefined();
    expect(trigger.textContent).toContain('Delhi');
  });

  it('renders with placeholder when state is empty', () => {
    render(<ProfileForm profile={{ ...mockProfile, state: null }} />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeDefined();
    expect(trigger.textContent).toContain('Select state');
  });
});
