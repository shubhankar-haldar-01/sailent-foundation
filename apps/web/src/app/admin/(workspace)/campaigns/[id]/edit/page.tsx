import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Progress, formatCurrency, formatDate } from '@sailent/ui';

import { CampaignForm } from '@/components/admin/campaign-form';
import { FaqsPanel, type FaqRow } from '@/components/admin/campaign-children';
import { CampaignProductManager } from '@/components/products/campaign-product-manager';
import type { CampaignProductRow, CatalogueProduct } from '@/components/products/types';
import { StatusActions } from '@/components/admin/status-actions';
import { StatusPill } from '@/components/admin/status-pill';
import { changeCampaignStatus } from '@/lib/admin/actions';
import {
  AdminApiError,
  adminFetch,
  type AdminCampaign,
  type AdminCategory,
  type AdminProgram,
  type Paginated,
} from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

interface CampaignDetail extends AdminCampaign {
  description: string | null;
  beneficiaryContext: string | null;
  fundUtilization: string | null;
  internalNotes: string | null;
  state: string | null;
  slugHistory: { slug: string; changedAt: string }[];
}

/**
 * The six-state lifecycle, mapped to endpoints and labels.
 *
 * Which of these render is decided by the transition table fetched from the
 * API, so this object describes HOW to perform a move, never WHETHER one is
 * available.
 */
