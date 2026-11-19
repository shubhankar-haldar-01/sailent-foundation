import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminBreadcrumbs } from '../admin-breadcrumbs';

let mockPathname = '/admin';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('AdminBreadcrumbs', () => {
  beforeEach(() => {
    mockPathname = '/admin';
    window.sessionStorage.clear();
  });

  it('renders Dashboard for root admin path', () => {
    mockPathname = '/admin';
    render(<AdminBreadcrumbs />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders group and section crumbs for listing page', () => {
    mockPathname = '/admin/events';
    render(<AdminBreadcrumbs />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Programs & work')).toBeInTheDocument();
    expect(screen.getByText('Events')).toBeInTheDocument();
  });

  it('renders New crumb for creation page', () => {
    mockPathname = '/admin/events/new';
    render(<AdminBreadcrumbs />);
    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('skips ID and renders Edit directly under Events on edit page (no 404 Detail crumb)', () => {
    mockPathname = '/admin/events/1f3d5973-ae88-4596-98d0-de65ff4f97b9/edit';
    render(<AdminBreadcrumbs />);

    // Should NOT contain 'Detail'
    expect(screen.queryByText('Detail')).not.toBeInTheDocument();

    // Should contain Events link and Edit page
    const eventsLink = screen.getByRole('link', { name: 'Events' });
    expect(eventsLink).toBeInTheDocument();
    expect(eventsLink).toHaveAttribute('href', '/admin/events');

    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('skips ID on campaign edit page', () => {
    mockPathname = '/admin/campaigns/1f3d5973-ae88-4596-98d0-de65ff4f97b9/edit';
    render(<AdminBreadcrumbs />);

    expect(screen.queryByText('Detail')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Campaigns' })).toHaveAttribute(
      'href',
      '/admin/campaigns',
    );
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('renders Edit link pointing to event edit and Attendees on event registrations page', () => {
    mockPathname = '/admin/events/1f3d5973-ae88-4596-98d0-de65ff4f97b9/registrations';
    render(<AdminBreadcrumbs />);

    expect(screen.queryByText('Detail')).not.toBeInTheDocument();

    const editLink = screen.getByRole('link', { name: 'Edit' });
    expect(editLink).toBeInTheDocument();
    expect(editLink).toHaveAttribute(
      'href',
      '/admin/events/1f3d5973-ae88-4596-98d0-de65ff4f97b9/edit',
    );

    expect(screen.getByText('Attendees')).toBeInTheDocument();
  });

  it('renders Detail for entity views where ID is the terminal segment', () => {
    mockPathname = '/admin/donors/1f3d5973-ae88-4596-98d0-de65ff4f97b9';
    render(<AdminBreadcrumbs />);

    expect(screen.getByRole('link', { name: 'Donors' })).toHaveAttribute('href', '/admin/donors');
    expect(screen.getByText('Detail')).toBeInTheDocument();
  });

  it('renders clean breadcrumb for draft campaign preview without intermediate 404 links', () => {
    mockPathname = '/admin/preview/campaign/water-well-project';
    render(<AdminBreadcrumbs />);

    expect(screen.getByText('Fundraising')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Campaigns' });
    expect(link).toHaveAttribute('href', '/admin/campaigns');
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('renders clean breadcrumb for draft program preview without intermediate 404 links', () => {
    mockPathname = '/admin/preview/program/education-for-all';
    render(<AdminBreadcrumbs />);

    expect(screen.getByText('Programs & work')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Programs' });
    expect(link).toHaveAttribute('href', '/admin/programs');
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });
});
