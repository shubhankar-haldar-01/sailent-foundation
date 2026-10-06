import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatDate } from '@sailent/ui';

import { ProgramForm } from '@/components/admin/program-form';
import { StatusActions } from '@/components/admin/status-actions';
import { StatusPill } from '@/components/admin/status-pill';
import { changeProgramStatus } from '@/lib/admin/actions';
import { CoverImagePanel } from '@/components/admin/campaign-media';
import { can, currentActor } from '@/lib/auth/session';
import {
  AdminApiError,
  adminFetch,
  listMedia,
  type AdminCategory,
  type AdminMedia,
} from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

interface ProgramDetail {
  id: string;
  title: string;
  slug: string;
  coverImage: string | null;
  shortDescription: string | null;
  description: string | null;
  problem: string | null;
  approach: string | null;
  beneficiaries: string | null;
  categoryId: string | null;
  category: string | null;
  status: 'draft' | 'published' | 'archived';
  displayOrder: number;
  publishedAt: string | null;
  updatedAt: string;
  campaigns: { id: string; title: string; slug: string; status: string }[];
  slugHistory: { slug: string; changedAt: string }[];
}

/** Program lifecycle, mirroring PROGRAM_TRANSITIONS on the server. */
const PROGRAM_LABELS = {
  published: { endpoint: 'publish', label: 'Publish' },
  draft: { endpoint: 'unpublish', label: 'Take back to draft' },
  archived: { endpoint: 'archive', label: 'Archive' },
};

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let program: ProgramDetail;
  let transitions: { program: Record<string, string[]> };
  let categories: { items: AdminCategory[] };

  try {
    [program, transitions, categories] = await Promise.all([
      adminFetch<ProgramDetail>(`admin/programs/${id}`),
      adminFetch<{ program: Record<string, string[]> }>('admin/campaigns/transitions'),
      adminFetch<{ items: AdminCategory[] }>('admin/categories', { query: { kind: 'program' } }),
    ]);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }

  const actor = await currentActor();
  const mediaOptions: AdminMedia[] = can(actor, 'media.read')
    ? (await listMedia({ visibility: 'public', limit: 60 })).items
    : [];

  return (
    <div className="space-y-8">
      <header>
        <Link href="/admin/programs" className="text-body-sm text-muted-foreground hover:underline">
          ← Programs
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-h1 font-bold tracking-tight">{program.title}</h1>
          <StatusPill status={program.status} />
        </div>
        <p className="text-body-sm text-muted-foreground mt-1">
          /{program.slug} · updated {formatDate(program.updatedAt)}
          {program.status === 'published' ? (
            <>
              {' · '}
              <Link href={`/programs/${program.slug}`} target="_blank" className="hover:underline">
                View on the site
              </Link>
            </>
          ) : (
            <>
              {' · '}
              <Link
                href={`/admin/preview/program/${program.slug}`}
                className="text-primary hover:underline"
              >
                Preview
              </Link>
            </>
          )}
        </p>
      </header>

      <section className="border-border rounded-lg border p-5">
        <h2 className="text-h4 font-semibold">Publication</h2>
        <p className="text-body-sm text-muted-foreground mb-4 mt-1">
          {program.status === 'published'
            ? 'This program is visible on the public site.'
            : 'Not visible publicly.'}
        </p>
        <StatusActions
          entityId={program.id}
          current={program.status}
          allowed={transitions.program[program.status] ?? []}
          action={changeProgramStatus}
          labels={PROGRAM_LABELS}
          confirmRequired={['archived']}
        />
      </section>

      <section>
        <h2 className="text-h4 mb-4 font-semibold">Details</h2>
        <ProgramForm categories={categories.items.filter((c) => c.isActive)} program={program} />
      </section>

      {can(actor, 'program.update') ? (
        <section>
          <h2 className="text-h4 mb-1 font-semibold">Cover image</h2>
          <p className="text-body-sm text-muted-foreground mb-4 max-w-prose">
            Shown at the top of the programme page and on its card (Phase 13). Public images from
            the media library only.
          </p>
          <CoverImagePanel
            kind="program"
            id={program.id}
            slug={program.slug}
            current={program.coverImage}
            options={mediaOptions}
          />
        </section>
      ) : null}

      {program.campaigns.length > 0 ? (
        <section>
          <h2 className="text-h4 mb-3 font-semibold">Campaigns in this program</h2>
          <ul className="border-border divide-border divide-y rounded-lg border">
            {program.campaigns.map((campaign) => (
              <li key={campaign.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <Link
                  href={`/admin/campaigns/${campaign.id}/edit`}
                  className="text-body-sm hover:text-primary font-medium"
                >
                  {campaign.title}
                </Link>
                <StatusPill status={campaign.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {program.slugHistory.length > 0 ? (
        <section>
          <h2 className="text-h4 mb-2 font-semibold">Previous addresses</h2>
          <p className="text-body-sm text-muted-foreground mb-3">
            Each of these still redirects here, permanently. Old links and printed material keep
            working.
          </p>
          <ul className="text-body-sm text-muted-foreground space-y-1">
            {program.slugHistory.map((entry) => (
              <li key={entry.slug}>
                <code>/programs/{entry.slug}</code> — retired {formatDate(entry.changedAt)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
