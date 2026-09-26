import Link from 'next/link';
import type { Metadata } from 'next';
import { ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';

import { Card, formatDate } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';
import { buildMetadata } from '@/lib/seo/metadata';
import { verifyCertificate } from '@/lib/volunteers/verify';

export const metadata: Metadata = buildMetadata({
  title: 'Verify a certificate',
  description: 'Confirm that a Sailent Foundation certificate of service is genuine.',
  path: '/verify',
  /*
    NOT INDEXED. Each URL contains somebody's verification code — the secret
    that makes this check meaningful. Letting a search engine crawl and publish
    them would turn a verification page into a directory of volunteers'
    service records.
  */
  noIndex: true,
});

export const dynamic = 'force-dynamic';

/**
 * Is this certificate genuine?
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WRITTEN FOR SOMEBODY WHO HAS NEVER HEARD OF THIS ORGANISATION.
 *
 * The reader is an employer with a certificate in front of them. They have no
 * account, no context and about fifteen seconds. So the page answers the one
 * question they have, in the first line, and shows only what is already
 * printed on the document they are holding.
 *
 * A WITHDRAWN certificate shows its details with a clear notice rather than a
 * "not found". "No such certificate" would read as a forgery, which is unfair
 * to somebody whose certificate was reissued for an administrative reason.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const certificate = await verifyCertificate(code);

  return (
    <PageShell className="py-12 md:py-20">
      <div className="mx-auto max-w-lg">
        <h1 className="text-h1 text-center font-bold">Certificate check</h1>

        {!certificate ? (
          <Card className="mt-8 p-6 text-center md:p-8">
            <ShieldAlert className="text-muted-foreground mx-auto size-10" aria-hidden="true" />
            <p className="text-h3 mt-4 font-semibold">We cannot find that certificate</p>
            <p className="text-body text-muted-foreground mt-3">
              No certificate carries this code. Check that it was typed exactly as printed — or, if
              it was copied from a link, that the whole link came with it.
            </p>
          </Card>
        ) : certificate.valid ? (
          <Card className="border-success/30 bg-success-subtle mt-8 p-6 md:p-8">
            <div className="text-center">
              <ShieldCheck className="text-success mx-auto size-10" aria-hidden="true" />
              <p className="text-h3 mt-4 font-semibold">This certificate is genuine</p>
            </div>

            <dl className="text-body mt-6 space-y-3">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">Issued to</dt>
                <dd className="font-medium">{certificate.volunteerName}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">Volunteer number</dt>
                <dd>{certificate.volunteerCode}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">Hours of service</dt>
                <dd data-numeric="" className="font-medium tabular-nums">
                  {certificate.hoursCredited}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">Period</dt>
                <dd>
                  {formatDate(certificate.periodStart)} — {formatDate(certificate.periodEnd)}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">Certificate number</dt>
                <dd>{certificate.certificateNumber}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">Issued</dt>
                <dd>{formatDate(certificate.issuedAt)}</dd>
              </div>
            </dl>

            <p className="text-caption text-muted-foreground border-border mt-6 border-t pt-4">
              {/*
                The one sentence that tells a reader what the number MEANS.
                "42 hours" is worthless without knowing who counted them.
              */}
              These hours were recorded by Sailent Foundation staff and verified before this
              certificate was issued. They are not self-reported.
            </p>
          </Card>
        ) : (
          <Card className="border-destructive/30 bg-destructive-subtle mt-8 p-6 md:p-8">
            <div className="text-center">
              <ShieldX className="text-destructive mx-auto size-10" aria-hidden="true" />
              <p className="text-h3 mt-4 font-semibold">This certificate has been withdrawn</p>
              <p className="text-body text-muted-foreground mt-3">
                It was issued to {certificate.volunteerName} on {formatDate(certificate.issuedAt)}{' '}
                and withdrawn
                {certificate.revokedAt ? ` on ${formatDate(certificate.revokedAt)}` : ''}. It should
                not be relied on.
              </p>
            </div>
          </Card>
        )}

        <p className="text-body-sm text-muted-foreground mt-6 text-center">
          <Link
            href="/contact"
            className="text-info-action focus-visible:outline-ring rounded-sm font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-2"
          >
            Get in touch
          </Link>{' '}
          if something here does not look right.
        </p>
      </div>
    </PageShell>
  );
}
