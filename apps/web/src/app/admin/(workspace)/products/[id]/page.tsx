import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Progress, formatCurrency } from '@sailent/ui';

import { ProductForm } from '@/components/products/product-form';
import { ArchiveProductPanel } from '@/components/products/archive-product-panel';
import type { CatalogueProductDetail } from '@/components/products/types';
import { AdminApiError, adminFetch } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * One catalogue product.
 *
 * The page is half edit form and half ANSWER TO "WHAT DOES THIS AFFECT". The
 * campaign list below the form is not decoration: it is the thing an operator
 * needs before they change a name that four live appeals are displaying, and
 * the thing that makes the price rule legible — four campaigns, four prices,
 * none of them the default.
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
    <div className="space-y-8">
      <header>
        <Link
          href="/admin/products"
          className="text-body-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          ← Products
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <h1 className="font-display text-h1 font-bold tracking-tight">{product.name}</h1>
          <span className="text-body-sm text-muted-foreground capitalize">{product.status}</span>
        </div>
        <p data-numeric="" className="text-body-sm text-muted-foreground mt-1">
          Default {formatCurrency(product.defaultPrice)} per {product.unit}
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,32rem)_1fr] lg:items-start">
        <section aria-labelledby="edit-product">
          <h2 id="edit-product" className="text-h3 font-semibold">
            Details
          </h2>
          {canEdit ? (
            <div className="mt-4">
              <ProductForm product={product} />
            </div>
          ) : (
            <p className="text-body-sm text-muted-foreground mt-3">
              You can view this product but not edit it.
            </p>
          )}
        </section>

        <section aria-labelledby="where-offered" className="space-y-4">
          <div>
            <h2 id="where-offered" className="text-h3 font-semibold">
              Where it is offered
            </h2>
            <p className="text-body-sm text-muted-foreground mt-1">
              Each campaign sets its own price. These are independent of the default above and of
              each other.
            </p>
          </div>

          {product.campaigns.length === 0 ? (
            <p className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed p-5">
              No campaign offers this yet. That is the ordinary state for a product added ahead of
              the appeal that will use it.
            </p>
          ) : (
            <ul className="border-border divide-border divide-y rounded-lg border">
              {product.campaigns.map((usage) => (
                <li key={usage.campaignProductId} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      href={`/admin/campaigns/${usage.campaignId}/edit`}
                      className="text-body-sm focus-visible:outline-ring rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2"
                    >
                      {usage.campaignTitle}
                    </Link>
                    <span data-numeric="" className="text-body-sm tabular-nums">
                      {formatCurrency(usage.price)}
                      {usage.price !== product.defaultPrice ? (
                        <span className="text-muted-foreground"> (differs from default)</span>
                      ) : null}
                    </span>
                  </div>

                  <p className="text-caption text-muted-foreground">
                    {usage.campaignStatus}
                    {usage.isActive ? '' : ' · hidden on this campaign'}
                    {' · '}
                    {usage.targetQuantity === null
                      ? `${usage.providedQuantity} provided`
                      : `${usage.providedQuantity} of ${usage.targetQuantity} provided`}
                  </p>

                  {usage.targetQuantity ? (
                    <Progress
                      value={Math.min(
                        100,
                        Math.round((usage.providedQuantity / usage.targetQuantity) * 100),
                      )}
                      size="sm"
                      label={`${usage.campaignTitle}: progress towards its target`}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}

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
        </section>
      </div>
    </div>
  );
}
