'use client';

import * as React from 'react';
import Link from 'next/link';

import { Button, cn, formatCurrency } from '@sailent/ui';

import { FormStatus } from '@/components/admin/form-shell';
import { setProductStatus, type ActionState } from '@/lib/admin/actions';

import type { CatalogueProduct } from './types';

const STATUS_STYLE: Record<CatalogueProduct['status'], string> = {
  active: 'bg-success-subtle text-success',
  inactive: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground',
};

/**
 * The product catalogue, as a table.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE COLUMN THAT MATTERS IS "CAMPAIGNS".
 *
 * It is the answer to "what will I affect if I change this", and it is the
 * reason the catalogue is a list rather than a set of forms. A product used by
 * four appeals and a product used by none are the same row in the database and
 * completely different objects to an operator about to edit one.
 *
 * Zero is a NORMAL state, not a broken one — a product added ahead of the
 * campaign that will offer it, which is the ordinary way round. So it is shown
 * as a plain dash rather than styled as a problem.
 *
 * There is no delete control, anywhere, at any count. Products are archived.
 * A product cited by a donation from two years ago must still resolve or that
 * donation's receipt has a hole in it.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function ProductTable({ products }: { products: CatalogueProduct[] }) {
  const [state, action] = React.useActionState<ActionState, FormData>(setProductStatus, {});

  if (products.length === 0) {
    return (
      <div className="border-border rounded-lg border border-dashed p-8 text-center">
        <p className="text-body font-medium">The catalogue is empty</p>
        <p className="text-body-sm text-muted-foreground mx-auto mt-1 max-w-md">
          A product is a specific thing a donor can fund — a school kit, a clinic day. Define it
          once here and every campaign can offer it without anyone rewriting the description.
        </p>
        <Button asChild className="mt-4">
          <Link href="/admin/products/new">Add the first product</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FormStatus state={state} />

      {/* The only element on the page allowed to scroll sideways. */}
      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[46rem] border-collapse">
          <caption className="sr-only">
            Every product in the catalogue, with its default price, status and the number of
            campaigns offering it.
          </caption>
          <thead>
            <tr className="border-border bg-muted/50 border-b text-left">
              <th scope="col" className="text-caption px-4 py-2.5 font-semibold">
                Product
              </th>
              <th scope="col" className="text-caption px-4 py-2.5 text-right font-semibold">
                Default price
              </th>
              <th scope="col" className="text-caption px-4 py-2.5 text-right font-semibold">
                Campaigns
              </th>
              <th scope="col" className="text-caption px-4 py-2.5 font-semibold">
                Status
              </th>
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {products.map((product) => (
              <tr key={product.id} className={cn(product.status === 'archived' && 'opacity-60')}>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="text-body-sm focus-visible:outline-ring rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2"
                  >
                    {product.name}
                  </Link>
                  <p className="text-caption text-muted-foreground line-clamp-1">
                    {product.description}
                  </p>
                </td>
                <td data-numeric="" className="text-body-sm px-4 py-3 text-right tabular-nums">
                  {formatCurrency(product.defaultPrice)}
                  <span className="text-muted-foreground"> / {product.unit}</span>
                </td>
                <td data-numeric="" className="text-body-sm px-4 py-3 text-right tabular-nums">
                  {product.campaignCount === 0 ? (
                    <span className="text-muted-foreground" title="Not offered on any campaign yet">
                      —
                    </span>
                  ) : (
                    product.campaignCount
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'text-caption inline-flex rounded-full px-2 py-0.5 font-medium capitalize',
                      STATUS_STYLE[product.status],
                    )}
                  >
                    {product.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {product.status === 'archived' ? (
                    <form action={action} className="inline">
                      <input type="hidden" name="id" value={product.id} />
                      <input type="hidden" name="status" value="inactive" />
                      <Button type="submit" size="sm" variant="ghost">
                        Restore
                      </Button>
                    </form>
                  ) : (
                    <form action={action} className="inline">
                      <input type="hidden" name="id" value={product.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={product.status === 'active' ? 'inactive' : 'active'}
                      />
                      <Button type="submit" size="sm" variant="ghost">
                        {product.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
