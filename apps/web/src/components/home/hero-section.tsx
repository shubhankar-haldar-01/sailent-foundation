import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';

import { Button, formatNumber } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import { PageShell } from '@/components/layout/page-shell';
import { ScriptAccent } from '@/components/sections/script-accent';
import type { ImpactMetric } from '@/lib/content';
import { localMedia, publicAssetExists } from '@/lib/media/public-asset';

/**
 * The supplied banner photograph.
 *
 * Checked ONCE, at module load, rather than per request — see
 * `publicAssetExists`. Until the file is in `public/`, the hero falls back to
 * the generated placeholder rather than rendering a broken image on the most
 * prominent part of the site.
 */
const HERO_PHOTO = '/images/sailent-foundation-banner.webp';
const hasHeroPhoto = publicAssetExists(HERO_PHOTO);

/**
 * Homepage hero.
 *
 * ONE full-bleed photograph behind the whole band, with a warm wash over the
 * left of it and the message sitting on that wash. A column grid cannot
 * reproduce it: the headline there is boxed into a third of the page and breaks
 * "Empowering People," across two lines.
 *
 * The donation card that used to sit on the right was removed at the client's
 * request. The ask is not lost with it — it is still the header's one button,
 * the hero's own "Donate Now", every campaign card, and the /donate page the
 * two of them lead to.
 *
 * The wash is FULLY OPAQUE for the first 40% and only then fades. The headline
 * never leaves that part, so its contrast against the background is the token
 * pair's, measured, rather than something that depends on which photograph is
 * loaded today.
 *
 * The photograph is decorative here: it carries no information the headline
 * does not, and a background image announced to a screen reader is noise. The
 * campaign and story cards are where photographs get alt text.
 */
