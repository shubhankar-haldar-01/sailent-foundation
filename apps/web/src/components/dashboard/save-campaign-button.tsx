'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Bookmark, BookmarkCheck, X } from 'lucide-react';

import { Button } from '@sailent/ui';

import { saveCampaign, unsaveCampaign, type DonorActionState } from '@/lib/donor/actions';

/**
 * Save and unsave.
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
function SaveSubmit({ saved, title }: { saved: boolean; title: string }) {
  const { pending } = useFormStatus();
  const Icon = saved ? BookmarkCheck : Bookmark;

  return (
    <Button type="submit" size="md" variant={saved ? 'secondary' : 'subtle'} disabled={pending}>
      <Icon className="size-4" aria-hidden="true" />
      {/* The accessible name names the CAMPAIGN — a page of "Save" buttons is
          unusable when the labels are read out of context. */}
      <span className="sr-only">
        {saved ? `Remove ${title} from saved campaigns` : `Save ${title} for later`}
      </span>
      <span aria-hidden="true">{pending ? 'Saving…' : saved ? 'Saved' : 'Save'}</span>
    </Button>
  );
}

export function SaveCampaignButton({
  campaignId,
  title,
  saved = false,
}: {
  campaignId: string;
  title: string;
  saved?: boolean;
}) {
  const [, action] = useActionState<DonorActionState, FormData>(
    saved ? unsaveCampaign : saveCampaign,
    {},
  );

  return (
    <form action={action}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <SaveSubmit saved={saved} title={title} />
    </form>
  );
}

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
