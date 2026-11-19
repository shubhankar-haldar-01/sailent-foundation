'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export interface AdminBackButtonProps {
  /**
   * The fallback list route to navigate back to (e.g. "/admin/team", "/admin/campaigns").
   */
  href: string;
  /**
   * Label content rendered next to the arrow icon. Defaults to "Back".
   */
  children?: React.ReactNode;
  /**
   * Optional custom CSS class for the link.
   */
  className?: string;
}

/**
 * Intelligent back button for admin detail and edit pages.
 *
 * Ensures that navigating back from an item detail/edit view returns the operator
 * to the exact page, search query, and filter tab they were on (e.g. page 2, 3),
 * rather than resetting to page 1.
 *
 * Priority order:
 * 1. Explicit `from` or `returnTo` URL parameter on the current page.
 * 2. Section list URL remembered in `sessionStorage` (recorded by AdminUrlTracker).
 * 3. Explicit `page` parameter on the current page.
 * 4. Fallback `href` prop.
 */
export function AdminBackButton({ href, children = 'Back', className }: AdminBackButtonProps) {
  const [targetHref, setTargetHref] = React.useState<string>(href);

  React.useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);

        // 1. Explicit return destination in search params
        const returnParam = urlParams.get('from') || urlParams.get('returnTo');
        if (returnParam && returnParam.startsWith(href)) {
          setTargetHref(returnParam);
          return;
        }

        // 2. Remembered section list URL in sessionStorage
        if (window.sessionStorage) {
          const saved = window.sessionStorage.getItem(`admin_list_url:${href}`);
          if (saved && saved.startsWith(href)) {
            setTargetHref(saved);
            return;
          }
        }

        // 3. Fallback to page query parameter on current URL
        const pageParam = urlParams.get('page');
        if (pageParam && !href.includes('page=')) {
          const sep = href.includes('?') ? '&' : '?';
          setTargetHref(`${href}${sep}page=${pageParam}`);
        }
      }
    } catch {
      // Ignore storage restrictions (e.g. strict privacy mode or embedded frames)
    }
  }, [href]);

  return (
    <Link
      href={targetHref}
      className={
        className ??
        'text-body-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors'
      }
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      <span>{children}</span>
    </Link>
  );
}
