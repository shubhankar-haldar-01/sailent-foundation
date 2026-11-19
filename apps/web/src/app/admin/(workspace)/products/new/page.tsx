import { notFound } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

import { AdminBackButton } from '@/components/admin/admin-back-button';
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
        breadcrumb={<AdminBackButton href="/admin/products">Back to products</AdminBackButton>}
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
