import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, HandHeart, HeartHandshake, KeyRound, LogIn } from 'lucide-react';

import { Button, cn } from '@sailent/ui';

import { AuthBrand, AuthShell, OrDivider } from '@/components/auth/auth-shell';
import { currentDonor } from '@/lib/auth/donor-session';
import { headingExtraBold } from '@/lib/fonts';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Sign up',
  description:
    'How a Sailent Foundation account is created: with your first donation, or when you apply to volunteer.',
  path: '/sign-up',
  noIndex: true,
});

const WAYS = [
  {
    icon: HeartHandshake,
    title: 'Make a donation',
    body: 'Your account is created with your first donation, under the email address you give with it.',
  },
  {
    icon: HandHeart,
    title: 'Apply to volunteer',
    body: 'Sign in with the email address you applied with to follow your application and assignments.',
  },
  {
    icon: KeyRound,
    title: 'No password',
    body: 'Each time, we email a 6-digit code to that address. There is nothing to set or remember.',
  },
] as const;

/**
 * "Sign Up", told straight (owner decision, 2026-10-08).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THERE IS NO SEPARATE SIGN-UP, AND THIS PAGE SAYS SO. An account is opened by
 * a donation or a volunteer application (decision A8), and sign-in codes are
 * only ever emailed to an address the foundation already holds — which is what
 * stops the form being used to send mail to strangers. A "create account" form
 * here would collect an address and then never send it anything. Instead the
 * page explains, and offers the two ways in.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function SignUpPage() {
  // Somebody already signed in has an account.
  if (await currentDonor()) redirect('/dashboard');

  return (
    <AuthShell>
      <AuthBrand />
      <h1
        className={cn(
          headingExtraBold.className,
          'text-foreground mt-4 text-[clamp(1.625rem,1.3rem+1vw,1.875rem)] leading-tight tracking-[-0.025em]',
        )}
      >
        Create Your Account
      </h1>
      <p className="text-muted-foreground mt-1 max-w-[28rem] text-[0.875rem] leading-relaxed">
        Your account starts with a donation or a volunteer application — there is no separate
        sign-up form.
      </p>

      <ul className="mt-5 space-y-3.5">
        {WAYS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3">
            <span
              aria-hidden="true"
              className="text-cta-glow dark:bg-primary/10 bg-(--cta-50) grid size-10 shrink-0 place-items-center rounded-full"
            >
              <Icon className="size-5" strokeWidth={1.8} />
            </span>
            <span>
              <span className="text-foreground block text-[0.9375rem] font-semibold">{title}</span>
              <span className="text-muted-foreground mt-0.5 block text-[0.8125rem] leading-relaxed">
                {body}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
        <Button asChild size="lg" className="h-11 rounded-full text-base">
          <Link href="/donate">
            Donate Now
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg" className="h-11 rounded-full text-base">
          <Link href="/volunteer">Volunteer with Us</Link>
        </Button>
      </div>

      <OrDivider className="mt-4" />
      <Link
        href="/sign-in"
        className="border-cta-glow/60 bg-primary-soft/60 focus-visible:outline-ring hover:bg-primary-soft hover:border-cta-glow mt-3 flex min-h-11 flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-xl border-[1.5px] px-4 py-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <LogIn aria-hidden="true" className="text-cta-glow size-5 shrink-0" strokeWidth={1.8} />
        <span className="text-foreground text-[0.9375rem]">Already have an account?</span>
        <span className="text-primary text-base font-semibold">Login</span>
      </Link>
    </AuthShell>
  );
}
