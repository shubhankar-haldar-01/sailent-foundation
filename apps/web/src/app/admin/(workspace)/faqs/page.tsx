import { FAQ_CATEGORIES } from '@sailent/validation';
import { HelpCircle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from '@sailent/ui';

import { CreateFaqForm, FaqRow } from '@/components/admin/faq-admin';
import { AdminApiError, listGeneralFaqs } from '@/lib/admin/api';
import { can, currentActor } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const RETIRED = 'retired';
const LIVE_SECTIONS = new Set<string>(FAQ_CATEGORIES.map((category) => category.id));

/** The section a stored FAQ is listed under here: its own, or "retired". */
function sectionOf(category: string | null | undefined): string {
  const id = category ?? 'general';
  return LIVE_SECTIONS.has(id) ? id : RETIRED;
}

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
        title="Frequently asked questions"
        description="Public site FAQs organized by topic section. Campaign-specific FAQs are managed on their respective campaign."
        count={faqs.length}
      />

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="text-primary size-4" />
              Add FAQ question
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
        [
          ...FAQ_CATEGORIES,
          /*
            Rows whose section no longer exists (the "volunteering" section,
            removed on 2026-11-22). /faq does not show them; listing them here
            is what lets an administrator move or delete them.
          */
          {
            id: RETIRED,
            label: 'Retired section',
            description: 'Not shown on /faq. Move each question to a section, or delete it.',
          },
        ].map((category) => {
          const items = faqs.filter((faq) => sectionOf(faq.category) === category.id);
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
