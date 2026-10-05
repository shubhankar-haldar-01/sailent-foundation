'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Heart, X } from 'lucide-react';

import { Button, cn } from '@sailent/ui';

import { saveCampaign, unsaveCampaign, type DonorActionState } from '@/lib/donor/actions';

/**
 * Unsave, from the donor's Saved campaigns page.
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

/**
 * The round white disc the heart sits in, over a card's photograph.
 *
 * 36px drawn, with a pseudo-element widening the hit area to 44px — the disc
 * is small so it does not cover the picture, the target is not.
 */
const HEART_DISC = cn(
  'relative grid size-9 place-items-center rounded-full bg-surface text-wash-rose-ink shadow-sm',
  'before:absolute before:-inset-1 before:content-[""]',
  // Grows and warms under the pointer, presses in when tapped.
  'transition-[scale,background-color] duration-(--duration-base) ease-(--ease-out-soft)',
  'hover:bg-wash-rose motion-safe:hover:scale-110 motion-safe:active:scale-95',
  'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
);

/**
 * The heart on a campaign card: save it for later.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * SHOWN TO EVERYONE, AND HONEST ABOUT WHAT IT DOES FOR EACH.
 *
 * Saving needs a donor account. A signed-out visitor still sees the heart,
 * but it is a LINK to sign-in that brings them back to the listing — the
 * control names the action, and the destination is where that action is
 * possible. Nothing pretends to save and then quietly fails.
 *
 * A signed-in donor gets a toggle whose starting state was read on the server
 * (`saved`), so the first press does what the heart shows rather than what a
 * default assumed.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `aria-pressed` carries the state and the name stays "Save <title>", which is
 * how a toggle button is meant to be announced: "Save Educate Rural Children,
 * toggle button, pressed".
 */
export function SaveCampaignHeart({
  campaignId,
  title,
  signedIn,
  saved: savedOnLoad,
  returnTo = '/campaigns',
  className,
}: {
  campaignId: string;
  title: string;
  signedIn: boolean;
  saved: boolean;
  /** Where sign-in should send a visitor back to. */
  returnTo?: string;
  className?: string;
}) {
  const [saved, setSaved] = React.useState(savedOnLoad);
  /** Bumped on each successful save, so the heart beats once each time. */
  const [beats, setBeats] = React.useState(0);

  /*
    The intent travels IN THE FORM rather than being read from `saved` in this
    closure, so a double-tap cannot send "save" twice off one stale render.
  */
  const [state, action, pending] = useActionState<DonorActionState, FormData>(
    async (previous, form) => {
      const intent = form.get('intent');
      const result = await (intent === 'unsave' ? unsaveCampaign : saveCampaign)(previous, form);
      if (result.ok) {
        setSaved(intent !== 'unsave');
        if (intent !== 'unsave') setBeats((count) => count + 1);
      }
      return result;
    },
    {},
  );

  if (!signedIn) {
    return (
      <Link
        href={`/sign-in?next=${encodeURIComponent(returnTo)}`}
        aria-label={`Sign in to save ${title}`}
        className={cn(HEART_DISC, className)}
      >
        <Heart className="size-[1.125rem]" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <form action={action} className={className}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="intent" value={saved ? 'unsave' : 'save'} />
      <button
        type="submit"
        aria-pressed={saved}
        aria-label={`Save ${title}`}
        disabled={pending}
        className={cn(HEART_DISC, state.error && 'ring-destructive ring-2', 'disabled:opacity-70')}
      >
        {/* Keyed on the count so the beat replays on every save, not just the first. */}
        <Heart
          key={beats}
          className={cn('size-[1.125rem]', saved && 'fill-current', beats > 0 && 'heart-pop')}
          aria-hidden="true"
        />
      </button>
      {/* Said aloud, and shown as the red ring above, rather than swallowed. */}
      <p role="status" className="sr-only">
        {state.error ? `Could not update saved campaigns: ${state.error}` : ''}
      </p>
    </form>
  );
}
