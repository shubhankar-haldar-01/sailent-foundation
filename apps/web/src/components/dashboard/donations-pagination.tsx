'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@sailent/ui';

interface DonationsPaginationProps {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

const PAGE_SIZE_OPTIONS = [8, 16, 32];

export function DonationsPagination({
  page,
  limit,
  total,
  totalPages,
  hasNext,
  hasPrevious,
}: DonationsPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParam = useCallback(
    (updates: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          params.set(key, String(value));
        } else {
          params.delete(key);
        }
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams],
  );

  const startRecord = total === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);

  // Generate page numbers array (up to 5 pages around current page)
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (page <= 3) {
      return [1, 2, 3, 4, 5];
    }
    if (page >= totalPages - 2) {
      return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [page - 2, page - 1, page, page + 1, page + 2];
  };

  const pages = getPageNumbers();

  return (
    <div className="flex flex-col items-center justify-between gap-3 pt-1 sm:flex-row sm:gap-4 sm:pt-0.5">
      {/* Range text: Showing 1–8 of 18 donations */}
      <p className="text-caption text-muted-foreground order-2 text-xs sm:order-1">
        Showing{' '}
        <span className="text-foreground font-semibold">
          {startRecord}–{endRecord}
        </span>{' '}
        of <span className="text-foreground font-semibold">{total}</span>{' '}
        {total === 1 ? 'donation' : 'donations'}
      </p>

      {/* Page controls: < 1 2 3 > */}
      <nav
        aria-label="Pagination Navigation"
        className="order-1 flex items-center gap-1 sm:order-2"
      >
        <button
          type="button"
          onClick={() => updateParam({ page: page - 1 })}
          disabled={!hasPrevious || isPending}
          aria-label="Previous page"
          className="text-muted-foreground hover:bg-muted hover:text-foreground border-border/80 flex size-7 items-center justify-center rounded-lg border transition-colors disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
        </button>

        {pages.map((p) => {
          const isActive = p === page;
          return (
            <button
              key={p}
              type="button"
              onClick={() => updateParam({ page: p })}
              disabled={isPending}
              aria-label={`Page ${p}`}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex size-7 items-center justify-center rounded-lg text-xs font-semibold transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {p}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => updateParam({ page: page + 1 })}
          disabled={!hasNext || isPending}
          aria-label="Next page"
          className="text-muted-foreground hover:bg-muted hover:text-foreground border-border/80 flex size-7 items-center justify-center rounded-lg border transition-colors disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </button>
      </nav>

      {/* Rows per page selector */}
      <div className="order-3 flex items-center gap-1.5">
        <label
          htmlFor="rows-per-page"
          className="text-caption text-muted-foreground shrink-0 text-xs font-medium"
        >
          Rows per page
        </label>
        <div className="relative">
          <select
            id="rows-per-page"
            value={limit}
            onChange={(e) => updateParam({ limit: Number(e.target.value), page: 1 })}
            disabled={isPending}
            className="bg-surface text-foreground border-border/80 focus-visible:border-primary focus-visible:ring-primary/20 h-7.5 pr-6.5 cursor-pointer appearance-none rounded-lg border py-0.5 pl-2.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <ChevronDown
            className="text-muted-foreground pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 stroke-[2]"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
