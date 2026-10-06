import { FAQ_CATEGORIES } from '@sailent/validation';

import { CreateFaqForm, FaqRow } from '@/components/admin/faq-admin';
import { AdminApiError, listGeneralFaqs } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * General FAQs — the questions on /faq (Phase 13).
 *
 * Drafts are listed here and nowhere else. Campaign FAQs are edited on their
 * campaign and appear only on its page.
 */
export default async function AdminFaqsPage() {
  const actor = await currentActor();

  let faqs;
  try {
    faqs = await listGeneralFaqs();
  } catch (error) {
    return (
      <p
        role="alert"
        className="border-destructive/40 bg-destructive/5 text-body-sm text-destructive rounded-lg border p-4"
      >
        {error instanceof AdminApiError ? error.message : 'Could not load the FAQs.'}
      </p>
    );
  }

  const canManage = can(actor, 'faq.manage');

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold tracking-tight">FAQs</h1>
          <p className="text-body-sm text-muted-foreground mt-1 max-w-2xl">
            The questions on the public FAQ page, by section. Only published ones appear there.
            Questions about a single campaign are edited on that campaign.
          </p>
        </div>
      </header>

      {canManage ? <CreateFaqForm /> : null}

      {faqs.length === 0 ? (
        <p className="border-border text-body-sm text-muted-foreground rounded-lg border border-dashed p-8 text-center">
          No questions yet. The FAQ page shows a short note until one is published.
        </p>
      ) : (
        FAQ_CATEGORIES.map((category) => {
          const items = faqs.filter((faq) => (faq.category ?? 'general') === category.id);
          if (items.length === 0) return null;
          return (
            <section key={category.id} className="space-y-2">
              <h2 className="text-h3 font-semibold">{category.label}</h2>
              <div className="border-border divide-border divide-y rounded-lg border">
                {items.map((faq) => (
                  <FaqRow key={faq.id} faq={faq} canManage={canManage} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
