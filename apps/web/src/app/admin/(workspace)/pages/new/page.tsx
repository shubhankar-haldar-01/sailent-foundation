import { notFound } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

import { PageComposer } from '@/components/admin/page-composer';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** A new page is always a draft. Publishing is a separate, permissioned step. */
export default async function NewPagePage() {
  const actor = await currentActor();
  if (!can(actor, 'page.create')) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compose Page"
        description="Select a route (home, about, etc.) and configure its section layout and ordering. Saved as a draft."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Section Composition</CardTitle>
          <CardDescription>
            Assemble and reorder sections before publishing to the live website.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PageComposer />
        </CardContent>
      </Card>
    </div>
  );
}
