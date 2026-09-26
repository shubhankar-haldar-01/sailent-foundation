import Link from 'next/link';

import { Button } from '@sailent/ui';

import { ProductTable } from '@/components/products/product-table';
import type { CatalogueProduct } from '@/components/products/types';
import { adminFetch, type Paginated } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const STATUSES = ['all', 'active', 'inactive', 'archived'] as const;

/**
 * The product catalogue.
 *
 * A top-level page rather than something under a campaign, because a product is
 * not a child of one. It outlives every campaign that offers it, is edited by
 * different people, and carries its own permissions — filing it under campaigns
 * would reproduce in the interface the exact confusion the schema change
 * removed from the database.
 *
 * `status` defaults to the API's own default, which excludes archived entries.
 * An operator picking a product should not scroll past things the organisation
 * retired; the filter is there for whoever is auditing the catalogue.
 */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();

  const data = await adminFetch<Paginated<CatalogueProduct>>('admin/products', {
    query: {
      status: params.status,
      q: params.q,
      page: params.page,
      limit: 50,
      sort: 'name',
    },
  });

  const active = params.status ?? 'all';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">Products</h1>
          <p className="text-body-sm text-muted-foreground mt-1 max-w-prose">
            Defined once, offered by any campaign. Each campaign sets its own price — editing a
            product here never changes what a campaign charges or what a donor has already paid.
          </p>
        </div>
        {can(actor, 'product.create') ? (
          <Button asChild>
            <Link href="/admin/products/new">New product</Link>
          </Button>
        ) : null}
      </header>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
        {STATUSES.map((status) => (
          <Link
            key={status}
            href={
              status === 'all' ? '/admin/products?status=all' : `/admin/products?status=${status}`
            }
            aria-current={active === status ? 'page' : undefined}
            className={`text-body-sm rounded-md px-3 py-1.5 capitalize ${
              active === status
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {status}
          </Link>
        ))}
      </nav>

      <ProductTable products={data.items} />

      <p className="text-body-sm text-muted-foreground">
        {data.pagination.total} product{data.pagination.total === 1 ? '' : 's'}.
      </p>
    </div>
  );
}
