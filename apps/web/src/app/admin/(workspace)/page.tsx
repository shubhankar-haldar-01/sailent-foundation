import Link from 'next/link';
import {
  AlertTriangle,
  CalendarDays,
  HeartHandshake,
  Inbox,
  Layers,
  Mail,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { PageHeader, StatsCard, formatCurrency } from '@sailent/ui';

import { AdminApiError, getDashboard, type AdminDashboard } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

/**
 * The admin home page (Phase 13).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * REAL FIGURES ONLY, AND ONLY THE ONES THIS PERSON MAY SEE.
 *
 * Every number is a live count from `GET /admin/dashboard`; a section the
 * signed-in staff member has no permission for is simply absent — never
 * shown as zero, which would be a claim. Each card links to the page where
 * the work is done. Analysis stays in Reports; this page answers "what needs
 * me today?".
 * ══════════════════════════════════════════════════════════════════════════
 */
function paise(value: number): string {
  return formatCurrency(value);
}

function attentionItems(data: AdminDashboard) {
  const items: { label: string; href: string; count: number }[] = [];
  const add = (count: number | undefined, label: string, href: string) => {
    if (count && count > 0) items.push({ count, label, href });
  };
  add(data.messages?.new, 'contact messages waiting for a reply', '/admin/messages');
  add(
    data.volunteers?.pendingApplications,
    'volunteer applications to review',
    '/admin/volunteers',
  );
  add(data.payments?.needsReview, 'payments need review', '/admin/payments');
  add(data.payments?.failedWebhooks, 'payment notifications failed', '/admin/payments');
  add(data.payments?.overdueDonations, 'donations pending for over a day', '/admin/payments');
  add(
    data.campaigns?.pastDeadline,
    'active campaigns past their deadline (closed to donations)',
    '/admin/campaigns',
  );
  add(
    data.notifications?.failedLast7Days,
    'emails failed in the last 7 days',
    '/admin/notifications/log?status=failed',
  );
  return items;
}

export default async function AdminDashboardPage() {
  let data: AdminDashboard;
  try {
    data = await getDashboard();
  } catch (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
        >
          {error instanceof AdminApiError ? error.message : 'Could not load the dashboard.'}
        </p>
      </div>
    );
  }

  const cards = [
    data.donations && {
      label: 'Donations this month',
      value: `${paise(data.donations.thisMonth.amountPaise)} · ${data.donations.thisMonth.count}`,
      icon: Wallet,
      href: '/admin/donations',
    },
    data.campaigns && {
      label: 'Campaigns open for donations',
      value: data.campaigns.open,
      icon: HeartHandshake,
      href: '/admin/campaigns',
    },
    data.programs && {
      label: 'Published programmes',
      value: data.programs.published,
      icon: Layers,
      href: '/admin/programs',
    },
    data.donors && {
      label: 'Donors who have given',
      value: data.donors.withDonations,
      icon: Users,
      href: '/admin/donors',
    },
    data.volunteers && {
      label: 'Volunteer applications to review',
      value: data.volunteers.pendingApplications,
      icon: UserCheck,
      href: '/admin/volunteers',
    },
    data.events && {
      label: 'Upcoming events',
      value: data.events.upcoming,
      icon: CalendarDays,
      href: '/admin/events',
    },
    data.messages && {
      label: 'New messages',
      value: data.messages.new,
      icon: Inbox,
      href: '/admin/messages',
    },
    data.newsletter && {
      label: 'Newsletter subscribers',
      value: data.newsletter.subscribed,
      icon: Mail,
      href: '/admin/newsletter',
    },
  ].filter(Boolean) as {
    label: string;
    value: string | number;
    icon: typeof Wallet;
    href: string;
  }[];

  const attention = attentionItems(data);

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Live figures from the platform." />

      {cards.length === 0 ? (
        <p className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed p-8 text-center">
          Your account has no permissions to show here.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <StatsCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={card.icon}
              href={card.href}
              LinkComponent={Link}
            />
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border-border rounded-lg border p-5" aria-labelledby="attention">
          <h2 id="attention" className="text-h4 flex items-center gap-2 font-semibold">
            <AlertTriangle className="text-warning size-4" aria-hidden="true" />
            Needs attention
          </h2>
          {attention.length === 0 ? (
            <p className="text-body-sm text-muted-foreground mt-3">Nothing waiting.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {attention.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-body-sm hover:text-primary underline-offset-4 hover:underline"
                  >
                    <span data-numeric="" className="font-semibold tabular-nums">
                      {item.count}
                    </span>{' '}
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {data.donations ? (
          <section
            className="border-border rounded-lg border p-5"
            aria-labelledby="recent-donations"
          >
            <h2 id="recent-donations" className="text-h4 font-semibold">
              Recent donations
            </h2>
            {data.donations.recent.length === 0 ? (
              <p className="text-body-sm text-muted-foreground mt-3">No donations yet.</p>
            ) : (
              <ul className="divide-border mt-3 divide-y">
                {data.donations.recent.map((donation) => (
                  <li key={donation.id} className="text-body-sm flex justify-between gap-3 py-2">
                    <Link
                      href={`/admin/donations/${donation.id}`}
                      className="hover:text-primary min-w-0 truncate"
                    >
                      {donation.campaignTitle ?? 'Campaign'}
                      {donation.donorName ? ` · ${donation.donorName}` : ''}
                    </Link>
                    <span data-numeric="" className="shrink-0 font-semibold tabular-nums">
                      {paise(donation.amountPaise)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {data.donations.pending > 0 ? (
              <p className="text-caption text-muted-foreground mt-3">
                {data.donations.pending} checkout{data.donations.pending === 1 ? '' : 's'} not yet
                paid.
              </p>
            ) : null}
          </section>
        ) : null}
      </div>

      {data.activity ? (
        <section className="border-border rounded-lg border p-5" aria-labelledby="activity">
          <h2 id="activity" className="text-h4 font-semibold">
            Recent staff activity
          </h2>
          {data.activity.length === 0 ? (
            <p className="text-body-sm text-muted-foreground mt-3">Nothing recorded yet.</p>
          ) : (
            <ul className="divide-border mt-3 divide-y">
              {data.activity.map((entry) => (
                <li
                  key={entry.id}
                  className="text-body-sm flex flex-wrap justify-between gap-2 py-2"
                >
                  <span>
                    <span className="font-mono">{entry.action}</span>
                    {entry.actor ? (
                      <span className="text-muted-foreground"> · {entry.actor}</span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString('en-IN')}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/audit-logs"
            className="text-body-sm text-primary mt-3 inline-block underline"
          >
            The full audit log
          </Link>
        </section>
      ) : null}
    </div>
  );
}
