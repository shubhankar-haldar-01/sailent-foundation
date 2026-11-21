import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DeleteTeamMemberButton } from '../delete-team-member';

vi.mock('@/lib/admin/actions', () => ({
  deleteTeamMember: vi.fn(),
}));

describe('DeleteTeamMemberButton', () => {
  it('renders delete button with given label', () => {
    render(<DeleteTeamMemberButton id="member-1" name="Shubhankar Haldar" label="Delete member" />);
    expect(screen.getByRole('button', { name: 'Delete member' })).toBeInTheDocument();
  });

  it('opens confirmation dialog on click with warning message', () => {
    render(<DeleteTeamMemberButton id="member-1" name="Shubhankar Haldar" />);
    const btn = screen.getByRole('button', { name: 'Delete member' });
    fireEvent.click(btn);

    expect(screen.getByText('Delete “Shubhankar Haldar”?')).toBeInTheDocument();
    expect(
      screen.getByText(/This will permanently delete this team member profile from the database/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Permanently' })).toBeInTheDocument();
  });
});
