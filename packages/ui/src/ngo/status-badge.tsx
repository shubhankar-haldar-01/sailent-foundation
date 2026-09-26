import * as React from 'react';
import {
  Archive,
  CheckCircle2,
  CircleDot,
  Clock,
  FileEdit,
  PauseCircle,
  XCircle,
} from 'lucide-react';

import { Badge } from '../primitives/badge';

/**
 * StatusBadge.
 *
 * Every status pairs a colour with an ICON and a LABEL. Colour never carries
 * meaning alone — required for WCAG and for the significant share of donors
 * with colour vision deficiency.
 *
 * Covers the lifecycle states defined in Phase 0 for campaigns, payments and
 * volunteers. The union is intentionally explicit so an unhandled state is a
 * compile error rather than a blank badge.
 */

export type StatusKind =
  // campaign
  | 'draft'
  | 'published'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived'
  // payment / donation
  | 'pending'
  | 'processing'
  | 'captured'
  | 'failed'
  // volunteer
  | 'applied'
  | 'under_review'
  | 'approved'
  | 'inactive'
  | 'suspended'
  | 'rejected';

type Variant = React.ComponentProps<typeof Badge>['variant'];

const config: Record<
  StatusKind,
  { label: string; variant: Variant; icon: React.ComponentType<{ className?: string }> }
> = {
  draft: { label: 'Draft', variant: 'neutral', icon: FileEdit },
  published: { label: 'Published', variant: 'info', icon: CheckCircle2 },
  active: { label: 'Active', variant: 'success', icon: CircleDot },
  paused: { label: 'Paused', variant: 'warning', icon: PauseCircle },
  completed: { label: 'Completed', variant: 'info', icon: CheckCircle2 },
  archived: { label: 'Archived', variant: 'neutral', icon: Archive },

  pending: { label: 'Pending', variant: 'warning', icon: Clock },
  processing: { label: 'Processing', variant: 'warning', icon: Clock },
  captured: { label: 'Successful', variant: 'success', icon: CheckCircle2 },
  failed: { label: 'Failed', variant: 'destructive', icon: XCircle },

  applied: { label: 'Applied', variant: 'neutral', icon: Clock },
  under_review: { label: 'Under review', variant: 'warning', icon: Clock },
  approved: { label: 'Approved', variant: 'success', icon: CheckCircle2 },
  inactive: { label: 'Inactive', variant: 'neutral', icon: CircleDot },
  suspended: { label: 'Suspended', variant: 'destructive', icon: XCircle },
  rejected: { label: 'Rejected', variant: 'destructive', icon: XCircle },
};

export interface StatusBadgeProps {
  status: StatusKind;
  /** Override the default label where domain wording differs. */
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const entry = config[status];
  const Icon = entry.icon;

  return (
    <Badge variant={entry.variant} className={className}>
      <Icon aria-hidden="true" />
      {label ?? entry.label}
    </Badge>
  );
}
