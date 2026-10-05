import { getImageProps } from 'next/image';

import { cn } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';
import { MediaFrame } from '@/components/media/media-frame';
import { localMedia } from '@/lib/media/public-asset';
import { breadcrumbSchema, jsonLd } from '@/lib/seo/structured-data';

/**
 * The two photographs, by slot.
 *
 * Resolved ONCE at module load, like the homepage banner, and each falls back
 * to a drawing until its file is in `public/images/` — a missing photograph is
 * never a broken image.
 *
 * `campaigns-hero-cluster` is the right-hand group exactly as the approved
 * banner draws it: three photographs, the white curved rims between them, and
 * the mint corner with its two leaves, cut from the design at 726×345. It is
 * placed 1:1 in the SVG below, so the only edge drawn in code is its LEFT one,
 * where the girl's photograph shows through. A replacement must keep that
 * size and layout, or the clip below will not follow its rims.
 *
 * Empty alt text, deliberately. The pictures illustrate the headline beside
 * them; the campaign cards are where photographs say something.
 */
const PHOTOS = {
  education: localMedia('campaigns-hero-education', ''),
  cluster: localMedia('campaigns-hero-cluster', ''),
};

/** The cluster image's own size, which the SVG's coordinate space matches. */
const CLUSTER = { width: 726, height: 345 } as const;

/**
 * The outer edge of the cluster's white rims, in the cluster's coordinates:
 * down the cow's rounded left side, into the notch where the two left-hand
 * pebbles meet, and out round the relief photograph to the bottom.
 */
const CLUSTER_EDGE =
  'M 55 0 C 34 18, 16 50, 11 85 C 6 115, 12 150, 30 175 C 42 190, 58 198, 79 200 C 60 205, 44 222, 35 242 C 26 263, 22 292, 22 345';

/**
 * The /campaigns banner.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * LAID OUT AS THE APPROVED BANNER IS, NOT AS A TWO-COLUMN GRID.
 *
 * The copy sits on a soft cream-to-mint ground with a sprig, a heart and a
 * leaf beside it; the photographs run from just past the copy to the right
 * edge of the WINDOW, not of the content column. So the section is full
 * bleed and positions both halves from the content container's left edge:
 *
 *   --hero-left    where the 1320px content container starts
 *   --hero-indent  how far in from that the copy starts (≈12.9% of the
 *                  window at desktop, as the design sets it)
 *   --hero-text    the width the copy is given
 *
 * The photographs start where the copy ends. The cluster keeps its own
 * proportions and is anchored right; the girl's photograph fills whatever is
 * left and fades in from the copy's side.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Height is fixed per breakpoint, short enough that the first row of campaign
 * cards is on screen. The search bar below overlaps the bottom edge — it is
 * not part of this component and is not changed by it.
 *
 * Below `lg` it stacks: copy, then the two photographs.
 *
 * No visible breadcrumb trail — the approved banner has none — but the
 * trail's structured data stays, so search engines still read the page's place
 * in the site.
 */
