import { BookOpen, HeartPulse, Users } from 'lucide-react';

import { cn } from '@sailent/ui';

import { CategoryIcon } from '@/components/home/category-icon';

/**
 * A story category's icon, as the owner's Stories design draws it
 * (2026-10-15): an open book for Education, a solid heart with its pulse
 * left white for Healthcare, solid figures for Women Empowerment and Child
 * Welfare. Any other category keeps the site's own icon (`CategoryIcon`), so
 * a category added later still gets one.
 *
 * The site-wide mapping is not changed here: the campaign cards' icons are an
 * approved design of their own (`AGENTS.md` §11).
 *
 * Decorative — the category's name is always written beside it.
 */
export function StoryCategoryIcon({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const key = category.toLowerCase().replace(/[^a-z]/g, '');
  const base = cn('size-4 shrink-0', className);

  if (key === 'education') {
    return <BookOpen aria-hidden="true" strokeWidth={2} className={base} />;
  }
  if (key === 'healthcare' || key === 'health') {
    // Lucide draws the heart first and the pulse last: fill the one, keep the other a white line.
    return (
      <HeartPulse
        aria-hidden="true"
        className={cn(
          'fill-current [&>path:last-child]:fill-none [&>path:last-child]:stroke-white',
          base,
        )}
      />
    );
  }
  if (key === 'womenempowerment' || key === 'childwelfare') {
    return <Users aria-hidden="true" className={cn('fill-current', base)} />;
  }
  return <CategoryIcon category={category} className={base} />;
}
