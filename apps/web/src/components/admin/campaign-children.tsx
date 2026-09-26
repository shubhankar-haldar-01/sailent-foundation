'use client';

import * as React from 'react';

import { Button, Input } from '@sailent/ui';

import { Field, FormStatus, SubmitButton, TextArea } from '@/components/admin/form-shell';
import { createFaq, deleteFaq, setFaqPublished, type ActionState } from '@/lib/admin/actions';

export interface FaqRow {
  id: string;
  question: string;
  answer: string;
  isPublished: boolean;
  displayOrder: number;
}

/**
 * Campaign products MOVED to `components/products/campaign-product-manager.tsx`
 * in Phase 5.
 *
 * Adding a product to a campaign now means choosing an existing catalogue entry
 * rather than typing a name and a description into a campaign-shaped form —
 * which is how three campaigns ended up with three different descriptions of
 * one School Kit. A panel that still offered the old form would keep that door
 * open, so it is gone rather than deprecated.
 */

export function FaqsPanel({ campaignId, faqs }: { campaignId: string; faqs: FaqRow[] }) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(createFaq, {});
  const [publishState, publishAction] = React.useActionState<ActionState, FormData>(
    setFaqPublished,
    {},
  );
  const [, deleteAction] = React.useActionState<ActionState, FormData>(deleteFaq, {});

  return (
    <div className="space-y-5">
      <FormStatus state={publishState} />

      {faqs.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">
          No FAQs yet. Only published ones appear on the public page.
        </p>
      ) : (
        <ul className="border-border divide-border divide-y rounded-lg border">
          {faqs.map((faq) => (
            <li key={faq.id} className="space-y-2 px-4 py-3">
              <p className="text-body-sm font-medium">
                {faq.question}
                {!faq.isPublished ? (
                  <span className="text-caption text-muted-foreground ml-2">(draft)</span>
                ) : null}
              </p>
              <p className="text-caption text-muted-foreground">{faq.answer}</p>
              <div className="flex gap-2">
                <form action={publishAction}>
                  <input type="hidden" name="campaignId" value={campaignId} />
                  <input type="hidden" name="faqId" value={faq.id} />
                  <input
                    type="hidden"
                    name="isPublished"
                    value={faq.isPublished ? 'false' : 'true'}
                  />
                  <Button type="submit" size="sm" variant="secondary">
                    {faq.isPublished ? 'Unpublish' : 'Publish'}
                  </Button>
                </form>
                <form
                  action={deleteAction}
                  onSubmit={(event) => {
                    if (!window.confirm('Delete this FAQ? This cannot be undone.')) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="campaignId" value={campaignId} />
                  <input type="hidden" name="faqId" value={faq.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Delete
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <details className="border-border rounded-lg border p-4">
        <summary className="text-body-sm cursor-pointer font-medium">Add an FAQ</summary>
        <form action={action} className="mt-4 space-y-4">
          <input type="hidden" name="campaignId" value={campaignId} />
          <FormStatus state={state} />
          <Field label="Question" name="question" errors={state.fieldErrors} required>
            <Input id="question" name="question" required />
          </Field>
          <Field label="Answer" name="answer" errors={state.fieldErrors} required>
            <TextArea name="answer" rows={3} errors={state.fieldErrors} />
          </Field>
          <label className="text-body-sm flex items-center gap-2">
            <input type="checkbox" name="isPublished" className="size-4" />
            Publish immediately
          </label>
          <SubmitButton pending={pending}>Add FAQ</SubmitButton>
        </form>
      </details>
    </div>
  );
}