const CAMPAIGN_LABELS = {
  published: { endpoint: 'publish', label: 'Publish' },
  active: { endpoint: 'activate', label: 'Open for donations' },
  paused: { endpoint: 'pause', label: 'Pause donations' },
  completed: { endpoint: 'complete', label: 'Mark complete' },
  archived: { endpoint: 'archive', label: 'Archive' },
  draft: { endpoint: 'status', label: 'Back to draft' },
};

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let campaign: CampaignDetail;
  let transitions: { campaign: Record<string, string[]> };
  let programs: Paginated<AdminProgram>;
  let categories: { items: AdminCategory[] };
  let products: { items: CampaignProductRow[] };
  let faqs: { items: FaqRow[] };
  let catalogue: Paginated<CatalogueProduct>;

  try {
    [campaign, transitions, programs, categories, products, faqs, catalogue] = await Promise.all([
      adminFetch<CampaignDetail>(`admin/campaigns/${id}`),
      adminFetch<{ campaign: Record<string, string[]> }>('admin/campaigns/transitions'),
      adminFetch<Paginated<AdminProgram>>('admin/programs', {
        query: { status: 'published', limit: 100, sort: 'title' },
      }),
      adminFetch<{ items: AdminCategory[] }>('admin/categories', { query: { kind: 'campaign' } }),
      adminFetch<{ items: CampaignProductRow[] }>(`admin/campaigns/${id}/products`),
      adminFetch<{ items: FaqRow[] }>(`admin/campaigns/${id}/faqs`),
      /**
       * The catalogue, ALREADY FILTERED to what this campaign does not offer.
       *
       * Filtering server-side rather than in the picker is what makes a
       * duplicate impossible to choose rather than merely refused. The unique
       * index would reject the insert either way; this means nobody reaches it.
       */
      adminFetch<Paginated<CatalogueProduct>>('admin/products', {
        query: { notInCampaignId: id, status: 'active', limit: 100, sort: 'name' },
      }),
    ]);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  const isPublic = ['published', 'active', 'paused', 'completed'].includes(campaign.status);

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/admin/campaigns"
          className="text-body-sm text-muted-foreground hover:underline"
        >
          ← Campaigns
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-h1 font-bold tracking-tight">{campaign.title}</h1>
          <StatusPill status={campaign.status} />
        </div>
        <p className="text-body-sm text-muted-foreground mt-1">
          /{campaign.slug} · updated {formatDate(campaign.updatedAt)}
          {' · '}
          <Link
            href={
              isPublic ? `/campaigns/${campaign.slug}` : `/admin/preview/campaign/${campaign.slug}`
            }
            target={isPublic ? '_blank' : undefined}
            className="text-primary hover:underline"
          >
            {isPublic ? 'View on the site' : 'Preview'}
          </Link>
        </p>
      </header>

      {/* Overview — the numbers an operator opens this page to check. */}
      <section className="border-border grid gap-5 rounded-lg border p-5 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <p className="text-caption text-muted-foreground uppercase">Raised</p>
          <p data-numeric="" className="font-display text-h2 font-bold tabular-nums">
            {formatCurrency(campaign.amountRaised)}
            <span className="text-body text-muted-foreground font-normal">
              {' of '}
              {formatCurrency(campaign.fundraisingGoal)}
            </span>
          </p>
          <Progress
            value={campaign.progress.percent}
            className="mt-2 max-w-md"
            label={`${campaign.progress.percent}% of the goal raised`}
          />
          <p className="text-caption text-muted-foreground mt-1.5">
            {campaign.progress.goalReached
              ? `Goal reached. ${formatCurrency(campaign.progress.surplus)} beyond it.`
              : `${formatCurrency(campaign.progress.remaining)} still needed.`}
            {campaign.daysRemaining !== null ? ` · ${campaign.daysRemaining} days left.` : ''}
          </p>
        </div>

        <dl className="space-y-3">
          <div>
            <dt className="text-caption text-muted-foreground uppercase">Donors</dt>
            <dd data-numeric="" className="text-h4 font-semibold tabular-nums">
              {campaign.donorCount}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground uppercase">Beneficiaries</dt>
            <dd data-numeric="" className="text-h4 font-semibold tabular-nums">
              {campaign.beneficiariesReached}
              {campaign.beneficiaryTarget ? ` / ${campaign.beneficiaryTarget}` : ''}
            </dd>
          </div>
        </dl>

        <p className="text-caption text-muted-foreground sm:col-span-3">
          Raised, donors and beneficiaries reached are updated by recorded donations, not by hand.
          They stay at zero until payment processing lands.
        </p>
      </section>

      <section className="border-border rounded-lg border p-5">
        <h2 className="text-h4 font-semibold">Lifecycle</h2>
        <p className="text-body-sm text-muted-foreground mb-4 mt-1">
          {campaign.status === 'active'
            ? 'Open for donations.'
            : campaign.status === 'paused'
              ? 'Publicly visible, donations stopped.'
              : campaign.status === 'completed'
                ? 'Complete. Still readable as history.'
                : isPublic
                  ? 'Visible publicly, not yet taking donations.'
                  : 'Not visible publicly.'}
        </p>
        <StatusActions
          entityId={campaign.id}
          slug={campaign.slug}
          current={campaign.status}
          allowed={transitions.campaign[campaign.status] ?? []}
          action={changeCampaignStatus}
          labels={CAMPAIGN_LABELS}
          reasonRequired={['paused', 'completed']}
          confirmRequired={['archived']}
        />
      </section>

      <section>
        <h2 className="text-h4 mb-4 font-semibold">Details</h2>
        <CampaignForm
          programs={programs.items}
          categories={categories.items.filter((c) => c.isActive)}
          campaign={campaign}
        />
      </section>

      <section>
        <h2 className="text-h4 mb-1 font-semibold">Products</h2>
        <p className="text-body-sm text-muted-foreground mb-4 max-w-prose">
          Chosen from the shared catalogue. The price below is this campaign’s own — changing it
          affects no other campaign, and no donation already taken.
        </p>
        <CampaignProductManager
          campaignId={campaign.id}
          products={products.items}
          catalogue={catalogue.items}
        />
      </section>

      <section>
        <h2 className="text-h4 mb-4 font-semibold">FAQs</h2>
        <FaqsPanel campaignId={campaign.id} faqs={faqs.items} />
      </section>

      {campaign.slugHistory.length > 0 ? (
        <section>
          <h2 className="text-h4 mb-2 font-semibold">Previous addresses</h2>
          <p className="text-body-sm text-muted-foreground mb-3">
            Each still redirects here permanently, so posters and forwarded links keep working.
          </p>
          <ul className="text-body-sm text-muted-foreground space-y-1">
            {campaign.slugHistory.map((entry) => (
              <li key={entry.slug}>
                <code>/campaigns/{entry.slug}</code> — retired {formatDate(entry.changedAt)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
