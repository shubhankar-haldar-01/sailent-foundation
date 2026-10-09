'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check, PackageSearch, Search } from 'lucide-react';

import { Button, Input, cn, formatCurrency } from '@sailent/ui';

import type { CatalogueProduct } from './types';

export interface ProductSelectorProps {
  /** Already filtered server-side to what this campaign does NOT offer. */
  products: CatalogueProduct[];
  selectedId: string | null;
  onSelect: (product: CatalogueProduct | null) => void;
  className?: string;
}

/**
 * Pick a product from the catalogue.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS COMPONENT CANNOT CREATE A PRODUCT, and that is its whole purpose.
 *
 * Before Phase 5, adding an item to a campaign meant typing a name, a
 * description and a price into a campaign-shaped form. Three campaigns offering
 * a School Kit therefore held three descriptions of it, written months apart by
 * different people, drifting. The fix is not a warning on the form. It is a
 * form that has no name field.
 *
 * What the operator does here is CHOOSE. If what they need is not listed, the
 * empty state sends them to the catalogue to add it once, where the next person
 * will find it.
 *
 * The list arrives already filtered to what this campaign does not yet offer,
 * so a duplicate is not merely refused — it is not on screen. The unique index
 * would refuse the insert anyway; this makes the refusal unnecessary rather
 * than merely survivable.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Filtering is CLIENT-SIDE over an already-fetched list. A catalogue is tens of
 * rows, not thousands, and a round trip per keystroke would make a control that
 * should feel instant feel broken. When the catalogue outgrows one page, this
 * gains a server search — and the empty state below is where that will show.
 */
export function ProductSelector({
  products,
  selectedId,
  onSelect,
  className,
}: ProductSelectorProps) {
  const [query, setQuery] = React.useState('');
  const searchId = React.useId();

  const filtered = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        product.slug.includes(term) ||
        product.description.toLowerCase().includes(term),
    );
  }, [products, query]);

  if (products.length === 0) {
    return (
      <div
        className={cn('border-border rounded-lg border border-dashed p-6 text-center', className)}
      >
        <PackageSearch className="text-muted-foreground mx-auto size-6" aria-hidden="true" />
        <p className="text-body-sm mt-3 font-medium">
          Every catalogue product is already on this campaign
        </p>
        <p className="text-body-sm text-muted-foreground mt-1">
          To offer something new, add it to the catalogue first. It will then be available to every
          campaign, not just this one.
        </p>
        <Button asChild variant="secondary" size="sm" className="mt-4">
          <Link href="/admin/products/new">Add a product to the catalogue</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <label htmlFor={searchId} className="sr-only">
          Search the product catalogue
        </label>
        <Input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the catalogue"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="border-border rounded-lg border border-dashed p-5 text-center">
          <p className="text-body-sm font-medium">Nothing matches “{query}”</p>
          <p className="text-body-sm text-muted-foreground mt-1">
            Check the spelling, or add it to the catalogue so it is there next time.
          </p>
          <Button asChild variant="ghost" size="sm" className="mt-3">
            <Link href="/admin/products/new">Add a product</Link>
          </Button>
        </div>
      ) : (
        // A radiogroup, not a listbox: one choice, and every option visible and
        // reachable by arrow key without a popup to open first.
        <ul
          role="radiogroup"
          aria-label="Catalogue products"
          className="border-border divide-border max-h-80 divide-y overflow-y-auto rounded-lg border"
        >
          {filtered.map((product) => {
            const isSelected = product.id === selectedId;
            return (
              <li key={product.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onSelect(isSelected ? null : product)}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                    'focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2',
                    isSelected ? 'bg-primary-soft' : 'hover:bg-muted',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border-strong',
                    )}
                  >
                    {isSelected ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-body-sm font-medium">{product.name}</span>
                      <span data-numeric="" className="text-body-sm tabular-nums">
                        {formatCurrency(product.defaultPrice)}
                        <span className="text-muted-foreground"> / {product.unit}</span>
                      </span>
                    </span>
                    <span className="text-caption text-muted-foreground mt-0.5 line-clamp-2 block">
                      {product.description}
                    </span>
                    {/* Says where else this is in use, so an operator adding it
                        knows whether they are joining an established item or
                        being the first. */}
                    <span className="text-caption text-muted-foreground mt-1 block">
                      {product.campaignCount === 0
                        ? 'Not yet offered on any campaign'
                        : `Offered on ${product.campaignCount} campaign${product.campaignCount === 1 ? '' : 's'}`}
                      {product.status !== 'active' ? ` · ${product.status}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
