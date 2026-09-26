'use client';

import * as React from 'react';

import { AdminHeader } from './admin-header';
import { AdminSidebarContent } from './admin-sidebar';

/**
 * Admin shell.
 *
 * Responsive strategy from docs/design-system.md §9:
 *   mobile  — off-canvas drawer
 *   tablet  — off-canvas drawer (a 768px icon rail costs more than it returns)
 *   desktop — persistent sidebar
 *
 * The `data-surface="admin"` attribute is what switches the neutral hue from
 * warm to cool and tightens the radius. One attribute, no second token set —
 * which is how "two experiences, one design system" is true in code rather
 * than only in the documentation.
 */
export function AdminShell({
  children,
  actor,
  unreadCount = 0,
}: {
  children: React.ReactNode;
  /** Unread in-app notifications, read server-side by the layout. */
  unreadCount?: number;
  /**
   * The signed-in staff member. Passed down so the sidebar can hide menu
   * items the viewer has no permission for — a courtesy, since the API
   * refuses the request either way.
   */
  actor?: { id: string; permissions: string[] };
}) {
  // Threaded to the sidebar so it can hide what the viewer cannot use.
  void actor;
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isSidebarOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSidebarOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isSidebarOpen]);

  return (
    <div data-surface="admin" className="bg-background min-h-dvh">
      <a
        href="#admin-content"
        className="skip-link bg-primary text-primary-foreground rounded-md px-4 py-2"
      >
        Skip to content
      </a>

      <div className="flex min-h-dvh">
        {/* Desktop: persistent. */}
        <aside className="border-border bg-surface hidden w-64 shrink-0 border-r lg:block">
          <div className="sticky top-0 flex h-dvh flex-col overflow-y-auto">
            <div className="border-border flex h-14 shrink-0 items-center border-b px-4">
              <span className="font-semibold">Sailent Admin</span>
            </div>
            <AdminSidebarContent />
          </div>
        </aside>

        {/* Mobile and tablet: off-canvas. */}
        {isSidebarOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 bg-neutral-950/50"
            />
            <div className="border-border bg-surface absolute inset-y-0 left-0 w-72 overflow-y-auto border-r">
              <div className="border-border flex h-14 shrink-0 items-center border-b px-4">
                <span className="font-semibold">Sailent Admin</span>
              </div>
              <AdminSidebarContent onNavigate={() => setIsSidebarOpen(false)} />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader onOpenSidebar={() => setIsSidebarOpen(true)} unreadCount={unreadCount} />
          <main id="admin-content" className="flex-1 p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
