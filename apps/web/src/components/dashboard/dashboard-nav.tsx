'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bookmark,
  CalendarDays,
  CreditCard,
  HandHeart,
  LayoutDashboard,
  Newspaper,
  Settings,
  User,
} from 'lucide-react';

import { cn } from '@sailent/ui';

/**
 * The account navigation.
 *
 * A client component only because it needs `usePathname` to mark the current
 * page. `aria-current="page"` is what actually conveys that — the colour is a
 * second signal, not the signal, so it still reads correctly to somebody who
 * cannot separate the two shades.
 *
 * TWO GROUPS. The design's four — Dashboard, Payments, Profile, Settings —
 * and, under a rule, the rest of the account (saved campaigns, events,
 * volunteering, updates), which are real pages that must stay reachable.
 * "Campaigns Supported" is gone from here: supported campaigns are shown on
 * the dashboard itself (owner, 2026-10-08).
 *
 * Horizontal and scrollable on a phone, a vertical rail from `lg`. Every
 * target clears 44px.
 */
const PRIMARY = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Payments', href: '/dashboard/donations', icon: CreditCard },
  { label: 'Profile', href: '/dashboard/profile', icon: User },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
] as const;

const MORE = [
  { label: 'Saved', href: '/dashboard/saved', icon: Bookmark },
  { label: 'Events', href: '/dashboard/events', icon: CalendarDays },
  { label: 'Volunteering', href: '/dashboard/volunteering', icon: HandHeart },
  { label: 'Updates', href: '/dashboard/updates', icon: Newspaper },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  const item = ({ label, href, icon: Icon }: (typeof PRIMARY)[number] | (typeof MORE)[number]) => {
    // Exact match for the dashboard, prefix for the rest — otherwise
    // `/dashboard` would be marked current on every page.
    const current = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
    return (
      <li key={href} className="shrink-0">
        <Link
          href={href}
          {...(current ? { 'aria-current': 'page' as const } : {})}
          className={cn(
            'text-body-sm focus-visible:outline-ring xl:pointer-coarse:min-h-11 flex min-h-11 items-center gap-3 whitespace-nowrap rounded-xl px-3.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 xl:min-h-10',
            // The soft orange pill with orange ink: `--cta-50` under the
            // darker `text-primary` ink clears 4.5:1, which a 10% wash of
            // the button orange did not.
            current
              ? 'text-primary bg-(--cta-50) dark:bg-primary/15 font-semibold'
              : 'text-foreground/80 hover:bg-muted hover:text-foreground font-medium',
          )}
        >
          <Icon
            className={cn(
              'size-[1.125rem] shrink-0',
              current ? 'text-cta-glow' : 'text-muted-foreground',
            )}
            aria-hidden="true"
          />
          {label}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="Your account">
      <ul className="rail flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0 xl:gap-0.5">
        {PRIMARY.map(item)}
        <li aria-hidden="true" className="border-border my-1 hidden border-t lg:block" />
        {MORE.map(item)}
      </ul>
    </nav>
  );
}
