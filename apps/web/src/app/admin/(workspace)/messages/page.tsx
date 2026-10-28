import Link from 'next/link';
import { Mail, MessageSquare } from 'lucide-react';

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
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="text-body-sm text-destructive p-4">
          {error instanceof AdminApiError ? error.message : 'Could not load messages.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contact Messages"
        description="Inquiries submitted via the public contact form. Messages are persisted locally and mirrored to the staff contact inbox."
        count={data.counts.new}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((filter) => {
          const count = filter.value === 'all' ? undefined : data.counts[filter.value];
          const isActive = active === filter.value;
          return (
            <Link
              key={filter.value}
              href={`/admin/messages?status=${filter.value}`}
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
            <Mail className="text-primary size-4" />
            Inbox Messages
          </CardTitle>
          <CardDescription>
            Showing {data.items.length} {active} message items
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.items.length === 0 ? (
            <div className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed py-12 text-center">
              {active === 'new'
                ? 'No new inquiries pending response.'
                : 'No messages match this filter.'}
            </div>
          ) : (
            <div className="border-border/70 divide-border/70 divide-y overflow-hidden rounded-lg border">
              {data.items.map((message) => (
                <Link
                  key={message.id}
                  href={`/admin/messages/${message.id}`}
                  className="hover:bg-muted/40 focus-visible:outline-ring block p-4 transition-colors focus-visible:outline-2"
                >
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="text-primary size-4 shrink-0" />
                      <span className="text-body-sm text-foreground font-semibold">
                        {message.name}
                      </span>
                      <Badge variant="neutral" className="text-caption font-normal">
                        {CONTACT_SUBJECT_LABELS[message.subject as ContactSubject] ??
                          message.subject}
                      </Badge>
                    </div>
                    <span className="text-caption text-muted-foreground font-mono">
                      {new Date(message.createdAt).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-body-sm text-muted-foreground mt-2 line-clamp-2 pl-6">
                    {message.preview}
                  </p>
                </Link>
              ))}
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
                      href={`/admin/messages?status=${active}&page=${data.pagination.page - 1}`}
                    >
                      Previous
                    </Link>
                  </Button>
                ) : null}
                {data.pagination.hasNext ? (
                  <Button asChild variant="secondary" size="sm">
                    <Link
                      href={`/admin/messages?status=${active}&page=${data.pagination.page + 1}`}
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
