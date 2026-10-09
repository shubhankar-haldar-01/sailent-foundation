import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { Program } from '@/lib/mock/types';

import { ProgramCard } from '../program-card';

const base: Program = {
  slug: 'healthcare',
  name: 'Healthcare',
  category: 'Healthcare',
  tagline: 'Basic care, close to home',
  shortDescription: 'Mobile clinics and medicines in villages far from a hospital.',
  activeCampaignCount: 1,
  // No `url`, so the frame draws its placeholder rather than a next/image.
  cover: { seed: 'program-healthcare', alt: 'Healthcare program' },
  accentIcon: 'heart',
  problem: '',
  approach: '',
  beneficiaries: '',
  goals: [],
  activities: [],
  metrics: [],
  locations: [],
};

describe('ProgramCard', () => {
  it('is one link, named by the programme, to its page', () => {
    render(<ProgramCard program={base} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName('Healthcare');
    expect(links[0]).toHaveAttribute('href', '/programs/healthcare');
  });

  it('counts open campaigns in words, singular and plural', () => {
    const { rerender } = render(<ProgramCard program={base} />);
    expect(screen.getByText(/active campaign$/)).toHaveTextContent('1 active campaign');

    rerender(<ProgramCard program={{ ...base, activeCampaignCount: 2 }} />);
    expect(screen.getByText(/active campaigns$/)).toHaveTextContent('2 active campaigns');
  });

  it('says "Ongoing program" rather than "0 active campaigns"', () => {
    render(<ProgramCard program={{ ...base, activeCampaignCount: 0 }} />);
    expect(screen.getByText('Ongoing program')).toBeInTheDocument();
    expect(screen.queryByText(/0 active/)).not.toBeInTheDocument();
  });

  it('falls back to the tagline when there is no short description', () => {
    render(<ProgramCard program={{ ...base, shortDescription: '' }} />);
    expect(screen.getByText('Basic care, close to home')).toBeInTheDocument();
  });
});
