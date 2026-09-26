import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Alert, formatCurrency } from '@sailent/ui';

import { StatusPill } from '@/components/admin/status-pill';
import { AdminApiError, adminFetch, type Paginated } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

/**
 * Draft preview.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * SECURE BY ROUTE, not by token.
 *
 * This page lives under `/admin`, so it is behind the staff session guard, and
 * it reads through the ADMIN API — which checks `program.read` or
 * `campaign.read` on every request like any other admin call. An operator
 * without those permissions gets a 403 here exactly as they would anywhere
 * else.
 *
 * Deliberately NOT done with a shareable preview token in a public URL. A token
 * that renders unpublished content is a credential that leaks by being pasted
 * into a group chat, and it has no audit trail and no revocation. If sharing a
 * draft with someone outside the team is ever needed, that is a feature worth
 * designing — an expiring, revocable, logged grant — not a query parameter.
 *
 * `robots: noindex` is inherited from the admin layout, and `/admin` is
 * disallowed in robots.txt, so a draft cannot be crawled from here either.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function PreviewPage({
  params,
}: {
  params: Promise<{ entity: string; slug: string }>;
}) {
  const { entity, slug } = await params;
  if (entity !== 'program' && entity !== 'campaign') notFound();

  const resource = entity === 'program' ? 'programs' : 'campaigns';

  let record: Record<string, unknown>;
  try {
    // Looked up by slug through the admin listing, because the admin detail
    // endpoint is keyed by id and a preview link is naturally by slug.
    const page = await adminFetch<Paginated<Record<string, unknown>>>(`admin/${resource}`, {
      query: { q: slug, status: 'all', limit: 50 },
    });

    const match = page.items.find((item) => item.slug === slug);
    if (!match) notFound();

    record = await adminFetch<Record<string, unknown>>(`admin/${resource}/${match.id as string}`);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  const status = String(record.status);
  const isPublic = ['published', 'active', 'paused', 'completed'].includes(status);

  return (
    <div className="space-y-6">
      <Alert variant="warning">
        <strong>Preview.</strong>{' '}
        {isPublic
          ? 'This is live on the public site.'
          : 'This is not published. Nobody outside the team can see it.'}
      </Alert>

      <header>
        <Link
          href={`/admin/${resource}`}
          className="text-body-sm text-muted-foreground hover:underline"
        >
          ← {entity === 'program' ? 'Programs' : 'Campaigns'}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-h1 font-bold tracking-tight">{String(record.title)}</h1>
          <StatusPill status={status} />
        </div>
        <p className="text-body-sm text-muted-foreground mt-1">
          /{resource}/{slug}
        </p>
      </header>

      {record.shortDescription ? (
        <p className="text-body-lg text-muted-foreground max-w-prose leading-relaxed">
          {String(record.shortDescription)}
        </p>
      ) : (
        <p className="text-body-sm text-warning-foreground">
          No short description yet — required before this can be published.
        </p>
      )}

      {entity === 'campaign' ? (
        <dl className="border-border grid gap-4 rounded-lg border p-5 sm:grid-cols-3">
          <div>
            <dt className="text-caption text-muted-foreground uppercase">Goal</dt>
            <dd data-numeric="" className="text-h4 font-semibold tabular-nums">
              {record.fundraisingGoal ? formatCurrency(Number(record.fundraisingGoal)) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground uppercase">Program</dt>
            <dd className="text-body-sm">{String(record.programTitle ?? 'Not attached')}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground uppercase">Category</dt>
            <dd className="text-body-sm">{String(record.category ?? '—')}</dd>
          </div>
        </dl>
      ) : null}

      {record.description ? (
        <div className="max-w-prose space-y-4">
          {String(record.description)
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((paragraph, index) => (
              <p key={index} className="text-body text-muted-foreground leading-relaxed">
                {paragraph}
              </p>
            ))}
        </div>
      ) : null}

      <p className="text-caption text-muted-foreground">
        This is a content check, not a rendering of the final page. Publish to see it in the real
        layout.
      </p>
    </div>
  );
}
