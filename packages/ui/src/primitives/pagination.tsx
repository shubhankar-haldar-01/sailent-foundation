import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '../lib/cn';
import { buttonVariants } from './button';

/**
 * Pagination. Real anchors that a crawler can follow — never an infinite
 * scroll that hides content behind an event handler and makes the footer
 * unreachable (docs/information-architecture.md §5.1).
 */
export function Pagination({ className, ...props }: React.ComponentPropsWithoutRef<'nav'>) {
  return (
    <nav
      aria-label="Pagination"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  );
}

export function PaginationContent({ className, ...props }: React.ComponentPropsWithoutRef<'ul'>) {
  return <ul className={cn('flex flex-row items-center gap-1', className)} {...props} />;
}

export function PaginationItem(props: React.ComponentPropsWithoutRef<'li'>) {
  return <li {...props} />;
}

export interface PaginationLinkProps extends React.ComponentPropsWithoutRef<'a'> {
  isActive?: boolean;
}

export function PaginationLink({ className, isActive, ...props }: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'icon' }),
        'size-10',
        className,
      )}
      {...props}
    />
  );
}

export function PaginationPrevious({ className, ...props }: React.ComponentPropsWithoutRef<'a'>) {
  return (
    <a
      aria-label="Go to previous page"
      className={cn(buttonVariants({ variant: 'ghost', size: 'md' }), 'gap-1 pl-2.5', className)}
      {...props}
    >
      <ChevronLeft aria-hidden="true" />
      <span>Previous</span>
    </a>
  );
}

export function PaginationNext({ className, ...props }: React.ComponentPropsWithoutRef<'a'>) {
  return (
    <a
      aria-label="Go to next page"
      className={cn(buttonVariants({ variant: 'ghost', size: 'md' }), 'gap-1 pr-2.5', className)}
      {...props}
    >
      <span>Next</span>
      <ChevronRight aria-hidden="true" />
    </a>
  );
}

export function PaginationEllipsis({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      aria-hidden="true"
      className={cn('flex size-10 items-center justify-center', className)}
      {...props}
    >
      &hellip;
    </span>
  );
}
