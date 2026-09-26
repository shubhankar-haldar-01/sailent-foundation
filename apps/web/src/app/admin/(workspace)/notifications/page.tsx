import Link from 'next/link';

import { MarkAllReadButton, MarkReadButton } from '@/components/admin/notification-panels';
import { ReauthPanel } from '@/components/admin/reauth-panel';
import { AdminApiError, listNotifications } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

/**
 * In-app notifications for the signed-in administrator.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS IS WHERE A FAILED SEND BECOMES SOMETHING SOMEBODY KNOWS ABOUT.
 *
 * §4.21: "a failed send is retried and visible to admins." The retry is the
 * worker's; the visibility is this screen and the bell above it. A send log
 * nobody opens is not visibility — the person who needs to know a donor never
 * got their receipt is not going to check on the off chance.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; unread?: string }>;
}) {
  const params = await searchParams;
  const unreadOnly = params.unread === 'true';

  try {
    const data = await listNotifications({ page: params.page, unreadOnly });
    const unread = data.items.filter((item) => !item.readAt).length;

    return (
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-h1 font-bold tracking-tight">Notifications</h1>
            <p className="text-body-sm text-muted-foreground mt-1 max-w-2xl">
              What the platform needs you to know — chiefly, emails that did not go out. The full
              record of every send is in the{' '}
              <Link href="/admin/notifications/log" className="hover:text-foreground underline">
                send log
              </Link>
              .
            </p>
          </div>
          <MarkAllReadButton disabled={unread === 0} />
        </header>

        <nav aria-label="Filter" className="flex gap-2">
          {[
            { label: 'All', href: '/admin/notifications', active: !unreadOnly },
            { label: 'Unread', href: '/admin/notifications?unread=true', active: unreadOnly },
          ].map((filter) => (
            <Link
              key={filter.label}
              href={filter.href}
              aria-current={filter.active ? 'page' : undefined}
              className={
                filter.active
                  ? 'bg-foreground text-background text-body-sm rounded-full px-3 py-1.5 font-semibold'
                  : 'border-border text-body-sm hover:bg-muted rounded-full border px-3 py-1.5'
              }
            >
              {filter.label}
            </Link>
          ))}
        </nav>

        {data.items.length === 0 ? (
          <p className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed p-8 text-center">
            Nothing to report. Failed sends appear here.
          </p>
        ) : (
          <ul className="border-border divide-border divide-y rounded-lg border">
            {data.items.map((item) => (
              <li
                key={item.id}
                className={item.readAt ? 'flex gap-4 p-4' : 'bg-info-subtle/40 flex gap-4 p-4'}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-semibold">{item.title}</p>
                  <p className="text-body-sm text-muted-foreground mt-0.5">{item.message}</p>
                  <p className="text-caption text-muted-foreground mt-1">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                {item.readAt ? (
                  <span className="text-caption text-muted-foreground shrink-0 self-start pt-1">
                    Read
                  </span>
                ) : (
                  <MarkReadButton id={item.id} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'REAUTH_REQUIRED') {
      return <ReauthPanel returnTo="/admin/notifications" what="These are your notifications." />;
    }
    return (
      <p
        role="alert"
        className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
      >
        {error instanceof AdminApiError ? error.message : 'Could not load your notifications.'}
      </p>
    );
  }
}
