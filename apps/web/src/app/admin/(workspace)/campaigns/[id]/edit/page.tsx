import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Eye } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Progress,
  formatCurrency,
  formatDate,
  PageHeader,
} from '@sailent/ui';

import { CampaignForm } from '@/components/admin/campaign-form';
import { FaqsPanel, type FaqRow } from '@/components/admin/campaign-children';
import { CampaignProductManager } from '@/components/products/campaign-product-manager';
import type { CampaignProductRow, CatalogueProduct } from '@/components/products/types';
import { StatusActions } from '@/components/admin/status-actions';
import { StatusPill } from '@/components/admin/status-pill';
import { changeCampaignStatus, deleteCampaignAction } from '@/lib/admin/actions';
import { CampaignUpdatesPanel } from '@/components/admin/campaign-media';
import { can, currentActor } from '@/lib/auth/session';
import {
  AdminApiError,
  adminFetch,
  listCampaignGallery,
  listCampaignUpdates,
  listMedia,
  type AdminCampaign,
  type AdminCampaignUpdate,
  type AdminGalleryItem,
  type AdminMedia,
  type AdminCategory,
  type AdminProgram,
  type Paginated,
} from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

interface CampaignDetail extends AdminCampaign {
  coverImage: string | null;
  description: string | null;
  beneficiaryContext: string | null;
  fundUtilization: string | null;
  internalNotes: string | null;
  state: string | null;
  slugHistory: { slug: string; changedAt: string }[];
}

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
        query: { status: 'all', limit: 100, sort: 'title' },
      }),
      adminFetch<{ items: AdminCategory[] }>('admin/categories', { query: { kind: 'campaign' } }),
      adminFetch<{ items: CampaignProductRow[] }>(`admin/campaigns/${id}/products`),
      adminFetch<{ items: FaqRow[] }>(`admin/campaigns/${id}/faqs`),
      adminFetch<Paginated<CatalogueProduct>>('admin/products', {
        query: { notInCampaignId: id, status: 'active', limit: 100, sort: 'name' },
      }),
    ]);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  const actor = await currentActor();
  const [mediaOptions, gallery, updates] = await Promise.all([
    can(actor, 'media.read')
      ? listMedia({ visibility: 'public', limit: 60 }).then((page) => page.items)
      : Promise.resolve([] as AdminMedia[]),
    can(actor, 'campaign_gallery.manage')
      ? listCampaignGallery(id).then((page) => page.items)
      : Promise.resolve(null as AdminGalleryItem[] | null),
    listCampaignUpdates(id).then((page) => page.items) as Promise<AdminCampaignUpdate[]>,
  ]);

  const isPublic = ['published', 'active', 'paused', 'completed'].includes(campaign.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={campaign.title}
        breadcrumb={
          <Link
            href="/admin/campaigns"
            className="text-body-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to campaigns
          </Link>
        }
        description={`/${campaign.slug} · Updated ${formatDate(campaign.updatedAt)}`}
        status={<StatusPill status={campaign.status} />}
        actions={
          <div className="flex items-center gap-2">
            {isPublic ? (
              <Button asChild variant="secondary" size="sm" className="gap-1.5">
                <Link href={`/campaigns/${campaign.slug}`} target="_blank">
                  View on site
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="secondary" size="sm" className="gap-1.5">
                <Link href={`/admin/preview/campaign/${campaign.slug}`}>
                  <Eye className="size-3.5" aria-hidden="true" />
                  Preview draft
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {/* Progress & Operational Performance Card */}
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <p className="text-caption text-muted-foreground font-semibold uppercase tracking-wider">
                Total Raised
              </p>
              <p
                data-numeric=""
                className="font-display text-h1 text-foreground mt-1 font-bold tabular-nums"
              >
                {formatCurrency(campaign.amountRaised)}
                <span className="text-body text-muted-foreground font-normal">
                  {' of '}
                  {formatCurrency(campaign.fundraisingGoal)}
                </span>
              </p>
              <Progress
                value={campaign.progress.percent}
                className="mt-3 max-w-lg"
                label={`${campaign.progress.percent}% of the goal raised`}
              />
              <p className="text-caption text-muted-foreground mt-2">
                {campaign.progress.goalReached
                  ? `Goal achieved. ${formatCurrency(campaign.progress.surplus)} beyond target.`
                  : `${formatCurrency(campaign.progress.remaining)} still required.`}
                {campaign.daysRemaining !== null
                  ? ` · ${campaign.daysRemaining} days remaining.`
                  : ''}
              </p>
            </div>

            <dl className="border-border grid grid-cols-2 gap-4 sm:border-l sm:pl-6">
              <div>
                <dt className="text-caption text-muted-foreground font-medium uppercase">Donors</dt>
                <dd
                  data-numeric=""
                  className="font-display text-h2 text-foreground mt-1 font-bold tabular-nums"
                >
                  {campaign.donorCount}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground font-medium uppercase">
                  Beneficiaries
                </dt>
                <dd
                  data-numeric=""
                  className="font-display text-h2 text-foreground mt-1 font-bold tabular-nums"
                >
                  {campaign.beneficiariesReached}
                  {campaign.beneficiaryTarget ? (
                    <span className="text-caption text-muted-foreground font-normal">
                      {' '}
                      / {campaign.beneficiaryTarget}
                    </span>
                  ) : (
                    ''
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>

      {/* Lifecycle Transitions Card */}
      <Card className="border-border">
        <CardHeader className="border-border border-b pb-4">
          <CardTitle className="text-base font-semibold">Lifecycle Status & Permissions</CardTitle>
          <p className="text-caption text-muted-foreground mt-1">
            {campaign.status === 'active'
              ? 'Campaign is live and actively accepting donations through Razorpay.'
              : campaign.status === 'paused'
                ? 'Campaign is publicly visible; online checkout is temporarily halted.'
                : campaign.status === 'completed'
                  ? 'Campaign has concluded. Historical details and contributions remain readable.'
                  : campaign.status === 'archived'
                    ? 'Campaign is archived and removed from public view. It can be returned to draft or deleted.'
                    : isPublic
                      ? 'Published publicly; donations have not been opened yet.'
                      : 'Draft state. Requires associated program before publishing.'}
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <StatusActions
            entityId={campaign.id}
            slug={campaign.slug}
            current={campaign.status}
            allowed={transitions.campaign[campaign.status] ?? []}
            action={changeCampaignStatus}
            labels={CAMPAIGN_LABELS}
            reasonRequired={['paused', 'completed']}
            confirmRequired={['archived']}
            deleteAction={deleteCampaignAction}
            canDelete={
              can(actor, 'campaign.delete') &&
              (campaign.status === 'archived' || campaign.status === 'draft') &&
              campaign.amountRaised === 0 &&
              campaign.donorCount === 0
            }
          />
        </CardContent>
      </Card>

      {/* Campaign Details Form Card */}
      <Card className="border-border">
        <CardHeader className="border-border border-b pb-4">
          <CardTitle className="text-base font-semibold">Campaign Information & Content</CardTitle>
          <p className="text-caption text-muted-foreground mt-1">
            Core narrative, location, beneficiary scope, and fund utilization breakdown.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <CampaignForm
            programs={programs.items.filter(
              (p) => p.status !== 'archived' || p.id === campaign.programId,
            )}
            categories={categories.items.filter((c) => c.isActive)}
            campaign={campaign}
            mediaOptions={mediaOptions}
            initialGallery={gallery}
          />
        </CardContent>
      </Card>

      {/* Product Offerings Card */}
      <Card className="border-border">
        <CardHeader className="border-border border-b pb-4">
          <CardTitle className="text-base font-semibold">
            Catalogue Products & Targeted Giving
          </CardTitle>
          <p className="text-caption text-muted-foreground mt-1">
            Product allocations for itemized donor giving. Modifying pricing here applies
            specifically to this campaign.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <CampaignProductManager
            campaignId={campaign.id}
            products={products.items}
            catalogue={catalogue.items}
          />
        </CardContent>
      </Card>

      {/* FAQs Panel */}
      <Card className="border-border">
        <CardHeader className="border-border border-b pb-4">
          <CardTitle className="text-base font-semibold">Frequently Asked Questions</CardTitle>
          <p className="text-caption text-muted-foreground mt-1">
            Questions and answers rendered specifically on this campaign detail page.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <FaqsPanel campaignId={campaign.id} faqs={faqs.items} />
        </CardContent>
      </Card>

      {/* Progress Updates Panel */}
      <Card className="border-border">
        <CardHeader className="border-border border-b pb-4">
          <CardTitle className="text-base font-semibold">Progress & Field Impact Updates</CardTitle>
          <p className="text-caption text-muted-foreground mt-1">
            Chronological field reports communicating milestones and impact to donors.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <CampaignUpdatesPanel
            campaignId={campaign.id}
            slug={campaign.slug}
            updates={updates}
            canCreate={can(actor, 'campaign_update.create')}
            canPublish={can(actor, 'campaign_update.publish')}
          />
        </CardContent>
      </Card>

      {/* Slug History */}
      {campaign.slugHistory.length > 0 ? (
        <Card className="border-border">
          <CardHeader className="border-border border-b pb-4">
            <CardTitle className="text-base font-semibold">Previous URL Permalinks</CardTitle>
            <p className="text-caption text-muted-foreground mt-1">
              Permanent 301 redirects preserved so physical posters, QR codes, and external links
              remain valid.
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <ul className="text-body-sm text-muted-foreground space-y-2">
              {campaign.slugHistory.map((entry) => (
                <li key={entry.slug} className="flex items-center gap-2">
                  <code className="text-caption bg-muted text-foreground rounded px-2 py-0.5">
                    /campaigns/{entry.slug}
                  </code>
                  <span>— retired on {formatDate(entry.changedAt)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
