import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageComposer } from '@/components/admin/page-composer';
import { currentActor, can } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** A new page is always a draft. Publishing is a separate, permissioned step. */
export default async function NewPagePage() {
  const actor = await currentActor();
  if (!can(actor, 'page.create')) notFound();

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-body-sm text-muted-foreground">
        <Link href="/admin/pages" className="hover:text-foreground">
          Pages
        </Link>
        <span aria-hidden="true"> / </span>
        <span>New</span>
      </nav>

      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">Compose a page</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Choose the route this composes — <code>home</code>, <code>about</code> — then add the
          sections it should show. Saved as a draft; nothing changes on the site until you publish.
        </p>
      </header>

      <PageComposer />
    </div>
  );
}
