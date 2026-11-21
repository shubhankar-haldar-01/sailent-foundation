import { PageHeader } from '@sailent/ui';

import { AdminBackButton } from '@/components/admin/admin-back-button';
import { TeamForm } from '@/components/admin/team-form';

export const dynamic = 'force-dynamic';

export default function NewTeamMemberPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Add team member"
        breadcrumb={<AdminBackButton href="/admin/team">Back to team</AdminBackButton>}
        description="Creates a team member profile. Saved initially as a draft; publishes to the public team directory once approved."
      />

      <TeamForm />
    </div>
  );
}
