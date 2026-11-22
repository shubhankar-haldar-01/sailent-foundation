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
  registrations: 'Attendees',
};

export function AdminBreadcrumbs() {
  const pathname = usePathname();
  const [resolvedHrefs, setResolvedHrefs] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage && pathname) {
        const segments = pathname.split('/').filter(Boolean);
        const updates: Record<string, string> = {};
        let acc = '';
        for (const seg of segments) {
          acc += `/${seg}`;
          const saved = window.sessionStorage.getItem(`admin_list_url:${acc}`);
          if (saved && saved.startsWith(acc)) {
            updates[acc] = saved;
          }
        }
        setResolvedHrefs(updates);
      }
    } catch {
      // Ignore storage restrictions
    }
  }, [pathname]);

  const currentPath = pathname || '';

  // Root admin view or unmounted/null pathname
  if (!currentPath || currentPath === '/admin' || currentPath === '/admin/') {
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

  const segments = currentPath.split('/').filter(Boolean);

  // Special case: /admin/preview/:entity/:slug (previewing drafts)
  if (segments[1] === 'preview' && segments.length >= 3) {
    const entity = segments[2] === 'program' ? 'program' : 'campaign';
    const isProgram = entity === 'program';
    const parentHref = isProgram ? '/admin/programs' : '/admin/campaigns';
    const parentLabel = isProgram ? 'Programs' : 'Campaigns';
    const group = isProgram ? 'Programs & work' : 'Fundraising';

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

          <BreadcrumbItem>
            <span className="text-muted-foreground">{group}</span>
          </BreadcrumbItem>
          <BreadcrumbSeparator />

          <BreadcrumbItem>
            <Link
              href={resolvedHrefs[parentHref] ?? parentHref}
              className="text-muted-foreground hover:text-foreground focus-visible:outline-ring rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {parentLabel}
            </Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator />

          <BreadcrumbItem>
            <BreadcrumbPage className="text-foreground font-semibold">Preview</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  // Find parent navigation group for context if possible
  let groupLabel: string | null = null;
  for (const group of adminNav) {
    if (group.items.some((item) => currentPath.startsWith(item.href) && item.href !== '/admin')) {
      groupLabel = group.label;
      break;
    }
  }

  // Construct breadcrumb items
  const crumbs: { label: string; href: string; isLast: boolean }[] = [];
  let accumulatedPath = '';

  for (let index = 0; index < segments.length; index++) {
    const seg = segments[index]!;
    accumulatedPath += `/${seg}`;
    const isLast = index === segments.length - 1;
    const isId = /^[0-9a-f-]{10,}$/i.test(seg) || /^\d+$/.test(seg);
    const nextSeg = segments[index + 1];

    if (isId) {
      if (nextSeg === 'edit') {
        // Skip the ID segment in the breadcrumb trail when immediately followed by 'edit',
        // so /admin/events/[id]/edit renders as: Events > Edit (rather than Events > Detail > Edit)
        continue;
      }
      if (nextSeg) {
        // Sub-page under an entity ID (e.g., /admin/events/[id]/registrations)
        // Point the entity link to its edit page if it's an edit-centric resource,
        // or to its detail view.
        const prevSeg = segments[index - 1];
        const editCentric = ['events', 'campaigns', 'programs', 'team', 'impact'].includes(
          prevSeg ?? '',
        );
        const entityHref = editCentric ? `${accumulatedPath}/edit` : accumulatedPath;
        const label = editCentric ? 'Edit' : 'Detail';
        crumbs.push({ label, href: entityHref, isLast: false });
        continue;
      }
      // ID is the terminal segment (e.g., /admin/donors/[id])
      crumbs.push({ label: 'Detail', href: accumulatedPath, isLast: true });
      continue;
    }

    const label = SEGMENT_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
    crumbs.push({ label, href: accumulatedPath, isLast });
  }

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
                  href={resolvedHrefs[crumb.href] ?? crumb.href}
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
