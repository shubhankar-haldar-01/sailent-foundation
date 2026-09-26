import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProductForm } from '@/components/products/product-form';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const actor = await currentActor();

  // The API enforces this on every call; the page checks so an operator who
  // cannot do it sees a 404 rather than a form that fails on submit.
  if (!can(actor, 'product.create')) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <Link
          href="/admin/products"
          className="text-body-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          ← Products
        </Link>
        <h1 className="font-display text-h1 mt-2 font-bold tracking-tight">New product</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Something specific a donor can fund. Write the description once — every campaign that
          offers this will use it.
        </p>
      </header>

      <ProductForm />
    </div>
  );
}
