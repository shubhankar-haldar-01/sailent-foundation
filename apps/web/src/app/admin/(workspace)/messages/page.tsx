import Link from 'next/link';

import { AdminApiError, listContactMessages, type ContactStatus } from '@/lib/admin/api';
import { CONTACT_SUBJECT_LABELS, type ContactSubject } from '@sailent/validation';

export const dynamic = 'force-dynamic';

const FILTERS: { value: ContactStatus | 'all'; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'handled', label: 'Handled' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
];

/**
 * Messages from the website contact form (Phase 13).
 *
 * Every message is stored before it is emailed, so this inbox is complete even
 * when email is not configured or failed. The list opens on what still needs
 * an answer.
 */
export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const active = (FILTERS.find((filter) => filter.value === params.status)?.value ?? 'new') as
    ContactStatus | 'all';

  let data;
  try {
    data = await listContactMessages({ status: active, page: params.page });
  } catch (error) {
    return (
      <p
        role="alert"
        className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
      >
        {error instanceof AdminApiError ? error.message : 'Could not load messages.'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">Messages</h1>
        <p className="text-body-sm text-muted-foreground mt-1 max-w-2xl">
          What people sent through the contact form. Each one is also emailed to the contact address
          in Settings; mark it handled once somebody has replied.
        </p>
      </header>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const count = filter.value === 'all' ? undefined : data.counts[filter.value];
          return (
            <Link
              key={filter.value}
              href={`/admin/messages?status=${filter.value}`}
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
          {active === 'new' ? 'No new messages.' : 'Nothing here.'}
        </p>
      ) : (
        <ul className="border-border divide-border divide-y rounded-lg border">
          {data.items.map((message) => (
            <li key={message.id}>
              <Link
                href={`/admin/messages/${message.id}`}
                className="hover:bg-muted/40 focus-visible:outline-ring block px-4 py-3 focus-visible:outline-2"
              >
                <p className="text-body-sm flex flex-wrap justify-between gap-2">
                  <span className="font-semibold">
                    {message.name} ·{' '}
                    {CONTACT_SUBJECT_LABELS[message.subject as ContactSubject] ?? message.subject}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(message.createdAt).toLocaleString('en-IN')}
                  </span>
                </p>
                <p className="text-body-sm text-muted-foreground mt-1 line-clamp-2">
                  {message.preview}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data.pagination.totalPages > 1 ? (
        <nav aria-label="Pages" className="text-body-sm flex gap-4">
          {data.pagination.page > 1 ? (
            <Link href={`/admin/messages?status=${active}&page=${data.pagination.page - 1}`}>
              Previous
            </Link>
          ) : null}
          <span>
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          {data.pagination.hasNext ? (
            <Link href={`/admin/messages?status=${active}&page=${data.pagination.page + 1}`}>
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
