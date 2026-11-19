import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminPagination } from '../admin-pagination';

describe('AdminPagination', () => {
  it('renders nothing when totalPages is 0 or totalItems is 0', () => {
    const { container, rerender } = render(
      <AdminPagination
        page={1}
        totalPages={0}
        totalItems={0}
        makeHref={(p) => `/admin/test?page=${p}`}
      />,
    );
    expect(container.firstChild).toBeNull();

    rerender(
      <AdminPagination
        page={1}
        totalPages={1}
        totalItems={0}
        makeHref={(p) => `/admin/test?page=${p}`}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders single page indicator with disabled controls when totalPages is 1 and has items', () => {
    render(
      <AdminPagination
        page={1}
        totalPages={1}
        totalItems={5}
        makeHref={(p) => `/admin/test?page=${p}`}
      />,
    );

    expect(screen.getByText(/showing page/i)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toHaveClass('pointer-events-none');
    expect(screen.getByText('Next')).toHaveClass('pointer-events-none');
    expect(screen.getByRole('link', { name: '1' })).toBeInTheDocument();
  });

  it('renders page items and info when totalPages > 1', () => {
    render(
      <AdminPagination
        page={2}
        totalPages={5}
        totalItems={50}
        makeHref={(p) => `/admin/test?page=${p}`}
      />,
    );

    expect(screen.getByText(/showing page/i)).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();

    // Check page links
    expect(screen.getByRole('link', { name: '1' })).toHaveAttribute('href', '/admin/test?page=1');
    expect(screen.getByRole('link', { name: '2' })).toHaveAttribute('href', '/admin/test?page=2');
    expect(screen.getByRole('link', { name: '5' })).toHaveAttribute('href', '/admin/test?page=5');

    // Previous and Next are active links
    expect(screen.getByRole('link', { name: /previous/i })).toHaveAttribute(
      'href',
      '/admin/test?page=1',
    );
    expect(screen.getByRole('link', { name: /next/i })).toHaveAttribute(
      'href',
      '/admin/test?page=3',
    );
  });

  it('disables Previous on first page and Next on last page', () => {
    const { rerender } = render(
      <AdminPagination
        page={1}
        totalPages={3}
        totalItems={30}
        makeHref={(p) => `/admin/test?page=${p}`}
      />,
    );

    // Previous is disabled text, not a link
    expect(screen.queryByRole('link', { name: /previous/i })).toBeNull();
    expect(screen.getByText('Previous')).toHaveClass('pointer-events-none');

    // Next is a link
    expect(screen.getByRole('link', { name: /next/i })).toHaveAttribute(
      'href',
      '/admin/test?page=2',
    );

    // Rerender on last page
    rerender(
      <AdminPagination
        page={3}
        totalPages={3}
        totalItems={30}
        makeHref={(p) => `/admin/test?page=${p}`}
      />,
    );

    // Next is disabled text, not a link
    expect(screen.queryByRole('link', { name: /next/i })).toBeNull();
    expect(screen.getByText('Next')).toHaveClass('pointer-events-none');
    expect(screen.getByRole('link', { name: /previous/i })).toHaveAttribute(
      'href',
      '/admin/test?page=2',
    );
  });

  it('renders ellipses for large page counts', () => {
    render(
      <AdminPagination
        page={5}
        totalPages={20}
        totalItems={200}
        makeHref={(p) => `/admin/test?page=${p}`}
      />,
    );

    expect(screen.getAllByText('More pages').length).toBeGreaterThan(0);
  });
});
