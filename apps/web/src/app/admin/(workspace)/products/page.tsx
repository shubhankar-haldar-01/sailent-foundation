import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Button, PageHeader, SearchInput } from '@sailent/ui';

import { ProductTable } from '@/components/products/product-table';
import type { CatalogueProduct } from '@/components/products/types';
import { adminFetch, type Paginated } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const STATUSES = [
  { value: 'all', label: 'All products' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
] as const;

/**
 * The product catalogue.
 *
 * Defined once, offered by any campaign. Each campaign sets its own price.
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
      <PageHeader
        title="Products"
        count={data.pagination.total}
        description="Shared product catalogue. Items can be offered across multiple campaigns with custom campaign pricing."
        actions={
          can(actor, 'product.create') ? (
            <Button asChild className="gap-1.5">
              <Link href="/admin/products/new">
                <Plus className="size-4" aria-hidden="true" />
                New product
              </Link>
            </Button>
          ) : null
        }
      />

      {/* Filter and Search Bar */}
      <div className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter by status" className="flex flex-wrap items-center gap-1.5">
          {STATUSES.map((status) => {
            const isSelected = active === status.value;
            const href = `/admin/products?status=${status.value}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`;
            return (
              <Link
                key={status.value}
                href={href}
                aria-current={isSelected ? 'page' : undefined}
                className={`text-body-sm focus-visible:outline-ring rounded-md px-3 py-1.5 font-medium capitalize transition-colors focus-visible:outline-2 ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {status.label}
              </Link>
            );
          })}
        </nav>

        <form method="get" action="/admin/products" className="flex items-center gap-2">
          {active !== 'all' ? <input type="hidden" name="status" value={active} /> : null}
          <SearchInput
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search products..."
            aria-label="Search products"
            className="w-full sm:w-64"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
          {params.q ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/admin/products${active !== 'all' ? `?status=${active}` : ''}`}>
                Clear
              </Link>
            </Button>
          ) : null}
        </form>
      </div>

      <ProductTable products={data.items} />
    </div>
  );
}
