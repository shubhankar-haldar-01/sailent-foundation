'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { FormStatus, SubmitButton } from '@/components/admin/form-shell';
import { setContactMessageStatus, type ActionState } from '@/lib/admin/actions';
import type { ContactStatus } from '@/lib/admin/api';

const NEXT: Record<ContactStatus, { status: ContactStatus; label: string }[]> = {
  new: [
    { status: 'handled', label: 'Mark handled' },
    { status: 'archived', label: 'Archive' },
  ],
  handled: [
    { status: 'archived', label: 'Archive' },
    { status: 'new', label: 'Mark as new again' },
  ],
  archived: [{ status: 'new', label: 'Mark as new again' }],
};

/** Status buttons for one contact message (Phase 13). Nothing is ever deleted. */
export function ContactMessageActions({ id, status }: { id: string; status: ContactStatus }) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    setContactMessageStatus,
    {},
  );
  const router = useRouter();
  React.useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <div className="space-y-3">
      <FormStatus state={state} />
      <div className="flex flex-wrap gap-2">
        {NEXT[status].map((next) => (
          <form key={next.status} action={action}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={next.status} />
            <SubmitButton pending={pending}>{next.label}</SubmitButton>
          </form>
        ))}
      </div>
    </div>
  );
}
