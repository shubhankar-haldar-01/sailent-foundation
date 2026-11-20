import Link from 'next/link';
import { Button, EmptyState } from '@sailent/ui';

/**
 * An admin list with nothing to show (docs/ui-feedback.md, Phase 4).
 *
 * Two different situations, never one message for both: a list narrowed by a
 * search or filter to nothing ("No campaigns match", with a way back to the
 * whole list), and a list with nothing in it yet ("No campaigns yet").
 */
export function AdminListEmpty({
  icon,
  noun,
  filtered,
  clearHref,
  filteredDescription,
  emptyDescription,
}: {
  icon: React.ComponentType<{ className?: string }>;
  /** Plural, lower case: "campaigns", "staff accounts". */
  noun: string;
  filtered: boolean;
  /** The list with no search or filter. */
  clearHref: string;
  filteredDescription: string;
  emptyDescription: string;
}) {
  return (
    <EmptyState
      kind={filtered ? 'no-results' : 'no-content'}
      icon={icon}
      title={filtered ? `No ${noun} match` : `No ${noun} yet`}
      description={filtered ? filteredDescription : emptyDescription}
      className="bg-surface rounded-xl"
      action={
        filtered ? (
          <Button asChild variant="secondary" size="sm" className="touch-target relative">
            <Link href={clearHref}>Clear filters</Link>
          </Button>
        ) : undefined
      }
    />
  );
}

/** Whether a list page's query narrows it: anything but paging and sorting, and not "all". */
export function isFiltered(params: Record<string, string | string[] | undefined>): boolean {
  return Object.entries(params).some(
    ([key, value]) => key !== 'page' && key !== 'sort' && Boolean(value) && value !== 'all',
  );
}
