import Link from 'next/link';

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
    <div className={cn('border-border rounded-lg border border-dashed px-6 py-10', className)}>
      <p className="text-body-sm text-center font-semibold">{title}</p>
      <p className="text-body-sm text-muted-foreground mx-auto mt-2 max-w-prose text-center">
        {description}
      </p>
      {action ? (
        <div className="mt-5 text-center">
          <Button asChild size="md" variant="secondary">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
