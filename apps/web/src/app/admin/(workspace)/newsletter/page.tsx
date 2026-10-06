import Link from 'next/link';

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
      <p
        role="alert"
        className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
      >
        {error instanceof AdminApiError ? error.message : 'Could not load subscriptions.'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">Newsletter</h1>
        <p className="text-body-sm text-muted-foreground mt-1 max-w-2xl">
          People who asked for the newsletter from the website. Only confirmed addresses count as
          subscribed. This site does not send newsletters; it keeps the record of who agreed to
          receive one, and every confirmation email carries an unsubscribe link.
        </p>
      </header>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const count = filter.value === 'all' ? undefined : (data.counts[filter.value] ?? 0);
          return (
            <Link
              key={filter.value}
              href={`/admin/newsletter?status=${filter.value}`}
              aria-current={active === filter.value ? 'page' : undefined}
              className={
                active === filter.value
                  ? 'bg-foreground text-background text-body-sm rounded-full px-3 py-1.5 font-semibold'
                  : 'border-border text-body-sm hover:bg-muted rounded-full border px-3 py-1.5'
              }
            >
              {filter.label}
              {count !== undefined ? ` (${count})` : ''}
            </Link>
          );
        })}
      </nav>

      {data.items.length === 0 ? (
        <p className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed p-8 text-center">
          Nobody here yet.
        </p>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[36rem] text-left">
            <thead className="bg-muted/60 text-caption text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Email
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Since
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {data.items.map((row) => (
                <tr key={row.id}>
                  <td className="text-body-sm break-all px-4 py-3">{row.email}</td>
                  <td className="text-body-sm px-4 py-3">{row.status}</td>
                  <td className="text-body-sm text-muted-foreground px-4 py-3">
                    {new Date(
                      row.unsubscribedAt ?? row.confirmedAt ?? row.createdAt,
                    ).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.pagination.totalPages > 1 ? (
        <nav aria-label="Pages" className="text-body-sm flex gap-4">
          {data.pagination.page > 1 ? (
            <Link href={`/admin/newsletter?status=${active}&page=${data.pagination.page - 1}`}>
              Previous
            </Link>
          ) : null}
          <span>
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          {data.pagination.hasNext ? (
            <Link href={`/admin/newsletter?status=${active}&page=${data.pagination.page + 1}`}>
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
