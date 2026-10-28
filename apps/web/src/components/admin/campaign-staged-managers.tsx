'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';

import { Button, Input, Label, cn, formatCurrency } from '@sailent/ui';

import { ProductImage } from '@/components/products/product-image';
import { ProductSelector } from '@/components/products/product-selector';
import type { CatalogueProduct } from '@/components/products/types';

export interface StagedCampaignProduct {
  productId: string;
  product: CatalogueProduct;
  pricePaise: number;
  priceRupees: number;
  targetQuantity: number;
  isMostNeeded: boolean;
}

export interface StagedCampaignFaq {
  id: string;
  question: string;
  answer: string;
  isPublished: boolean;
}

/**
 * Manage catalogue products staged during new campaign creation.
 * Matches the layout and interaction patterns of CampaignProductManager.
 */
export function StagedProductsManager({
  catalogue,
  products,
  onChange,
}: {
  catalogue: CatalogueProduct[];
  products: StagedCampaignProduct[];
  onChange: (products: StagedCampaignProduct[]) => void;
}) {
  const [selected, setSelected] = React.useState<CatalogueProduct | null>(null);
  const [priceRupees, setPriceRupees] = React.useState('');
  const [targetQuantity, setTargetQuantity] = React.useState('100');
  const [isMostNeeded, setIsMostNeeded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const availableCatalogue = React.useMemo(() => {
    const stagedIds = new Set(products.map((p) => p.productId));
    return catalogue.filter((item) => !stagedIds.has(item.id));
  }, [catalogue, products]);

  const handleSelect = (product: CatalogueProduct | null) => {
    setSelected(product);
    if (product) {
      setPriceRupees(String(product.defaultPrice / 100));
      setTargetQuantity('100');
      setIsMostNeeded(false);
      setError(null);
    }
  };

  const handleAddProduct = () => {
    if (!selected) return;

    const price = Number(priceRupees);
    if (!Number.isFinite(price) || price <= 0) {
      setError('Please enter a valid price greater than ₹0.');
      return;
    }

    const qty = Number(targetQuantity);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
      setError('Target quantity must be a positive whole number.');
      return;
    }

    onChange([
      ...products,
      {
        productId: selected.id,
        product: selected,
        pricePaise: Math.round(price * 100),
        priceRupees: price,
        targetQuantity: qty,
        isMostNeeded,
      },
    ]);

    setSelected(null);
    setPriceRupees('');
    setTargetQuantity('100');
    setIsMostNeeded(false);
    setError(null);
  };

  const handleRemove = (productId: string) => {
    onChange(products.filter((p) => p.productId !== productId));
  };

  return (
    <div className="space-y-6">
      {products.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">
          This campaign has no products yet. A product lets a donor fund something specific — “a
          school kit”, rather than “₹900”.
        </p>
      ) : (
        <ul className="border-border divide-border divide-y rounded-lg border">
          {products.map((item) => (
            <li
              key={item.productId}
              className="flex items-center justify-between gap-4 px-4 py-3.5"
            >
              <div className="flex min-w-0 items-center gap-3.5">
                <ProductImage
                  image={item.product.image}
                  slug={item.product.slug}
                  name={item.product.name}
                  className="size-12 shrink-0"
                  size={48}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-body-sm font-semibold">{item.product.name}</p>
                    {item.isMostNeeded ? (
                      <span className="bg-primary text-primary-foreground rounded-md px-2 py-0.5 text-[11px] font-semibold leading-none">
                        Most Needed
                      </span>
                    ) : null}
                  </div>
                  <p className="text-caption text-muted-foreground mt-0.5">
                    ₹{item.priceRupees.toLocaleString('en-IN')} / {item.product.unit || 'unit'} ·
                    Target: {item.targetQuantity} units
                    {item.priceRupees * 100 !== item.product.defaultPrice ? (
                      <span className="text-muted-foreground/80 ml-1">
                        (catalogue suggests {formatCurrency(item.product.defaultPrice)})
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(item.productId)}
                className="hover:bg-destructive/10 text-destructive hover:text-destructive shrink-0 gap-1.5"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <details className="border-border rounded-lg border p-4">
        <summary className="text-body-sm cursor-pointer font-medium">Offer another product</summary>

        <div className="mt-4 space-y-4">
          <p className="text-body-sm text-muted-foreground">
            Choose from the catalogue. Products are shared across campaigns, so editing one here
            changes only what this campaign charges.
          </p>

          <ProductSelector
            products={availableCatalogue}
            selectedId={selected?.id ?? null}
            onSelect={handleSelect}
          />

          {selected ? (
            <div className="space-y-4 pt-2">
              <div className="border-border/70 bg-surface flex items-center gap-3.5 rounded-lg border p-3">
                <ProductImage
                  image={selected.image}
                  slug={selected.slug}
                  name={selected.name}
                  className="size-12 shrink-0"
                  size={48}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-semibold">{selected.name}</p>
                  <p className="text-caption text-muted-foreground truncate">
                    {selected.description}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="staged-product-price" className="text-body-sm font-medium">
                    This campaign’s price (₹) *
                  </Label>
                  <Input
                    id="staged-product-price"
                    type="number"
                    min={1}
                    step={1}
                    value={priceRupees}
                    onChange={(e) => setPriceRupees(e.target.value)}
                    required
                  />
                  <p className="text-caption text-muted-foreground">
                    The catalogue suggests {formatCurrency(selected.defaultPrice)}. Required.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="staged-product-target" className="text-body-sm font-medium">
                    Target quantity *
                  </Label>
                  <Input
                    id="staged-product-target"
                    type="number"
                    min={1}
                    value={targetQuantity}
                    onChange={(e) => setTargetQuantity(e.target.value)}
                    placeholder="e.g. 100"
                    required
                  />
                  <p className="text-caption text-muted-foreground">
                    Units targeted for this campaign. Required.
                  </p>
                </div>
              </div>

              <div className="border-border/70 bg-surface-warm/40 rounded-lg border p-3">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={isMostNeeded}
                    onChange={(e) => setIsMostNeeded(e.target.checked)}
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

              {error ? <p className="text-caption text-destructive font-medium">{error}</p> : null}

              <Button
                type="button"
                onClick={handleAddProduct}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Add “{selected.name}”
              </Button>
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}

/**
 * Manage FAQs staged during new campaign creation.
 * Matches the layout and interaction patterns of FaqsPanel.
 */
export function StagedFaqsManager({
  faqs,
  onChange,
}: {
  faqs: StagedCampaignFaq[];
  onChange: (faqs: StagedCampaignFaq[]) => void;
}) {
  const [question, setQuestion] = React.useState('');
  const [answer, setAnswer] = React.useState('');
  const [isPublished, setIsPublished] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const handleAddFaq = () => {
    const q = question.trim();
    const a = answer.trim();

    if (!q) {
      setError('A question is required.');
      return;
    }

    if (!a) {
      setError('An answer is required.');
      return;
    }

    onChange([
      ...faqs,
      {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now()),
        question: q,
        answer: a,
        isPublished,
      },
    ]);

    setQuestion('');
    setAnswer('');
    setIsPublished(true);
    setError(null);
  };

  const handleTogglePublish = (faqId: string) => {
    onChange(faqs.map((f) => (f.id === faqId ? { ...f, isPublished: !f.isPublished } : f)));
  };

  const handleRemove = (faqId: string) => {
    onChange(faqs.filter((f) => f.id !== faqId));
  };

  return (
    <div className="space-y-5">
      {faqs.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">
          No FAQs yet. Only published ones appear on the public page.
        </p>
      ) : (
        <ul className="border-border divide-border divide-y rounded-lg border">
          {faqs.map((faq) => (
            <li key={faq.id} className="space-y-2 px-4 py-3">
              <p className="text-body-sm font-medium">
                {faq.question}
                {!faq.isPublished ? (
                  <span className="text-caption text-muted-foreground ml-2">(draft)</span>
                ) : null}
              </p>
              <p className="text-caption text-muted-foreground">{faq.answer}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => handleTogglePublish(faq.id)}
                >
                  {faq.isPublished ? 'Unpublish' : 'Publish'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemove(faq.id)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <details className="border-border rounded-lg border p-4">
        <summary className="text-body-sm cursor-pointer font-medium">Add an FAQ</summary>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="staged-faq-question" className="text-body-sm font-medium">
              Question *
            </Label>
            <Input
              id="staged-faq-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. How will the funds be utilized?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staged-faq-answer" className="text-body-sm font-medium">
              Answer *
            </Label>
            <textarea
              id="staged-faq-answer"
              rows={3}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Provide a clear, helpful answer..."
              className={cn(
                'border-border bg-surface text-foreground focus-visible:outline-ring min-h-20 w-full rounded-lg border p-3 text-sm focus-visible:outline-2',
              )}
            />
          </div>

          <label className="text-body-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="size-4"
            />
            Publish immediately
          </label>

          {error ? <p className="text-caption text-destructive font-medium">{error}</p> : null}

          <Button type="button" onClick={handleAddFaq}>
            Add FAQ
          </Button>
        </div>
      </details>
    </div>
  );
}
