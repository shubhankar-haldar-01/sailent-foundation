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
      <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-10 text-center">
        You do not have permission to view organisation settings.
      </p>
    );
  }

  try {
    const settings = await getSettings();

    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-h1 font-bold tracking-tight">Settings</h1>
          <p className="text-body-sm text-muted-foreground mt-1">
            The organisation’s own settings. Changes are recorded in the audit log and require a
            recent re-authentication.
          </p>
        </header>

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

    // A missing row is a real, actionable message from the API rather than a
    // crash — it means reference data has not been seeded.
    return (
      <div className="space-y-4">
        <h1 className="font-display text-h1 font-bold tracking-tight">Settings</h1>
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
        >
          {error instanceof AdminApiError ? error.message : 'Could not load settings just now.'}
        </p>
      </div>
    );
  }
}
