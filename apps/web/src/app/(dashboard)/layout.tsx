import * as React from 'react';
import { redirect } from 'next/navigation';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { AccountBadge } from '@/components/layout/account-badge';
import { PageShell } from '@/components/layout/page-shell';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { SignOutButton } from '@/components/dashboard/sign-out-button';
import { currentDonor } from '@/lib/auth/donor-session';
import { donorFetch, type DonorProfile } from '@/lib/donor/api';

/**
 * The donor dashboard shell.
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
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const donor = await currentDonor();
  if (!donor) redirect('/sign-in');

  // The name in the greeting. A failure here must not take the page down —
  // being unable to say "Hello Asha" is not a reason to show an error.
  let profile: DonorProfile | null = null;
  try {
    profile = await donorFetch<DonorProfile>('me');
  } catch {
    profile = null;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="skip-link bg-primary text-primary-foreground rounded-md px-4 py-2"
      >
        Skip to content
      </a>
      <SiteHeader accountSlot={<AccountBadge />} />
      <main id="main-content" className="flex-1 py-8 md:py-12">
        <PageShell>
          <div className="grid gap-8 lg:grid-cols-[15rem_1fr]">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="border-border mb-4 hidden rounded-lg border p-4 lg:block">
                <p className="text-caption text-muted-foreground">Signed in as</p>
                <p className="text-body-sm mt-0.5 truncate font-semibold">
                  {profile?.firstName
                    ? `${profile.firstName} ${profile.lastName ?? ''}`.trim()
                    : 'Your account'}
                </p>
                {profile?.donorCode ? (
                  <p data-numeric="" className="text-caption text-muted-foreground mt-1">
                    {profile.donorCode}
                  </p>
                ) : null}
              </div>

              <DashboardNav />

              <div className="mt-4 hidden lg:block">
                <SignOutButton />
              </div>
            </div>

            <div className="min-w-0">{children}</div>
          </div>

          <div className="mt-8 lg:hidden">
            <SignOutButton />
          </div>
        </PageShell>
      </main>
      <SiteFooter />
    </div>
  );
}