export function CampaignsHero() {
  return (
    <section
      aria-labelledby="campaigns-hero-title"
      className={cn(
        'lg:h-(--hero-h) group/hero relative isolate overflow-hidden',
        '[--hero-h:14rem] 2xl:[--hero-h:16rem]',
        '[--hero-left:max(2.5rem,50vw_-_41.25rem)]',
        '[--hero-indent:0rem] xl:[--hero-indent:clamp(0rem,12.9vw_-_var(--hero-left),8rem)]',
        '[--hero-text:23rem] xl:[--hero-text:28.5rem] 2xl:[--hero-text:31rem]',
        /*
          The banner's own inks, sampled from the approved design: an indigo
          navy for the headline, softer indigo-slates for the eyebrow and the
          lead, and the leaf green of "Real Change". Scoped to this section —
          nothing else on the site uses them. Each clears 4.5:1 on the cream
          ground except the green, which is large bold text and clears 3:1.
        */
        '[--hero-eyebrow:#253b74] [--hero-green:#2f855a] [--hero-ink:#0d1258] [--hero-lead:#4d5b87]',
      )}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Campaigns', path: '/campaigns' },
          ]),
        )}
      />

      {/* The ground: cream warming to mint at the left edge. Two palette washes. */}
      <div aria-hidden="true" className="bg-surface-warm absolute inset-0 -z-20" />
      <div
        aria-hidden="true"
        className="from-wash-mint/45 via-surface-warm/0 absolute inset-0 -z-10 bg-gradient-to-r to-transparent"
      />

      {/*
        The sprig, heart and leaf, filling the space from the window edge to
        the copy. From `xl` — below that the copy starts at the gutter and
        there is no space to fill.
      */}
      <LeftFlourish className="absolute inset-y-0 left-0 -z-10 hidden h-full w-[calc(var(--hero-left)_+_var(--hero-indent)_-_0.75rem)] xl:block" />

      {/* The photographs, from the end of the copy to the window's right edge. */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-[calc(var(--hero-left)_+_var(--hero-indent)_+_var(--hero-text))] right-0 hidden lg:block"
      >
        {/*
          The girl's photograph runs well under the cluster, so the notch
          between its two left pebbles shows her photograph rather than the
          ground. It is capped at a little over twice the banner's height and
          kept against the cluster (`ml-auto`): on a very wide window a wider
          frame would only zoom into her face and soften the picture.
        */}
        <div className="absolute inset-y-0 left-0 right-[calc(var(--hero-h)_*_2.104_-_6rem)] ml-auto max-w-[calc(var(--hero-h)_*_2.3)]">
          <MediaFrame
            media={PHOTOS.education}
            aspect="video"
            rounded={false}
            priority
            sizes="(min-width: 1024px) 560px, 1px"
            className={cn(
              'absolute inset-0 aspect-auto bg-transparent',
              '[mask-image:linear-gradient(to_right,transparent,black_26%)]',
              // Hold her face clear of the cluster as the photograph narrows.
              '[&_img]:object-[30%_50%] xl:[&_img]:object-left',
              // Eases in a touch while the pointer is over the banner.
              '[&_img]:ease-(--ease-out-soft) [&_img]:transition-[scale] [&_img]:duration-[900ms] motion-safe:group-hover/hero:[&_img]:scale-[1.04]',
            )}
          />
          {/* On her fading edge, as the design has it. Too close to her face below `xl`. */}
          <PhotoSprig className="absolute inset-y-0 left-0 hidden h-full xl:block" />
        </div>
        <Cluster
          clipId="campaigns-hero-cluster-lg"
          className="ease-(--ease-out-soft) absolute inset-y-0 right-0 h-full origin-right transition-[scale] duration-[900ms] motion-safe:group-hover/hero:scale-[1.02]"
        />
      </div>

      <PageShell className="lg:h-full">
        <div className="max-w-(--container-wide) mx-auto lg:h-full">
          <div className="lg:pl-(--hero-indent) flex flex-col justify-center pb-16 pt-7 lg:h-full lg:max-w-[calc(var(--hero-indent)_+_var(--hero-text))] lg:pb-9 lg:pt-3 xl:pt-4">
            <p className="text-caption text-(--hero-eyebrow) flex items-center gap-2 font-medium">
              <TwinLeaf className="text-(--hero-green) size-4" />
              Be a Part of the Change
            </p>

            <h1
              id="campaigns-hero-title"
              className="font-display text-(--hero-ink) mt-1.5 text-[clamp(1.75rem,0.75rem+1.25vw,2.25rem)] font-extrabold leading-[1.05] tracking-tight"
            >
              <span className="sm:block">Support Causes</span>{' '}
              <span className="sm:block">
                That Create <span className="text-(--hero-green)">Real Change</span>
              </span>
            </h1>

            {/* Two sentences, one per line from `sm` up, as the banner sets them. */}
            <p className="2xl:text-body-sm text-(--hero-lead) mt-2 text-[0.8125rem] leading-[1.45]">
              <span className="sm:block">
                Discover our campaigns and be a part of meaningful change.
              </span>{' '}
              <span className="sm:block">
                Your support helps us build a kinder, healthier and more inclusive future.
              </span>
            </p>

            {/* The hand-drawn stroke under the copy. Decorative. */}
            <svg
              aria-hidden="true"
              viewBox="0 0 80 14"
              className="text-accent-rule mt-2.5 h-3 w-[4.5rem]"
              fill="none"
            >
              <path
                d="M2 9c14-5 30-7 46-5M14 12c16-4 34-6 62-4"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/*
            Below the copy on smaller screens. A tablet gets the banner's own
            composition as a strip — the girl fading under the cluster — and a
            phone, too narrow for that overlap, gets the two stacked.
          */}
          <div aria-hidden="true" className="-mt-9 pb-14 lg:hidden">
            <div className="grid gap-3 sm:hidden">
              <MediaFrame
                media={PHOTOS.education}
                aspect="video"
                rounded={false}
                priority
                className="aspect-[2.4/1] rounded-2xl [&_img]:object-[35%_40%]"
                sizes="(max-width: 639px) 100vw, 1px"
              />
              <Cluster clipId="campaigns-hero-cluster-sm" className="w-full" />
            </div>
            <div className="relative hidden h-52 overflow-hidden rounded-2xl [--hero-h:13rem] sm:block">
              <MediaFrame
                media={PHOTOS.education}
                aspect="video"
                rounded={false}
                priority
                className="absolute inset-y-0 left-0 right-[calc(var(--hero-h)_*_2.104_-_6rem)] aspect-auto [&_img]:object-[30%_45%]"
                sizes="(min-width: 640px) and (max-width: 1023px) 420px, 1px"
              />
              <Cluster
                clipId="campaigns-hero-cluster-md"
                className="absolute inset-y-0 right-0 h-full"
              />
            </div>
          </div>
        </div>
      </PageShell>
    </section>
  );
}

/**
 * The cluster, drawn as an SVG so its left edge can follow the photographs'
 * curved rims exactly. The picture goes through the same image optimiser as
 * every other photograph on the site (`getImageProps`), so it arrives resized
 * and re-encoded rather than as the raw file.
 */
