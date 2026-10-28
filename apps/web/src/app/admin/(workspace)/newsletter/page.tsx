import Link from 'next/link';
import { MailCheck } from 'lucide-react';

import {
  Badge,
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

import { AdminApiError, listNewsletterSubscribers, type NewsletterStatus } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

const FILTERS: { value: NewsletterStatus | 'all'; label: string }[] = [
  { value: 'subscribed', label: 'Subscribed' },
  { value: 'pending', label: 'Awaiting confirmation' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
  { value: 'all', label: 'All' },
];

/**
 * Newsletter subscriptions (Phase 13). Read-only.
 *
 * Double opt-in: an address appears as Subscribed only after its owner
 * followed the confirmation link. The platform records consent; it does not
 * send newsletters — that is done with a mailing tool, using the Subscribed
 * list only.
 */
export default async function AdminNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const active = (FILTERS.find((filter) => filter.value === params.status)?.value ??
    'subscribed') as NewsletterStatus | 'all';

  let data;
  try {
    data = await listNewsletterSubscribers({ status: active, page: params.page });
  } catch (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="text-body-sm text-destructive p-4">
          {error instanceof AdminApiError ? error.message : 'Could not load subscriptions.'}
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'subscribed':
        return <Badge variant="success">Subscribed</Badge>;
      case 'pending':
        return <Badge variant="warning">Awaiting confirmation</Badge>;
      case 'unsubscribed':
        return <Badge variant="neutral">Unsubscribed</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Newsletter Subscribers"
        description="Subscriber consent directory following double opt-in verification. Used for audit records and broadcast audience exports."
        count={data.counts.subscribed}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((filter) => {
          const count = filter.value === 'all' ? undefined : (data.counts[filter.value] ?? 0);
          const isActive = active === filter.value;
          return (
            <Link
              key={filter.value}
              href={`/admin/newsletter?status=${filter.value}`}
              aria-current={isActive ? 'page' : undefined}
              className={`text-caption rounded-full px-3 py-1 font-medium capitalize transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {filter.label}
              {count !== undefined ? ` (${count})` : ''}
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MailCheck className="text-primary size-4" />
            Verified Subscribers
          </CardTitle>
          <CardDescription>Showing {data.items.length} records in current view</CardDescription>
        </CardHeader>
        <CardContent>
          {data.items.length === 0 ? (
            <div className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed py-12 text-center">
              No subscriber records found.
            </div>
          ) : (
            <div className="border-border/70 overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold">Email Address</TableHead>
                    <TableHead className="font-semibold">Subscription Status</TableHead>
                    <TableHead className="text-right font-semibold">Consent Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-body-sm font-mono font-medium">
                        {row.email}
                      </TableCell>
                      <TableCell>{getStatusBadge(row.status)}</TableCell>
                      <TableCell className="text-body-sm text-muted-foreground text-right font-mono">
                        {new Date(
                          row.unsubscribedAt ?? row.confirmedAt ?? row.createdAt,
                        ).toLocaleDateString('en-IN')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {data.pagination.totalPages > 1 ? (
            <div className="border-border mt-4 flex items-center justify-between border-t pt-4">
              <p className="text-body-sm text-muted-foreground">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </p>
              <div className="flex gap-2">
                {data.pagination.page > 1 ? (
                  <Button asChild variant="secondary" size="sm">
                    <Link
                      href={`/admin/newsletter?status=${active}&page=${data.pagination.page - 1}`}
                    >
                      Previous
                    </Link>
                  </Button>
                ) : null}
                {data.pagination.hasNext ? (
                  <Button asChild variant="secondary" size="sm">
                    <Link
                      href={`/admin/newsletter?status=${active}&page=${data.pagination.page + 1}`}
                    >
                      Next
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
