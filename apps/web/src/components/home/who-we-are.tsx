import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';

import { Button } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import { PageShell } from '@/components/layout/page-shell';
import { HeartDoodle } from '@/components/home/focus-icons';
import { localMedia } from '@/lib/media/public-asset';
import { HeadingRule } from '@/components/home/section-head';
import { ScriptAccent } from '@/components/sections/script-accent';

const WHAT_WE_DO = [
  'Provide access to quality education',
  'Support healthcare and nutrition',
  'Respond to natural disasters',
  'Empower women and youth',
  'Promote sustainable livelihoods',
  'Care for animals and the environment',
];

/**
 * The soft blue cloud the collage and the handwritten note sit on.
 *
 * A PATH, not a border-radius. `border-radius` — even the eight-value
 * elliptical form — can only describe one smooth corner per side, so whatever
 * numbers you give it the result is an egg. The approved shape has LOBES: it
 * swells and pinches its way round the way a drawn blob does, and that needs
 * real curves.
 *
 * The outline is a closed Catmull-Rom through six points at varying radii,
 * converted to cubics — which is how it stays convex and soft rather than
 * pinching into a rounded diamond, which is what fewer points and a low tension
 * produce.
 *
 * `preserveAspectRatio="none"` so it stretches to whatever box it is given.
 * Distortion is invisible on a shape with no correct proportions of its own,
 * and it lets one path serve both the wide backing behind the collage and the
 * narrow upright one behind the note.
 */
function BlobShape({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 220"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        fill="currentColor"
        d="M131.5 23.6C179.5 40.8 190.0 46.7 197.5 92.9C205.0 139.1 195.6 145.3 156.5 177.5C117.4 209.6 110.6 215.8 67.1 200.2C23.5 184.6 20.2 174.9 11.4 125.5C2.5 76.2 1.7 66.2 37.7 35.6C73.8 5.0 83.6 6.4 131.5 23.6Z"
      />
    </svg>
  );
}

/**
 * Who we are, what we do, and a photograph between them.
 *
 * FOUR columns at `lg`, not three: the handwritten "Real People Impact" and its
 * blue shape are a column of their own rather than something hung off the side
 * of the list. Hanging it outside the 1200px container was the only way to put
 * it there, and that widened the document — which is why it used to be gated to
 * 1536px and simply vanished on most screens. As a column it is always present,
 * as the approved design has it.
 *
 * The centre is a composed group rather than a single frame: a large photograph
 * with two smaller ones overlapping its corners, a soft blue shape behind all
 * three, and two loose hearts. Everything but the main photograph is
 * decorative, and only it carries alt text — three descriptions of the same
 * idea is three interruptions for one picture.
 *
 * Stacked below `lg` with the image LAST: on a phone the two blocks of text are
 * the substance, and a large picture wedged between them just separates two
 * halves of one idea.
 */
