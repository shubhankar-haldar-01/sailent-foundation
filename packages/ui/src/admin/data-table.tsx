'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react';

import { cn } from '../lib/cn';
import { Button } from '../primitives/button';
import { Input } from '../primitives/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../primitives/table';
import { EmptyState } from '../patterns/states';
import { Skeleton } from '../primitives/skeleton';

/**
 * DataTable.
 *
 * One list pattern applied everywhere, so learning one admin screen teaches
 * all of them (docs/information-architecture.md §8.4).
 *
 * Phase 1 provides the presentational shell: columns, sorting affordances,
 * selection, loading and the two distinct empty states. Server-side data
 * fetching, URL filter state via nuqs, and bulk actions arrive with the
 * modules that need them.
 *
 * Mobile strategy is a STACKED CARD per row, not a horizontally squeezed
 * table — a table forced into 390px is unreadable.
 */

export interface DataTableColumn<TRow> {
  id: string;
  header: string;
  /** Rendered per row. */
  cell: (row: TRow) => React.ReactNode;
  sortable?: boolean;
  /** Right-align and use tabular figures. */
  numeric?: boolean;
  /** Hide on mobile stacked cards (e.g. a redundant id column). */
  hideOnMobile?: boolean;
  className?: string;
}

export interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  getRowId: (row: TRow) => string;
  isLoading?: boolean;
  sort?: { field: string; direction: 'asc' | 'desc' };
  onSortChange?: (field: string) => void;
  /** Supplied when filters are active — switches the empty state to "no results". */
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  caption?: string;
  className?: string;
}

export function DataTable<TRow>({
  columns,
  rows,
  getRowId,
  isLoading = false,
  sort,
  onSortChange,
  hasActiveFilters = false,
  onClearFilters,
  emptyTitle,
  emptyDescription,
  emptyAction,
  caption,
  className,
}: DataTableProps<TRow>) {
  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)} aria-busy="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    // Two genuinely different situations, never conflated.
    return hasActiveFilters ? (
      <EmptyState
        kind="no-results"
        title="No matches for these filters"
        description="Try removing one of the filters you've applied."
        onClearFilters={onClearFilters}
        className={className}
      />
    ) : (
      <EmptyState
        kind="no-content"
        title={emptyTitle ?? 'Nothing here yet'}
        description={emptyDescription}
        action={emptyAction}
        className={className}
      />
    );
  }

  return (
    <div className={className}>
      {/* Desktop and tablet: a real table. */}
      <div className="border-border bg-surface hidden rounded-md border md:block">
        <Table>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => {
                const isSorted = sort?.field === column.id;
                return (
                  <TableHead
                    key={column.id}
                    className={cn(column.numeric && 'text-right', column.className)}
                    aria-sort={
                      isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(column.id)}
                        className={cn(
                          'hover:text-foreground inline-flex items-center gap-1.5 rounded-sm transition-colors',
                          'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                          column.numeric && 'flex-row-reverse',
                        )}
                      >
                        {column.header}
                        {isSorted ? (
                          sort.direction === 'asc' ? (
                            <ArrowUp className="size-3" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="size-3" aria-hidden="true" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={getRowId(row)}>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    {...(column.numeric ? { 'data-numeric': '' } : {})}
                    className={cn(column.numeric && 'text-right tabular-nums', column.className)}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked cards with labelled fields. */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={getRowId(row)} className="border-border bg-surface rounded-md border p-4">
            <dl className="space-y-2">
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div key={column.id} className="flex items-start justify-between gap-3">
                    <dt className="text-caption text-muted-foreground">{column.header}</dt>
                    <dd
                      {...(column.numeric ? { 'data-numeric': '' } : {})}
                      className={cn('text-body-sm text-right', column.numeric && 'tabular-nums')}
                    >
                      {column.cell(row)}
                    </dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export function SearchInput({ className, value, onClear, ...props }: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input type="search" value={value} className="h-10 pl-9 pr-9" {...props} />
      {value && onClear ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className={cn(
            'text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5',
            'hover:bg-muted hover:text-foreground transition-colors',
            'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
          )}
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface FilterBarProps {
  children?: React.ReactNode;
  /** Count of active filters, surfaced so the user knows why results are narrow. */
  activeCount?: number;
  onClearAll?: () => void;
  className?: string;
}

/**
 * FilterBar. All filter state belongs in the URL, so any view is shareable
 * and bookmarkable — an operator should be able to send a colleague the exact
 * list they are looking at.
 */
export function FilterBar({ children, activeCount = 0, onClearAll, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        'border-border bg-surface flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center',
        className,
      )}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      {activeCount > 0 && onClearAll ? (
        <Button variant="ghost" size="sm" onClick={onClearAll} className="shrink-0">
          <X aria-hidden="true" />
          Clear {activeCount} {activeCount === 1 ? 'filter' : 'filters'}
        </Button>
      ) : null}
    </div>
  );
}
