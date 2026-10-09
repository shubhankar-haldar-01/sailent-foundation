import * as React from 'react';

import { DemoNotice } from '@/components/layout/demo-notice';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { AccountBadge } from '@/components/layout/account-badge';
import { currentDonor } from '@/lib/auth/donor-session';
import { getOrganisation } from '@/lib/content/organisation';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // The footer reads the same settings; the mobile menu's social row needs them too.
  const organisation = await getOrganisation();
  return (
    <div className="flex min-h-dvh flex-col">
      {/* First in the tab order, per the accessibility foundation. */}
      <a
        href="#main-content"
        className="skip-link bg-primary text-primary-foreground rounded-md px-4 py-2"
      >
        Skip to content
      </a>
      <DemoNotice />
      <SiteHeader
        accountSlot={<AccountBadge />}
        signedIn={Boolean(await currentDonor())}
        socialLinks={organisation.social}
      />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
