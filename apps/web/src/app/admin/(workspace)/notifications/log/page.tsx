import Link from 'next/link';
import { Send, ArrowLeft } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@sailent/ui';

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
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="text-body-sm text-destructive p-4">
          {error instanceof AdminApiError ? error.message : 'Could not load the send log.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transaction Send Log"
        description="Delivery tracking for every transactional email produced by the platform. Recipients are identified by record ID to safeguard donor privacy."
        count={data.pagination.total}
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/notifications">
              <ArrowLeft className="mr-1.5 size-4" />
              Alerts Feed
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {STATUSES.map((status) => {
          const isActive = active === status;
          return (
            <Link
              key={status}
              href={
                status === 'all'
                  ? '/admin/notifications/log'
                  : `/admin/notifications/log?status=${status}`
              }
              aria-current={isActive ? 'page' : undefined}
              className={`text-caption rounded-full px-3 py-1 font-medium capitalize transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {status}
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="text-primary size-4" />
            Dispatch Log Records
          </CardTitle>
          <CardDescription>
            Showing {data.items.length} {active} transactional records
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.items.length === 0 ? (
            <div className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed py-12 text-center">
              No transmission records matching current criteria.
            </div>
          ) : (
            <div className="border-border/70 overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold">Delivery Status</TableHead>
                    <TableHead className="font-semibold">Message & Template</TableHead>
                    <TableHead className="font-semibold">Transport Channel</TableHead>
                    <TableHead className="font-semibold">Queued At</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((entry) => (
                    <TableRow key={entry.id} className="align-top">
                      <TableCell>
                        <div className="text-body-sm inline-flex items-center gap-1.5 font-semibold capitalize">
                          <StatusIcon status={entry.status} />
                          {entry.status}
                        </div>
                        {entry.error ? (
                          <p className="text-caption text-destructive mt-1 max-w-xs break-words">
                            {entry.error}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-body-sm font-semibold">{entry.title}</p>
                        <p className="text-caption text-muted-foreground/80 mt-0.5 font-mono">
                          {entry.type}
                          {entry.templateVersion ? ` · template v${entry.templateVersion}` : ''}
                        </p>
                      </TableCell>
                      <TableCell className="text-body-sm text-muted-foreground text-caption font-mono uppercase">
                        {entry.channel}
                      </TableCell>
                      <TableCell className="text-body-sm text-muted-foreground font-mono">
                        {new Date(entry.createdAt).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.status === 'failed' &&
                        entry.channel === 'email' &&
                        can(actor, 'notification.send') ? (
                          <RetryButton id={entry.id} retryCount={entry.retryCount} />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
