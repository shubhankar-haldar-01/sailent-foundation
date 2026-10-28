import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

import { TeamForm } from '@/components/admin/team-form';

export const dynamic = 'force-dynamic';

export default function NewTeamMemberPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add team member"
        breadcrumb={
          <Link
            href="/admin/team"
            className="text-body-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to team
          </Link>
        }
        description="Creates a team member profile. Saved initially as a draft; publishes to the public About page once approved."
      />

      <Card className="border-border max-w-2xl">
        <CardHeader className="border-border border-b pb-4">
          <CardTitle className="text-base font-semibold">Profile Details</CardTitle>
          <p className="text-caption text-muted-foreground mt-1">
            Name, official designation, department, public biography, and display ordering.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <TeamForm />
        </CardContent>
      </Card>
    </div>
  );
}
