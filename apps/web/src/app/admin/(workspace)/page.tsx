import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  HeartHandshake,
  Inbox,
  Layers,
  Mail,
  Plus,
  ShieldAlert,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  formatCurrency,
} from '@sailent/ui';

import { AdminApiError, getDashboard, type AdminDashboard } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

function paise(value: number): string {
  return formatCurrency(value);
}

function attentionItems(data: AdminDashboard) {
  const items: {
    label: string;
    href: string;
    count: number;
    severity: 'warning' | 'destructive';
  }[] = [];
  const add = (
    count: number | undefined,
    label: string,
    href: string,
    severity: 'warning' | 'destructive' = 'warning',
  ) => {
    if (count && count > 0) items.push({ count, label, href, severity });
  };

  add(data.messages?.new, 'contact messages waiting for a reply', '/admin/messages', 'warning');
  add(
    data.volunteers?.pendingApplications,
    'volunteer applications to review',
    '/admin/volunteers',
    'warning',
  );
  add(data.payments?.needsReview, 'payments need review', '/admin/payments', 'destructive');
  add(
    data.payments?.failedWebhooks,
    'payment notifications failed',
    '/admin/payments',
    'destructive',
  );
  add(
    data.payments?.overdueDonations,
    'donations pending for over a day',
    '/admin/payments',
    'destructive',
  );
  add(
    data.campaigns?.pastDeadline,
    'active campaigns past their deadline (closed to donations)',
    '/admin/campaigns',
    'warning',
  );
  add(
    data.notifications?.failedLast7Days,
    'emails failed in the last 7 days',
    '/admin/notifications/log?status=failed',
    'destructive',
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
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive shadow-xs flex items-center gap-3 rounded-xl border p-5"
        >
          <ShieldAlert className="size-5 shrink-0" aria-hidden="true" />
          <p>{error instanceof AdminApiError ? error.message : 'Could not load the dashboard.'}</p>
        </div>
      </div>
    );
  }

  const attention = attentionItems(data);

  // Total campaigns calculation for progress bar
  const totalCampaigns = data.campaigns
    ? (data.campaigns.open || 0) +
      (data.campaigns.completed || 0) +
      (data.campaigns.draft || 0) +
      (data.campaigns.paused || 0)
    : 0;

  return (
    <div className="space-y-8">
      {/* Top Header with live figures description and quick action buttons */}
      <PageHeader
        title="Dashboard"
        description="Live figures from the platform."
        actions={
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="hidden gap-1.5 text-xs sm:inline-flex"
            >
              <Link href="/admin/reports">
                <Activity className="size-3.5" aria-hidden="true" />
                <span>View reports</span>
              </Link>
            </Button>
            <Button asChild variant="primary" size="sm" className="gap-1.5 text-xs">
              <Link href="/admin/campaigns/new">
                <Plus className="size-3.5" aria-hidden="true" />
                <span>New campaign</span>
              </Link>
            </Button>
          </div>
        }
      />

      {/* ──────── 1. Key Metrics Stat Cards ──────── */}
      <section aria-label="Key Performance Indicators">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Donations this Month */}
          {data.donations ? (
            <Card variant="standard" className="shadow-xs p-5 transition-shadow hover:shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-body-sm text-muted-foreground font-medium">
                  Donations this month
                </p>
                <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
                  <Wallet className="size-4.5" aria-hidden="true" />
                </div>
              </div>
              <p data-numeric="" className="font-display text-h2 mt-2 font-bold tabular-nums">
                {paise(data.donations.thisMonth.amountPaise)}
              </p>
              <div className="text-caption text-muted-foreground mt-2 flex items-center justify-between">
                <span>{data.donations.thisMonth.count} donations completed</span>
                <Link
                  href="/admin/donations"
                  className="text-primary hover:text-primary-hover inline-flex items-center gap-0.5 font-semibold"
                >
                  <span>View</span>
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              </div>
            </Card>
          ) : null}

          {/* Campaigns open for donations */}
          {data.campaigns ? (
            <Card variant="standard" className="shadow-xs p-5 transition-shadow hover:shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-body-sm text-muted-foreground font-medium">
                  Campaigns open for donations
                </p>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <HeartHandshake className="size-4.5" aria-hidden="true" />
                </div>
              </div>
              <p data-numeric="" className="font-display text-h2 mt-2 font-bold tabular-nums">
                {data.campaigns.open}
              </p>
              <div className="text-caption text-muted-foreground mt-2 flex items-center justify-between">
                <span>
                  {data.campaigns.completed} completed · {data.campaigns.draft} draft
                </span>
                <Link
                  href="/admin/campaigns"
                  className="text-primary hover:text-primary-hover inline-flex items-center gap-0.5 font-semibold"
                >
                  <span>View</span>
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              </div>
            </Card>
          ) : null}

          {/* Donors who have given */}
          {data.donors ? (
            <Card variant="standard" className="shadow-xs p-5 transition-shadow hover:shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-body-sm text-muted-foreground font-medium">
                  Donors who have given
                </p>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Users className="size-4.5" aria-hidden="true" />
                </div>
              </div>
              <p data-numeric="" className="font-display text-h2 mt-2 font-bold tabular-nums">
                {data.donors.withDonations}
              </p>
              <div className="text-caption text-muted-foreground mt-2 flex items-center justify-between">
                <span>Total records: {data.donors.total}</span>
                <Link
                  href="/admin/donors"
                  className="text-primary hover:text-primary-hover inline-flex items-center gap-0.5 font-semibold"
                >
                  <span>View</span>
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              </div>
            </Card>
          ) : null}

          {/* Volunteer applications */}
          {data.volunteers ? (
            <Card variant="standard" className="shadow-xs p-5 transition-shadow hover:shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-body-sm text-muted-foreground font-medium">
                  Volunteer applications to review
                </p>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <UserCheck className="size-4.5" aria-hidden="true" />
                </div>
              </div>
              <p data-numeric="" className="font-display text-h2 mt-2 font-bold tabular-nums">
                {data.volunteers.pendingApplications}
              </p>
              <div className="text-caption text-muted-foreground mt-2 flex items-center justify-between">
                <span>Needs onboarding review</span>
                <Link
                  href="/admin/volunteers"
                  className="text-primary hover:text-primary-hover inline-flex items-center gap-0.5 font-semibold"
                >
                  <span>Review</span>
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              </div>
            </Card>
          ) : null}
        </div>

        {/* Secondary KPI Row: Programmes, Events, Messages, Newsletter */}
        {data.programs || data.events || data.messages || data.newsletter ? (
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {data.programs ? (
              <Link
                href="/admin/programs"
                className="border-border bg-surface hover:border-primary/50 shadow-2xs flex items-center justify-between gap-2 rounded-xl border p-3.5 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="text-muted-foreground size-4" aria-hidden="true" />
                  <div>
                    <p className="text-caption text-muted-foreground">Published programmes</p>
                    <p className="text-sm font-bold tabular-nums">{data.programs.published}</p>
                  </div>
                </div>
                <ArrowUpRight className="text-muted-foreground size-3.5" aria-hidden="true" />
              </Link>
            ) : null}

            {data.events ? (
              <Link
                href="/admin/events"
                className="border-border bg-surface hover:border-primary/50 shadow-2xs flex items-center justify-between gap-2 rounded-xl border p-3.5 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <CalendarDays className="text-muted-foreground size-4" aria-hidden="true" />
                  <div>
                    <p className="text-caption text-muted-foreground">Upcoming events</p>
                    <p className="text-sm font-bold tabular-nums">{data.events.upcoming}</p>
                  </div>
                </div>
                <ArrowUpRight className="text-muted-foreground size-3.5" aria-hidden="true" />
              </Link>
            ) : null}

            {data.messages ? (
              <Link
                href="/admin/messages"
                className="border-border bg-surface hover:border-primary/50 shadow-2xs flex items-center justify-between gap-2 rounded-xl border p-3.5 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Inbox className="text-muted-foreground size-4" aria-hidden="true" />
                  <div>
                    <p className="text-caption text-muted-foreground">New messages</p>
                    <p className="text-sm font-bold tabular-nums">{data.messages.new}</p>
                  </div>
                </div>
                <ArrowUpRight className="text-muted-foreground size-3.5" aria-hidden="true" />
              </Link>
            ) : null}

            {data.newsletter ? (
              <Link
                href="/admin/newsletter"
                className="border-border bg-surface hover:border-primary/50 shadow-2xs flex items-center justify-between gap-2 rounded-xl border p-3.5 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Mail className="text-muted-foreground size-4" aria-hidden="true" />
                  <div>
                    <p className="text-caption text-muted-foreground">Newsletter subscribers</p>
                    <p className="text-sm font-bold tabular-nums">{data.newsletter.subscribed}</p>
                  </div>
                </div>
                <ArrowUpRight className="text-muted-foreground size-3.5" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* ──────── 2. Priority Action Center: Needs attention ──────── */}
      <section
        className="border-border bg-surface shadow-xs rounded-xl border p-5"
        aria-labelledby="attention"
      >
        <div className="border-border flex items-center justify-between border-b pb-3.5">
          <h2 id="attention" className="text-h4 flex items-center gap-2.5 font-semibold">
            <AlertTriangle className="size-5 text-amber-500" aria-hidden="true" />
            <span>Needs attention</span>
          </h2>
          {attention.length > 0 ? (
            <Badge variant="warning" className="text-xs font-semibold">
              {attention.length} pending
            </Badge>
          ) : null}
        </div>

        {attention.length === 0 ? (
          <div className="flex items-center gap-3 py-4 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
            <p className="text-body-sm font-medium">Nothing waiting.</p>
          </div>
        ) : (
          <ul className="divide-border/60 mt-4 divide-y">
            {attention.map((item) => (
              <li key={item.label} className="flex items-center justify-between py-2.5">
                <Link
                  href={item.href}
                  className="text-body-sm text-foreground hover:text-primary flex items-center gap-3 transition-colors"
                >
                  <span
                    data-numeric=""
                    className={
                      item.severity === 'destructive'
                        ? 'bg-destructive/10 text-destructive rounded-md px-2 py-0.5 text-xs font-bold tabular-nums'
                        : 'rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-700 dark:text-amber-400'
                    }
                  >
                    {item.count}
                  </span>
                  <span>{item.label}</span>
                </Link>
                <Link
                  href={item.href}
                  className="text-primary hover:text-primary-hover inline-flex items-center gap-1 text-xs font-semibold"
                >
                  <span>Resolve</span>
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ──────── 3. Middle Grid: Recent Donations & Campaign Pulse ──────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Donations Table */}
        {data.donations ? (
          <section
            className="border-border bg-surface shadow-xs flex flex-col justify-between rounded-xl border p-5"
            aria-labelledby="recent-donations"
          >
            <div>
              <div className="border-border flex items-center justify-between border-b pb-3.5">
                <div className="flex items-center gap-2">
                  <h2 id="recent-donations" className="text-h4 font-semibold">
                    Recent donations
                  </h2>
                  <Badge variant="neutral" className="text-caption font-semibold">
                    {data.donations.recent.length}
                  </Badge>
                </div>
                <Link
                  href="/admin/donations"
                  className="text-primary hover:text-primary-hover inline-flex items-center gap-1 text-xs font-semibold"
                >
                  <span>View all</span>
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              </div>

              {data.donations.recent.length === 0 ? (
                <p className="text-body-sm text-muted-foreground py-8 text-center">
                  No donations yet.
                </p>
              ) : (
                <div className="mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/60 hover:bg-transparent">
                        <TableHead className="text-xs">Campaign / Donor</TableHead>
                        <TableHead className="text-right text-xs">Amount</TableHead>
                        <TableHead className="w-16 text-right text-xs">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.donations.recent.map((donation) => (
                        <TableRow key={donation.id} className="border-border/60">
                          <TableCell className="py-2.5">
                            <div className="min-w-0">
                              <p className="text-foreground truncate text-xs font-medium">
                                {donation.campaignTitle ?? 'Campaign'}
                              </p>
                              <p className="text-muted-foreground truncate text-[0.6875rem]">
                                {donation.donorName || 'Anonymous Donor'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <span
                              data-numeric=""
                              className="text-foreground text-xs font-bold tabular-nums"
                            >
                              {paise(donation.amountPaise)}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <Button asChild variant="ghost" size="sm" className="size-7 p-0">
                              <Link
                                href={`/admin/donations/${donation.id}`}
                                aria-label={`View donation ${donation.id}`}
                              >
                                <ArrowUpRight className="text-muted-foreground hover:text-foreground size-3.5" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {data.donations.pending > 0 ? (
              <p className="text-caption text-muted-foreground border-border/60 mt-3 border-t pt-3">
                {data.donations.pending} checkout{data.donations.pending === 1 ? '' : 's'} not yet
                paid.
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Campaign & Programme Distribution */}
        {data.campaigns ? (
          <section
            className="border-border bg-surface shadow-xs rounded-xl border p-5"
            aria-labelledby="campaign-distribution"
          >
            <div className="border-border flex items-center justify-between border-b pb-3.5">
              <h2 id="campaign-distribution" className="text-h4 font-semibold">
                Campaign & Programme Pulse
              </h2>
              <Link
                href="/admin/campaigns"
                className="text-primary hover:text-primary-hover inline-flex items-center gap-1 text-xs font-semibold"
              >
                <span>Campaigns</span>
                <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            </div>

            {/* Visual ratio bar */}
            {totalCampaigns > 0 ? (
              <div className="mt-4 space-y-2">
                <div className="text-muted-foreground flex items-center justify-between text-xs">
                  <span>Campaign Lifecycle ({totalCampaigns} total)</span>
                  <span>
                    {Math.round(((data.campaigns.open || 0) / totalCampaigns) * 100)}% active
                  </span>
                </div>
                <div className="bg-muted flex h-3 w-full overflow-hidden rounded-full">
                  {data.campaigns.open > 0 ? (
                    <div
                      style={{ width: `${(data.campaigns.open / totalCampaigns) * 100}%` }}
                      className="bg-primary transition-all"
                      title={`Open: ${data.campaigns.open}`}
                    />
                  ) : null}
                  {data.campaigns.completed > 0 ? (
                    <div
                      style={{ width: `${(data.campaigns.completed / totalCampaigns) * 100}%` }}
                      className="bg-emerald-500 transition-all"
                      title={`Completed: ${data.campaigns.completed}`}
                    />
                  ) : null}
                  {data.campaigns.draft > 0 ? (
                    <div
                      style={{ width: `${(data.campaigns.draft / totalCampaigns) * 100}%` }}
                      className="bg-neutral-400 transition-all dark:bg-neutral-600"
                      title={`Draft: ${data.campaigns.draft}`}
                    />
                  ) : null}
                  {data.campaigns.paused > 0 ? (
                    <div
                      style={{ width: `${(data.campaigns.paused / totalCampaigns) * 100}%` }}
                      className="bg-amber-500 transition-all"
                      title={`Paused: ${data.campaigns.paused}`}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Campaign breakdown grid */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="border-border bg-muted/30 rounded-lg border p-2.5 text-center">
                <p className="text-caption text-muted-foreground font-medium">Open</p>
                <p className="text-primary text-base font-bold tabular-nums">
                  {data.campaigns.open}
                </p>
              </div>
              <div className="border-border bg-muted/30 rounded-lg border p-2.5 text-center">
                <p className="text-caption text-muted-foreground font-medium">Completed</p>
                <p className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {data.campaigns.completed}
                </p>
              </div>
              <div className="border-border bg-muted/30 rounded-lg border p-2.5 text-center">
                <p className="text-caption text-muted-foreground font-medium">Draft</p>
                <p className="text-muted-foreground text-base font-bold tabular-nums">
                  {data.campaigns.draft}
                </p>
              </div>
              <div className="border-border bg-muted/30 rounded-lg border p-2.5 text-center">
                <p className="text-caption text-muted-foreground font-medium">Paused</p>
                <p className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {data.campaigns.paused}
                </p>
              </div>
            </div>

            {/* Program stats */}
            {data.programs ? (
              <div className="border-border text-muted-foreground mt-4 flex items-center justify-between border-t pt-3 text-xs">
                <span>
                  <strong className="text-foreground font-semibold">
                    {data.programs.published}
                  </strong>{' '}
                  published programmes
                  {data.programs.draft > 0 ? ` · ${data.programs.draft} draft` : ''}
                </span>
                <Link href="/admin/programs" className="text-primary font-medium hover:underline">
                  View programmes
                </Link>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      {/* ──────── 4. Staff Activity Audit Stream ──────── */}
      {data.activity ? (
        <section
          className="border-border bg-surface shadow-xs rounded-xl border p-5"
          aria-labelledby="activity"
        >
          <div className="border-border flex items-center justify-between border-b pb-3.5">
            <div className="flex items-center gap-2">
              <Clock className="size-4.5 text-muted-foreground" aria-hidden="true" />
              <h2 id="activity" className="text-h4 font-semibold">
                Recent staff activity
              </h2>
            </div>
            <Link
              href="/admin/audit-logs"
              className="text-primary hover:text-primary-hover inline-flex items-center gap-1 text-xs font-semibold"
            >
              <span>The full audit log</span>
              <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          </div>

          {data.activity.length === 0 ? (
            <p className="text-body-sm text-muted-foreground py-6 text-center">
              Nothing recorded yet.
            </p>
          ) : (
            <ul className="divide-border/60 mt-3 divide-y">
              {data.activity.slice(0, 8).map((entry) => (
                <li
                  key={entry.id}
                  className="text-body-sm flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <Badge
                      variant="outline"
                      className="font-mono text-[0.6875rem] font-medium uppercase"
                    >
                      {entry.action}
                    </Badge>
                    {entry.actor ? (
                      <span className="text-foreground text-xs font-medium">{entry.actor}</span>
                    ) : null}
                    <span className="text-muted-foreground hidden text-[0.6875rem] sm:inline">
                      ({entry.entityType})
                    </span>
                  </div>
                  <span className="text-caption text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
