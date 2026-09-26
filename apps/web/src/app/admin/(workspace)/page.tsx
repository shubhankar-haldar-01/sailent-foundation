import { Activity, HeartHandshake, Users, Wallet } from 'lucide-react';
import { PageHeader, StatsCard } from '@sailent/ui';

import { PhasePlaceholder } from '@/components/phase-placeholder';

/**
 * Admin dashboard — STRUCTURAL SHELL.
 *
 * The stat cards below render an em dash, not a number. They demonstrate the
 * layout without inventing figures: a dashboard showing "₹4,20,000 raised" on a
 * platform that has never processed a donation is exactly the kind of
 * plausible-looking fiction decision A14 exists to prevent.
 *
 * Phase 7 wires these to real aggregates, and adds the attention panel —
 * failed payments, halted subscriptions, reconciliation mismatches, donations
 * missing a tax ID before the 31 May deadline — which is the most valuable
 * element on the page.
 */
export default function AdminDashboardPage() {
  const cards = [
    { label: 'Donations this month', icon: Wallet },
    { label: 'Active campaigns', icon: HeartHandshake },
    { label: 'Volunteer applications', icon: Users },
    { label: 'Upcoming events', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Foundation build. Live figures are wired up as each module lands."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatsCard key={card.label} label={card.label} value="—" icon={card.icon} />
        ))}
      </div>

      <PhasePlaceholder
        title="Operational dashboard"
        phase="Phase 7"
        description="Donation trends, the attention panel for items needing action, and recent activity from the audit log — each filtered to what the signed-in user is permitted to see."
      />
    </div>
  );
}
