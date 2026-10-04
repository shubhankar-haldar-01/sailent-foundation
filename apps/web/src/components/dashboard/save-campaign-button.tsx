'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { X } from 'lucide-react';

import { Button } from '@sailent/ui';

import { unsaveCampaign, type DonorActionState } from '@/lib/donor/actions';

/**
 * Unsave, from the donor's Saved campaigns page.
 *
 * (Saving itself was taken off the campaign page, so only removal is left
 * here — for campaigns a donor saved before that.)
 *
 * FORMS, NOT FETCH CALLS. A server action posts through the same session the
 * rest of the dashboard uses, so there is no token in client JavaScript and the
 * control still works with JavaScript disabled — it degrades to a plain form
 * post and a page reload.
 *
 * Both actions are IDEMPOTENT at the API, which matters most here: a
 * double-tapped bookmark on a phone sends two requests, and the second must be
 * a success rather than a 409 the donor has to interpret.
 */
function RemoveSubmit({ title }: { title: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant="ghost"
      disabled={pending}
      // 44px, the WCAG 2.5.8 enhanced target, because this is a small icon
      // control sitting next to a link people actually want to press.
      className="text-muted-foreground hover:text-foreground size-11 shrink-0 p-0"
    >
      <X className="size-4" aria-hidden="true" />
      <span className="sr-only">Remove {title} from saved campaigns</span>
    </Button>
  );
}

export function UnsaveButton({ campaignId, title }: { campaignId: string; title: string }) {
  const [, action] = useActionState<DonorActionState, FormData>(unsaveCampaign, {});

  return (
    <form action={action}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <RemoveSubmit title={title} />
    </form>
  );
}
