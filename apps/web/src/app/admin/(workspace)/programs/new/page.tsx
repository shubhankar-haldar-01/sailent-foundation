import Link from 'next/link';

import { ProgramForm } from '@/components/admin/program-form';
import { adminFetch, type AdminCategory } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

export default async function NewProgramPage() {
  const categories = await adminFetch<{ items: AdminCategory[] }>('admin/categories', {
    query: { kind: 'program' },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/programs" className="text-body-sm text-muted-foreground hover:underline">
          ← Programs
        </Link>
        <h1 className="font-display text-h1 mt-2 font-bold tracking-tight">New program</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Saved as a draft. Nothing is public until you publish it.
        </p>
      </div>

      <ProgramForm categories={categories.items.filter((c) => c.isActive)} />
    </div>
  );
}
