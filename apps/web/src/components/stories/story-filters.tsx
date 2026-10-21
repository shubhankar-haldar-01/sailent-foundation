import Link from 'next/link';

import { cn } from '@sailent/ui';

import { categoryTone } from '@/components/home/category-icon';

import { StoryCategoryIcon } from './story-category-icon';

/**
 * The icon's colour in an inactive pill. The owner's design draws the
 * Education, Healthcare and Women Empowerment icons in rose and magenta;
 * any other category takes its own tone, so a new one still reads as itself.
 */
function filterIconColor(category: string): string {
  const key = category.toLowerCase().replace(/[^a-z]/g, '');
  if (key.includes('education') || key.includes('health')) return 'text-wash-rose-ink';
  if (key.includes('women')) return 'text-wash-pink-ink';
  return categoryTone(category).ink;
}

/**
 * The category pills above the stories, as the owner's design (2026-10-15)
 * draws them: "All Stories" and one pill per category, the one in force
 * filled brand orange with a white label, the rest white with a navy label
 * and the category's icon.
 *
 * Plain links — `?category=` on the listing — so filtering works without
 * JavaScript, can be bookmarked, and the back button undoes it. Below `sm`
 * the row scrolls sideways (only the row, never the page) rather than
 * wrapping.
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
    <nav aria-label="Filter stories by category" className="mb-4 mt-6 sm:mt-8">
      <div className="rail -mx-4 flex items-center gap-2.5 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {pills.map((pill) => {
          const active = pill.value === null ? !current : pill.value === current;
          const href = pill.value
            ? `/stories?category=${encodeURIComponent(pill.value)}`
            : '/stories';
          return (
            <Link
              key={pill.label}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex h-11 shrink-0 items-center gap-2.5 rounded-full border px-5 text-sm font-semibold transition-colors',
                'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                active
                  ? 'bg-primary border-primary text-primary-foreground font-bold'
                  : 'bg-surface border-accent-100 dark:border-border text-foreground hover:border-primary/50 hover:text-primary',
              )}
            >
              {pill.value ? (
                <StoryCategoryIcon
                  category={pill.value}
                  className={cn(
                    'size-[1.125rem]',
                    active ? 'text-white' : filterIconColor(pill.value),
                  )}
                />
              ) : null}
              <span>{pill.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
