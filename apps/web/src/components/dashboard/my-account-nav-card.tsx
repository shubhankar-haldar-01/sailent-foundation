'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, CreditCard, HandHeart, Heart, LayoutGrid, LogOut, User } from 'lucide-react';

import { cn } from '@sailent/ui';
import { signOutDonor } from '@/lib/auth/donor-actions';

/**
 * Every page of the account, in the desktop rail's order (`dashboard-nav.tsx`),
 * so a phone or tablet reaches the same places.
 * "Saved Campaigns" is the Saved page — campaigns a donor bookmarked, not the
 * ones they gave to.
 */
const ACCOUNT_LINKS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutGrid },
  { label: 'Payments', href: '/dashboard/donations', icon: CreditCard },
  { label: 'Saved Campaigns', href: '/dashboard/saved', icon: Heart },
  { label: 'Profile', href: '/dashboard/profile', icon: User },
  { label: 'Events', href: '/dashboard/events', icon: CalendarDays },
  { label: 'Volunteering', href: '/dashboard/volunteering', icon: HandHeart },
] as const;

/**
 * The "My Account" card: the account's navigation below `lg`, where the
 * sidebar rail is not drawn. `aria-current` marks the page; the colour is a
 * second signal, not the only one.
 */
export function MyAccountNavCard({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Account quick navigation"
      className={cn('card-standard rounded-2xl p-5 sm:p-6', className)}
    >
      <h2 className="font-display text-foreground text-lg font-bold tracking-tight">My Account</h2>
      <div className="border-border/60 my-3.5 border-t" />

      <ul className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-sm">
        {ACCOUNT_LINKS.map(({ label, href, icon: Icon }) => {
          const current = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                {...(current ? { 'aria-current': 'page' as const } : {})}
                className={cn(
                  'focus-visible:outline-ring flex min-h-6 items-center gap-2.5 rounded-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
                  current ? 'text-primary font-bold' : 'text-foreground/85 hover:text-primary',
                )}
              >
                <Icon className="size-4.5 shrink-0 stroke-[2]" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <form action={signOutDonor}>
            <button
              type="submit"
              className="text-destructive hover:text-destructive/80 focus-visible:outline-ring flex min-h-6 items-center gap-2.5 rounded-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <LogOut className="size-4.5 shrink-0 stroke-[2]" aria-hidden="true" />
              <span>Logout</span>
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}

/**
 * The layout's phone-only slot for the card, above every dashboard page —
 * except the dashboard home, which places the card itself UNDER its welcome
 * banner (owner, 2026-10-17: "replace the position" of the two). The other
 * pages hide their own headings on a phone, so there the card stays first.
 * Done in the markup rather than with CSS `order`, so reading and focus order
 * match what is on screen.
 */
export function MyAccountNavSlot() {
  const pathname = usePathname();
  if (pathname === '/dashboard') return null;

  return (
    <div className="mb-5 lg:hidden">
      <MyAccountNavCard />
    </div>
  );
}
