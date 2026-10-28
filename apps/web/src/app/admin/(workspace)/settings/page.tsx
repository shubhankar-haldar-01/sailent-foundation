import { Card, CardContent, PageHeader, Alert } from '@sailent/ui';
import { ShieldAlert } from 'lucide-react';

import { ReauthPanel } from '@/components/admin/reauth-panel';
import { SettingsForm } from '@/components/admin/settings-form';
import { AdminApiError, getSettings } from '@/lib/admin/api';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Organisation settings.
 *
 * Distinct from `/dashboard/settings`, which is a DONOR's own preferences.
 * These are the organisation's, on the staff audience, behind
 * `settings.read` — `registration_details` holds the PAN, which is a statutory
 * identifier rather than something to show unauthenticated.
 *
 * Saving is `@Sensitive()`, so the API answers `REAUTH_REQUIRED` for a stale
 * session and the form shows that error. Reading is not, so the page itself
 * loads without one.
 */
export default async function AdminSettingsPage() {
  const actor = await currentActor();

  if (!can(actor, 'settings.read')) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <ShieldAlert className="text-muted-foreground/40 mb-3 h-10 w-10" />
          <p className="text-foreground text-sm font-medium">Access Restricted</p>
          <p className="text-muted-foreground mt-1 text-xs">
            You do not have permission to view or manage organisation settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  try {
    const settings = await getSettings();

    return (
      <div className="space-y-6">
        <PageHeader
          title="Organisation settings"
          description="The organisation’s statutory details and operational defaults. Changes are recorded in the immutable audit log and require recent 5-minute re-authentication."
        />

        <SettingsForm settings={settings} />
      </div>
    );
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'REAUTH_REQUIRED') {
      return (
        <ReauthPanel
          returnTo="/admin/settings"
          what="Settings include the statutory identifiers printed on receipts."
        />
      );
    }

    return (
      <div className="space-y-4">
        <PageHeader
          title="Organisation settings"
          description="The organisation’s statutory details and operational defaults."
        />
        <Alert variant="destructive">
          {error instanceof AdminApiError ? error.message : 'Could not load settings just now.'}
        </Alert>
      </div>
    );
  }
}
