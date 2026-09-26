import Link from 'next/link';

import { Badge, Button, formatDate } from '@sailent/ui';

import { adminFetch, type AdminVolunteerSummary, type Paginated } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const TONE: Record<string, 'success' | 'warning' | 'neutral' | 'destructive'> = {
  applied: 'warning',
  under_review: 'warning',
  approved: 'success',
  active: 'success',
  inactive: 'neutral',
  suspended: 'destructive',
  rejected: 'destructive',
  archived: 'neutral',
};

/**
 * Volunteers and applications.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE DEFAULT VIEW IS THE REVIEW QUEUE, not everybody.
 *
 * An application sitting unread is the failure this screen exists to prevent —
 * somebody offered their time and heard nothing. A list that opens on all 200
 * volunteers buries the four that need a decision today.
 *
 * The list deliberately omits phone numbers, addresses and emergency contacts.
 * Those are on the detail page, which is `@Sensitive()` and requires a fresh
 * re-authentication: finding somebody is a different act from reading their
 * record, and only the second one needs their mother's phone number.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function AdminVolunteersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();
  const active = params.status ?? 'pending';

  const data = await adminFetch<Paginated<AdminVolunteerSummary>>('admin/volunteers', {
    query: { status: active, q: params.q, page: params.page, limit: 25 },
  });

  const filters = [
    ['pending', 'Awaiting a decision'],
    ['active', 'Active'],
    ['approved', 'Approved'],
    ['suspended', 'Suspended'],
    ['rejected', 'Rejected'],
    ['all', 'Everyone'],
  ] as const;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">Volunteers</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          {data.pagination.total} in this view. Contact details and emergency contacts are on each
          person’s own page, which asks you to confirm your password first.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Filter volunteers" className="flex flex-wrap gap-1.5">
          {filters.map(([value, label]) => (
            <Link
              key={value}
              href={`/admin/volunteers?status=${value}`}
              aria-current={active === value ? 'page' : undefined}
              className={`text-body-sm rounded-md px-3 py-1.5 ${
                active === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <form className="ml-auto flex gap-2" action="/admin/volunteers">
          <input type="hidden" name="status" value={active} />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Name, email or VOL- number"
            aria-label="Search volunteers"
            className="border-input bg-surface text-body-sm h-9 rounded-md border px-3"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {data.items.length === 0 ? (
        <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-10 text-center">
          {active === 'pending'
            ? 'Nothing is waiting for a decision.'
            : 'Nobody matches this view.'}
        </p>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="text-body-sm w-full">
            <thead className="bg-surface-sunken text-caption text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Name
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Volunteer number
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Skills
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Verified hours
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Applied
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((volunteer) => (
                <tr key={volunteer.id} className="border-border border-t">
                  <td className="px-4 py-3">
                    {can(actor, 'volunteer.read') ? (
                      <Link
                        href={`/admin/volunteers/${volunteer.id}`}
                        className="hover:text-primary font-medium"
                      >
                        {[volunteer.firstName, volunteer.lastName].filter(Boolean).join(' ')}
                      </Link>
                    ) : (
                      <span className="font-medium">
                        {[volunteer.firstName, volunteer.lastName].filter(Boolean).join(' ')}
                      </span>
                    )}
                    <p className="text-caption text-muted-foreground">{volunteer.city ?? '—'}</p>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {/* Null until approved, and the database enforces that
                        (A13) — so an empty cell here means "not approved". */}
                    {volunteer.volunteerId ?? '—'}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {volunteer.skills?.slice(0, 3).join(', ') || '—'}
                    {volunteer.skills && volunteer.skills.length > 3
                      ? ` +${volunteer.skills.length - 3}`
                      : null}
                  </td>
                  <td data-numeric="" className="px-4 py-3 text-right tabular-nums">
                    {volunteer.verifiedHours}
                    {volunteer.totalHours !== volunteer.verifiedHours ? (
                      <span className="text-muted-foreground"> of {volunteer.totalHours}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={TONE[volunteer.status] ?? 'neutral'}>
                      {volunteer.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {formatDate(volunteer.createdAt)}
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
