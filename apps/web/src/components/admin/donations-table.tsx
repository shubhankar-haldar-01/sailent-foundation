'use client';

import * as React from 'react';
import Link from 'next/link';
import { Ban, CheckCircle2, Clock, XCircle } from 'lucide-react';

import { Badge, DataTable, type DataTableColumn, formatCurrency, formatDate } from '@sailent/ui';

export interface AdminDonation {
  id: string;
  reference: string;
  status: string;
  donationType: string;
  amount: number;
  createdAt: string;
  completedAt: string | null;
  campaignTitle: string | null;
  campaignSlug: string | null;
  receiptNumber: string | null;
  donorName: string | null;
  donorEmail: string | null;
}

interface StatusConfig {
  variant: 'success' | 'warning' | 'destructive' | 'neutral';
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  label: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  successful: {
    variant: 'success',
    icon: CheckCircle2,
    label: 'Successful',
  },
  pending: {
    variant: 'warning',
    icon: Clock,
    label: 'Pending',
  },
  processing: {
    variant: 'warning',
    icon: Clock,
    label: 'Processing',
  },
  failed: {
    variant: 'destructive',
    icon: XCircle,
    label: 'Failed',
  },
  cancelled: {
    variant: 'neutral',
    icon: Ban,
    label: 'Cancelled',
  },
};

/**
 * Accessible donation status badge:
 * Pairs semantic status tokens with clear icons and accessible labels so
 * state is never communicated through color alone.
 */
export function DonationStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? {
    variant: 'neutral',
    icon: Clock,
    label: status.replace('_', ' '),
  };
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="capitalize">
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span>{config.label}</span>
    </Badge>
  );
}

export interface DonationsTableProps {
  donations: AdminDonation[];
  seesDonors: boolean;
  activeStatus?: string;
  className?: string;
}

/**
 * DonationsTable — shared admin table component reusing @sailent/ui's DataTable.
 *
 * Renders:
 *  - Desktop / Tablet: Accessible Table with tabular figures, sticky headers, and clear borders.
 *  - Mobile (<768px): Responsive stacked-card layout per the Master Design System,
 *    preventing horizontal page scroll while preserving full donation details.
 */
export function DonationsTable({
  donations,
  seesDonors,
  activeStatus = 'all',
  className,
}: DonationsTableProps) {
  const columns = React.useMemo<DataTableColumn<AdminDonation>[]>(() => {
    const baseColumns: DataTableColumn<AdminDonation>[] = [
      {
        id: 'reference',
        header: 'Reference',
        cell: (donation) => (
          <div>
            <Link
              href={`/admin/donations/${donation.id}`}
              data-numeric=""
              className="text-body-sm focus-visible:outline-ring whitespace-nowrap rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2"
            >
              {donation.reference}
            </Link>
            <p className="text-caption text-muted-foreground capitalize">{donation.donationType}</p>
          </div>
        ),
      },
      {
        id: 'campaign',
        header: 'Campaign',
        cell: (donation) => <span className="text-body-sm">{donation.campaignTitle ?? '—'}</span>,
      },
    ];

    if (seesDonors) {
      baseColumns.push({
        id: 'donor',
        header: 'Donor',
        cell: (donation) => (
          <div>
            <p className="text-body-sm">{donation.donorName ?? '—'}</p>
            <p className="text-caption text-muted-foreground">{donation.donorEmail ?? ''}</p>
          </div>
        ),
      });
    }

    baseColumns.push(
      {
        id: 'amount',
        header: 'Amount',
        numeric: true,
        cell: (donation) => (
          <span data-numeric="" className="text-body-sm font-semibold tabular-nums">
            {formatCurrency(donation.amount)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'State',
        cell: (donation) => <DonationStatusBadge status={donation.status} />,
      },
      {
        id: 'receipt',
        header: 'Receipt',
        cell: (donation) => (
          <span data-numeric="" className="text-caption tabular-nums">
            {donation.receiptNumber ?? '—'}
          </span>
        ),
      },
      {
        id: 'createdAt',
        header: 'When',
        cell: (donation) => (
          <span className="text-caption text-muted-foreground">
            {formatDate(donation.completedAt ?? donation.createdAt)}
          </span>
        ),
      },
    );

    return baseColumns;
  }, [seesDonors]);

  return (
    <DataTable
      columns={columns}
      rows={donations}
      getRowId={(donation) => donation.id}
      caption="Every donation, with its reference, campaign, amount and state."
      emptyTitle="No donations match this filter."
      hasActiveFilters={activeStatus !== 'all'}
      className={className}
    />
  );
}
