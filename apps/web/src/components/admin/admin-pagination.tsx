import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@sailent/ui';

export interface AdminPaginationProps {
  page: number;
  totalPages: number;
  makeHref: (page: number) => string;
  totalItems?: number;
  className?: string;
  ariaLabel?: string;
}

/**
 * Generate visible page numbers and ellipses for pagination.
 * Gives a clean sequence like [1, 2, 3, 4, 5, 'ellipsis', 20]
 * or [1, 'ellipsis', 4, 5, 6, 'ellipsis', 20].
 */
function getPageItems(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      'ellipsis',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}

export function AdminPagination({
  page,
  totalPages,
  makeHref,
  totalItems,
  className,
  ariaLabel = 'Pagination',
}: AdminPaginationProps) {
  if (totalPages <= 0 || (totalItems !== undefined && totalItems === 0)) return null;

  const pageItems = getPageItems(page, totalPages);
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <div
      className={`flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between ${className ?? ''}`}
    >
      <p className="text-caption text-muted-foreground">
        Showing page <span className="text-foreground font-semibold tabular-nums">{page}</span> of{' '}
        <span className="text-foreground font-semibold tabular-nums">{totalPages}</span>
        {totalItems !== undefined ? (
          <>
            {' '}
            (<span className="text-foreground font-semibold tabular-nums">{totalItems}</span> total)
          </>
        ) : null}
      </p>

      <Pagination aria-label={ariaLabel} className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            {hasPrevious ? (
              <PaginationPrevious asChild>
                <Link href={makeHref(page - 1)}>
                  <ChevronLeft aria-hidden="true" className="size-4" />
                  <span>Previous</span>
                </Link>
              </PaginationPrevious>
            ) : (
              <span className="text-muted-foreground/40 pointer-events-none inline-flex items-center gap-1.5 px-3 py-2 text-xs">
                Previous
              </span>
            )}
          </PaginationItem>

          {pageItems.map((item, idx) => (
            <PaginationItem key={item === 'ellipsis' ? `ellipsis-${idx}` : item}>
              {item === 'ellipsis' ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink asChild isActive={item === page}>
                  <Link href={makeHref(item)}>{item}</Link>
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            {hasNext ? (
              <PaginationNext asChild>
                <Link href={makeHref(page + 1)}>
                  <span>Next</span>
                  <ChevronRight aria-hidden="true" className="size-4" />
                </Link>
              </PaginationNext>
            ) : (
              <span className="text-muted-foreground/40 pointer-events-none inline-flex items-center gap-1.5 px-3 py-2 text-xs">
                Next
              </span>
            )}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
