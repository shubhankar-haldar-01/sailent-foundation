import { FAQ_CATEGORIES } from '@sailent/validation';
import { HelpCircle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

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
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="text-body-sm text-destructive p-4">
          {error instanceof AdminApiError ? error.message : 'Could not load the FAQs.'}
        </CardContent>
      </Card>
    );
  }

  const canManage = can(actor, 'faq.manage');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Frequently Asked Questions"
        description="Public site FAQs organized by topic section. Campaign-specific FAQs are managed on their respective campaign."
        count={faqs.length}
      />

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="text-primary size-4" />
              Add FAQ Question
            </CardTitle>
            <CardDescription>
              Create a new general question and answer to publish under a category section.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateFaqForm />
          </CardContent>
        </Card>
      ) : null}

      {faqs.length === 0 ? (
        <Card>
          <CardContent className="text-body-sm text-muted-foreground py-12 text-center">
            No questions yet. The public FAQ page shows a placeholder message until at least one
            item is published.
          </CardContent>
        </Card>
      ) : (
        FAQ_CATEGORIES.map((category) => {
          const items = faqs.filter((faq) => (faq.category ?? 'general') === category.id);
          if (items.length === 0) return null;
          return (
            <Card key={category.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{category.label}</CardTitle>
                <CardDescription>
                  {items.length} {items.length === 1 ? 'question' : 'questions'} in this section
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-border/70 divide-border/70 divide-y overflow-hidden rounded-lg border">
                  {items.map((faq) => (
                    <FaqRow key={faq.id} faq={faq} canManage={canManage} />
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
