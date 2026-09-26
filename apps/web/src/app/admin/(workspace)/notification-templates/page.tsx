import Link from 'next/link';

import { ActivePill } from '@/components/admin/notification-panels';
import { AdminApiError, listNotificationTemplates } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

/**
 * Email templates.
 *
 * Every transactional email the platform sends has a row here (§4.21), and
 * every row is editable without a deployment. An inactive template is not a
 * broken one — the processor falls back to its built-in wording, so turning
 * one off changes the words, never whether the email arrives.
 */
export default async function AdminTemplatesPage() {
  let items;
  try {
    ({ items } = await listNotificationTemplates());
  } catch (error) {
    return (
      <p
        role="alert"
        className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
      >
        {error instanceof AdminApiError ? error.message : 'Could not load the templates.'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">Email templates</h1>
        <p className="text-body-sm text-muted-foreground mt-1 max-w-2xl">
          The wording of every transactional email. Editing one saves a new version; an inactive
          template falls back to the built-in wording rather than stopping the email.
        </p>
      </header>

      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[44rem] text-left">
          <thead className="bg-muted/60 text-caption text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                Email
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Subject
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Version
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                State
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {items.map((template) => (
              <tr key={template.id} className="hover:bg-muted/40 align-top">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/notification-templates/${template.id}`}
                    className="text-body-sm hover:text-info-action font-semibold"
                  >
                    {template.name}
                  </Link>
                  <p className="text-caption text-muted-foreground mt-0.5 font-mono">
                    {template.slug}
                  </p>
                </td>
                <td className="text-body-sm text-muted-foreground px-4 py-3">{template.subject}</td>
                <td className="text-body-sm text-muted-foreground px-4 py-3">{template.version}</td>
                <td className="px-4 py-3">
                  <ActivePill isActive={template.isActive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
