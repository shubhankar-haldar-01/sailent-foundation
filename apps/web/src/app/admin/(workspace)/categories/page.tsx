import type { Metadata } from 'next';
import { Card, CardContent } from '@sailent/ui';

import { CategoriesManager } from '@/components/admin/categories-manager';
import { AdminApiError, adminFetch, type AdminCategory } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Categories — Admin — Sailent Foundation',
};

/**
 * Category Management Admin Screen.
 *
 * Serves the lookup catalogue of causes and sectors (`categories` table).
 * Operators with `category.manage` permission can create, rename, and
 * activate/deactivate categories. Renaming automatically syncs the denormalised
 * `category` name on programs and campaigns.
 */
export default async function AdminCategoriesPage() {
  const actor = await currentActor();
  const canManage = can(actor, 'category.manage');

  let categories: AdminCategory[] = [];
  try {
    const res = await adminFetch<{ items: AdminCategory[] }>('admin/categories');
    categories = res.items;
  } catch (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="text-body-sm text-destructive p-4">
          {error instanceof AdminApiError ? error.message : 'Could not load categories.'}
        </CardContent>
      </Card>
    );
  }

  return <CategoriesManager categories={categories} canManage={canManage} />;
}