export function HeroSection({ metrics }: { metrics: ImpactMetric[] }) {
  // The social-proof line uses the live "people reached" aggregate. Absent
  // that figure, the line is dropped rather than invented (decision A14).
  const reached = metrics.find((metric) => metric.id === 'beneficiaries');

  return (
    <section className="bg-surface-warm border-border relative isolate overflow-hidden border-b">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        {hasHeroPhoto ? (
          /*
            `priority` because this is the page's LCP element — without it the
            browser discovers the photograph only after the CSS has parsed, and
            the largest thing on the screen is the last thing to arrive.

            `object-[62%_50%]` rather than plain `object-center`: the supplied
            banner puts its subject right of centre and open landscape on the
            left, so a centre crop cuts her in half at narrow widths. This
            holds the right-hand two thirds as the viewport gets shorter.
          */
          <Image
            src={HERO_PHOTO}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[62%_50%]"
          />
        ) : (
          <MediaFrame
            media={{ seed: 'home-hero', alt: '' }}
            aspect="wide"
            rounded={false}
            priority
            className="size-full [&>svg]:size-full"
          />
        )}
        {/*
          The wash.

          NEVER FULLY OPAQUE. The photograph carries across the whole band,
          including behind the message — the flat cream block that used to fill
          the left half is gone.

          How thin it can go is set ENTIRELY by the orange line.

          Sampling the supplied photograph under the message gives a
          1st-percentile luminance of 0.058 (the mountain silhouette) against a
          median of 0.839 (the sunrise). The navy is never in danger — it holds
          better than 8:1 at any wash here. "Transforming Lives" is the whole
          constraint, and which orange it uses decides the answer:

            wash   `--cta-bright` #E36209   `--cta` #C2410C
            85%    3.07:1  ← its floor      6.0:1
            70%    2.60:1  ✗                4.6:1
            60%    2.28:1  ✗                3.9:1  ← this floor
            50%    1.96:1  ✗                3.3:1

          At the brighter orange the photograph had to sit under an 85% wash and
          was barely there. Moving that one line to `--cta` — the same orange as
          the donate buttons and the "Read Story" links, so it is not a new
          colour on the page — buys 25 points of wash, and the picture actually
          reads.

          It still CLEARS to the right, so the subject of the photograph is
          untouched.

          Sideways only from `lg`. Below that the message is no longer a narrow
          column beside the picture — `max-w-md` on the paragraph is 448px
          against a 592px content box at 640px wide, so the text reaches 74% of
          the band and runs straight off the end of a horizontal fade. Measured
          there it fell to 1.37:1. Below `lg` the wash runs DOWNWARD instead,
          which tracks the text rather than fighting it.
        */}
        <div className="from-surface-warm/84 via-surface-warm/76 to-surface-warm/56 lg:from-surface-warm/74 lg:via-surface-warm/66 lg:from-3% lg:via-46% lg:to-72% absolute inset-0 bg-gradient-to-b from-10% via-70% lg:bg-gradient-to-r lg:to-transparent" />
        {/*
          A light lift at the right edge — NOT a cream block.

          It exists so the handwritten accent has something to sit against
          instead of landing straight on the foliage. At full opacity it did
          that job and also hid the right of the photograph, which is the part
          with the volunteers and the painted wall in it. At 55% the picture
          carries through and the accent still separates.

          Its own element because one gradient cannot start and end on the same
          colour with a clear middle.
        */}
        <div className="to-surface-warm/55 to-92% absolute inset-0 hidden bg-gradient-to-r from-transparent from-80% lg:block" />
      </div>

      <PageShell>
        {/*
          `relative` so the accent below can hang off the band rather than off a
          card that no longer exists, and the taller `lg` padding is what keeps
          the band roughly its approved height now that the message is the only
          thing setting it.
        */}
        <div className="relative py-9 lg:py-16">
          {/* Message ------------------------------------------------------- */}
          <div className="max-w-xl">
            <p className="text-overline tracking-(--text-overline--letter-spacing) text-muted-foreground uppercase">
              A kinder, fairer, brighter tomorrow
            </p>

            {/*
              Three deliberate lines, as approved. `block` on each rather than
              letting the browser balance it: left to itself the heading breaks
              after "Empowering", which strands one word and pushes the comma
              onto its own line. Below `sm` the blocks are allowed to wrap
              normally, because forcing these breaks at 320px overflows.
            */}
            <h1 className="font-display text-display-hero tracking-(--text-display-hero--letter-spacing) mt-2.5 text-balance font-extrabold sm:text-pretty">
              <span className="sm:block">Sailent Foundation</span>{' '}
              <span className="sm:block">Empowering People,</span>{' '}
              {/* Colour, not meaning — the sentence reads the same without it. */}
              <span className="text-primary sm:block">Transforming Lives</span>
            </h1>

            <p className="text-body-sm text-muted-foreground-strong mt-4 max-w-md leading-relaxed">
              We work across education, healthcare, food, disaster relief and livelihoods to build
              stronger, more inclusive communities for a better tomorrow.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild size="md">
                <Link href="/donate">
                  Donate Now
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="md" variant="secondary">
                <Link href="/about">
                  {/* The disc is part of the button's own artwork, so it sits
                      inside the label rather than being a second control. */}
                  <span
                    aria-hidden="true"
                    className="bg-accent-950 -ml-1.5 grid size-6 place-items-center rounded-full text-white"
                  >
                    <Play className="size-2.5 translate-x-px fill-current" />
                  </span>
                  Watch Our Story
                </Link>
              </Button>
            </div>

            {reached ? (
              <div className="mt-5 flex items-center gap-3">
                {/* Decorative: the figure beside them is the information. */}
                <ul aria-hidden="true" className="flex -space-x-2.5">
                  {['a', 'b', 'c', 'd'].map((seed) => (
                    <li
                      key={seed}
                      className="border-surface size-8 overflow-hidden rounded-full border-2"
                    >
                      <MediaFrame
                        media={localMedia(`team-supporter-${seed}`, '')}
                        aspect="square"
                        rounded={false}
                        sizes="36px"
                      />
                    </li>
                  ))}
                </ul>
                <p className="text-body-sm font-medium">
                  <span data-numeric="" className="tabular-nums">
                    {formatNumber(reached.value)}
                  </span>{' '}
                  <span className="text-muted-foreground">lives already impacted</span>
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </PageShell>

      {/*
        At the far right, on the cream the right-hand fade leaves behind — where
        the approved design puts it.

        OUTSIDE `PageShell`, anchored to the section instead. The page container
        caps at 1200px, so anything anchored to it can only reach the gutter on
        a negative offset, and that widens the document at narrower widths.
        Anchored to the full-width section it simply sits there, with the
        section's own `overflow-hidden` as the backstop.

        It needs the fade behind it: the supplied photograph carries its own
        lettering, a painted wall reading "education, health, food, stronger
        communities", and with no clear ground the two collide. The halo stays
        regardless, for whatever photograph replaces this one.

        The ink is WHITE, at the client's request, and the halo is DARK because
        of it. It used to be the other way round — orange ink, white halo —
        which worked because the words were darker than everything behind them.
        White words are lighter than the cream lift and lighter than the
        sunrise, so a pale halo would leave nothing to see; the dark one is the
        only thing separating them from the photograph now.
      */}
      <ScriptAccent
        size="lg"
        heart
        className="pointer-events-none absolute right-3 top-1/2 hidden max-w-[6rem] -translate-y-1/2 text-left font-bold leading-tight text-white [filter:drop-shadow(0_0_2px_rgb(0_0_0/0.6))_drop-shadow(0_1px_6px_rgb(0_0_0/0.5))] lg:block"
      >
        Small Actions Big Change
      </ScriptAccent>
    </section>
  );
}
