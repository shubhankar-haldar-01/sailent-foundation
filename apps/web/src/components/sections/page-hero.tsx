import { cn } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';

/**
 * Standard page hero.
 *
 * Deliberately restrained: an eyebrow, an h1 and a lead paragraph on a tinted
 * band. Every inner page uses it, which is what makes the site feel like one
 * publication rather than a set of separately designed pages.
 */
export function PageHero({
  eyebrow,
  title,
  lead,
  children,
  className,
  align = 'left',
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children?: React.ReactNode;
  className?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className={cn('border-border bg-surface-sunken border-b', className)}>
      <PageShell>
        <div className={cn('py-12 md:py-16', align === 'center' && 'text-center')}>
          <div className={cn('max-w-3xl', align === 'center' && 'mx-auto')}>
            {eyebrow ? (
              <p className="text-overline tracking-(--text-overline--letter-spacing) text-primary uppercase">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-display mt-2 font-bold">{title}</h1>
            {lead ? <p className="text-body-lg text-muted-foreground mt-4">{lead}</p> : null}
          </div>
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
      </PageShell>
    </div>
  );
}