export function WhoWeAre() {
  return (
    // `overflow-hidden` is a guard, not the layout — nothing here is positioned
    // outside the container any more. It stops a future ornament from silently
    // widening the document.
    <section
      aria-labelledby="who-we-are-title"
      className="bg-surface-tint border-border overflow-hidden border-b"
    >
      <PageShell className="py-6 lg:py-8">
        <div className="grid gap-7 lg:grid-cols-[3.4fr_4.1fr_3.2fr_1.5fr] lg:items-center lg:gap-5">
          {/* Who we are ----------------------------------------------------- */}
          <div>
            <div className="flex items-center gap-3">
              <h2
                id="who-we-are-title"
                className="font-display text-section tracking-(--text-section--letter-spacing) font-bold"
              >
                Who We Are
              </h2>
              <HeadingRule />
            </div>

            <p className="text-body-sm text-muted-foreground mt-3 leading-relaxed">
              Sailent Foundation is a non-profit organization working towards a kinder, fairer and
              more inclusive society. We collaborate with communities, volunteers and partners to
              create sustainable change in education, healthcare, food, disaster relief, livelihoods
              and animal welfare.
            </p>

            <Button asChild size="md" variant="info" className="mt-4">
              <Link href="/about">
                Learn More About Us
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          {/* Collage — last in the DOM on small screens via `order`. --------- */}
          <div className="relative order-last px-6 lg:order-none">
            {/* The blue shape the group sits on. One large soft blob rather
            {/* The blue shape the group sits on. One large soft cloud rather
                than two small ones, which is what reads at this size. */}
            <BlobShape className="text-wash-blue absolute -inset-y-3 inset-x-0 h-[calc(100%+1.5rem)] w-full opacity-70" />

            <div className="relative">
              <HeartDoodle className="text-cta-glow absolute -right-6 -top-6 z-10 size-5 rotate-12" />
              <HeartDoodle className="text-cta-glow absolute -bottom-6 -left-7 z-10 size-4 -rotate-12" />
              {/*
                Two smaller frames overlapping the main one, at the corners the
                approved collage uses. They need the explicit `z-10`: they are
                EARLIER siblings, so without it the main frame paints over them
                whatever their offsets and they show as slivers at the edges.
              */}
              <div
                aria-hidden="true"
                className="border-surface absolute -left-5 -top-4 z-10 hidden w-20 overflow-hidden rounded-xl border-4 shadow-md sm:block"
              >
                <MediaFrame
                  media={localMedia('community-reading-corner', '')}
                  aspect="square"
                  rounded={false}
                />
              </div>
              <div
                aria-hidden="true"
                className="border-surface absolute -bottom-4 -right-5 z-10 hidden w-20 overflow-hidden rounded-xl border-4 shadow-md sm:block"
              >
                <MediaFrame
                  media={localMedia('community-training-centre', '')}
                  aspect="square"
                  rounded={false}
                />
              </div>

              <div className="border-surface relative overflow-hidden rounded-2xl border-4 shadow-lg">
                <MediaFrame
                  media={localMedia(
                    'community-classroom',
                    'Students outside their classroom holding a slate',
                  )}
                  // 8:5, which is the shape the supplied photograph is in —
                  // 16:9 cut the bottom off the chalkboard the children hold.
                  aspect="landscape"
                  rounded={false}
                  sizes="(max-width: 1024px) 80vw, 420px"
                />
                {/*
                  NO live script here.

                  The supplied collage photograph has "Together for a Brighter
                  Tomorrow" written on the chalkboard the children are holding,
                  so drawing ours over it printed the line twice. If a version
                  without it arrives, put the `ScriptAccent` back.
                */}
              </div>
            </div>
          </div>

          {/* What we do ----------------------------------------------------- */}
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-section tracking-(--text-section--letter-spacing) font-bold">
                What We Do
              </h2>
              <HeadingRule />
            </div>

            <p className="text-body-sm text-muted-foreground mt-3 leading-relaxed">
              We design and implement impactful programs that address real needs on the ground.
            </p>

            <ul className="mt-3 space-y-1.5">
              {WHAT_WE_DO.map((item) => (
                <li key={item} className="text-body-sm flex items-start gap-2.5 leading-snug">
                  <span className="bg-info-action mt-0.5 grid size-4 shrink-0 place-items-center rounded-full">
                    <Check className="size-2.5 text-white" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            {/* Underlined at rest, as approved — it sits under a list of plain
                sentences with nothing else to mark it as a link. */}
            <Link
              href="/programs"
              className="text-body-sm text-info-action focus-visible:outline-ring group mt-3 inline-flex items-center gap-1.5 rounded-sm font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Explore Our Programs
              <ArrowRight
                className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
                aria-hidden="true"
              />
            </Link>
          </div>

          {/* The handwritten note, in its own column. ------------------------ */}
          <div className="relative hidden place-items-center lg:grid">
            <BlobShape className="text-wash-blue absolute -inset-x-2 -inset-y-4 h-[calc(100%+2rem)] w-[calc(100%+1rem)] opacity-90" />
            <ScriptAccent
              size="md"
              heart
              className="text-accent-800 relative max-w-[5rem] text-center"
            >
              Real People Impact
            </ScriptAccent>
          </div>
        </div>
      </PageShell>
    </section>
  );
}
