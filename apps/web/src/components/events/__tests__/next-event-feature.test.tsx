import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SailentEvent } from '@/lib/mock/types';

import { NextEventFeature } from '../next-event-feature';

/** An event a month from now, open and uncapped unless told otherwise. */
function event(overrides: Partial<SailentEvent> = {}): SailentEvent {
  const start = new Date(Date.now() + 30 * 86_400_000);
  return {
    slug: 'health-camp',
    title: 'Health Camp',
    summary: 'A one-day community health camp.',
    startsAt: start.toISOString(),
    endsAt: null,
    venueName: 'Ward 12 Community Hall',
    city: 'Pune, Maharashtra',
    isOnline: false,
    capacity: null,
    registeredCount: 0,
    status: 'registration_open',
    lifecycle: 'open',
    registrationDeadline: null,
    cover: { seed: 'event-health-camp', alt: 'Health Camp' },
    description: [],
    schedule: [],
    address: null,
    programSlug: null,
    campaignSlug: null,
    gallery: [],
    ...overrides,
  };
}

describe('NextEventFeature', () => {
  it('offers Register while registration is open, with the places left', () => {
    render(<NextEventFeature event={event({ capacity: 50, registeredCount: 48 })} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Health Camp' })).toBeInTheDocument();
    expect(screen.getByText('Next event')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Register/ })).toHaveAttribute(
      'href',
      '/events/health-camp/register',
    );
    expect(screen.getByText('2 places left')).toBeInTheDocument();
    expect(screen.getByText('Pune, Maharashtra')).toBeInTheDocument();
  });

  it('never offers Register for a full event — only its page, which says why', () => {
    render(<NextEventFeature event={event({ capacity: 40, registeredCount: 40 })} />);

    expect(screen.queryByRole('link', { name: /^Register/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View details/ })).toHaveAttribute(
      'href',
      '/events/health-camp',
    );
  });

  it('never offers Register for a cancelled event', () => {
    render(<NextEventFeature event={event({ status: 'cancelled', lifecycle: 'cancelled' })} />);
    expect(screen.queryByRole('link', { name: /^Register/ })).not.toBeInTheDocument();
  });

  it('says Online rather than a place for an online event', () => {
    render(<NextEventFeature event={event({ isOnline: true })} />);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });
});
