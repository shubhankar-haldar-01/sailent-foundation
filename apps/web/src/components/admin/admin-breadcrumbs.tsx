'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@sailent/ui';

import { adminNav } from './admin-sidebar';

const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Admin',
  new: 'New',
  edit: 'Edit',
  donations: 'Donations',
  campaigns: 'Campaigns',
  products: 'Products',
  reconciliation: 'Reconciliation',
  payments: 'Payment exceptions',
  tax: 'Tax compliance',
  reports: 'Reports',
  donors: 'Donors',
  volunteers: 'Volunteers',
  team: 'Team / Staff',
  programs: 'Programs',
  categories: 'Categories',
  events: 'Events',
  impact: 'Impact records',
  stories: 'Success stories',
  pages: 'Pages',
  blog: 'Blog',
  media: 'Media library',
  faqs: 'FAQs',
  documents: 'Reports & documents',
  messages: 'Messages',
  newsletter: 'Newsletter',
  notifications: 'Notifications',
  'notification-templates': 'Email templates',
  log: 'Send log',
  users: 'Users',
  roles: 'Roles & permissions',
  settings: 'Settings',
  'audit-logs': 'Audit logs',
};

export function AdminBreadcrumbs() {
  const pathname = usePathname();

  // Root admin view
  if (pathname === '/admin' || pathname === '/admin/') {
    return (
      <Breadcrumb className="hidden sm:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-1.5 text-xs font-medium">
              <Home className="text-muted-foreground size-3.5" aria-hidden="true" />
              <span>Dashboard</span>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  const segments = pathname.split('/').filter(Boolean);

  // Find parent navigation group for context if possible
  let groupLabel: string | null = null;
  for (const group of adminNav) {
    if (group.items.some((item) => pathname.startsWith(item.href) && item.href !== '/admin')) {
      groupLabel = group.label;
      break;
    }
  }

  // Construct breadcrumb items
  const crumbs: { label: string; href: string; isLast: boolean }[] = [];
  let accumulatedPath = '';

  segments.forEach((seg, index) => {
    accumulatedPath += `/${seg}`;
    const isLast = index === segments.length - 1;
    // Check if UUID / numeric ID
    const isId = /^[0-9a-f-]{10,}$/i.test(seg) || /^\d+$/.test(seg);
    const label = isId
      ? 'Detail'
      : (SEGMENT_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1));
    crumbs.push({ label, href: accumulatedPath, isLast });
  });

  return (
    <Breadcrumb className="hidden sm:block">
      <BreadcrumbList className="text-xs">
        <BreadcrumbItem>
          <Link
            href="/admin"
            className="text-muted-foreground hover:text-foreground focus-visible:outline-ring flex items-center gap-1 rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Home className="size-3.5" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Admin</span>
          </Link>
        </BreadcrumbItem>
        <BreadcrumbSeparator />

        {groupLabel ? (
          <>
            <BreadcrumbItem>
              <span className="text-muted-foreground">{groupLabel}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        ) : null}

        {crumbs.slice(1).map((crumb, idx) => (
          <React.Fragment key={crumb.href}>
            {idx > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {crumb.isLast ? (
                <BreadcrumbPage className="text-foreground font-semibold">
                  {crumb.label}
                </BreadcrumbPage>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground focus-visible:outline-ring rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {crumb.label}
                </Link>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
