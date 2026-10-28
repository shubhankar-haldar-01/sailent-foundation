'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Shield, X } from 'lucide-react';
import { Button, cn } from '@sailent/ui';

import type { AdminUser } from '@/lib/admin/api';
import type { StaffActor } from '@/lib/auth/session';
import { AdminHeader } from './admin-header';
import { AdminSidebarContent } from './admin-sidebar';

export function AdminShell({
  children,
  actor,
  user,
  unreadCount = 0,
}: {
  children: React.ReactNode;
  unreadCount?: number;
  actor?: StaffActor;
  user?: AdminUser | null;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);

  // Initialize collapsed preference on client mount
  React.useEffect(() => {
    setIsMounted(true);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('sailent_admin_collapsed');
        if (saved !== null) {
          setIsCollapsed(saved === 'true');
        }
      }
    } catch {
      // Ignore storage restrictions (e.g. private browsing or test environments)
    }
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('sailent_admin_collapsed', String(next));
        }
      } catch {
        // Ignore storage restrictions
      }
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (!isSidebarOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSidebarOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isSidebarOpen]);

  return (
    <div data-surface="admin" className="bg-background text-foreground min-h-dvh">
      <a
        href="#admin-content"
        className="skip-link bg-primary text-primary-foreground rounded-md px-4 py-2 font-medium"
      >
        Skip to content
      </a>

      <div className="flex min-h-dvh">
        {/* Desktop Sidebar: Persistent & Collapsible */}
        <aside
          className={cn(
            'border-border bg-surface hidden shrink-0 border-r transition-all duration-200 lg:block',
            isMounted && isCollapsed ? 'w-16' : 'w-64',
          )}
        >
          <div className="sticky top-0 flex h-dvh flex-col">
            {/* Sidebar Brand Header */}
            <div className="border-border flex h-14 shrink-0 items-center border-b px-3">
              <Link
                href="/admin"
                className={cn(
                  'flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-90',
                  'focus-visible:outline-ring focus-visible:outline-2',
                  isMounted && isCollapsed ? 'w-full justify-center' : '',
                )}
              >
                <div className="bg-primary text-primary-foreground shadow-xs flex size-8 shrink-0 items-center justify-center rounded-lg font-bold">
                  <Shield className="size-4.5" aria-hidden="true" />
                </div>
                {(!isMounted || !isCollapsed) && (
                  <div className="flex min-w-0 flex-col">
                    <span className="text-foreground truncate text-sm font-bold tracking-tight">
                      Sailent Admin
                    </span>
                    <span className="text-muted-foreground text-[0.625rem] font-medium uppercase tracking-wider">
                      Operations Hub
                    </span>
                  </div>
                )}
              </Link>
            </div>

            {/* Sidebar Navigation */}
            <div className="flex-1 overflow-y-auto">
              <AdminSidebarContent isCollapsed={isMounted && isCollapsed} actor={actor} />
            </div>

            {/* Sidebar Footer: Collapse Toggle */}
            <div className="border-border border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleCollapsed}
                className={cn(
                  'text-muted-foreground hover:text-foreground w-full justify-start gap-2 text-xs',
                  isMounted && isCollapsed ? 'justify-center px-0' : 'px-3',
                )}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isMounted && isCollapsed ? (
                  <ChevronRight className="size-4" aria-hidden="true" />
                ) : (
                  <>
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    <span>Collapse sidebar</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </aside>

        {/* Mobile and Tablet: Off-canvas Navigation Drawer */}
        {isSidebarOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setIsSidebarOpen(false)}
              className="backdrop-blur-xs absolute inset-0 bg-neutral-950/60 transition-opacity"
            />

            {/* Slide-in Drawer */}
            <div className="border-border bg-surface absolute inset-y-0 left-0 flex w-72 flex-col border-r shadow-2xl">
              <div className="border-border flex h-14 shrink-0 items-center justify-between border-b px-4">
                <Link
                  href="/admin"
                  onClick={() => setIsSidebarOpen(false)}
                  className="flex items-center gap-2.5"
                >
                  <div className="bg-primary text-primary-foreground shadow-xs flex size-8 items-center justify-center rounded-lg font-bold">
                    <Shield className="size-4.5" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-foreground text-sm font-bold tracking-tight">
                      Sailent Admin
                    </span>
                    <span className="text-muted-foreground text-[0.625rem] font-medium uppercase">
                      Operations Hub
                    </span>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  aria-label="Close navigation"
                  className="text-muted-foreground hover:text-foreground focus-visible:outline-ring rounded-lg p-1.5 transition-colors focus-visible:outline-2"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <AdminSidebarContent onNavigate={() => setIsSidebarOpen(false)} actor={actor} />
              </div>
            </div>
          </div>
        ) : null}

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader
            onOpenSidebar={() => setIsSidebarOpen(true)}
            isCollapsed={isMounted && isCollapsed}
            onToggleCollapse={toggleCollapsed}
            unreadCount={unreadCount}
            user={user}
            actor={actor}
          />
          <main id="admin-content" className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
