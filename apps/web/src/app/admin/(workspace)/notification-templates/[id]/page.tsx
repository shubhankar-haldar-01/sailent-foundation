import { notFound } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

import { ActivePill, TemplateEditor } from '@/components/admin/notification-panels';
import { AdminApiError, getNotificationTemplate } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** One template: its wording, the variables it is given, and its history. */
export default async function AdminTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();

  let template;
  try {
    template = await getNotificationTemplate(id);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={template.name}
        description={`Identifier: ${template.slug} · Active revision version ${template.version}`}
        status={<ActivePill isActive={template.isActive} />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template Specification & Content</CardTitle>
          <CardDescription>
            {template.description ||
              'Modify email subject and body copy. Interpolation tokens are replaced dynamically at dispatch time.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {can(actor, 'notification.template.manage') ? (
            <TemplateEditor template={template} />
          ) : (
            <p className="border-border/60 text-body-sm text-muted-foreground bg-muted/20 rounded-lg border p-5">
              You have read-only access to this email template. Editing requires
              notification.template.manage permission.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
