import Link from 'next/link';
import { cn } from '@sailent/ui';

/**
 * The category pills above the stories (owner's page design, 2026-10-08).
 *
 * Plain links — `?category=` on the listing — so filtering works without
 * JavaScript, can be bookmarked, and the back button undoes it. Only the
 * categories that published stories are actually filed under are offered
 * (`getStoryCategories`), so no pill leads to an empty page.
 */
export function StoryFilters({
  categories,
  current,
}: {
  categories: string[];
  current: string | null;
}) {
  const pills = [{ label: 'All Stories', value: null as string | null }].concat(
    categories.map((category) => ({ label: category, value: category })),
  );

  return (
    <nav aria-label="Filter stories by category" className="mt-8">
      <ul className="flex flex-wrap gap-2">
        {pills.map((pill) => {
          const active = pill.value === null ? !current : pill.value === current;
          const href = pill.value
            ? `/stories?category=${encodeURIComponent(pill.value)}`
            : '/stories';
          return (
            <li key={pill.label}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-10 items-center rounded-full border px-[1.0625rem] text-[0.78125rem] font-medium transition-colors',
                  'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                  active
                    ? 'bg-primary text-primary-foreground border-transparent font-bold'
                    : 'border-border bg-surface text-foreground hover:border-primary/50 hover:text-primary',
                )}
              >
                {pill.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
