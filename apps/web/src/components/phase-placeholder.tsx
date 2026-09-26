import * as React from 'react';
import { Construction } from 'lucide-react';
import { cn } from '@sailent/ui';

/**
 * PhasePlaceholder.
 *
 * Shell pages say plainly what is not built yet and when it arrives. This is
 * deliberate: the alternative — filling the site with plausible-looking
 * campaigns and statistics — produces a demo that is indistinguishable from
 * the real thing, and invented NGO figures have a way of surviving into
 * production (decision A14).
 *
 * Every one of these is deleted as its phase lands. Grepping for
 * `PhasePlaceholder` gives an honest inventory of what remains.
 */
export function PhasePlaceholder({
  title,
  phase,
  description,
  className,
}: {
  title: string;
  /** e.g. "Phase 2" */
  phase: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-20 text-center',
        className,
      )}
    >
      <Construction className="text-muted-foreground size-8" aria-hidden="true" />
      <div className="space-y-1">
        <h2 className="text-h3 font-semibold">{title}</h2>
        <p className="text-body-sm text-muted-foreground mx-auto max-w-prose">
          {description ?? `This section will be available in ${phase}.`}
        </p>
      </div>
      <p className="text-caption text-primary font-medium">{phase}</p>
    </div>
  );
}
