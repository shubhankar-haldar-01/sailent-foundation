'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CircleDollarSign,
  FileCode2,
  FileText,
  Globe,
  Heart,
  HelpCircle,
  History,
  Image,
  Layers,
  LayoutDashboard,
  ListOrdered,
  Mail,
  Megaphone,
  MessageSquare,
  Package,
  Receipt,
  Scale,
  Shield,
  ShieldCheck,
  Sliders,
  Sparkles,
  Tag,
  Target,
  UserCheck,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, cn } from '@sailent/ui';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  phase?: string;
  permission?: string;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const adminNav: AdminNavGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard }],
  },
  {
    label: 'Fundraising',
    items: [
      {
        label: 'Donations',
        href: '/admin/donations',
        icon: CircleDollarSign,
        permission: 'donation.read',
      },
      {
        label: 'Campaigns',
        href: '/admin/campaigns',
        icon: Megaphone,
        permission: 'campaign.read',
      },
      { label: 'Products', href: '/admin/products', icon: Package, permission: 'product.view' },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        label: 'Reconciliation',
        href: '/admin/reconciliation',
        icon: Scale,
        permission: 'payment.manage',
      },
      {
        label: 'Payment exceptions',
        href: '/admin/payments',
        icon: AlertTriangle,
        permission: 'payment.read',
      },
      { label: 'Tax compliance', href: '/admin/tax', icon: Receipt, permission: 'tax.read' },
      { label: 'Reports', href: '/admin/reports', icon: BarChart3, permission: 'report.view' },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Donors', href: '/admin/donors', icon: Heart, permission: 'donor.read' },
      {
        label: 'Volunteers',
        href: '/admin/volunteers',
        icon: UserCheck,
        permission: 'volunteer.read',
      },
      { label: 'Team / Staff', href: '/admin/team', icon: ShieldCheck, permission: 'team.read' },
    ],
  },
  {
    label: 'Programs & work',
    items: [
      { label: 'Programs', href: '/admin/programs', icon: Layers, permission: 'program.read' },
      { label: 'Categories', href: '/admin/categories', icon: Tag, permission: 'category.read' },
      { label: 'Events', href: '/admin/events', icon: Calendar, permission: 'event.read' },
      { label: 'Impact records', href: '/admin/impact', icon: Target, permission: 'impact.read' },
      {
        label: 'Success stories',
        href: '/admin/stories',
        icon: Sparkles,
        permission: 'story.read',
      },
    ],
  },
  {
    label: 'Content',
    items: [
      { label: 'Pages', href: '/admin/pages', icon: Globe, permission: 'page.read' },
      { label: 'Blog', href: '/admin/blog', icon: BookOpen, permission: 'blog.read' },
      { label: 'Media library', href: '/admin/media', icon: Image, permission: 'media.read' },
      { label: 'FAQs', href: '/admin/faqs', icon: HelpCircle, permission: 'faq.read' },
      {
        label: 'Reports & documents',
        href: '/admin/documents',
        icon: FileText,
        permission: 'document.read',
      },
    ],
  },
  {
    label: 'Communication',
    items: [
      {
        label: 'Messages',
        href: '/admin/messages',
        icon: MessageSquare,
        permission: 'contact.read',
      },
      { label: 'Newsletter', href: '/admin/newsletter', icon: Mail, permission: 'newsletter.read' },
      {
        label: 'Notifications',
        href: '/admin/notifications',
        icon: Bell,
        permission: 'notification.read',
      },
      {
        label: 'Email templates',
        href: '/admin/notification-templates',
        icon: FileCode2,
        permission: 'notification.manage',
      },
      {
        label: 'Send log',
        href: '/admin/notifications/log',
        icon: ListOrdered,
        permission: 'notification.read',
      },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Users', href: '/admin/users', icon: UserCog, permission: 'user.read' },
      { label: 'Roles & permissions', href: '/admin/roles', icon: Shield, permission: 'role.read' },
      { label: 'Settings', href: '/admin/settings', icon: Sliders, permission: 'settings.read' },
      { label: 'Audit logs', href: '/admin/audit-logs', icon: History, permission: 'audit.read' },
    ],
  },
];

export function AdminSidebarContent({
  onNavigate,
  isCollapsed = false,
  actor,
}: {
  onNavigate?: () => void;
  isCollapsed?: boolean;
  actor?: { id: string; permissions: string[] };
}) {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={150}>
      <nav
        aria-label="Admin"
        className={cn(
          'flex flex-col transition-all duration-200',
          isCollapsed ? 'gap-4 p-2' : 'gap-5 p-3',
        )}
      >
        {adminNav.map((group, groupIdx) => {
          // Filter items by actor permissions if provided
          const visibleItems = group.items.filter((item) => {
            if (!item.permission || !actor?.permissions) return true;
            return actor.permissions.includes(item.permission);
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className="space-y-1">
              {!isCollapsed ? (
                <div className="px-2 pb-1 pt-1.5">
                  <p className="text-muted-foreground/80 text-[0.6875rem] font-bold uppercase tracking-wider">
                    {group.label}
                  </p>
                </div>
              ) : groupIdx > 0 ? (
                <div className="border-border/60 my-2 border-t" aria-hidden="true" />
              ) : null}

              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === '/admin'
                      ? pathname === '/admin' || pathname === '/admin/'
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);

                  if (isCollapsed) {
                    return (
                      <li key={item.href}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              href={item.href}
                              onClick={onNavigate}
                              aria-current={isActive ? 'page' : undefined}
                              className={cn(
                                'flex size-10 items-center justify-center rounded-xl transition-all',
                                'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                                isActive
                                  ? 'bg-primary text-primary-foreground shadow-xs'
                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                              )}
                            >
                              <Icon className="size-4 shrink-0" aria-hidden="true" />
                              <span className="sr-only">{item.label}</span>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right" sideOffset={12} className="font-medium">
                            <div className="flex items-center gap-1.5">
                              <span>{item.label}</span>
                              {item.phase ? (
                                <span className="bg-muted text-muted-foreground rounded px-1 text-[0.625rem]">
                                  {item.phase}
                                </span>
                              ) : null}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </li>
                    );
                  }

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'group relative flex min-h-9 items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                          'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                          isActive
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Icon
                            className={cn(
                              'size-4 shrink-0 transition-colors',
                              isActive
                                ? 'text-primary'
                                : 'text-muted-foreground group-hover:text-foreground',
                            )}
                            aria-hidden="true"
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {/* Active indicator bar */}
                        {isActive ? (
                          <span
                            className="bg-primary absolute bottom-1.5 left-0 top-1.5 w-1 rounded-r-full"
                            aria-hidden="true"
                          />
                        ) : null}

                        {item.phase ? (
                          <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[0.625rem] font-normal">
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
    </TooltipProvider>
  );
}
