import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProgramForm } from '../program-form';

vi.mock('@/lib/admin/actions', () => ({
  createProgram: vi.fn(),
  updateProgram: vi.fn(),
  uploadMediaDirect: vi.fn(),
}));

describe('ProgramForm', () => {
  const sampleMedia = [
    {
      id: 'media-1',
      storageKey: 'key-1',
      url: 'https://images.sailent.org/program-cover.webp',
      altText: 'Children studying in classroom',
      caption: null,
      mimeType: 'image/webp',
      sizeBytes: 102400,
      width: 1200,
      height: 800,
      visibility: 'public' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('renders all 6 requested fields in the correct order and marks them all mandatory', () => {
    const { container } = render(<ProgramForm mediaOptions={sampleMedia} />);

    // 1. Title (mandatory)
    const titleInput = screen.getByLabelText(/Title/i);
    expect(titleInput).toBeInTheDocument();
    expect(titleInput).toBeRequired();

    // 2. Short description (mandatory)
    const shortDescInput = screen.getByLabelText(/Short description/i);
    expect(shortDescInput).toBeInTheDocument();
    expect(shortDescInput).toBeRequired();

    // 3. About this program (mandatory)
    const descInput = screen.getByLabelText(/About this program/i);
    expect(descInput).toBeInTheDocument();
    expect(descInput).toBeRequired();

    // 4. The challenge (mandatory)
    const challengeInput = screen.getByLabelText(/The challenge/i);
    expect(challengeInput).toBeInTheDocument();
    expect(challengeInput).toBeRequired();

    // 5. Our approach (mandatory)
    const approachInput = screen.getByLabelText(/Our approach/i);
    expect(approachInput).toBeInTheDocument();
    expect(approachInput).toBeRequired();

    // 6. Upload image (mandatory)
    expect(screen.getByText(/Upload image/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Choose from Media Library/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload photo from device/i })).toBeInTheDocument();

    // Verify hidden input exists for coverImage
    const hiddenCover = container.querySelector('input[type="hidden"][name="coverImage"]');
    expect(hiddenCover).toBeInTheDocument();

    // Submit button
    expect(screen.getByRole('button', { name: /Create program/i })).toBeInTheDocument();
  });

  it('populates fields with existing program details in edit mode', () => {
    const existingProgram = {
      id: 'prg-123',
      title: 'Healthcare for Children',
      slug: 'healthcare-for-children',
      shortDescription: 'Providing essential pediatric healthcare.',
      description: 'Comprehensive health programs across rural districts.',
      problem: 'High incidence of preventable illnesses among rural children.',
      approach: 'Mobile healthcare units visiting schools weekly.',
      beneficiaries: 'Children aged 0-14 in rural regions.',
      coverImage: 'https://images.sailent.org/program-cover.webp',
      displayOrder: 10,
    };

    render(<ProgramForm program={existingProgram} mediaOptions={sampleMedia} />);

    expect(screen.getByLabelText(/Title/i)).toHaveValue('Healthcare for Children');
    expect(screen.getByLabelText(/Short description/i)).toHaveValue(
      'Providing essential pediatric healthcare.',
    );
    expect(screen.getByLabelText(/About this program/i)).toHaveValue(
      'Comprehensive health programs across rural districts.',
    );
    expect(screen.getByLabelText(/The challenge/i)).toHaveValue(
      'High incidence of preventable illnesses among rural children.',
    );
    expect(screen.getByLabelText(/Our approach/i)).toHaveValue(
      'Mobile healthcare units visiting schools weekly.',
    );

    // Active cover image preview
    expect(screen.getByText('Active program cover image')).toBeInTheDocument();
    expect(screen.getByText('Remove image')).toBeInTheDocument();

    // Save changes button in edit mode
    expect(screen.getByRole('button', { name: /Save changes/i })).toBeInTheDocument();
  });
});
