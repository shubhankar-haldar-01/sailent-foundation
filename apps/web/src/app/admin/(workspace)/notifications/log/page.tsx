import Link from 'next/link';

import { RetryButton, StatusIcon } from '@/components/admin/notification-panels';
import { AdminApiError, sendLog } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const STATUSES = ['all', 'sent', 'failed', 'pending'] as const;

/**
 * The send log.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * RECIPIENTS APPEAR BY ID, NEVER BY ADDRESS.
 *
 * The API does not return one, and this screen could not show one if it
 * wanted to. An administrator asking "did that receipt go out" needs the
 * answer; they do not need a browsable list of donor email addresses, and a
 * screen that offered one would become the easiest place in the platform to
 * harvest them from.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function AdminSendLogPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();
  const active = params.status ?? 'all';

  let data;
  try {
    data = await sendLog({
      page: params.page,
      status: active === 'all' ? undefined : active,
    });
  } catch (error) {
    return (
      <p
        role="alert"
        className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
      >
        {error instanceof AdminApiError ? error.message : 'Could not load the send log.'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">Send log</h1>
        <p className="text-body-sm text-muted-foreground mt-1 max-w-2xl">
          {data.pagination.total} entries. Every transactional message the platform has produced,
          and what happened to it. Recipients are shown by record, not by address.
        </p>
      </header>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {STATUSES.map((status) => (
          <Link
            key={status}
            href={
              status === 'all'
                ? '/admin/notifications/log'
                : `/admin/notifications/log?status=${status}`
            }
            aria-current={active === status ? 'page' : undefined}
            className={
              active === status
                ? 'bg-foreground text-background text-body-sm rounded-full px-3 py-1.5 font-semibold'
                : 'border-border text-body-sm hover:bg-muted rounded-full border px-3 py-1.5'
            }
          >
            {status === 'all' ? 'All' : status[0]!.toUpperCase() + status.slice(1)}
          </Link>
        ))}
      </nav>

      {data.items.length === 0 ? (
        <p className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed p-8 text-center">
          Nothing here yet.
        </p>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[52rem] text-left">
            <thead className="bg-muted/60 text-caption text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  What
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Channel
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  When
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {data.items.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/40 align-top">
                  <td className="px-4 py-3">
                    <span className="text-body-sm inline-flex items-center gap-1.5 font-semibold">
                      <StatusIcon status={entry.status} />
                      {entry.status}
                    </span>
                    {entry.error ? (
                      <p className="text-caption text-destructive mt-1 max-w-56">{entry.error}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-body-sm font-semibold">{entry.title}</p>
                    <p className="text-caption text-muted-foreground mt-0.5 font-mono">
                      {entry.type}
                      {entry.templateVersion ? ` · template v${entry.templateVersion}` : ''}
                    </p>
                  </td>
                  <td className="text-body-sm text-muted-foreground px-4 py-3">{entry.channel}</td>
                  <td className="text-body-sm text-muted-foreground px-4 py-3">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {entry.status === 'failed' &&
                    entry.channel === 'email' &&
                    can(actor, 'notification.send') ? (
                      <RetryButton id={entry.id} retryCount={entry.retryCount} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
