'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Bell,
  ExternalLink,
  History,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Shield,
  Sliders,
} from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from '@sailent/ui';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { signOut } from '@/lib/auth/actions';
import type { AdminUser } from '@/lib/admin/api';
import type { StaffActor } from '@/lib/auth/session';
import { AdminBreadcrumbs } from './admin-breadcrumbs';
import { AdminSearchDialog } from './admin-search-dialog';

export function AdminHeader({
  onOpenSidebar,
  isCollapsed = false,
  onToggleCollapse,
  unreadCount = 0,
  user,
}: {
  onOpenSidebar: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  unreadCount?: number;
  user?: AdminUser | null;
  actor?: StaffActor | null;
}) {
  const [searchOpen, setSearchOpen] = React.useState(false);

  // Global Cmd+K / Ctrl+K shortcut listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
    : 'Development Admin';
  const displayEmail = user?.email || 'admin@sailent.local';
  const roleName = user?.roles?.[0]?.name || 'SUPER_ADMIN';

  const initials = user?.firstName
    ? `${user.firstName.charAt(0)}${user.lastName ? user.lastName.charAt(0) : ''}`.toUpperCase()
    : 'AD';

  return (
    <TooltipProvider delayDuration={200}>
      <header className="border-border bg-surface/95 backdrop-blur-xs sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b px-4 lg:px-6">
        {/* Left: Mobile open, Desktop collapse toggle, and Breadcrumbs */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger menu */}
          <button
            type="button"
            onClick={onOpenSidebar}
            aria-label="Open navigation"
            className={cn(
              'inline-flex size-8 items-center justify-center rounded-lg lg:hidden',
              'hover:bg-muted text-muted-foreground hover:text-foreground transition-colors',
              'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
            )}
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>

          {/* Desktop collapse toggle */}
          {onToggleCollapse ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  className={cn(
                    'hidden size-8 items-center justify-center rounded-lg lg:inline-flex',
                    'hover:bg-muted text-muted-foreground hover:text-foreground transition-colors',
                    'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                  )}
                >
                  {isCollapsed ? (
                    <PanelLeftOpen className="size-4" aria-hidden="true" />
                  ) : (
                    <PanelLeftClose className="size-4" aria-hidden="true" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span>{isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
              </TooltipContent>
            </Tooltip>
          ) : null}

          {/* Breadcrumbs */}
          <AdminBreadcrumbs />
        </div>

        {/* Right: Quick Search, Theme Toggle, Notification Bell, User Menu */}
        <div className="flex items-center gap-2">
          {/* Quick jump search button */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className={cn(
              'border-border/80 bg-muted/40 text-muted-foreground hidden items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs sm:flex',
              'hover:bg-muted/80 hover:text-foreground transition-colors',
              'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
            )}
            aria-label="Quick jump (⌘K)"
          >
            <Search className="size-3.5" aria-hidden="true" />
            <span className="hidden md:inline">Quick jump...</span>
            <kbd className="border-border bg-surface text-muted-foreground/80 rounded border px-1 py-0.5 text-[0.625rem] font-medium">
              ⌘K
            </kbd>
          </button>

          {/* Light / Dark Mode Toggle */}
          <ThemeToggle className="size-8" />

          {/* Notifications Bell */}
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground relative size-8"
            aria-label={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : 'Notifications, none unread'
            }
          >
            <Link href="/admin/notifications">
              <Bell className="size-4" aria-hidden="true" />
              {unreadCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="bg-destructive text-caption shadow-xs absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full px-1 font-bold text-white"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : null}
            </Link>
          </Button>

          {/* User Account Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex items-center gap-2 rounded-full p-0.5 transition-all',
                  'hover:ring-border hover:ring-2',
                  'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                )}
                aria-label="Open account menu"
              >
                <Avatar size="sm" className="border-border size-8 border">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-60 p-1 shadow-lg">
              <DropdownMenuLabel className="p-2">
                <div className="flex flex-col space-y-1">
                  <p className="text-foreground truncate text-xs font-semibold">{displayName}</p>
                  <p className="text-muted-foreground truncate text-[0.6875rem]">{displayEmail}</p>
                  <div className="pt-1">
                    <span className="bg-primary/10 text-primary inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.625rem] font-semibold">
                      {roleName}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings" className="flex items-center gap-2 text-xs">
                    <Sliders className="text-muted-foreground size-3.5" aria-hidden="true" />
                    <span>Organization Settings</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href="/admin/roles" className="flex items-center gap-2 text-xs">
                    <Shield className="text-muted-foreground size-3.5" aria-hidden="true" />
                    <span>Roles & Permissions</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href="/admin/audit-logs" className="flex items-center gap-2 text-xs">
                    <History className="text-muted-foreground size-3.5" aria-hidden="true" />
                    <span>Audit Logs</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href="/" target="_blank" className="flex items-center gap-2 text-xs">
                    <ExternalLink className="text-muted-foreground size-3.5" aria-hidden="true" />
                    <span>Public Website</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              {/* Working server-action sign out */}
              <form action={signOut} className="w-full">
                <button
                  type="submit"
                  className={cn(
                    'text-destructive hover:bg-destructive/10 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                    'focus-visible:outline-ring focus-visible:outline-2',
                  )}
                >
                  <LogOut className="size-3.5" aria-hidden="true" />
                  <span>Sign out</span>
                </button>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Command Search Dialog */}
        <AdminSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      </header>
    </TooltipProvider>
  );
}
