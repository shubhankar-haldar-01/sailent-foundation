import Link from 'next/link';
import { Button, Card, CardContent, PageHeader, formatDate } from '@sailent/ui';
import { Shield, Key, Search } from 'lucide-react';

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
    failure =
      error instanceof AdminApiError ? error.message : 'Could not load staff accounts just now.';
  }

  const statuses = ['all', 'active', 'invited', 'suspended', 'inactive'] as const;
  const active = params.status ?? 'all';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff accounts"
        description="Everyone here holds SUPER_ADMIN — the only administrative role. Donors and volunteers are separate and do not appear on this screen."
        count={data ? data.pagination.total : undefined}
        actions={can(actor, 'user.invite') ? <InviteUserForm /> : undefined}
      />

      {failure ? (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-4 text-sm"
        >
          {failure}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {statuses.map((status) => (
            <Link
              key={status}
              href={status === 'all' ? '/admin/users' : `/admin/users?status=${status}`}
              aria-current={active === status ? 'page' : undefined}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                active === status
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {status}
            </Link>
          ))}
        </nav>

        <form className="flex w-full items-center gap-2 sm:w-auto" action="/admin/users">
          <input type="hidden" name="status" value={active} />
          <div className="relative w-full sm:w-64">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search name or email"
              aria-label="Search staff accounts"
              className="border-input bg-surface focus:border-primary focus:ring-primary h-9 w-full rounded-lg border pl-9 pr-3 text-sm focus:outline-none focus:ring-1"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {data && data.items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Shield className="text-muted-foreground/40 mb-3 h-10 w-10" />
            <p className="text-foreground text-sm font-medium">No staff accounts found</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {params.q
                ? `No staff account matches “${params.q}”.`
                : 'No staff accounts match the selected status filter.'}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {data && data.items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Staff accounts</caption>
              <thead className="border-border bg-muted/40 text-muted-foreground border-b text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Name & Email
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Second Factor
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Last Signed In
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Added
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.items.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="text-foreground hover:text-primary font-medium transition-colors"
                      >
                        {user.firstName} {user.lastName ?? ''}
                      </Link>
                      <p className="text-muted-foreground mt-0.5 text-xs">{user.email}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={user.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      {user.totpEnabled ? (
                        <span className="text-success inline-flex items-center gap-1.5 text-xs font-medium">
                          <Key className="h-3.5 w-3.5" /> Enrolled
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">None</span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-5 py-3.5 text-xs">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                    </td>
                    <td className="text-muted-foreground px-5 py-3.5 text-xs">
                      {formatDate(user.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
