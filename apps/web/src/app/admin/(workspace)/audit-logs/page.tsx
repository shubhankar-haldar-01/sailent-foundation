import Link from 'next/link';
import { Button, Card, CardContent, PageHeader, Badge } from '@sailent/ui';
import { Filter, History } from 'lucide-react';

import { listAuditEntries, type AdminAuditEntry } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

/**
 * The audit log — READ ONLY, and it has no other mode.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * Decision A10: the log is APPEND-ONLY. There is no update or delete path in
 * the API, and this screen adds none — no edit control, no bulk action, no
 * "clear" button. A log somebody can tidy is not evidence of anything.
 *
 * WHAT IS SHOWN AND WHY IT IS SAFE.
 *
 * `oldValues`/`newValues` are redacted at WRITE time by the API's `redact()`:
 * passwords, hashes, tokens, OTP codes, PAN and card data never reach the
 * column at all. So what survives is safe to display, and displaying it is the
 * entire point — an audit row that says "something changed" without saying
 * what is not worth keeping.
 *
 * They are still folded into a `<details>` rather than spread across the
 * table. A diff can contain a donor's address or phone number, and those
 * belong behind a deliberate click rather than on screen for anyone walking
 * past, which is the same reasoning the donor screens use.
 *
 * `actorEmailSnapshot` is the address AS IT WAS when the action happened, not
 * a join. An administrator who is later renamed or removed does not rewrite
 * history — before Phase 8's fix this column was empty in every row and 73 of
 * 233 entries already pointed at users who no longer existed.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; entityId?: string; action?: string; page?: string }>;
}) {
  const params = await searchParams;
  const data = await listAuditEntries(params);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Append-only administrative trail. Entries are immutable and cannot be modified or deleted, preserving verifiable accountability."
        count={data.pagination.total}
      />

      <Card>
        <CardContent className="p-4">
          <form className="flex flex-wrap items-end gap-3" action="/admin/audit-logs">
            <label className="text-muted-foreground text-xs font-medium">
              <span className="mb-1 block">Action</span>
              <input
                type="search"
                name="action"
                defaultValue={params.action ?? ''}
                placeholder="e.g. user.suspend"
                className="border-input bg-surface text-foreground focus:border-primary focus:ring-primary h-9 w-44 rounded-lg border px-3 text-sm focus:outline-none focus:ring-1"
              />
            </label>
            <label className="text-muted-foreground text-xs font-medium">
              <span className="mb-1 block">Entity Type</span>
              <input
                type="search"
                name="entityType"
                defaultValue={params.entityType ?? ''}
                placeholder="e.g. user, donation"
                className="border-input bg-surface text-foreground focus:border-primary focus:ring-primary h-9 w-44 rounded-lg border px-3 text-sm focus:outline-none focus:ring-1"
              />
            </label>
            <label className="text-muted-foreground text-xs font-medium">
              <span className="mb-1 block">Entity ID</span>
              <input
                type="search"
                name="entityId"
                defaultValue={params.entityId ?? ''}
                placeholder="UUID or ID"
                className="border-input bg-surface text-foreground focus:border-primary focus:ring-primary h-9 w-56 rounded-lg border px-3 text-sm focus:outline-none focus:ring-1"
              />
            </label>
            <Button type="submit" variant="secondary" size="sm">
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              Filter
            </Button>
            {params.action || params.entityType || params.entityId ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/audit-logs">Clear</Link>
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {data.items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <History className="text-muted-foreground/40 mb-3 h-10 w-10" />
            <p className="text-foreground text-sm font-medium">No audit entries found</p>
            <p className="text-muted-foreground mt-1 text-xs">
              No recorded actions match the active filter criteria.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Audit entries, newest first</caption>
              <thead className="border-border bg-muted/40 text-muted-foreground border-b text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    When (IST)
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Actor
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Action
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Target Entity
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Severity
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Detail & Changes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.items.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data.pagination.totalPages > 1 ? (
        <Pagination
          page={data.pagination.page}
          pages={data.pagination.totalPages}
          params={params}
        />
      ) : null}
    </div>
  );
}

function AuditRow({ entry }: { entry: AdminAuditEntry }) {
  const changed = Object.keys({ ...(entry.oldValues ?? {}), ...(entry.newValues ?? {}) });

  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'warning':
        return <Badge variant="warning">Warning</Badge>;
      default:
        return <Badge variant="neutral">{severity}</Badge>;
    }
  };

  return (
    <tr className="hover:bg-muted/30 align-top transition-colors">
      <td className="text-muted-foreground whitespace-nowrap px-5 py-3.5 text-xs">
        {new Intl.DateTimeFormat('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Kolkata',
        }).format(new Date(entry.createdAt))}
      </td>
      <td className="px-5 py-3.5">
        <span className="text-foreground font-medium">{entry.actorEmailSnapshot ?? '—'}</span>
        <p className="text-muted-foreground mt-0.5 text-xs capitalize">{entry.actorType}</p>
      </td>
      <td className="text-foreground px-5 py-3.5 font-mono text-xs font-medium">{entry.action}</td>
      <td className="px-5 py-3.5">
        <span className="text-foreground text-xs font-semibold capitalize">{entry.entityType}</span>
        {entry.entityId ? (
          <p className="text-muted-foreground mt-0.5 break-all font-mono text-[11px]">
            {entry.entityId}
          </p>
        ) : null}
      </td>
      <td className="px-5 py-3.5">{getSeverityBadge(entry.severity)}</td>
      <td className="px-5 py-3.5 text-xs">
        {entry.reason ? <p className="text-foreground mb-1 font-medium">{entry.reason}</p> : null}
        {changed.length > 0 ? (
          <details className="mt-1">
            <summary className="text-primary cursor-pointer font-medium hover:underline">
              {changed.length} field{changed.length === 1 ? '' : 's'} changed
            </summary>
            <pre className="border-border bg-muted/50 text-muted-foreground mt-2 max-w-md overflow-x-auto rounded-lg border p-2.5 font-mono text-[11px]">
              {JSON.stringify({ before: entry.oldValues, after: entry.newValues }, null, 2)}
            </pre>
          </details>
        ) : null}
        {entry.ipAddress ? (
          <p className="text-muted-foreground mt-1 font-mono text-[11px]">{entry.ipAddress}</p>
        ) : null}
      </td>
    </tr>
  );
}

function Pagination({
  page,
  pages,
  params,
}: {
  page: number;
  pages: number;
  params: { entityType?: string; entityId?: string; action?: string };
}) {
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== 'page') search.set(key, value);
    }
    search.set('page', String(target));
    return `/admin/audit-logs?${search.toString()}`;
  };

  return (
    <nav aria-label="Pages" className="flex items-center justify-between pt-2">
      <p className="text-muted-foreground text-xs">
        Page {page} of {pages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={href(page - 1)}>Previous</Link>
          </Button>
        ) : null}
        {page < pages ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={href(page + 1)}>Next</Link>
          </Button>
        ) : null}
      </div>
    </nav>
  );
}
