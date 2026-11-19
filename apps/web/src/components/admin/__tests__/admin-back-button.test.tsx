import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { AdminBackButton } from '../admin-back-button';

describe('AdminBackButton', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/admin/team/123/edit');
  });

  it('renders with fallback href when no session or query param exists', () => {
    render(<AdminBackButton href="/admin/team">Back to team</AdminBackButton>);
    const link = screen.getByRole('link', { name: /back to team/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/team');
  });

  it('uses remembered list URL with page number from sessionStorage', () => {
    window.sessionStorage.setItem('admin_list_url:/admin/team', '/admin/team?page=2&status=draft');
    render(<AdminBackButton href="/admin/team">Back to team</AdminBackButton>);
    const link = screen.getByRole('link', { name: /back to team/i });
    expect(link).toHaveAttribute('href', '/admin/team?page=2&status=draft');
  });

  it('uses page parameter from current URL when present', () => {
    window.history.replaceState({}, '', '/admin/team/123/edit?page=3');
    render(<AdminBackButton href="/admin/team">Back to team</AdminBackButton>);
    const link = screen.getByRole('link', { name: /back to team/i });
    expect(link).toHaveAttribute('href', '/admin/team?page=3');
  });

  it('prioritizes explicit returnTo parameter over sessionStorage', () => {
    window.sessionStorage.setItem('admin_list_url:/admin/team', '/admin/team?page=1');
    window.history.replaceState({}, '', '/admin/team/123/edit?returnTo=%2Fadmin%2Fteam%3Fpage%3D4');
    render(<AdminBackButton href="/admin/team">Back to team</AdminBackButton>);
    const link = screen.getByRole('link', { name: /back to team/i });
    expect(link).toHaveAttribute('href', '/admin/team?page=4');
  });
});
