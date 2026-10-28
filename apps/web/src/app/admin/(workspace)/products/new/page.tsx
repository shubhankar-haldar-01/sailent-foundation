import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

import { ProductForm } from '@/components/products/product-form';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const actor = await currentActor();

  if (!can(actor, 'product.create')) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="New product"
        breadcrumb={
          <Link
            href="/admin/products"
            className="text-body-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to products
          </Link>
        }
        description="Define a tangible impact item or service package. Once added, it can be attached to any active appeal."
      />

      <Card className="border-border max-w-2xl">
        <CardHeader className="border-border border-b pb-4">
          <CardTitle className="text-base font-semibold">Product Specifications</CardTitle>
          <p className="text-caption text-muted-foreground mt-1">
            Specify the default benchmark price, measure unit (e.g. kit, ration pack, scholarship),
            and public description.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <ProductForm />
        </CardContent>
      </Card>
    </div>
  );
}
