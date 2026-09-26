import * as React from 'react';

import { redirect } from 'next/navigation';

import { AdminShell } from '@/components/admin/admin-shell';
import { can, currentActor } from '@/lib/auth/session';
import { unreadNotificationCount } from '@/lib/admin/api';

/**
 * Admin layout.
 *
 * Redirects to sign-in without a live staff session. This is a CONVENIENCE,
 * not the control: it stops an operator staring at an empty screen full of
 * failed requests. Every API call is authorized independently at the Nest
 * guard, so a hand-crafted request with no session fails there regardless of
 * what this layout does.
 *
 * The sidebar filters itself by the viewer's permissions for the same reason —
 * so nobody is shown a menu item that leads to a 403.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor();
  if (!actor) redirect('/admin/login');

  /*
    The bell's count, read HERE rather than in the browser.

    The admin UI never fetches from the API client-side — the token lives in an
    httpOnly cookie and the BFF boundary (decision A1) is what keeps it there.
    A failure must not take the whole workspace down with it, so a count that
    cannot be read is simply zero.
  */
  let unreadCount = 0;
  if (can(actor, 'notification.read')) {
    try {
      unreadCount = (await unreadNotificationCount()).unread;
    } catch {
      unreadCount = 0;
    }
  }

  return (
    <AdminShell actor={actor} unreadCount={unreadCount}>
      {children}
    </AdminShell>
  );
}
