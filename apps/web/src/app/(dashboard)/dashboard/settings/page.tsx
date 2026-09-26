import type { Metadata } from 'next';

import { SettingsForm } from '@/components/dashboard/settings-form';
import { donorFetch, type DonorSettings } from '@/lib/donor/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Settings',
  path: '/dashboard/settings',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const settings = await donorFetch<DonorSettings>('me/settings');

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-h1 font-bold">Settings</h1>
        <p className="text-body text-muted-foreground mt-2">
          What you hear from us, how we reach you, and how you appear publicly.
        </p>
      </header>

      <SettingsForm settings={settings} />
    </div>
  );
}