function Cluster({
  clipId,
  className,
}: {
  /**
   * Unique per copy. The banner draws the cluster once per breakpoint and
   * hides the others; a clip shared by id resolves to the FIRST copy in the
   * document, and a clip inside a hidden copy is not applied at all.
   */
  clipId: string;
  className?: string;
}) {
  const src = PHOTOS.cluster.url
    ? getImageProps({ src: PHOTOS.cluster.url, alt: '', ...CLUSTER }).props.src
    : null;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${CLUSTER.width} ${CLUSTER.height}`}
      className={cn('aspect-[726/345]', className)}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={`${CLUSTER_EDGE} L ${CLUSTER.width} ${CLUSTER.height} L ${CLUSTER.width} 0 Z`} />
        </clipPath>
      </defs>
      {src ? (
        <image
          href={src}
          width={CLUSTER.width}
          height={CLUSTER.height}
          clipPath={`url(#${clipId})`}
        />
      ) : (
        <rect
          width={CLUSTER.width}
          height={CLUSTER.height}
          clipPath={`url(#${clipId})`}
          className="fill-wash-mint"
        />
      )}
      {/* A crisp white rim along the cut, over the photograph's own. */}
      <path d={CLUSTER_EDGE} fill="none" strokeWidth={3} className="stroke-surface" />
    </svg>
  );
}

/** The two-leaf mark before "Be a Part of the Change". */
function TwinLeaf({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 20C6.5 18.5 3.2 13 4 5.5c6 .8 9 6.2 8 14.5Z" />
      <path d="M12 20c-.6-8 2.6-13.3 8.2-14.6C21.2 13 17.6 18.6 12 20Z" />
    </svg>
  );
}

/**
 * A slow, soft sway for the banner's leaves when the pointer enters it — a
 * breeze, once, not a loop. Origins are in each drawing's own coordinates
 * (an SVG transforms about its view box), set where each stalk would be held.
 */
const SWAY = 'duration-[900ms] ease-(--ease-out-soft) transition-[rotate,scale]';

/**
 * The line-art beside the copy: a pale-blue swell at the window edge, a large
 * leaf low down, and a sprig whose stem runs into an outlined heart.
 *
 * Drawn in the banner's own coordinates (its left 300px, at 345px tall) and
 * fitted into the space between the window edge and the copy, pinned
 * top-left — so the swell always starts at the edge, as in the design,
 * whatever width that space is.
 */
function LeftFlourish({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 300 345"
      preserveAspectRatio="xMinYMin meet"
      className={className}
    >
      <path d="M0 68C30 92 56 140 60 200c3 60-8 110-18 145H0Z" className="fill-wash-blue" />
      {/* The low leaf, swaying from its stalk. */}
      <g className={cn(SWAY, 'origin-[178px_345px] motion-safe:group-hover/hero:rotate-6')}>
        <path
          d="M178 348c-28-48-63-80-106-90 16 42 53 82 106 90Z"
          className="fill-wash-mint-ink/20"
        />
        <path
          d="M172 344c-32-32-64-60-92-82"
          fill="none"
          strokeWidth={2}
          className="stroke-surface/70"
        />
      </g>
      {/* The sprig, swaying from the foot of its stem, and the heart on it beating. */}
      <g className={cn(SWAY, 'origin-[212px_252px] motion-safe:group-hover/hero:-rotate-6')}>
        <path d="M160 105c-17-34-2-69 32-83 8 38-4 68-32 83Z" className="fill-wash-mint-ink/45" />
        <path
          d="M163 99c7-28 14-50 25-71"
          fill="none"
          strokeWidth={1.6}
          className="stroke-surface/70"
        />
        <path
          d="M160 105c-2 55 12 107 52 147"
          fill="none"
          strokeWidth={2.4}
          strokeLinecap="round"
          className="stroke-wash-mint-ink/45"
        />
        <path
          d="M212 216c-12-16-16-31-9-42 7-11 21-8 25 4 4-12 19-18 25-6 5 14-13 31-41 44Z"
          fill="none"
          strokeWidth={2.4}
          strokeLinejoin="round"
          className={cn(
            SWAY,
            'stroke-accent-rule/80 motion-safe:group-hover/hero:scale-115 origin-[230px_195px]',
          )}
        />
      </g>
    </svg>
  );
}

/** A translucent leaf on a fine stem, over the fading edge of the girl's photograph. */
function PhotoSprig({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 150 345"
      className={cn('aspect-[150/345]', className)}
    >
      <g className={cn(SWAY, 'origin-[125px_252px] motion-safe:group-hover/hero:rotate-[8deg]')}>
        <path
          d="M125 252C90 230 62 190 58 148"
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          className="stroke-wash-mint-ink/35"
        />
        <path d="M58 148C38 125 40 85 62 62c20 26 18 63-4 86Z" className="fill-wash-mint-ink/40" />
        <path
          d="M58 142c2-24 3-50 4-74"
          fill="none"
          strokeWidth={1.4}
          className="stroke-surface/60"
        />
      </g>
    </svg>
  );
}
