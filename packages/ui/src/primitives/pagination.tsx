import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '../lib/cn';
import { buttonVariants } from './button';

/**
 * Pagination (shadcn/ui). Real anchors that a crawler or user can follow.
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
  asChild?: boolean;
}

export function PaginationLink({
  className,
  isActive,
  asChild = false,
  ...props
}: PaginationLinkProps) {
  const Comp = asChild ? Slot : 'a';
  return (
    <Comp
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'icon' }),
        'size-9 min-w-9 cursor-pointer rounded-lg text-xs font-medium',
        isActive &&
          'border-primary bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground',
        className,
      )}
      {...props}
    />
  );
}

export type PaginationPreviousProps = PaginationLinkProps;

export function PaginationPrevious({ className, children, ...props }: PaginationPreviousProps) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      className={cn('w-auto gap-1.5 pl-2.5 pr-3 text-xs font-medium', className)}
      {...props}
    >
      {children ?? (
        <>
          <ChevronLeft aria-hidden="true" className="size-4" />
          <span>Previous</span>
        </>
      )}
    </PaginationLink>
  );
}

export type PaginationNextProps = PaginationLinkProps;

export function PaginationNext({ className, children, ...props }: PaginationNextProps) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      className={cn('w-auto gap-1.5 pl-3 pr-2.5 text-xs font-medium', className)}
      {...props}
    >
      {children ?? (
        <>
          <span>Next</span>
          <ChevronRight aria-hidden="true" className="size-4" />
        </>
      )}
    </PaginationLink>
  );
}

export function PaginationEllipsis({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      aria-hidden="true"
      className={cn('text-muted-foreground flex size-9 items-center justify-center', className)}
      {...props}
    >
      <span aria-hidden="true">&hellip;</span>
      <span className="sr-only">More pages</span>
    </span>
  );
}
