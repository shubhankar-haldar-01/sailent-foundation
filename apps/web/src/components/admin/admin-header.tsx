'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell, LogOut, Menu, User } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from '@sailent/ui';

/**
 * Admin header.
 *
 * The user menu is a structural placeholder; sign-out is wired against the
 * module that owns it.
 *
 * THE BELL IS REAL as of Phase 10.11. Its count is passed in from the layout,
 * which is a server component and can read it without the browser holding a
 * token — the same reason nothing else in the admin fetches client-side.
 */
export function AdminHeader({
  onOpenSidebar,
  unreadCount = 0,
}: {
  onOpenSidebar: () => void;
  /** Unread in-app notifications for the signed-in administrator. */
  unreadCount?: number;
}) {
  return (
    <header className="border-border bg-surface sticky top-0 z-40 flex h-14 items-center gap-3 border-b px-4">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-md lg:hidden',
          'hover:bg-muted transition-colors',
          'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
        )}
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      <Link
        href="/admin"
        className="text-body-sm focus-visible:outline-ring rounded-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 lg:hidden"
      >
        Sailent Admin
      </Link>

      <div className="ml-auto flex items-center gap-1">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="relative size-9"
          aria-label={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications, none unread'
          }
        >
          <Link href="/admin/notifications">
            <Bell aria-hidden="true" />
            {unreadCount > 0 ? (
              /*
                The count is in the LABEL above, not only in this dot — a badge
                a screen reader cannot read is decoration, and "you have unread
                notifications" is exactly the kind of thing that must not be
                conveyed by colour and position alone.
              */
              <span
                aria-hidden="true"
                className="bg-destructive text-caption absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full px-1 font-bold text-white"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'rounded-full transition-opacity hover:opacity-80',
                'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
              )}
            >
              <Avatar size="sm">
                <AvatarFallback>SF</AvatarFallback>
              </Avatar>
              <span className="sr-only">Open account menu</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Signed out</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User aria-hidden="true" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <LogOut aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
