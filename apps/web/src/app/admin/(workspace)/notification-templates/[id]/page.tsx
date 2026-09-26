import Link from 'next/link';
import { notFound } from 'next/navigation';

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
      <nav aria-label="Breadcrumb" className="text-body-sm text-muted-foreground">
        <Link href="/admin/notification-templates" className="hover:text-foreground">
          Email templates
        </Link>
      </nav>

      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">{template.name}</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          <span className="font-mono">{template.slug}</span> · version {template.version} ·{' '}
          <ActivePill isActive={template.isActive} />
        </p>
        {template.description ? (
          <p className="text-body-sm text-muted-foreground mt-2 max-w-2xl">
            {template.description}
          </p>
        ) : null}
      </header>

      {can(actor, 'notification.template.manage') ? (
        <TemplateEditor template={template} />
      ) : (
        <p className="border-border text-body-sm text-muted-foreground rounded-lg border p-5">
          You can read this template but not change it.
        </p>
      )}
    </div>
  );
}
