import Link from 'next/link';

import { Button, formatDate } from '@sailent/ui';

import { StatusPill } from '@/components/admin/status-pill';
import { ReauthPanel } from '@/components/admin/reauth-panel';
import { InviteUserForm } from '@/components/admin/user-admin';
import { AdminApiError, listUsers, type AdminUser, type Paginated } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Staff accounts.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE API FOR THIS HAS EXISTED SINCE PHASE 3 AND HAD NO SCREEN.
 *
 * Ten working routes — list, read, invite, update, assign roles, suspend,
 * reactivate — reachable only with a bearer token and curl. Everything here is
 * frontend against that API; no endpoint was added.
 *
 * There is ONE administrative role. No role column appears in this table and
 * no role picker appears anywhere on these screens: with a single role the
 * only honest answers are "they are staff" and "they are not", which is what
 * the status column already says.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  let data: Paginated<AdminUser> | null = null;
  let failure: string | null = null;

  try {
    data = await listUsers({ status: params.status, q: params.q, page: params.page });
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'REAUTH_REQUIRED') {
      return (
        <ReauthPanel
          returnTo="/admin/users"
          what="Staff accounts control who can administer this platform."
        />
      );
    }
    // Shown rather than thrown: a failed list is a bad moment to replace the
    // whole screen with an error page the operator cannot act on.
    failure =
      error instanceof AdminApiError ? error.message : 'Could not load staff accounts just now.';
  }

  const statuses = ['all', 'active', 'invited', 'suspended', 'inactive'] as const;
  const active = params.status ?? 'all';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">Staff accounts</h1>
          <p className="text-body-sm text-muted-foreground mt-1">
            {data ? `${data.pagination.total} total. ` : ''}
            Everyone here holds <strong>SUPER_ADMIN</strong> — the only administrative role. Donors
            and volunteers are separate and do not appear on this screen.
          </p>
        </div>
        {can(actor, 'user.invite') ? <InviteUserForm /> : null}
      </header>

      {failure ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
        >
          {failure}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {statuses.map((status) => (
            <Link
              key={status}
              href={status === 'all' ? '/admin/users' : `/admin/users?status=${status}`}
              aria-current={active === status ? 'page' : undefined}
              className={`text-body-sm rounded-md px-3 py-1.5 capitalize ${
                active === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {status}
            </Link>
          ))}
        </nav>

        <form className="ml-auto flex gap-2" action="/admin/users">
          <input type="hidden" name="status" value={active} />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search name or email"
            aria-label="Search staff accounts"
            className="border-input bg-surface text-body-sm h-9 rounded-md border px-3"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {data && data.items.length === 0 ? (
        <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-10 text-center">
          {params.q
            ? `No staff account matches “${params.q}”.`
            : 'No staff account matches this view.'}
        </p>
      ) : null}

      {data && data.items.length > 0 ? (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="text-body-sm w-full">
            <caption className="sr-only">Staff accounts</caption>
            <thead className="bg-surface-sunken text-caption text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Name
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Second factor
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Last signed in
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Added
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((user) => (
                <tr key={user.id} className="border-border border-t">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="hover:text-primary font-medium"
                    >
                      {user.firstName} {user.lastName ?? ''}
                    </Link>
                    <p className="text-caption text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={user.status} />
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {/* Whether one is enrolled. The secret is never returned by the API. */}
                    {user.totpEnabled ? 'Enrolled' : 'None'}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {data && data.pagination.total > data.items.length ? (
        <Pagination
          page={data.pagination.page}
          pages={data.pagination.totalPages}
          params={params}
        />
      ) : null}
    </div>
  );
}

function Pagination({
  page,
  pages,
  params,
}: {
  page: number;
  pages: number;
  params: { status?: string; q?: string };
}) {
  const href = (target: number) => {
    const search = new URLSearchParams();
    if (params.status && params.status !== 'all') search.set('status', params.status);
    if (params.q) search.set('q', params.q);
    search.set('page', String(target));
    return `/admin/users?${search.toString()}`;
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
