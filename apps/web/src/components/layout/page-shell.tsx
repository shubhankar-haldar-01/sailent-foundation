import * as React from 'react';
import { cn } from '@sailent/ui';

/**
 * Page container.
 *
 * `container-page` is a project utility (not a repeated arbitrary value) that
 * owns the gutter and max width in one place, so the side padding can never
 * collapse to zero on a page that forgets it.
 */
export function PageShell({
  children,
  className,
  width = 'page',
}: {
  children: React.ReactNode;
  className?: string;
  /** `content` caps at the long-form measure; `page` is the standard width. */
  width?: 'page' | 'content';
}) {
  return (
    <div
      className={cn(
        'container-page',
        width === 'content' && 'max-w-(--container-content)',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Vertical rhythm for a public section: 96–128px, versus 16–24px in admin. */
export function Section({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('section-y', className)} {...props}>
      {children}
    </section>
  );
}
