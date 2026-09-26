import * as React from 'react';
import { ChevronRight } from 'lucide-react';

import { cn } from '../lib/cn';

/**
 * Breadcrumb.
 *
 * The visible trail must match the BreadcrumbList structured data exactly —
 * markup that disagrees with the page is a search-guidelines violation
 * (docs/seo-strategy.md §5).
 */
export function Breadcrumb({ className, ...props }: React.ComponentPropsWithoutRef<'nav'>) {
  return <nav aria-label="Breadcrumb" className={cn('text-body-sm', className)} {...props} />;
}

export function BreadcrumbList({ className, ...props }: React.ComponentPropsWithoutRef<'ol'>) {
  return (
    <ol
      className={cn('text-muted-foreground flex flex-wrap items-center gap-1.5', className)}
      {...props}
    />
  );
}

export function BreadcrumbItem({ className, ...props }: React.ComponentPropsWithoutRef<'li'>) {
  return <li className={cn('inline-flex items-center gap-1.5', className)} {...props} />;
}

export function BreadcrumbLink({ className, ...props }: React.ComponentPropsWithoutRef<'a'>) {
  return (
    <a
      className={cn(
        'hover:text-foreground rounded-sm transition-colors',
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      )}
      {...props}
    />
  );
}

export function BreadcrumbPage({ className, ...props }: React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span aria-current="page" className={cn('text-foreground font-medium', className)} {...props} />
  );
}

export function BreadcrumbSeparator({ className, ...props }: React.ComponentPropsWithoutRef<'li'>) {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cn('[&>svg]:size-3.5', className)}
      {...props}
    >
      <ChevronRight />
    </li>
  );
}
