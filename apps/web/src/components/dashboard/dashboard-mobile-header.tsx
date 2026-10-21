'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Menu } from 'lucide-react';

import { BrandGlyph } from '@/components/layout/brand-mark';
import { siteConfig } from '@/lib/site-config';
import { DonorAvatar } from './donor-avatar';
import { useDashboardMobile } from './dashboard-mobile-context';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/donations': 'Your donations',
  '/dashboard/saved': 'Saved campaigns',
  '/dashboard/profile': 'Your profile',
  '/dashboard/events': 'Your events',
  '/dashboard/volunteering': 'Your volunteering',
};

export function DashboardMobileHeader({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  const pathname = usePathname();
  const { openDrawer } = useDashboardMobile();

  const isHome = pathname === '/dashboard';

  // Determine title for subpages
  let title = PAGE_TITLES[pathname];
  if (!title) {
    if (pathname.includes('/receipt')) {
      title = 'Receipt';
    } else if (pathname.startsWith('/dashboard/donations/')) {
      title = 'Donation details';
    } else {
      title = 'Your account';
    }
  }

  // Back link target
  let backHref = '/dashboard';
  if (pathname.includes('/receipt') && pathname.startsWith('/dashboard/donations/')) {
    const parts = pathname.split('/');
    backHref = parts.slice(0, 4).join('/'); // back to donation detail
  } else if (pathname.startsWith('/dashboard/donations/')) {
    backHref = '/dashboard/donations';
  }

  return (
    <header className="bg-surface/95 border-border/60 sticky top-0 z-40 border-b px-4 py-3 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        {isHome ? (
          /* Brand Lockup matching Mockup 1: Logo icon + 2-line title */
          <Link
            href="/"
            className="focus-visible:outline-ring flex items-center gap-2.5 rounded-sm focus-visible:outline-2"
          >
            <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-full">
              <BrandGlyph className="size-5" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-display text-foreground text-sm font-bold tracking-tight">
                {siteConfig.name}
              </span>
              <span className="text-muted-foreground text-[0.625rem] font-medium uppercase tracking-wider">
                {siteConfig.tagline.split('•')[0]?.trim() || 'Foundation'}
              </span>
            </span>
          </Link>
        ) : (
          /* Subpage Back Arrow + Title matching Mockup 2 & 4 */
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={backHref}
              aria-label="Back"
              className="hover:bg-muted text-foreground focus-visible:outline-ring -ml-1.5 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2"
            >
              <ArrowLeft className="size-5 stroke-[2.2]" aria-hidden="true" />
            </Link>
            <h1 className="font-display text-foreground truncate text-lg font-bold sm:text-xl">
              {title}
            </h1>
          </div>
        )}

        {/* Right: Avatar and Hamburger Menu */}
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/profile"
            aria-label="Your profile"
            className="focus-visible:outline-ring shrink-0 rounded-full transition-opacity hover:opacity-90 focus-visible:outline-2"
          >
            <DonorAvatar
              name={name}
              src={avatarUrl}
              className="ring-primary/20 size-8.5 text-xs ring-2 sm:size-9"
            />
          </Link>
          <button
            type="button"
            onClick={openDrawer}
            aria-label="Open menu"
            className="text-foreground hover:bg-muted focus-visible:outline-ring -mr-1 flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-2"
          >
            <Menu className="size-6 stroke-[2]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
