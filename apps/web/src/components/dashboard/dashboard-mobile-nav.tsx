'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, CalendarDays, CreditCard, HandHeart, Home, LogOut, User, X } from 'lucide-react';

import { cn } from '@sailent/ui';
import { signOutDonor } from '@/lib/auth/donor-actions';
import { DonorAvatar } from './donor-avatar';
import { useDashboardMobile } from './dashboard-mobile-context';

const DRAWER_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: Home },
  { label: 'Payments', href: '/dashboard/donations', icon: CreditCard },
  { label: 'Profile', href: '/dashboard/profile', icon: User },
  { label: 'Saved campaigns', href: '/dashboard/saved', icon: Bookmark },
  { label: 'Events', href: '/dashboard/events', icon: CalendarDays },
  { label: 'Volunteering', href: '/dashboard/volunteering', icon: HandHeart },
] as const;

export function DashboardMobileNav({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email: string | null;
  avatarUrl?: string | null;
}) {
  const pathname = usePathname();
  const { isDrawerOpen, closeDrawer } = useDashboardMobile();

  return (
    <>
      {/* ──────────────── Slide-Over Drawer (< lg) ──────────────── */}
      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="animate-in fade-in-0 backdrop-blur-xs fixed inset-0 bg-black/50 duration-300"
            onClick={closeDrawer}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="User navigation drawer"
            className="bg-surface animate-in slide-in-from-left relative z-10 flex h-full w-[85vw] max-w-sm flex-col overflow-y-auto p-5 shadow-2xl duration-300"
          >
            {/* Header: Avatar, Name, Email, Close Button */}
            <div className="border-border/60 flex items-center justify-between gap-3 border-b pb-4">
              <div className="flex min-w-0 items-center gap-3">
                <DonorAvatar
                  name={name}
                  src={avatarUrl}
                  className="ring-primary/20 size-12 text-sm ring-2"
                />
                <div className="min-w-0">
                  <p className="font-display text-foreground truncate text-base font-bold">
                    {name || 'Your account'}
                  </p>
                  {email ? (
                    <p className="text-caption text-muted-foreground truncate" title={email}>
                      {email}
                    </p>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Close menu"
                className="hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:outline-ring flex size-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2"
              >
                <X className="size-5 stroke-[2]" aria-hidden="true" />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="mt-4 flex-1 space-y-1">
              {DRAWER_ITEMS.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === '/dashboard'
                    ? pathname === item.href
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeDrawer}
                    className={cn(
                      'flex items-center gap-3.5 rounded-2xl px-4 py-3 text-sm transition-colors',
                      active
                        ? 'bg-[#fae8dc]/70 font-bold text-[#EB6A1F] dark:bg-orange-950/40'
                        : 'text-foreground/85 hover:bg-muted font-medium',
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-5 stroke-[2]',
                        active ? 'text-[#EB6A1F]' : 'text-muted-foreground',
                      )}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {/* Logout Option in Drawer */}
              <form action={signOutDonor} className="pt-2">
                <button
                  type="submit"
                  className="text-destructive hover:bg-destructive/10 flex w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors"
                >
                  <LogOut className="size-5 stroke-[2]" aria-hidden="true" />
                  <span>Logout</span>
                </button>
              </form>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
