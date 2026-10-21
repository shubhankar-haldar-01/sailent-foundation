import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { Story } from '@/lib/mock/types';
import { FeaturedStory } from '../featured-story';
import { StoryCard } from '../story-card';
import { StoryFilters } from '../story-filters';

const sampleStory: Story = {
  slug: 'sunita-finished-school',
  title: 'A New Beginning for Meera',
  summary:
    'From a small village to a brighter future — Meera’s journey shows what’s possible with education.',
  subjectName: 'Meera',
  location: 'Ranchi, Jharkhand',
  category: 'Education',
  programName: 'Education',
  programSlug: 'education',
  campaignSlug: 'school-kits-jharkhand',
  publishedAt: '2026-10-01T00:00:00+05:30',
  consentRecorded: true,
  isFeatured: true,
  challenge: '',
  intervention: '',
  journey: '',
  outcome: '',
  impact: '',
  cover: { seed: 'story-meera', alt: 'Meera in school' },
  gallery: [],
};

const healthcareStory: Story = {
  slug: 'a-healthier-season-for-ramesh',
  title: 'A Healthier Tomorrow for Ramesh',
  summary: 'The medical support I received changed my life.',
  subjectName: 'Ramesh',
  location: 'Bastar, Chhattisgarh',
  category: 'Healthcare',
  programName: 'Healthcare',
  programSlug: 'healthcare',
  campaignSlug: 'mobile-health-clinic-bastar',
  publishedAt: '2026-09-30T00:00:00+05:30',
  consentRecorded: true,
  isFeatured: false,
  challenge: '',
  intervention: '',
  journey: '',
  outcome: '',
  impact: '',
  cover: { seed: 'story-ramesh', alt: 'Ramesh portrait' },
  gallery: [],
};

describe('StoryFilters', () => {
  it('renders "All Stories" as active by default with brand orange styling', () => {
    render(<StoryFilters categories={['Education', 'Healthcare']} current={null} />);

    const allLink = screen.getByRole('link', { name: /all stories/i });
    expect(allLink).toHaveAttribute('aria-current', 'page');
    expect(allLink.className).toContain('bg-primary');
    // The label colour of an orange fill is the token: navy since 2026-10-21 (AA).
    expect(allLink.className).toContain('text-primary-foreground');
  });

  it('renders category filter pills with icons', () => {
    render(<StoryFilters categories={['Education', 'Healthcare']} current={null} />);

    const eduLink = screen.getByRole('link', { name: /education/i });
    expect(eduLink).toBeInTheDocument();
    expect(eduLink).toHaveAttribute('href', '/stories?category=Education');

    const healthLink = screen.getByRole('link', { name: /healthcare/i });
    expect(healthLink).toBeInTheDocument();
    expect(healthLink).toHaveAttribute('href', '/stories?category=Healthcare');
  });

  it('marks selected category as active with aria-current="page"', () => {
    render(<StoryFilters categories={['Education', 'Healthcare']} current="Education" />);

    const eduLink = screen.getByRole('link', { name: /education/i });
    expect(eduLink).toHaveAttribute('aria-current', 'page');
    expect(eduLink.className).toContain('bg-primary');
  });
});

describe('FeaturedStory', () => {
  it('renders featured story badge, title, summary, location, date, and button', () => {
    render(<FeaturedStory story={sampleStory} />);

    expect(screen.getByText('Featured Story')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'A New Beginning for Meera' })).toBeInTheDocument();
    expect(screen.getByText(/From a small village to a brighter future/)).toBeInTheDocument();
    expect(screen.getByText('Ranchi, Jharkhand')).toBeInTheDocument();
    expect(screen.getByText('01 Oct 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /read full story/i })).toHaveAttribute(
      'href',
      '/stories/sunita-finished-school',
    );
  });

  it('displays category badge on the image', () => {
    render(<FeaturedStory story={sampleStory} />);
    expect(screen.getByText('Education')).toBeInTheDocument();
  });
});

describe('StoryCard', () => {
  it('renders supporting story with title, summary, category badge, and Read Story action', () => {
    render(<StoryCard story={healthcareStory} />);

    expect(
      screen.getByRole('heading', { name: 'A Healthier Tomorrow for Ramesh' }),
    ).toBeInTheDocument();
    expect(screen.getByText('The medical support I received changed my life.')).toBeInTheDocument();
    expect(screen.getByText('Healthcare')).toBeInTheDocument();
    expect(screen.getByText('Bastar, Chhattisgarh')).toBeInTheDocument();
    expect(screen.getByText('30 Sep 2026')).toBeInTheDocument();
    expect(screen.getByText('Read Story')).toBeInTheDocument();
  });
});
