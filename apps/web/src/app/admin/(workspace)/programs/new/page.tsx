import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

import { ProgramForm } from '@/components/admin/program-form';
import { adminFetch, type AdminCategory } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

export default async function NewProgramPage() {
  const categories = await adminFetch<{ items: AdminCategory[] }>('admin/categories', {
    query: { kind: 'program' },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="New program"
        breadcrumb={
          <Link
            href="/admin/programs"
            className="text-body-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to programs
          </Link>
        }
        description="Creates a programmatic focus area. Initially saved as a draft; nothing is visible publicly until explicitly published."
      />

      <Card className="border-border">
        <CardHeader className="border-border border-b pb-4">
          <CardTitle className="text-base font-semibold">Program Information</CardTitle>
          <p className="text-caption text-muted-foreground mt-1">
            Core title, thematic category, description, and display ordering.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <ProgramForm categories={categories.items.filter((c) => c.isActive)} />
        </CardContent>
      </Card>
    </div>
  );
}
