'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, ExternalLink } from 'lucide-react';

import { Button, ConfirmationDialog, Input, Progress, cn, formatCurrency } from '@sailent/ui';

import { Field, FormStatus, SubmitButton } from '@/components/admin/form-shell';
import {
  addCampaignProduct,
  removeCampaignProduct,
  setProductActive,
  updateCampaignProduct,
  type ActionState,
} from '@/lib/admin/actions';

import { ProductSelector } from './product-selector';
import type { CampaignProductRow, CatalogueProduct } from './types';

/**
 * What a campaign offers, and on what terms.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO NUMBERS THAT LOOK THE SAME AND ARE NOT.
 *
 * `price` is what THIS campaign charges. `defaultPrice` is the catalogue's
 * suggestion. They start equal and are then unrelated — a relief kit at ₹1,500
 * in the monsoon appeal and ₹1,200 in the winter one is correct, not a bug.
 *
 * So the divergence is SHOWN rather than hidden, and shown neutrally: "catalogue
 * suggests ₹1,200", not a warning triangle. An interface that flags every
 * difference trains people to ignore the flag by the third campaign.
 *
 * `providedQuantity` is DISPLAYED AND NOT EDITABLE. It is meant to be a
 * consequence of donations received; correcting it is a separate, separately
 * permissioned, always-audited action. A field for it on this form would make
 * the exception routine, which is exactly what it must not be.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function CampaignProductManager({
  campaignId,
  products,
  catalogue,
}: {
  campaignId: string;
  products: CampaignProductRow[];
  /** Already filtered server-side to what this campaign does not offer. */
  catalogue: CatalogueProduct[];
}) {
  const [addState, addAction, addPending] = React.useActionState<ActionState, FormData>(
    addCampaignProduct,
    {},
  );
  // Activation and removal are per-row, so their states live on the row that
  // owns them. A banner at the top of the list saying "Saved." gives no clue
  // which of eleven products it refers to.
  const [selected, setSelected] = React.useState<CatalogueProduct | null>(null);

  return (
    <div className="space-y-6">
      {products.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">
          This campaign has no products yet. A product lets a donor fund something specific — “a
          school kit”, rather than “₹900”.
        </p>
      ) : (
        <ul className="border-border divide-border divide-y rounded-lg border">
          {products.map((product) => (
            <CampaignProductItem key={product.id} campaignId={campaignId} product={product} />
          ))}
        </ul>
      )}

      <details className="border-border rounded-lg border p-4">
        <summary className="text-body-sm cursor-pointer font-medium">Offer another product</summary>

        <div className="mt-4 space-y-4">
          <FormStatus state={addState} />

          <p className="text-body-sm text-muted-foreground">
            Choose from the catalogue. Products are shared across campaigns, so editing one here
            changes only what this campaign charges.
          </p>

          <ProductSelector
            products={catalogue}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
          />

          {selected ? (
            <form key={selected.id} action={addAction} className="space-y-4">
              <input type="hidden" name="campaignId" value={campaignId} />
              <input type="hidden" name="productId" value={selected.id} />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="This campaign’s price (₹) *"
                  name="price"
                  errors={addState.fieldErrors}
                  hint={`The catalogue suggests ${formatCurrency(selected.defaultPrice)}. Required.`}
                >
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    min={1}
                    step={1}
                    required
                    defaultValue={selected.defaultPrice / 100}
                  />
                </Field>

                <Field
                  label="Target quantity *"
                  name="targetQuantity"
                  errors={addState.fieldErrors}
                  hint="Units targeted for this campaign. Required."
                >
                  <Input
                    id="targetQuantity"
                    name="targetQuantity"
                    type="number"
                    min={1}
                    required
                    placeholder="e.g. 100"
                  />
                </Field>
              </div>

              <div className="border-border/70 bg-surface-warm/40 rounded-lg border p-3">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    name="isMostNeeded"
                    id="addIsMostNeeded"
                    value="true"
                    className="border-border text-primary focus:ring-primary size-4 rounded focus:ring-offset-0"
                  />
                  <div className="min-w-0">
                    <span className="text-body-sm text-foreground font-semibold">Most Needed</span>
                    <p className="text-caption text-muted-foreground">
                      Display an orange &ldquo;Most Needed&rdquo; badge on this product card on the
                      campaign page.
                    </p>
                  </div>
                </label>
              </div>

              <SubmitButton pending={addPending}>Add “{selected.name}”</SubmitButton>
            </form>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function CampaignProductItem({
  campaignId,
  product,
}: {
  campaignId: string;
  product: CampaignProductRow;
}) {
  const [editState, editAction, editPending] = React.useActionState<ActionState, FormData>(
    updateCampaignProduct,
    {},
  );
  const [, toggleAction] = React.useActionState<ActionState, FormData>(setProductActive, {});
  const [removeState, removeAction, removePending] = React.useActionState<ActionState, FormData>(
    removeCampaignProduct,
    {},
  );
  const [confirmRemoveOpen, setConfirmRemoveOpen] = React.useState(false);

  const handleConfirmRemove = async () => {
    const formData = new FormData();
    formData.append('campaignId', campaignId);
    formData.append('productId', product.id);
    await removeAction(formData);
    setConfirmRemoveOpen(false);
  };

  const divergesFromCatalogue = product.price !== product.defaultPrice;
  const isFunded = product.providedQuantity > 0;

  return (
    <li className="space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-body-sm font-medium">{product.name}</p>
          {product.isMostNeeded ? (
            <span className="bg-primary text-primary-foreground rounded-md px-2 py-1 text-[11px] font-semibold leading-none tracking-wide">
              Most Needed
            </span>
          ) : null}
          {!product.isActive ? (
            <span className="text-caption text-muted-foreground">(hidden on the page)</span>
          ) : null}
          {product.productStatus !== 'active' ? (
            <span className="text-caption text-warning-foreground">
              catalogue: {product.productStatus}
            </span>
          ) : null}
        </div>
        <p data-numeric="" className="text-body-sm tabular-nums">
          {formatCurrency(product.price)}
          <span className="text-muted-foreground"> / {product.unit}</span>
        </p>
      </div>

      <p className="text-caption text-muted-foreground">{product.description}</p>

      {/* Stated as information, not as a warning. Different campaigns charging
          different prices for the same item is the design working. */}
      {divergesFromCatalogue ? (
        <p className="text-caption text-muted-foreground">
          The catalogue suggests {formatCurrency(product.defaultPrice)} for this product.
        </p>
      ) : null}

      {/* A catalogue product that is inactive or archived stops being offerable
          everywhere at once. This says so on the campaign that is affected,
          because that is where someone will notice it has gone. */}
      {product.productStatus !== 'active' ? (
        <p className="border-warning/30 bg-warning-subtle text-caption flex items-start gap-2 rounded-md border p-2">
          <AlertTriangle
            className="text-warning-foreground mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />
          <span>
            This product is {product.productStatus} in the catalogue, so it is hidden from the
            public page whatever this campaign says.{' '}
            <Link
              href={`/admin/products/${product.productId}`}
              className="underline underline-offset-2"
            >
              Open it in the catalogue
              <ExternalLink className="ml-0.5 inline size-3" aria-hidden="true" />
            </Link>
          </span>
        </p>
      ) : null}

      {product.targetQuantity !== null ? (
        <div className="max-w-sm">
          <p className="text-caption text-muted-foreground">
            Provided <span data-numeric="">{product.progress.fulfilled}</span> of{' '}
            <span data-numeric="">{product.progress.target}</span> — {product.progress.percent}%
          </p>
          <Progress
            value={product.progress.percent}
            size="sm"
            className="mt-1"
            label={`${product.progress.percent}% of the target provided`}
          />
        </div>
      ) : (
        product.providedQuantity > 0 && (
          <p className="text-caption text-muted-foreground">
            <span data-numeric="">{product.providedQuantity}</span> provided so far
          </p>
        )
      )}

      <FormStatus state={removeState} />

      <details>
        <summary className="text-caption text-muted-foreground hover:text-foreground cursor-pointer">
          Edit this campaign’s price and target
        </summary>
        <form action={editAction} className="mt-3 space-y-3">
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="productId" value={product.id} />
          <FormStatus state={editState} />

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Price (₹) *" name="price" errors={editState.fieldErrors}>
              <Input
                id="price"
                name="price"
                type="number"
                min={1}
                required
                defaultValue={product.price / 100}
              />
            </Field>
            <Field
              label="Target *"
              name="targetQuantity"
              errors={editState.fieldErrors}
              hint={isFunded ? `At least ${product.providedQuantity}. Required.` : 'Required.'}
            >
              <Input
                id="targetQuantity"
                name="targetQuantity"
                type="number"
                min={Math.max(1, product.providedQuantity)}
                required
                defaultValue={product.targetQuantity ?? ''}
              />
            </Field>
            <Field label="Max per donation" name="maxPerDonation" errors={editState.fieldErrors}>
              <Input
                id="maxPerDonation"
                name="maxPerDonation"
                type="number"
                min={1}
                defaultValue={product.maxPerDonation}
              />
            </Field>
          </div>

          <div className="border-border/70 bg-surface-warm/40 rounded-lg border p-3">
            <input type="hidden" name="hasIsMostNeeded" value="true" />
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                name="isMostNeeded"
                id={`isMostNeeded-${product.id}`}
                value="true"
                defaultChecked={product.isMostNeeded}
                className="border-border text-primary focus:ring-primary size-4 rounded focus:ring-offset-0"
              />
              <div className="min-w-0">
                <span className="text-body-sm text-foreground font-semibold">Most Needed</span>
                <p className="text-caption text-muted-foreground">
                  Display an orange &ldquo;Most Needed&rdquo; badge on this product card on the
                  campaign page.
                </p>
              </div>
            </label>
          </div>

          <p className="text-caption text-muted-foreground">
            A price change applies to the next donation only. Donations already taken keep the price
            they were charged.
          </p>

          <SubmitButton pending={editPending}>Save</SubmitButton>
        </form>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <form action={toggleAction}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="active" value={product.isActive ? 'false' : 'true'} />
          <Button type="submit" size="sm" variant="secondary">
            {product.isActive ? 'Hide from the page' : 'Show on the page'}
          </Button>
        </form>

        <form action={editAction}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="productId" value={product.id} />
          <input
            type="hidden"
            name="isMostNeeded"
            value={product.isMostNeeded ? 'false' : 'true'}
          />
          <Button type="submit" size="sm" variant={product.isMostNeeded ? 'primary' : 'secondary'}>
            {product.isMostNeeded ? '★ Most Needed' : '☆ Mark Most Needed'}
          </Button>
        </form>

        {/*
          Removal is offered only while nothing has been funded. Once a donor
          has given towards this item, the row is what their receipt points at
          — so the control that would break that is not rendered, and the
          reason is stated where the control would have been. The API refuses
          it as well; this is the half of the pair that explains itself.
        */}
        {isFunded ? (
          <p className="text-caption text-muted-foreground self-center">
            Already funded — hide it rather than removing it, so the record stays intact.
          </p>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={removePending}
              onClick={() => setConfirmRemoveOpen(true)}
            >
              Remove
            </Button>
            <ConfirmationDialog
              open={confirmRemoveOpen}
              onOpenChange={setConfirmRemoveOpen}
              title={`Remove “${product.name}”?`}
              description="Stop offering this product on this campaign? The product remains in the global catalogue."
              confirmLabel="Remove product"
              variant="destructive"
              icon="danger"
              loading={removePending}
              onConfirm={handleConfirmRemove}
              error={removeState.error}
            />
          </>
        )}
      </div>
    </li>
  );
}

/** Read-only list of what a campaign offers. Used where editing is not the job. */
export function CampaignProductList({
  products,
  className,
}: {
  products: CampaignProductRow[];
  className?: string;
}) {
  if (products.length === 0) {
    return (
      <p className={cn('text-body-sm text-muted-foreground', className)}>
        No products on this campaign.
      </p>
    );
  }

  return (
    <ul className={cn('border-border divide-border divide-y rounded-lg border', className)}>
      {products.map((product) => (
        <li key={product.id} className="flex items-baseline justify-between gap-3 px-4 py-3">
          <span className="min-w-0">
            <span className="text-body-sm block font-medium">{product.name}</span>
            <span className="text-caption text-muted-foreground">
              {product.targetQuantity === null
                ? `${product.providedQuantity} provided`
                : `${product.providedQuantity} of ${product.targetQuantity} provided`}
            </span>
          </span>
          <span data-numeric="" className="text-body-sm shrink-0 tabular-nums">
            {formatCurrency(product.price)}
          </span>
        </li>
      ))}
    </ul>
  );
}
