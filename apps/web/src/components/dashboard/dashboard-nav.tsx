'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Gift,
  Heart,
  Bookmark,
  CalendarDays,
  HandHeart,
  Newspaper,
  Settings,
  User,
  LayoutDashboard,
} from 'lucide-react';

import { cn } from '@sailent/ui';

/**
 * The dashboard rail.
 *
 * A client component only because it needs `usePathname` to mark the current
 * page. `aria-current="page"` is what actually conveys that — the colour is a
 * second signal, not the signal, so it still reads correctly to somebody who
 * cannot separate the two shades.
 *
 * Horizontal and scrollable on a phone, a vertical rail from `lg`. Every target
 * clears 44px, which is the WCAG 2.5.8 enhanced size rather than the 24px
 * minimum: this is a list of small links and the minimum is uncomfortable on a
 * real phone.
 */
const ITEMS = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Donations', href: '/dashboard/donations', icon: Gift },
  { label: 'Campaigns', href: '/dashboard/campaigns', icon: Heart },
  { label: 'Saved', href: '/dashboard/saved', icon: Bookmark },
  { label: 'Events', href: '/dashboard/events', icon: CalendarDays },
  { label: 'Volunteering', href: '/dashboard/volunteering', icon: HandHeart },
  { label: 'Updates', href: '/dashboard/updates', icon: Newspaper },
  { label: 'Profile', href: '/dashboard/profile', icon: User },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Your account">
      <ul className="rail flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {ITEMS.map((item) => {
          // Exact match for the overview, prefix for the rest — otherwise
          // `/dashboard` would be marked current on every page.
          const current =
            item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                {...(current ? { 'aria-current': 'page' as const } : {})}
                className={cn(
                  'text-body-sm focus-visible:outline-ring flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-md px-3 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
                  /*
                    `bg-accent text-accent-foreground` is the design system's
                    OWN selected pair, and that is why it is used here rather
                    than an eyeballed tint.

                    This was `bg-primary/10 text-primary` — a 10% wash of the
                    CTA orange with the orange as ink — which measured 4.44:1
                    against a 4.5:1 floor for 14px text. Close enough to look
                    fine and still a WCAG 1.4.3 failure, which is exactly the
                    kind an eye does not catch and axe does.
                  */
                  current
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
