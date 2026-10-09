import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UserRound } from 'lucide-react';

import { cn } from '@sailent/ui';

import { AuthBrand, AuthShell, OrDivider } from '@/components/auth/auth-shell';
import { DonorSignInForm } from '@/components/dashboard/sign-in-form';
import { currentDonor } from '@/lib/auth/donor-session';
import { headingExtraBold } from '@/lib/fonts';
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
 * Donor sign-in, laid out to the owner's login design (2026-10-08).
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
    <AuthShell>
      <AuthBrand />
      <h1
        className={cn(
          headingExtraBold.className,
          'text-foreground mt-4 text-[clamp(1.625rem,1.3rem+1vw,1.875rem)] leading-tight tracking-[-0.025em]',
        )}
      >
        Login to Continue
      </h1>
      <p className="text-muted-foreground mt-1 text-[0.875rem] leading-relaxed">
        Enter your email address and OTP to access your account.
      </p>

      <DonorSignInForm next={next} />

      <OrDivider className="mt-3" />
      <Link
        href="/sign-up"
        className="border-cta-glow/60 bg-primary-soft/60 focus-visible:outline-ring hover:bg-primary-soft hover:border-cta-glow mt-3 flex min-h-11 flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-xl border-[1.5px] px-4 py-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <UserRound aria-hidden="true" className="text-cta-glow size-5 shrink-0" strokeWidth={1.8} />
        <span className="text-foreground text-[0.9375rem]">Don&rsquo;t have an account?</span>
        <span className="text-primary text-base font-semibold">Sign Up</span>
      </Link>
    </AuthShell>
  );
}
