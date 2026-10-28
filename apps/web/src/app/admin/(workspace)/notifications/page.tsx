import Link from 'next/link';
import { Bell, CheckCircle2, History } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from '@sailent/ui';

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
        <PageHeader
          title="Staff Alerts & Notifications"
          description="Operational system alerts, batch failures, and webhook execution notices for your administrator account."
          count={unread}
          actions={
            <div className="flex items-center gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href="/admin/notifications/log">
                  <History className="mr-1.5 size-4" />
                  View Send Log
                </Link>
              </Button>
              <MarkAllReadButton disabled={unread === 0} />
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { label: 'All', href: '/admin/notifications', active: !unreadOnly },
            { label: 'Unread', href: '/admin/notifications?unread=true', active: unreadOnly },
          ].map((filter) => (
            <Link
              key={filter.label}
              href={filter.href}
              aria-current={filter.active ? 'page' : undefined}
              className={`text-caption rounded-full px-3 py-1 font-medium capitalize transition-colors ${
                filter.active
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="text-primary size-4" />
              Notification Feed
            </CardTitle>
            <CardDescription>
              Showing {data.items.length} {unreadOnly ? 'unread' : 'total'} notification items
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.items.length === 0 ? (
              <div className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed py-12 text-center">
                Nothing to report. System alerts and failed transactional tasks appear here.
              </div>
            ) : (
              <div className="border-border/70 divide-border/70 divide-y overflow-hidden rounded-lg border">
                {data.items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-start justify-between gap-4 p-4 transition-colors ${
                      item.readAt ? 'bg-surface' : 'bg-primary/5'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-body-sm text-foreground font-semibold">
                          {item.title}
                        </span>
                        {!item.readAt ? (
                          <Badge variant="accent" className="text-caption font-normal">
                            Unread
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-body-sm text-muted-foreground">{item.message}</p>
                      <p className="text-caption text-muted-foreground/80 pt-1 font-mono">
                        {new Date(item.createdAt).toLocaleString('en-IN')}
                      </p>
                    </div>
                    {item.readAt ? (
                      <span className="text-caption text-muted-foreground/70 flex shrink-0 items-center gap-1 self-start pt-1 font-mono">
                        <CheckCircle2 className="text-muted-foreground/60 size-3" />
                        Read
                      </span>
                    ) : (
                      <div className="shrink-0 pt-0.5">
                        <MarkReadButton id={item.id} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'REAUTH_REQUIRED') {
      return <ReauthPanel returnTo="/admin/notifications" what="These are your notifications." />;
    }
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="text-body-sm text-destructive p-4">
          {error instanceof AdminApiError ? error.message : 'Could not load your notifications.'}
        </CardContent>
      </Card>
    );
  }
}
