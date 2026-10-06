'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  FileText,
  HeartHandshake,
  LayoutDashboard,
  Megaphone,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@sailent/ui';

/**
 * Admin sidebar.
 *
 * Groups follow the Phase 0 admin IA (docs/information-architecture.md §8.2),
 * including the review that added a dedicated FINANCE group: reconciliation
 * and the Form 10BD statutory deadline are a distinct job done by a
 * distinct role, and burying a 31 May legal deadline inside a fundraising menu
 * is how deadlines get missed.
 *
 * In Phase 3 this list is filtered by the viewer's permissions, so a user never
 * sees a menu item leading to a 403. That filtering is COSMETIC — the API
 * enforces independently (decision A9).
 */

interface AdminNavItem {
  label: string;
  href: string;
  /** The phase that implements it. Rendered as a hint while unbuilt. */
  phase?: string;
}

interface AdminNavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: AdminNavItem[];
}

export const adminNav: AdminNavGroup[] = [
  {
    label: 'Overview',
    icon: LayoutDashboard,
    items: [{ label: 'Dashboard', href: '/admin' }],
  },
  {
    label: 'Fundraising',
    icon: Megaphone,
    items: [
      { label: 'Donations', href: '/admin/donations' },
      { label: 'Campaigns', href: '/admin/campaigns' },
      /**
       * A top-level entry, not one nested under campaigns.
       *
       * A product is not a child of a campaign — it outlives every campaign
       * that offers it. Filing it under one would reproduce in the navigation
       * the confusion Phase 5 removed from the schema. The per-campaign
       * offerings are edited on the campaign, where the price belongs.
       */
      { label: 'Products', href: '/admin/products' },
    ],
  },
  {
    label: 'Finance',
    icon: Wallet,
    items: [
      { label: 'Reconciliation', href: '/admin/reconciliation' },
      // Phase 11: what reconciliation could not settle on its own. Read-only.
      { label: 'Payment exceptions', href: '/admin/payments' },
      { label: 'Tax compliance', href: '/admin/tax' },
      /*
        Phase 10.12. "Reports" sits under Finance rather than in a group of its
        own: `information-architecture.md` §8.2 gives it one, but every figure
        it shows is money, volunteers or impact over a range — and the two
        entries above are reports as well. Three destinations for one idea is
        the menu that makes people guess.
      */
      { label: 'Reports', href: '/admin/reports' },
    ],
  },
  {
    label: 'People',
    icon: Users,
    items: [
      { label: 'Donors', href: '/admin/donors' },
      /*
        ONE entry, not two. Applications used to be listed separately, and they
        are the same screen: an application IS a volunteer whose status has not
        been decided yet. The list opens on the review queue for that reason.
      */
      { label: 'Volunteers', href: '/admin/volunteers' },
      { label: 'Team / Staff', href: '/admin/team' },
    ],
  },
  {
    label: 'Programs & work',
    icon: HeartHandshake,
    items: [
      { label: 'Programs', href: '/admin/programs' },
      { label: 'Events', href: '/admin/events' },
      { label: 'Impact records', href: '/admin/impact' },
      { label: 'Success stories', href: '/admin/stories' },
    ],
  },
  {
    label: 'Content',
    icon: FileText,
    items: [
      { label: 'Pages', href: '/admin/pages' },
      { label: 'Blog', href: '/admin/blog' },
      { label: 'Media library', href: '/admin/media' },
      // Phase 13: the general questions on /faq. Campaign FAQs stay on the campaign.
      { label: 'FAQs', href: '/admin/faqs' },
      /*
        ONE ENTRY, NOT TWO.

        There was also a top-level "Reports" group pointing at `/admin/reports`.
        Annual reports, audited accounts and legal filings ARE documents, and
        two admin destinations for one drawer of PDFs is a menu that makes
        people guess. They are internal by design — the public `/reports` and
        `/transparency` pages were removed — so this is the only place they
        appear anywhere in the platform.
      */
      { label: 'Reports & documents', href: '/admin/documents' },
    ],
  },
  {
    /*
      "Communication", as `information-architecture.md` §8.2 names it. Messages
      and Newsletter arrived in Phase 13 with their tables (migration 0023).
    */
    label: 'Communication',
    icon: Bell,
    items: [
      { label: 'Messages', href: '/admin/messages' },
      { label: 'Newsletter', href: '/admin/newsletter' },
      { label: 'Notifications', href: '/admin/notifications' },
      { label: 'Email templates', href: '/admin/notification-templates' },
      { label: 'Send log', href: '/admin/notifications/log' },
    ],
  },
  {
    label: 'System',
    icon: Settings,
    items: [
      { label: 'Users', href: '/admin/users' },
      { label: 'Roles & permissions', href: '/admin/roles' },
      { label: 'Settings', href: '/admin/settings' },
      { label: 'Audit logs', href: '/admin/audit-logs' },
    ],
  },
];

export function AdminSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="flex flex-col gap-6 p-4">
      {adminNav.map((group) => {
        const Icon = group.icon;
        return (
          <div key={group.label}>
            <p className="text-overline tracking-(--text-overline--letter-spacing) text-muted-foreground mb-2 flex items-center gap-2 px-2 uppercase">
              <Icon className="size-3.5" aria-hidden="true" />
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'text-body-sm flex min-h-9 items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors',
                        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                        isActive
                          ? 'bg-accent text-accent-foreground font-medium'
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      <span>{item.label}</span>
                      {item.phase ? (
                        <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[0.6875rem]">
                          {item.phase}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
