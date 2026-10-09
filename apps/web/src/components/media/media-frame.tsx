import Image from 'next/image';

import { cn } from '@sailent/ui';

import type { MediaRef } from '@/lib/mock/types';

/**
 * MediaFrame — the image strategy.
 *
 * Sailent Foundation's own photography does not exist yet, and reference-site
 * imagery is off limits. Rather than grey boxes, this generates a deterministic
 * illustrative composition from the design tokens, so pages can be judged on
 * their layout, rhythm and colour.
 *
 * The composition is chosen from the media `seed`, so a team portrait renders a
 * portrait and a landscape renders a landscape — an abstract swatch in every
 * slot makes a page impossible to read as a design.
 *
 * What makes these swappable rather than throwaway:
 *   • The component takes a `MediaRef`, the same shape a real image will have.
 *   • Alt text already describes the photograph that belongs in the slot, so
 *     the accessibility copy is correct before the picture arrives.
 *   • Aspect ratio is explicit, so nothing shifts when real images land.
 *   • `data-media-placeholder` marks every one for a find-and-replace sweep.
 *
 * Replacing this with `next/image` is a change to this one component.
 */

const ASPECTS = {
  video: 'aspect-video',
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  photo: 'aspect-[4/3]',
  /** Card cover: a wide, short crop that leaves the figures the card. */
  banner: 'aspect-[15/4]',
  /**
   * 8:5. Between `photo` and `video`, and the shape most supplied photographs
   * actually arrive in — the homepage collage is 408×259, which 16:9 crops the
   * bottom off and 4:3 crops the sides off.
   */
  landscape: 'aspect-[8/5]',
  wide: 'aspect-[21/9]',
  hero: 'aspect-[4/3] md:aspect-[3/2]',
} as const;

export type MediaAspect = keyof typeof ASPECTS;

export interface MediaFrameProps {
  media: MediaRef;
  aspect?: MediaAspect;
  className?: string;
  rounded?: boolean;
  priority?: boolean;
  /**
   * What width this frame actually renders at, as a `sizes` string.
   *
   * WRONG `sizes` IS A SILENT BUG. The browser picks which variant to download
   * from this alone — it does not measure the element first. The default here
   * claims a third of the viewport, which is right for a card in a three-up
   * grid and badly wrong for an 88px avatar or a 104px story crop: too small
   * and the picture is soft, too large and a phone downloads a desktop image.
   */
  sizes?: string;
  /**
   * How a real photograph fills the frame. `cover` (the default) crops to the
   * frame's shape; `contain` shows the whole picture — for product shots on a
   * plain background, where cropping cuts the product itself.
   */
  fit?: 'cover' | 'contain';
  /**
   * Which part of a real photograph stays in view when `cover` crops it, as a
   * CSS `object-position` ("left center", "30% 50%"). Centre by default.
   */
  focus?: string;
}

/** Small deterministic hash, so a seed always renders the same picture. */
function hash(seed: string): number {
  let value = 0;
  for (let index = 0; index < seed.length; index += 1) {
    value = (value << 5) - value + seed.charCodeAt(index);
    value |= 0;
  }
  return Math.abs(value);
}

type Scene = 'portrait' | 'object' | 'interior' | 'landscape';

/** Pick a composition that suits what the slot is for. */
function sceneFor(seed: string): Scene {
  if (seed.startsWith('team-') || seed.startsWith('story-')) return 'portrait';
  if (seed.startsWith('product-')) return 'object';
  if (/classroom|interior|centre|training|creche|crèche|tailoring|reading/.test(seed)) {
    return 'interior';
  }
  return 'landscape';
}

