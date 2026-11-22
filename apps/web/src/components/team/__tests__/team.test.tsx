import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LeadershipCard } from '../leadership-card';
import { MemberCard } from '../member-card';
import { TeamDirectory } from '../team-directory';
import { teamMembers } from '@/lib/mock/team';

describe('Team Components', () => {
  it('opens with the editorial hero: a visible h1 and breadcrumb, and no banner (owner, 2026-11-22)', () => {
    render(<TeamDirectory initialMembers={teamMembers} />);

    const heading = screen.getByRole('heading', {
      level: 1,
      name: 'The people behind every possibility.',
    });
    expect(heading.closest('.sr-only')).toBeNull();
    const trail = screen.getByRole('navigation', { name: /Breadcrumb/i });
    expect(trail).toHaveTextContent(/Home/);
    expect(trail).toHaveTextContent(/Team/);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    // The banner photograph is gone; the only pictures are the team's own.
    expect(
      screen.queryByRole('img', { name: /Sailent Foundation coordinator with children/i }),
    ).not.toBeInTheDocument();
  });

  it('says what the page is in the brief’s words, and "Meet our team" leads to the grid', () => {
    const staff = teamMembers.filter((m) => m.department !== 'Leadership');
    render(<TeamDirectory initialMembers={teamMembers} />);

    expect(screen.getByText('Our people')).toBeInTheDocument();
    expect(
      screen.getByText(/Meet the people who share a vision of creating meaningful change/),
    ).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /Meet our team/ });
    expect(cta).toHaveAttribute('href', '#team-members');
    expect(document.getElementById('team-members')).not.toBeNull();
    // The head count, from the records: said once, as a number and its noun.
    expect(
      screen.getByText(
        (_, el) => el?.tagName === 'SPAN' && el.textContent === `${staff.length} team members`,
      ),
    ).toBeInTheDocument();
  });

  it('shows no portraits in the hero until genuine team photographs exist', () => {
    render(<TeamDirectory initialMembers={teamMembers} />);
    const hero = screen.getByRole('region', { name: 'The people behind every possibility.' });
    expect(hero.querySelectorAll('img')).toHaveLength(0);
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

  it('renders MemberCard with the portrait and the name under it, and nothing else', () => {
    const member = teamMembers.find((m) => m.slug === 'priya-mehta')!;
    render(<MemberCard member={member} />);

    expect(screen.getByRole('heading', { level: 3, name: 'Priya Mehta' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Portrait of Priya Mehta/i })).toBeInTheDocument();
    // Owner, 2026-11-22: every staff member is "Team", so no tag, no role, no
    // department and no responsibilities on the card.
    expect(screen.queryByText('Team')).not.toBeInTheDocument();
    expect(screen.queryByText('Programmes')).not.toBeInTheDocument();
    expect(screen.queryByText(/Handles content, storytelling/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders the team directory without leadership or department filters, with a search', () => {
    render(<TeamDirectory initialMembers={teamMembers} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Our team' })).toBeInTheDocument();
    // Leadership is on About, not here.
    expect(screen.queryByText('Shubhankar Haldar')).not.toBeInTheDocument();
    expect(screen.getByText('Priya Mehta')).toBeInTheDocument();

    // Owner, 2026-11-22: no department filters (everyone has the same role),
    // but the search stays.
    expect(screen.queryByRole('button', { name: /Programmes|Everyone/i })).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search team members' })).toBeInTheDocument();
  });

  it('searches names only, and says so when nobody matches', () => {
    render(<TeamDirectory initialMembers={teamMembers} />);
    const search = screen.getByRole('searchbox', { name: 'Search team members' });

    fireEvent.change(search, { target: { value: 'karan' } });
    expect(screen.getByText('Karan Joshi')).toBeInTheDocument();
    expect(screen.queryByText('Priya Mehta')).not.toBeInTheDocument();

    // A word that is only in a bio or a department finds nobody: a card shows
    // only a name, so a match must be visible on it.
    fireEvent.change(search, { target: { value: 'storytelling' } });
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(screen.getByText(/No one on the team is called/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('Priya Mehta')).toBeInTheDocument();
  });

  it('shows twelve people at first, and the rest on request', () => {
    const staff = teamMembers.filter((m) => m.department !== 'Leadership');
    render(<TeamDirectory initialMembers={teamMembers} />);

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(Math.min(staff.length, 12));
    if (staff.length > 12) {
      fireEvent.click(screen.getByRole('button', { name: /Show more people/i }));
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(Math.min(staff.length, 24));
    } else {
      expect(screen.queryByRole('button', { name: /Show more people/i })).not.toBeInTheDocument();
    }
  });

  it('never shows somebody else’s portrait for a member without a photograph', () => {
    const member = {
      ...teamMembers.find((m) => m.slug === 'priya-mehta')!,
      name: 'Asha Rao',
      photo: { seed: 'team-asha-rao', alt: '' },
    };
    render(<MemberCard member={member} />);

    expect(screen.getByRole('img', { name: 'No photograph of Asha Rao' })).toHaveTextContent('AR');
    expect(document.querySelector('img')).toBeNull();
  });
});
