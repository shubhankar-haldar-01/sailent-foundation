import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Button, cn } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import { PageShell } from '@/components/layout/page-shell';
import { FlagSolid, PartnerSolid, PeopleSolid } from '@/components/home/focus-icons';
import { localMedia } from '@/lib/media/public-asset';

/** Solid marks, matching the focus strip rather than the outline set. */
const ACTIONS = [
  {
    href: '/volunteer',
    icon: PeopleSolid,
    title: 'Volunteer',
    blurb: 'Share your time and skills',
    wash: 'bg-wash-blue text-info-action',
  },
  {
    /*
      "Fundraise — Start a campaign and inspire others" USED TO BE HERE, and it
      offered something this platform does not have. Peer-to-peer fundraising
      is a PERMANENT exclusion (`docs/product-requirements.md`): campaigns are
      run by the organisation, and there is no route, table or admin screen by
      which a supporter could start one. The link went to `/donate`, so anyone
      who took it up was quietly handed a donation form instead — the worst
      version of the mistake, because the promise was only withdrawn after the
      click.
    */
    href: '/donate',
    icon: FlagSolid,
    title: 'Donate',
    blurb: 'Fund a campaign that needs it',
    wash: 'bg-wash-amber text-primary',
  },
  {
    href: '/contact',
    icon: PartnerSolid,
    title: 'Partner',
    blurb: 'Collaborate for greater reach',
    wash: 'bg-wash-mint text-success',
  },
] as const;

/**
 * The community call to action.
 *
 * Text sits over a photograph, so it carries its own scrim rather than relying
 * on the image being dark enough — a drawing today, a photograph the moment
 * `public/images/community-volunteers.jpg` exists, and white text has to hold
 * on both. The scrim is what makes that a guarantee rather than a hope.
 *
 * It is a GRADIENT, and at `lg` it is darkest IN THE MIDDLE — behind the
 * message — clearing to almost nothing at both ends. The supplied photograph
 * carries "Be the Change" painted into its left side, and a scrim heavy enough
 * for white text was wiping that out; the sunset on the right has to stay
 * visible too.
 *
 * 10 / 52 / 8 is the lightest set that holds, and it was found by sweeping:
 *
 *   scrim          1440 heading   1024 heading
 *   10 / 45 /  8   3.23           2.89  ✗
 *   10 / 52 /  8   3.83           3.44  ← this one
 *   12 / 58 / 10   4.23           2.90  ✗
 *
 * The middle row is not simply "more is better": the heading lands on a
 * different part of the photograph at each width, so a heavier scrim can still
 * measure worse. The numbers come from sampling the rendered pixels, not from
 * the alpha values.
 *
 * Sideways only from `lg`. Below that the message is centred and runs the full
 * width, so it crosses into the light end of a horizontal fade — measured, the
 * subtitle fell to 4.24:1 at 390px. There the scrim runs downward and stays
 * dark throughout.
 */
export function CommunityCta() {
  return (
    <section aria-labelledby="community-title" className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <MediaFrame
          media={localMedia('community-volunteers', '')}
          aspect="wide"
          rounded={false}
          className="size-full [&>svg]:size-full"
        />
        <div
          aria-hidden="true"
          className="from-accent-950/70 via-accent-950/58 to-accent-950/50 lg:from-accent-950/10 lg:via-accent-950/52 lg:to-accent-950/08 lg:from-18% lg:to-86% absolute inset-0 bg-gradient-to-b lg:bg-gradient-to-r lg:via-50%"
        />
      </div>

      <PageShell className="band-y">
        <div className="grid items-center gap-6 lg:grid-cols-[3.9fr_4.2fr_3.9fr]">
          {/*
            NO live script accent here.

            The supplied background photograph has "Be the Change" and its heart
            PAINTED INTO IT, so rendering ours as well would print the words
            twice. The column is kept — it is what holds the message on the
            band's centre line — but it is empty.

            If a version of the photograph without the lettering arrives, put
            the `ScriptAccent` back: live text stays sharp at any size, and the
            baked-in version is soft wherever the image is scaled up.
          */}
          <div className="hidden lg:block" />

          <div className="text-center">
            <h2
              id="community-title"
              className="font-display text-h2 text-balance font-bold tracking-tight text-white"
            >
              Join Our Community
            </h2>
            <p className="text-body-sm mt-2 leading-relaxed text-white/85">
              Your time, skills or support can create real, lasting impact.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button
                asChild
                size="md"
                className="text-info-action ring-info-action/25 bg-white shadow-sm ring-1 hover:bg-white/90"
              >
                <Link href="/volunteer">
                  Become a Volunteer
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="md"
                className="bg-accent-950/35 hover:bg-accent-950/55 text-white ring-1 ring-white/70"
              >
                <Link href="/donate">
                  Make a Donation
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>

          <ul className="bg-surface divide-border grid rounded-xl p-2 shadow-lg sm:grid-cols-3 sm:divide-x">
            {ACTIONS.map((action) => (
              <li key={action.title} className="px-1">
                <Link
                  href={action.href}
                  className={cn(
                    'group flex h-full flex-col items-center gap-1.5 rounded-lg px-2 py-3 text-center transition-colors',
                    'hover:bg-muted focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-11 place-items-center rounded-full transition-transform',
                      'group-hover:scale-105 motion-reduce:transform-none',
                      action.wash,
                    )}
                  >
                    <action.icon className="size-[1.6rem]" aria-hidden="true" />
                  </span>
                  <span className="text-body-sm font-bold">{action.title}</span>
                  <span className="text-caption text-muted-foreground text-balance leading-tight">
                    {action.blurb}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </PageShell>
    </section>
  );
}
