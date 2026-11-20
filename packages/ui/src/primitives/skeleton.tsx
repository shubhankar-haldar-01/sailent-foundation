import * as React from 'react';

import { cn } from '../lib/cn';

/**
 * Placeholders shaped like the content they stand in for (2026-11-19,
 * docs/ui-feedback.md).
 *
 * Every skeleton appears only after 300ms (the `skeleton` utility in
 * tokens.css), so a quick load shows nothing rather than a flash. Pass
 * `immediate` where the delay is wrong (a loader that is already delayed).
 * Hidden from assistive technology: the region around it says what is loading.
 */
export function Skeleton({
  className,
  immediate = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { immediate?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'bg-muted rounded-md',
        immediate ? 'animate-pulse motion-reduce:animate-none' : 'skeleton',
        className,
      )}
      {...props}
    />
  );
}

/** Lines of text; the last one shorter, as a paragraph ends. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3.5', index === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({
  size = 40,
  className,
}: {
  /** Pixels. */
  size?: number;
  className?: string;
}) {
  return (
    <Skeleton
      className={cn('shrink-0 rounded-full', className)}
      style={{ width: size, height: size }}
    />
  );
}

/** A card: an image, a title and two lines. */
export function SkeletonCard({ className, media = true }: { className?: string; media?: boolean }) {
  return (
    <div
      className={cn('border-border overflow-hidden rounded-xl border', className)}
      aria-hidden="true"
    >
      {media ? <Skeleton className="aspect-[16/10] w-full rounded-none" /> : null}
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-2/3" />
        <SkeletonText lines={2} />
      </div>
    </div>
  );
}

/** A table row with `columns` cells; render several inside `<tbody>`. */
export function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: columns }, (_, index) => (
        <td key={index} className="px-4 py-3">
          <Skeleton className={cn('h-3.5', index === 0 ? 'w-3/4' : 'w-1/2')} />
        </td>
      ))}
    </tr>
  );
}
