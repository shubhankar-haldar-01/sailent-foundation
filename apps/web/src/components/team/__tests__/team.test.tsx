import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TeamHero } from '../team-hero';
import { LeadershipCard } from '../leadership-card';
import { MemberCard } from '../member-card';
import { TeamDirectory } from '../team-directory';
import { teamMembers } from '@/lib/mock/team';

describe('Team Components', () => {
  it('renders TeamHero with heading, breadcrumbs, and banner image', () => {
    render(<TeamHero />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Meet Our Team/i);
    expect(screen.getByRole('navigation', { name: /Breadcrumb/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'About Us' })).toHaveAttribute('href', '/about');
    expect(
      screen.getByRole('img', { name: /Sailent Foundation coordinator with children/i }),
    ).toBeInTheDocument();
  });

  it('renders LeadershipCard with image, name, and designation only', () => {
    const leader = teamMembers.find((m) => m.slug === 'shubhankar-haldar')!;
    render(<LeadershipCard member={leader} />);

    expect(
      screen.getByRole('heading', { level: 3, name: 'Shubhankar Haldar' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Co-Founder & Director')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Portrait of Shubhankar Haldar/i })).toBeInTheDocument();
    expect(screen.queryByText(/Passionate about technology/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders MemberCard with image, name, and designation only', () => {
    const member = teamMembers.find((m) => m.slug === 'priya-mehta')!;
    render(<MemberCard member={member} />);

    expect(screen.getByRole('heading', { level: 3, name: 'Priya Mehta' })).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Portrait of Priya Mehta/i })).toBeInTheDocument();
    expect(screen.queryByText(/Handles content, storytelling/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders team directory without leadership section and filters by department and search query', () => {
    render(<TeamDirectory initialMembers={teamMembers} />);

    // Leadership section is not present on the public team page
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Leadership Team' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Our Team' })).toBeInTheDocument();

    // Click 'Programmes' filter
    const programmesBtn = screen.getByRole('button', { name: /Programmes/i });
    fireEvent.click(programmesBtn);

    expect(screen.getByRole('heading', { level: 2, name: 'Our Team' })).toBeInTheDocument();
    expect(screen.getByText('Priya Mehta')).toBeInTheDocument();

    // Search for a specific member
    const searchInput = screen.getByPlaceholderText('Search team members...');
    fireEvent.change(searchInput, { target: { value: 'Karan' } });

    expect(screen.getByText('Karan Joshi')).toBeInTheDocument();
    expect(screen.queryByText('Priya Mehta')).not.toBeInTheDocument();
  });
});
