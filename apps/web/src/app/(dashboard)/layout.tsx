import * as React from 'react';
import { redirect } from 'next/navigation';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { AccountBadge } from '@/components/layout/account-badge';
import { PageShell } from '@/components/layout/page-shell';
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar';
import { donorDisplayName } from '@/components/dashboard/format';
import { currentDonor } from '@/lib/auth/donor-session';
import { getOrganisation } from '@/lib/content/organisation';
import { donorFetch, type DonorProfile } from '@/lib/donor/api';

/**
 * The donor dashboard shell: the public header and footer, and between them
 * the account sidebar beside the page (design, 2026-10-08).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NAMED `/dashboard`, NOT `/account`.
 *
 * Phase 0's information architecture called this `/account` and earlier phases
 * built a placeholder there. The Phase 7 brief names every route under
 * `/dashboard`, so that is what this is, and `/account` is a permanent redirect
 * rather than a second route for one concept.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE MIDDLEWARE IS WHAT KEEPS SIGNED-OUT PEOPLE OUT, not this. Next renders a
 * layout and its children IN PARALLEL, so a page's data fetch fires before a
 * `redirect()` here could take effect — the page would fail with a 401 and show
 * an error instead of the sign-in form. The redirect below is the second line,
 * for a cookie that exists but no longer works.
 *
 * And neither is an authorization control. The API re-checks ownership on every
 * request; a forged cookie gets somebody an empty shell full of 401s, which is
 * the correct outcome.
 */
import { MyAccountNavSlot } from '@/components/dashboard/my-account-nav-card';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const donor = await currentDonor();
  if (!donor) redirect('/sign-in');

  // The name and address in the sidebar. A failure here must not take the
  // page down — being unable to say who is signed in is not a reason to show
  // an error; the session's own name stands in.
  let profile: DonorProfile | null = null;
  try {
    profile = await donorFetch<DonorProfile>('me');
  } catch {
    profile = null;
  }
  const name = (profile ? donorDisplayName(profile) : '') || (donor.name ?? '').trim();
  // For the mobile menu's social row, as on the public site.
  const organisation = await getOrganisation();

  return (
    <div className="flex min-h-dvh flex-col print:block print:min-h-0">
      <a
        href="#main-content"
        className="skip-link bg-primary text-primary-foreground rounded-md px-4 py-2 print:hidden"
      >
        Skip to content
      </a>

      {/* Header across all screen sizes (mobile uses SiteHeader's full-site drawer) */}
      <div className="print:hidden">
        <SiteHeader
          accountSlot={<AccountBadge avatarUrl={profile?.avatarUrl ?? null} />}
          signedIn={Boolean(donor)}
          socialLinks={organisation.social}
        />
      </div>

      <main
        id="main-content"
        className="min-h-[calc(100dvh-4.5rem)] flex-1 py-4 sm:py-6 md:py-8 lg:py-6 lg:pb-8 xl:pb-8 xl:pt-5 print:m-0 print:block print:p-0"
      >
        <PageShell className="print:m-0 print:w-full print:max-w-none print:p-0">
          <div className="grid gap-5 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-6 xl:gap-5 print:block print:w-full print:gap-0">
            <div className="hidden lg:block print:hidden">
              <DashboardSidebar
                name={name}
                email={profile?.email ?? null}
                avatarUrl={profile?.avatarUrl ?? null}
              />
            </div>
            <div className="min-w-0 print:w-full">
              {/*
                Phone-only "My Account" card above each dashboard page. The
                dashboard home renders it itself, under its welcome banner.
              */}
              <MyAccountNavSlot />
              <div>{children}</div>
            </div>
          </div>
        </PageShell>
      </main>

      {/* Footer for mobile and desktop */}
      <div className="print:hidden">
        <SiteFooter />
      </div>
    </div>
  );
}
