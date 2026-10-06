import type { Metadata } from 'next';

import { PageShell, Section } from '@/components/layout/page-shell';
import { PageHero } from '@/components/sections/page-hero';
import { NewsletterTokenForm } from '@/components/forms/newsletter-token-form';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Confirm your subscription',
  description: 'Confirm your newsletter subscription.',
  path: '/newsletter/confirm',
  noIndex: true,
});

/** Reached from the link in a newsletter email (Phase 13). */
export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);

  return (
    <>
      <PageHero
        eyebrow="Newsletter"
        title="Confirm your subscription"
        lead="One click and you are on the list. Nothing is sent until you confirm."
      />
      <Section>
        <PageShell>
          <div className="max-w-xl">
            {valid ? (
              <NewsletterTokenForm mode="confirm" token={token} />
            ) : (
              <p role="alert" className="text-body-sm text-destructive">
                This link is incomplete. Open it again from the email, or subscribe again from the
                home page to get a new one.
              </p>
            )}
          </div>
        </PageShell>
      </Section>
    </>
  );
}
