import * as React from 'react';

import { cn } from '../lib/cn';

/**
 * Table primitives.
 *
 * The wrapper scrolls horizontally rather than letting the page do so — the
 * page body must never scroll sideways. On mobile, prefer the stacked-card
 * strategy in the admin DataTable over squeezing a table into 390px.
 */
export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    // tabIndex + role: a horizontally scrollable region that cannot receive
    // focus is unreachable by keyboard — axe flags it as
    // `scrollable-region-focusable`, and it genuinely strands anyone not using
    // a pointer.
    <div
      className="focus-visible:outline-ring relative w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2"
      tabIndex={0}
      role="region"
      aria-label="Table, scrollable horizontally"
    >
      <table
        className={cn('text-body-sm w-full caption-bottom border-collapse', className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('[&_tr]:border-border [&_tr]:border-b', className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot className={cn('border-border bg-muted/50 border-t font-medium', className)} {...props} />
  );
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-border hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  scope = 'col',
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={scope}
      className={cn(
        'text-caption text-muted-foreground h-11 px-3 text-left align-middle font-semibold',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-3 align-middle', className)} {...props} />;
}

export function TableCaption({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption className={cn('text-caption text-muted-foreground mt-4', className)} {...props} />
  );
}
