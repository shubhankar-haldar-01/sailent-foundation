import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EventForm } from '../event-form';
import type { AdminEvent, AdminProgram } from '@/lib/admin/api';

vi.mock('@/lib/admin/actions', () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  uploadMediaDirect: vi.fn(),
}));

// The editor's unsaved-changes guard (Phase 4) navigates with the router.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

describe('EventForm', () => {
  const samplePrograms: AdminProgram[] = [
    {
      id: 'e28d8b4e-2f15-4688-9d82-c2cb9bb88ef1',
      title: 'Healthcare Support',
      slug: 'healthcare-support',
      shortDescription: 'Healthcare',
      category: 'Healthcare',
      categoryId: null,
      status: 'published',
      displayOrder: 1,
      campaignCount: 0,
      publishedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('renders cleaned up fields: capacity renamed, organiser and campaign removed, URL input removed, image picker present', () => {
    const { container } = render(<EventForm programs={samplePrograms} />);

    // 1. Title is present and required
    const titleInput = screen.getByLabelText(/Title/i);
    expect(titleInput).toBeInTheDocument();
    expect(titleInput).toBeRequired();

    // Summary is present and required
    const summaryInput = screen.getByLabelText(/Summary/i);
    expect(summaryInput).toBeInTheDocument();
    expect(summaryInput).toBeRequired();

    // 2. Visible "URL" input is removed
    expect(screen.queryByLabelText(/^URL$/i)).not.toBeInTheDocument();

    // 3. Organiser input is removed
    expect(screen.queryByLabelText(/Organiser/i)).not.toBeInTheDocument();

    // 4. Campaign dropdown is removed
    expect(screen.queryByLabelText(/^Campaign$/i)).not.toBeInTheDocument();

    // 5. Programme (Category) is kept as optional
    expect(screen.getByLabelText(/Programme \(Category\)/i)).toBeInTheDocument();

    // 6. Capacity renamed to "Total Seats / Capacity" and is required
    const capacityInput = screen.getByLabelText(/Total Seats \/ Capacity/i);
    expect(capacityInput).toBeInTheDocument();
    expect(capacityInput).toHaveAttribute('type', 'number');
    expect(capacityInput).toHaveAttribute('placeholder', 'e.g. 50');
    expect(capacityInput).toBeRequired();

    // 7. Description, Venue, Address, City, State are all required
    expect(screen.getByLabelText(/^Description/i)).toBeRequired();
    expect(screen.getByLabelText(/^Venue/i)).toBeRequired();
    expect(screen.getByLabelText(/^Address/i)).toBeRequired();
    expect(screen.getByLabelText(/^City/i)).toBeRequired();
    expect(screen.getByLabelText(/^State/i)).toBeRequired();

    // 8. Modern DateTimePicker is used instead of native datetime-local inputs
    expect(container.querySelector('input[type="datetime-local"]')).not.toBeInTheDocument();
    expect(container.querySelector('input[name="startDate"][type="hidden"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="endDate"][type="hidden"]')).toBeInTheDocument();
    expect(
      container.querySelector('input[name="registrationDeadline"][type="hidden"]'),
    ).toBeInTheDocument();
  });

  it('populates initial data and preserves slug as hidden input when editing', () => {
    const sampleEvent: AdminEvent = {
      id: '84e643b6-fe8c-453a-b7d9-30df2a1ff528',
      title: 'Health Checkup Camp',
      slug: 'health-checkup-camp',
      summary: 'Free general health checkup for elderly residents.',
      description: 'Comprehensive screening including blood pressure and sugar tests.',
      coverImage: 'https://images.sailent.org/camp.webp',
      startDate: '2026-11-20T04:00:00.000Z',
      endDate: '2026-11-20T08:30:00.000Z',
      timezone: 'Asia/Kolkata',
      venueName: 'Community Center',
      address: '123 Main Street',
      city: 'Ranchi',
      state: 'Jharkhand',
      location: null,
      isOnline: false,
      meetingUrl: null,
      organizer: null,
      capacity: 100,
      registeredCount: 25,
      isPaid: false,
      feeAmount: null,
      registrationStatus: 'open',
      status: 'published',
      publishedAt: '2026-11-01T00:00:00.000Z',
      registrationDeadline: '2026-11-19T18:29:59.000Z',
      programId: samplePrograms[0]!.id,
      campaignId: null,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    };

    const { container } = render(<EventForm event={sampleEvent} programs={samplePrograms} />);

    // Preserved hidden fields for id and slug
    expect(container.querySelector('input[name="id"]')).toHaveValue(sampleEvent.id);
    expect(container.querySelector('input[name="slug"]')).toHaveValue(sampleEvent.slug);

    // Initial capacity populated
    expect(screen.getByLabelText(/Total Seats \/ Capacity/i)).toHaveValue(100);
    // Initial title populated
    expect(screen.getByLabelText(/Title/i)).toHaveValue('Health Checkup Camp');
  });
});
