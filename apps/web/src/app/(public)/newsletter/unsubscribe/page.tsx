import type { Metadata } from 'next';

import { PageShell, Section } from '@/components/layout/page-shell';
import { PageHero } from '@/components/sections/page-hero';
import { NewsletterTokenForm } from '@/components/forms/newsletter-token-form';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Unsubscribe',
  description: 'Unsubscribe from the newsletter.',
  path: '/newsletter/unsubscribe',
  noIndex: true,
});

/** Reached from the link in a newsletter email (Phase 13). */
export default async function NewsletterUnsubscribePage({
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
        title="Unsubscribe"
        lead="Stop receiving the Sailent Foundation newsletter."
      />
      <Section>
        <PageShell>
          <div className="max-w-xl">
            {valid ? (
              <NewsletterTokenForm mode="unsubscribe" token={token} />
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
