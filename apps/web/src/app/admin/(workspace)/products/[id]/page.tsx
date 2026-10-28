import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Layers, ShoppingBag } from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Progress,
  formatCurrency,
  PageHeader,
} from '@sailent/ui';

import { ProductForm } from '@/components/products/product-form';
import { ArchiveProductPanel } from '@/components/products/archive-product-panel';
import type { CatalogueProductDetail } from '@/components/products/types';
import { AdminApiError, adminFetch } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * One catalogue product.
 *
 * Shows the edit form alongside the live campaigns offering it and their current inventory targets.
 */
export default async function AdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();

  let product: CatalogueProductDetail;
  try {
    product = await adminFetch<CatalogueProductDetail>(`admin/products/${id}`);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  const canEdit = can(actor, 'product.update');

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        breadcrumb={
          <Link
            href="/admin/products"
            className="text-body-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to products
          </Link>
        }
        description={`Default price: ${formatCurrency(product.defaultPrice)} per ${product.unit}`}
        status={
          <Badge
            variant={product.status === 'active' ? 'success' : 'neutral'}
            className="capitalize"
          >
            {product.status}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,32rem)_1fr] lg:items-start">
        {/* Left Column: Product Form */}
        <Card className="border-border">
          <CardHeader className="border-border border-b pb-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="text-primary size-5" aria-hidden="true" />
              <CardTitle className="text-base font-semibold">Product Definition</CardTitle>
            </div>
            <p className="text-caption text-muted-foreground mt-1">
              Updating details here modifies the catalogue benchmark. Active campaigns maintain
              their specific pricing allocations.
            </p>
          </CardHeader>
          <CardContent className="p-6">
            {canEdit ? (
              <ProductForm product={product} />
            ) : (
              <p className="text-body-sm text-muted-foreground">
                You hold permission to view this product catalogue item, but not modify it.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Campaign Usages & Archive Panel */}
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader className="border-border border-b pb-4">
              <div className="flex items-center gap-2">
                <Layers className="text-primary size-5" aria-hidden="true" />
                <CardTitle className="text-base font-semibold">
                  Active Campaign Allocations
                </CardTitle>
              </div>
              <p className="text-caption text-muted-foreground mt-1">
                Campaigns currently offering this item. Each campaign sets its own donor pricing
                independently.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {product.campaigns.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-body-sm text-muted-foreground">
                    No campaigns offer this item yet. You can attach it to any active appeal from
                    the campaign&apos;s product manager.
                  </p>
                </div>
              ) : (
                <ul className="divide-border divide-y">
                  {product.campaigns.map((usage) => (
                    <li
                      key={usage.campaignProductId}
                      className="hover:bg-muted/10 space-y-2.5 px-6 py-4 transition-colors"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <Link
                          href={`/admin/campaigns/${usage.campaignId}/edit`}
                          className="text-body-sm focus-visible:outline-ring text-foreground rounded-sm font-semibold hover:underline focus-visible:outline-2"
                        >
                          {usage.campaignTitle}
                        </Link>
                        <span
                          data-numeric=""
                          className="text-body-sm text-foreground font-semibold tabular-nums"
                        >
                          {formatCurrency(usage.price)}
                          {usage.price !== product.defaultPrice ? (
                            <span className="text-caption text-muted-foreground font-normal">
                              {' '}
                              (custom)
                            </span>
                          ) : null}
                        </span>
                      </div>

                      <div className="text-caption text-muted-foreground flex items-center justify-between">
                        <span className="capitalize">
                          {usage.campaignStatus} · {usage.isActive ? 'Active on appeal' : 'Hidden'}
                        </span>
                        <span data-numeric="" className="tabular-nums">
                          {usage.targetQuantity === null
                            ? `${usage.providedQuantity} delivered`
                            : `${usage.providedQuantity} / ${usage.targetQuantity} delivered`}
                        </span>
                      </div>

                      {usage.targetQuantity ? (
                        <Progress
                          value={Math.min(
                            100,
                            Math.round((usage.providedQuantity / usage.targetQuantity) * 100),
                          )}
                          size="sm"
                          label={`${usage.campaignTitle}: delivery target progress`}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {can(actor, 'product.archive') ? (
            <ArchiveProductPanel
              productId={product.id}
              productName={product.name}
              status={product.status}
              blockingCampaigns={product.campaigns
                .filter(
                  (usage) =>
                    usage.isActive && !['completed', 'archived'].includes(usage.campaignStatus),
                )
                .map((usage) => usage.campaignTitle)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
