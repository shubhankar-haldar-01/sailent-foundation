import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NewsletterSection } from '../newsletter-section';

vi.mock('@/lib/communications/actions', () => ({
  subscribeToNewsletter: vi.fn(async (formData: FormData) => {
    const email = formData.get('email');
    if (email === 'fail@example.com') {
      return { ok: false, error: 'Subscription failed' };
    }
    return { ok: true };
  }),
}));

describe('NewsletterSection', () => {
  it('renders header, eyebrow, description, and benefits', () => {
    render(<NewsletterSection />);

    expect(screen.getByText('STAY CONNECTED')).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: /Join Our Newsletter/i })).toBeDefined();
    expect(
      screen.getByText(
        /Get the latest stories, updates and opportunities delivered directly to your inbox/i,
      ),
    ).toBeDefined();

    expect(screen.getByText('Latest Stories & Updates')).toBeDefined();
    expect(screen.getByText('Upcoming Events')).toBeDefined();
    expect(screen.getByText('Volunteer Opportunities')).toBeDefined();

    expect(screen.getByPlaceholderText('Enter your email address')).toBeDefined();
    expect(screen.getByRole('button', { name: /Subscribe/i })).toBeDefined();
  });

  it('shows error when submitting invalid email', async () => {
    render(<NewsletterSection />);

    const input = screen.getByPlaceholderText('Enter your email address');
    const button = screen.getByRole('button', { name: /Subscribe/i });

    fireEvent.change(input, { target: { value: 'invalid-email' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });

  it('successfully subscribes with valid email', async () => {
    render(<NewsletterSection />);

    const input = screen.getByPlaceholderText('Enter your email address');
    const button = screen.getByRole('button', { name: /Subscribe/i });

    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeDefined();
      expect(screen.getByText(/Nearly done — check your inbox/i)).toBeDefined();
    });
  });
});
