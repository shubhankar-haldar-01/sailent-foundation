import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Card } from '@sailent/ui';

import { DonorSignInForm } from '@/components/dashboard/sign-in-form';
import { PageShell } from '@/components/layout/page-shell';
import { currentDonor } from '@/lib/auth/donor-session';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Sign in',
  description: 'See your giving history, receipts and the campaigns you have funded.',
  path: '/sign-in',
  // A sign-in form has nothing to offer a search result, and indexing it only
  // creates a plausible-looking page for a phishing result to imitate.
  noIndex: true,
});

/**
 * Donor sign-in.
 *
 * Separate from `/admin/login`, and deliberately not linked to it. They are
 * different audiences with different credentials — staff sign in with a
 * password and, for privileged roles, a second factor; donors have neither and
 * never will (decision A8).
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  /*
    `next` is echoed into the form and validated by the action before any
    redirect happens — it comes from a query string, so it is attacker-
    controlled, and "sign in and then be taken somewhere" is the shape of a
    phishing link. Only a path beginning with a single `/` survives.
  */
  const requested = (await searchParams).next;
  const next = requested?.startsWith('/') && !requested.startsWith('//') ? requested : undefined;

  // Already signed in: send them where they were going rather than showing a
  // form that would immediately bounce.
  if (await currentDonor()) redirect(next ?? '/dashboard');

  return (
    <PageShell className="py-12 md:py-20">
      <div className="mx-auto max-w-md">
        <h1 className="text-h1 text-center font-bold">Sign in</h1>
        <p className="text-body text-muted-foreground mt-3 text-center">
          See your giving history, download receipts, and follow the work you have funded.
        </p>

        <Card className="mt-8 p-6 md:p-8">
          <DonorSignInForm next={next} />
        </Card>

        <p className="text-body-sm text-muted-foreground mt-6 text-center">
          Not donated yet?{' '}
          <Link
            href="/campaigns"
            className="text-info-action focus-visible:outline-ring rounded-sm font-semibold underline underline-offset-4 focus-visible:outline-2"
          >
            Find a campaign
          </Link>
          .
        </p>
      </div>
    </PageShell>
  );
}