export function MediaFrame({
  media,
  aspect = 'video',
  className,
  rounded = true,
  priority = false,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  fit = 'cover',
  focus,
}: MediaFrameProps) {
  const seed = hash(media.seed);
  const scene = sceneFor(media.seed);
  const id = media.seed;

  // Derived from the seed so each slot is distinct while the whole set stays
  // inside the brand palette — no new colours are introduced anywhere.
  const hue = `calc(var(--brand-hue) + ${(seed % 60) - 20})`;
  const warmHue = `calc(var(--brand-hue) + ${60 + (seed % 40)})`;

  return (
    <div
      className={cn(
        'bg-muted relative overflow-hidden',
        ASPECTS[aspect],
        rounded && 'rounded-lg',
        className,
      )}
      {...(media.url ? {} : { 'data-media-placeholder': media.seed })}
    >
      {media.url ? (
        /*
          A REAL photograph wins over the drawing, every time.

          `media.url` is set by the content layer — from the API's own cover
          image, or from a file named after the seed in `public/images/`. So a
          placeholder is replaced by dropping a file in, and this component is
          where that switch happens rather than at twenty call sites.
        */
        <Image
          src={media.url}
          alt={media.alt}
          fill
          sizes={sizes}
          className={fit === 'contain' ? 'object-contain' : 'object-cover'}
          {...(focus ? { style: { objectPosition: focus } } : {})}
          {...(priority ? { priority: true } : {})}
        />
      ) : (
        /*
          An EMPTY alt means decorative, and decorative art must be hidden
          outright — `role="img"` with `aria-label=""` leaves an image in the
          accessibility tree with no name, which is exactly the thing screen
          readers announce as "image" and move on from. Avatars beside a figure
          that already states the number, and portraits beside a name, are both
          this case.
        */
        <svg
          viewBox={scene === 'portrait' ? '0 0 300 400' : '0 0 400 300'}
          preserveAspectRatio="xMidYMid slice"
          className="size-full"
          {...(media.alt
            ? { role: 'img' as const, 'aria-label': media.alt }
            : { 'aria-hidden': true as const, focusable: false })}
          {...(priority ? { 'data-priority': 'true' } : {})}
        >
          <defs>
            <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0.2" y2="1">
              <stop offset="0%" stopColor={`oklch(0.93 0.05 ${warmHue})`} />
              <stop offset="55%" stopColor={`oklch(0.84 0.06 ${hue})`} />
              <stop offset="100%" stopColor={`oklch(0.7 0.08 ${hue})`} />
            </linearGradient>
            <radialGradient id={`glow-${id}`} cx="0.5" cy="0.4" r="0.7">
              <stop offset="0%" stopColor={`oklch(0.95 0.06 ${warmHue})`} />
              <stop offset="100%" stopColor={`oklch(0.72 0.07 ${hue})`} />
            </radialGradient>
          </defs>

          {scene === 'portrait' ? <PortraitScene id={id} seed={seed} hue={hue} /> : null}
          {scene === 'object' ? <ObjectScene id={id} seed={seed} hue={hue} /> : null}
          {scene === 'interior' ? <InteriorScene id={id} seed={seed} hue={hue} /> : null}
          {scene === 'landscape' ? <LandscapeScene id={id} seed={seed} hue={hue} /> : null}
        </svg>
      )}
    </div>
  );
}

/**
 * A head-and-shoulders portrait — for team members and story subjects.
 *
 * Drawn in a 300×400 box rather than the 400×300 the other scenes use, because
 * it appears in upright frames and a landscape drawing cropped to fit is just
 * a magnified chin.
 *
 * Deliberately abstract: no face, no features. A generated likeness standing in
 * for a real person on an NGO's stories page is worse than an obvious
 * placeholder, and this is what a photograph replaces — drop
 * `public/images/<seed>.jpg` in and it does.
 */
function PortraitScene({ id, seed, hue }: { id: string; seed: number; hue: string }) {
  const warm = `calc(var(--brand-hue) + ${120 + (seed % 30)})`;
  const skin = `oklch(${0.7 + (seed % 5) * 0.025} 0.055 ${warm})`;
  const hair = `oklch(${0.3 + (seed % 4) * 0.02} 0.04 ${hue})`;
  const cloth = `oklch(${0.52 + (seed % 6) * 0.035} 0.06 ${hue})`;

  return (
    <>
      <rect width="300" height="400" fill={`url(#glow-${id})`} />
      {/* The background thrown out of focus behind the sitter. */}
      <circle cx="150" cy="140" r="124" fill={`oklch(0.91 0.045 ${hue})`} opacity="0.45" />

      {/* Shoulders, then the neckline inside them. */}
      <path d="M2 400c0-80 62-136 148-136s148 56 148 136Z" fill={cloth} />
      <path
        d="M150 264c-24 0-43 8-43 8l43 48 43-48s-19-8-43-8Z"
        fill={`oklch(0.93 0.02 ${hue})`}
        opacity="0.85"
      />

      <rect x="126" y="184" width="48" height="82" rx="23" fill={skin} />
      <ellipse cx="150" cy="144" rx="62" ry="72" fill={skin} />
      {/* Hair, as a cap over the crown. */}
      <path d="M88 144a62 72 0 0 1 124 0c3-52-25-84-62-84s-65 32-62 84Z" fill={hair} />
    </>
  );
}

/** A still-life on a surface — for campaign products. */
function ObjectScene({ id, seed, hue }: { id: string; seed: number; hue: string }) {
  const count = 2 + (seed % 3);
  return (
    <>
      <rect width="400" height="300" fill={`url(#glow-${id})`} />
      {/* Table edge */}
      <rect y="214" width="400" height="86" fill={`oklch(0.55 0.05 ${hue})`} opacity="0.35" />
      {Array.from({ length: count }).map((_, index) => {
        const w = 58 + ((seed + index * 23) % 34);
        const h = 46 + ((seed + index * 17) % 58);
        const x = 200 - (count * 42) / 2 + index * 84 + ((seed + index) % 10);
        return (
          <rect
            key={index}
            x={x}
            y={214 - h}
            width={w}
            height={h}
            rx="6"
            fill={`oklch(${0.46 + index * 0.07} 0.06 ${hue})`}
          />
        );
      })}
      <ellipse cx="200" cy="222" rx="150" ry="14" fill={`oklch(0.3 0.03 ${hue})`} opacity="0.3" />
    </>
  );
}

