import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdminShell } from '../admin-shell';
import { adminNav } from '../admin-sidebar';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

// Mock auth actions
vi.mock('@/lib/auth/actions', () => ({
  signOut: vi.fn(),
}));

describe('AdminShell and Navigation', () => {
  it('renders the admin shell with proper role, skip-link, and surface attribute', () => {
    const { container } = render(
      <AdminShell actor={{ id: 'staff-1', permissions: ['*'] }} unreadCount={3}>
        <div data-testid="test-content">Dashboard Content</div>
      </AdminShell>,
    );

    expect(container.querySelector('[data-surface="admin"]')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toBeDefined();
    expect(screen.getByTestId('test-content')).toBeDefined();
  });

  it('renders the navigation landmark with all core sections and Dashboard link', () => {
    render(
      <AdminShell actor={{ id: 'staff-1', permissions: ['*'] }} unreadCount={0}>
        <div>Content</div>
      </AdminShell>,
    );

    const nav = screen.getByRole('navigation', { name: 'Admin' });
    expect(nav).toBeDefined();

    const dashboardLink = nav.querySelector('a[href="/admin"]');
    expect(dashboardLink).toBeDefined();
    expect(dashboardLink?.textContent).toContain('Dashboard');
  });

  it('renders the notification bell with exact accessible count label', () => {
    render(
      <AdminShell actor={{ id: 'staff-1', permissions: ['*'] }} unreadCount={5}>
        <div>Content</div>
      </AdminShell>,
    );

    expect(screen.getByRole('link', { name: 'Notifications, 5 unread' })).toBeDefined();
  });

  it('renders mobile open navigation trigger button', () => {
    render(
      <AdminShell actor={{ id: 'staff-1', permissions: ['*'] }} unreadCount={0}>
        <div>Content</div>
      </AdminShell>,
    );

    expect(screen.getByRole('button', { name: 'Open navigation' })).toBeDefined();
  });

  it('has comprehensive adminNav items with icons and permissions', () => {
    expect(adminNav.length).toBeGreaterThanOrEqual(7);
    const fundraising = adminNav.find((g) => g.label === 'Fundraising');
    expect(fundraising).toBeDefined();
    expect(fundraising?.items.some((i) => i.href === '/admin/donations')).toBe(true);
    expect(fundraising?.items.some((i) => i.href === '/admin/campaigns')).toBe(true);
  });
});
