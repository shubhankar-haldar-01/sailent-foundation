import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

import { AdminBackButton } from '@/components/admin/admin-back-button';
import { ProgramForm } from '@/components/admin/program-form';
import { listMedia, type AdminMedia } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function NewProgramPage() {
  const actor = await currentActor();
  const mediaOptions: AdminMedia[] = can(actor, 'media.read')
    ? (await listMedia({ visibility: 'public', limit: 100 })).items
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New program"
        breadcrumb={<AdminBackButton href="/admin/programs">Back to programs</AdminBackButton>}
        description="Creates a programmatic focus area. Initially saved as a draft; nothing is visible publicly until explicitly published."
      />

      <Card className="border-border">
        <CardHeader className="border-border border-b pb-4">
          <CardTitle className="text-base font-semibold">Program Information</CardTitle>
          <p className="text-caption text-muted-foreground mt-1">
            Core title, description, challenge, approach, and cover photograph.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <ProgramForm mediaOptions={mediaOptions} />
        </CardContent>
      </Card>
    </div>
  );
}