/** Window light across a room — for classrooms, clinics and training centres. */
function InteriorScene({ id, seed, hue }: { id: string; seed: number; hue: string }) {
  const windows = 2 + (seed % 2);
  return (
    <>
      <rect width="400" height="300" fill={`url(#glow-${id})`} />
      {Array.from({ length: windows }).map((_, index) => (
        <rect
          key={index}
          x={54 + index * (260 / windows)}
          y="48"
          width="86"
          height="104"
          rx="4"
          fill={`oklch(0.95 0.04 ${hue})`}
          opacity="0.7"
        />
      ))}
      {/* Light falling across the floor */}
      <path d="M0 232 L400 206 L400 300 L0 300 Z" fill={`oklch(0.5 0.05 ${hue})`} opacity="0.4" />
      {/* Seated figures */}
      {Array.from({ length: 3 + (seed % 3) }).map((_, index) => {
        const x = 56 + index * (300 / (3 + (seed % 3)));
        const y = 214 + ((seed + index * 13) % 16);
        return (
          <g key={index} fill={`oklch(0.38 0.05 ${hue})`}>
            <circle cx={x} cy={y - 24} r="11" />
            <path d={`M${x - 18} ${y + 30} Q${x} ${y - 14} ${x + 18} ${y + 30} Z`} />
          </g>
        );
      })}
    </>
  );
}

/** Sky, hills, ground and a few figures — the default outdoor scene. */
function LandscapeScene({ id, seed, hue }: { id: string; seed: number; hue: string }) {
  const horizon = 176 + (seed % 26);
  const figures = 2 + (seed % 4);
  return (
    <>
      <rect width="400" height="300" fill={`url(#sky-${id})`} />
      <circle
        cx={90 + (seed % 220)}
        cy={58 + (seed % 26)}
        r={24 + (seed % 10)}
        fill={`oklch(0.97 0.05 ${hue})`}
        opacity="0.75"
      />

      {/* Distant ridge */}
      <path
        d={`M0 ${horizon} Q90 ${horizon - 44 - (seed % 22)} 180 ${horizon - 10} T400 ${horizon - 26} V300 H0 Z`}
        fill={`oklch(0.62 0.05 ${hue})`}
        opacity="0.55"
      />
      {/* Near ground */}
      <path
        d={`M0 ${horizon + 34} Q120 ${horizon + 8} 230 ${horizon + 30} T400 ${horizon + 16} V300 H0 Z`}
        fill={`oklch(0.48 0.06 ${hue})`}
      />
      {/* Tree line */}
      {Array.from({ length: 3 + (seed % 3) }).map((_, index) => {
        const x = 24 + index * (360 / (3 + (seed % 3))) + ((seed + index * 7) % 18);
        const h = 26 + ((seed + index * 11) % 20);
        return (
          <g key={index} fill={`oklch(0.42 0.06 ${hue})`}>
            <rect x={x - 2} y={horizon - 4} width="4" height={h * 0.5} />
            <circle cx={x} cy={horizon - 6 - h * 0.3} r={h * 0.44} />
          </g>
        );
      })}
      {/* Figures, which is what makes it read as a photograph of people */}
      {Array.from({ length: figures }).map((_, index) => {
        const x = 70 + index * (260 / figures) + ((seed + index * 5) % 22);
        const baseY = horizon + 62 + ((seed + index * 9) % 22);
        const scale = 0.85 + ((seed + index * 3) % 5) / 10;
        return (
          <g
            key={index}
            fill={`oklch(0.34 0.05 ${hue})`}
            transform={`translate(${x} ${baseY}) scale(${scale})`}
          >
            <circle cx="0" cy="-30" r="8" />
            <path d="M-11 12 Q0 -22 11 12 Z" />
          </g>
        );
      })}
    </>
  );
}

/** Caption wrapper, for gallery and article figures. */
export function MediaFigure({
  media,
  aspect,
  className,
}: {
  media: MediaRef;
  aspect?: MediaAspect;
  className?: string;
}) {
  return (
    <figure className={cn('space-y-2', className)}>
      <MediaFrame media={media} aspect={aspect} />
      {media.caption ? (
        <figcaption className="text-caption text-muted-foreground">{media.caption}</figcaption>
      ) : null}
    </figure>
  );
}
