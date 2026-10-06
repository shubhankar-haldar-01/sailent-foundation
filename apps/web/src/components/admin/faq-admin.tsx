'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label, Textarea } from '@sailent/ui';
import { FAQ_CATEGORIES } from '@sailent/validation';

import { FormStatus, SubmitButton } from '@/components/admin/form-shell';
import {
  createGeneralFaq,
  deleteGeneralFaq,
  updateGeneralFaq,
  type ActionState,
} from '@/lib/admin/actions';
import type { AdminGeneralFaq } from '@/lib/admin/api';

function useRefresh(state: ActionState, after?: () => void) {
  const router = useRouter();
  React.useEffect(() => {
    if (state.ok) {
      after?.();
      router.refresh();
    }
    // `after` is a fresh closure each render; only the result matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router]);
}

/** The question/answer/category/order/published fields, with ids unique per form. */
function FaqFields({
  prefix,
  faq,
  state,
}: {
  prefix: string;
  faq?: AdminGeneralFaq;
  state: ActionState;
}) {
  const error = (name: string) =>
    state.fieldErrors?.[name] ? (
      <p className="text-caption text-destructive">{state.fieldErrors[name]}</p>
    ) : null;
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-question`}>Question</Label>
        <Input
          id={`${prefix}-question`}
          name="question"
          defaultValue={faq?.question}
          required
          maxLength={300}
        />
        {error('question')}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-answer`}>Answer</Label>
        <Textarea
          id={`${prefix}-answer`}
          name="answer"
          defaultValue={faq?.answer}
          required
          rows={4}
          maxLength={5000}
        />
        {error('answer')}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-category`}>Section on /faq</Label>
          <select
            id={`${prefix}-category`}
            name="category"
            defaultValue={faq?.category ?? 'general'}
            className="border-input bg-surface text-body h-11 w-full rounded-lg border px-3"
          >
            {FAQ_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-order`}>Order</Label>
          <Input
            id={`${prefix}-order`}
            name="displayOrder"
            type="number"
            min={0}
            max={9999}
            defaultValue={faq?.displayOrder ?? 100}
          />
        </div>
        <label className="text-body-sm flex items-center gap-2 self-end pb-3">
          <input type="checkbox" name="isPublished" defaultChecked={faq?.isPublished ?? false} />
          Published
        </label>
      </div>
    </>
  );
}

export function CreateFaqForm() {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    createGeneralFaq,
    {},
  );
  const [open, setOpen] = React.useState(false);
  useRefresh(state, () => setOpen(false));

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        Add a question
      </Button>
    );
  }
  return (
    <form action={action} className="border-border max-w-2xl space-y-4 rounded-lg border p-5">
      <h2 className="text-h4 font-semibold">New question</h2>
      <FormStatus state={state} />
      <FaqFields prefix="new" state={state} />
      <div className="flex gap-2">
        <SubmitButton pending={pending}>Save</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function FaqRow({ faq, canManage }: { faq: AdminGeneralFaq; canManage: boolean }) {
  const [editState, editAction, editPending] = React.useActionState<ActionState, FormData>(
    updateGeneralFaq,
    {},
  );
  const [deleteState, deleteAction, deletePending] = React.useActionState<ActionState, FormData>(
    deleteGeneralFaq,
    {},
  );
  const [mode, setMode] = React.useState<'view' | 'edit' | 'delete'>('view');
  useRefresh(editState, () => setMode('view'));
  useRefresh(deleteState);

  if (mode === 'edit') {
    return (
      <form action={editAction} className="space-y-4 p-4">
        <input type="hidden" name="id" value={faq.id} />
        <FormStatus state={editState} />
        <FaqFields prefix={faq.id} faq={faq} state={editState} />
        <div className="flex gap-2">
          <SubmitButton pending={editPending}>Save</SubmitButton>
          <Button type="button" variant="ghost" onClick={() => setMode('view')}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body-sm font-semibold">{faq.question}</p>
          <p className="text-body-sm text-muted-foreground mt-1 line-clamp-2">{faq.answer}</p>
          <p className="text-caption text-muted-foreground mt-1">
            {faq.isPublished ? 'Published' : 'Draft — not on the site'} · order {faq.displayOrder}
          </p>
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setMode('edit')}>
              Edit
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode('delete')}>
              Delete
            </Button>
          </div>
        ) : null}
      </div>
      {mode === 'delete' ? (
        <form
          action={deleteAction}
          className="border-destructive/40 bg-destructive/5 space-y-3 rounded-lg border p-4"
        >
          <input type="hidden" name="id" value={faq.id} />
          <FormStatus state={deleteState} />
          <p className="text-body-sm font-semibold">Delete this question? It cannot be undone.</p>
          <div className="flex gap-2">
            <SubmitButton pending={deletePending}>Delete</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setMode('view')}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
