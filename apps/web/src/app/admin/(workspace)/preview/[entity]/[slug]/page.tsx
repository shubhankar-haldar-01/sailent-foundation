import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  formatCurrency,
} from '@sailent/ui';
import { ArrowLeft, ExternalLink } from 'lucide-react';

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
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground gap-1.5">
          <Link href={`/admin/${resource}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to {entity === 'program' ? 'Programs' : 'Campaigns'}
          </Link>
        </Button>
      </div>

      <Alert variant="warning">
        <span className="font-semibold">Internal Preview Mode.</span>{' '}
        {isPublic
          ? 'This record is published and currently live on the public website.'
          : 'This record is a draft and not published. It is visible only to authorized staff.'}
      </Alert>

      <PageHeader
        title={String(record.title)}
        description={`/${resource}/${slug}`}
        status={<StatusPill status={status} />}
        actions={
          isPublic ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/${resource}/${slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                View Live Page
              </Link>
            </Button>
          ) : undefined
        }
      />

      {record.shortDescription ? (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
              Summary Lead
            </h2>
            <p className="text-foreground text-base leading-relaxed">
              {String(record.shortDescription)}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Alert variant="destructive">
          No short description provided. A summary description is required before publishing.
        </Alert>
      )}

      {entity === 'campaign' ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Fundraising Goal
              </span>
              <p className="text-foreground mt-2 text-xl font-bold tabular-nums">
                {record.fundraisingGoal ? formatCurrency(Number(record.fundraisingGoal)) : '—'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Associated Program
              </span>
              <p className="text-foreground mt-2 text-sm font-medium">
                {String(record.programTitle ?? 'Not attached')}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Cause Category
              </span>
              <p className="text-foreground mt-2 text-sm font-medium capitalize">
                {String(record.category ?? '—')}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {record.description ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Full Content Body</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {String(record.description)
              .split(/\n{2,}/)
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index} className="text-foreground/90 text-sm leading-relaxed">
                  {paragraph}
                </p>
              ))}
          </CardContent>
        </Card>
      ) : null}

      <p className="text-muted-foreground text-xs">
        Note: This is an internal content review, not a layout simulation. Publish to render this
        content inside the public web templates.
      </p>
    </div>
  );
}
