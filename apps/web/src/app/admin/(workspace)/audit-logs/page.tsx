import Link from 'next/link';

import { Button } from '@sailent/ui';

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
      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">Audit log</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          {data.pagination.total} entries, newest first. Append-only — entries cannot be edited or
          removed, here or anywhere else.
        </p>
      </header>

      {/* Only the three filters the API actually supports. */}
      <form className="flex flex-wrap items-end gap-3" action="/admin/audit-logs">
        <label className="text-body-sm">
          <span className="text-muted-foreground mb-1 block">Action</span>
          <input
            type="search"
            name="action"
            defaultValue={params.action ?? ''}
            placeholder="user.suspend"
            className="border-input bg-surface h-9 rounded-md border px-3"
          />
        </label>
        <label className="text-body-sm">
          <span className="text-muted-foreground mb-1 block">Entity type</span>
          <input
            type="search"
            name="entityType"
            defaultValue={params.entityType ?? ''}
            placeholder="user"
            className="border-input bg-surface h-9 rounded-md border px-3"
          />
        </label>
        <label className="text-body-sm">
          <span className="text-muted-foreground mb-1 block">Entity ID</span>
          <input
            type="search"
            name="entityId"
            defaultValue={params.entityId ?? ''}
            placeholder="uuid"
            className="border-input bg-surface h-9 w-64 rounded-md border px-3"
          />
        </label>
        <Button type="submit" variant="secondary" size="sm">
          Filter
        </Button>
        {params.action || params.entityType || params.entityId ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/audit-logs">Clear</Link>
          </Button>
        ) : null}
      </form>

      {data.items.length === 0 ? (
        <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-10 text-center">
          No entries match this view.
        </p>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="text-body-sm w-full">
            <caption className="sr-only">Audit entries, newest first</caption>
            <thead className="bg-surface-sunken text-caption text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  When
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Actor
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Action
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Entity
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Severity
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((entry) => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>
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

  return (
    <tr className="border-border border-t align-top">
      <td className="text-muted-foreground whitespace-nowrap px-4 py-3">
        {/*
          Date AND time, in IST. An audit log without a time is close to
          useless: "who changed this, and was it before or after the incident"
          is the question these rows exist to answer.
        */}
        {new Intl.DateTimeFormat('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Kolkata',
        }).format(new Date(entry.createdAt))}
      </td>
      <td className="px-4 py-3">
        {/*
          The snapshot, not a join — the address as it was at the time. Falls
          back to the actor type for system and volunteer actions, which have
          no staff account behind them.
        */}
        <span className="font-medium">{entry.actorEmailSnapshot ?? '—'}</span>
        <p className="text-caption text-muted-foreground capitalize">{entry.actorType}</p>
      </td>
      <td className="px-4 py-3 font-mono text-xs">{entry.action}</td>
      <td className="px-4 py-3">
        <span className="capitalize">{entry.entityType}</span>
        {entry.entityId ? (
          <p className="text-caption text-muted-foreground break-all font-mono">{entry.entityId}</p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <span
          className={
            entry.severity === 'critical' || entry.severity === 'warning'
              ? 'text-warning font-medium capitalize'
              : 'text-muted-foreground capitalize'
          }
        >
          {entry.severity}
        </span>
      </td>
      <td className="px-4 py-3">
        {entry.reason ? <p className="mb-1">{entry.reason}</p> : null}
        {changed.length > 0 ? (
          <details>
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer">
              {changed.length} field{changed.length === 1 ? '' : 's'} changed
            </summary>
            <pre className="bg-surface-sunken mt-2 max-w-md overflow-x-auto rounded p-2 text-xs">
              {JSON.stringify({ before: entry.oldValues, after: entry.newValues }, null, 2)}
            </pre>
          </details>
        ) : null}
        {entry.ipAddress ? (
          <p className="text-caption text-muted-foreground mt-1">{entry.ipAddress}</p>
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
    <nav aria-label="Pages" className="flex items-center justify-between">
      <p className="text-body-sm text-muted-foreground">
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
