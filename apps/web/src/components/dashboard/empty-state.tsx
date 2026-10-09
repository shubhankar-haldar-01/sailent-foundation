import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Button, cn } from '@sailent/ui';

/**
 * What a dashboard section shows when there is nothing in it.
 *
 * Every empty state here offers a way OUT of being empty. "No donations yet"
 * with no link is a dead end; with a link to the campaigns it is the start of
 * something. The one exception is a filtered list that found nothing, where the
 * useful action is to clear the filter, and the caller passes that instead.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border bg-muted/30 rounded-2xl border border-dashed px-6 py-10',
        className,
      )}
    >
      <p className="font-display text-foreground text-center text-[1.0625rem] font-semibold">
        {title}
      </p>
      <p className="text-body-sm text-muted-foreground mx-auto mt-2 max-w-prose text-center">
        {description}
      </p>
      {action ? (
        <div className="mt-5 text-center">
          <Button asChild size="md" className="h-11 rounded-full px-6">
            <Link href={action.href}>
              {action.label}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
