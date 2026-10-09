import { cn } from '@sailent/ui';

/**
 * The programs page's decorations, matched to the owner's reference design
 * (2026-10-08): the hero photograph's organic outline, the peach shape behind
 * it, a hand-drawn orange leaf, a soft green sprig and the pale blue leaves
 * beside the closing collage.
 *
 * All decorative — `aria-hidden`, no pointer events. The About page's own
 * pieces (`components/about/decor.tsx`) are reused where they fit; these are
 * the shapes that page does not have.
 */

/**
 * The hero photograph's outline — a soft, slightly irregular quadrilateral
 * rather than a plain rectangle.
 *
 * `objectBoundingBox` units, so the one path scales with the frame at every
 * width. Rendered once in the hero and referenced by id from the frame's
 * `clip-path`; the page has one hero, so the id cannot collide.
 */
export const HERO_SHAPE_ID = 'programs-hero-shape';

export function HeroShapeDefs() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <clipPath id={HERO_SHAPE_ID} clipPathUnits="objectBoundingBox">
        {/* Traced from the design: a long sweep down the left, the right edge leaning in. */}
        <path d="M0.17 0.032 C0.42 0.013 0.7 0.002 0.925 0.004 C0.984 0.005 1.003 0.052 0.998 0.125 L0.956 0.81 C0.948 0.935 0.9 1 0.82 1 L0.14 1 C0.068 1 0.032 0.952 0.027 0.87 C0.017 0.71 0.002 0.57 0.005 0.45 C0.01 0.29 0.055 0.1 0.17 0.032 Z" />
      </clipPath>
    </svg>
  );
}

/** The soft peach shape that sits behind the photograph's left edge. */
export function PeachBlob({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 320"
      preserveAspectRatio="none"
      className={cn('pointer-events-none', className)}
    >
      <path
        d="M118 6 C 168 0, 200 30, 196 82 C 192 140, 168 168, 176 222 C 184 282, 150 318, 98 314 C 40 310, 6 268, 4 206 C 2 150, 30 128, 34 82 C 38 34, 70 12, 118 6 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * A hand-drawn leafy branch in outline — the orange sketch on the peach shape.
 * `currentColor`, so the caller sets the ink.
 */
export function LeafOutline({ className }: { className?: string }) {
  // [x, y, rotation°, length] — each leaf starts on the stem.
  const leaves: [number, number, number, number][] = [
    [30, 26, -124, 30],
    [36, 42, -58, 30],
    [42, 62, -136, 34],
    [48, 78, -48, 32],
    [55, 100, -144, 34],
    [62, 116, -40, 30],
  ];
  return (
    <svg aria-hidden="true" viewBox="0 0 100 150" className={cn('pointer-events-none', className)}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M78 146 C 64 112, 46 66, 24 10" strokeWidth="1.8" />
        {leaves.map(([x, y, r, l]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${r})`} strokeWidth="1.5">
            <path
              d={`M0 0 C ${l * 0.28} ${-l * 0.3}, ${l * 0.72} ${-l * 0.3}, ${l} 0 C ${l * 0.72} ${l * 0.3}, ${l * 0.28} ${l * 0.3}, 0 0 Z`}
            />
            <path d={`M${l * 0.12} 0 L ${l * 0.86} 0`} strokeWidth="1.1" />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** A soft sage-green sprig — broad filled leaves on a curved stem, leaning right. */
export function GreenSprig({ className }: { className?: string }) {
  const LIGHT = 'oklch(0.87 0.045 150)';
  const DEEP = 'oklch(0.8 0.06 150)';
  // [x, y, rotation°, length, width, tone] — each leaf starts on the stem.
  // Broad leaves, mostly on the outer side of the stem, as the design draws them.
  const leaves: [number, number, number, number, number, string][] = [
    [52, 18, -70, 40, 13, LIGHT],
    [47, 40, -26, 46, 14.5, DEEP],
    [41, 56, -150, 38, 12.5, LIGHT],
    [40, 78, -18, 46, 14.5, LIGHT],
    [33, 98, -156, 36, 12, DEEP],
    [32, 118, -12, 44, 14, DEEP],
    [24, 140, -160, 34, 11.5, LIGHT],
  ];
  return (
    // The box takes in every leaf whole — the top leaf rises above the stem's
    // tip and the lowest reaches left of its base, and an SVG clips whatever
    // falls outside its viewBox.
    <svg
      aria-hidden="true"
      viewBox="-12 -24 104 196"
      className={cn('pointer-events-none', className)}
    >
      <path
        d="M14 168 C 24 122, 36 70, 54 12"
        fill="none"
        stroke={DEEP}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {leaves.map(([x, y, r, l, w, tone]) => (
        <path
          key={`${x}-${y}`}
          d={`M0 0 C ${l * 0.3} ${-w}, ${l * 0.75} ${-w}, ${l} 0 C ${l * 0.75} ${w}, ${l * 0.3} ${w}, 0 0 Z`}
          fill={tone}
          transform={`translate(${x} ${y}) rotate(${r})`}
        />
      ))}
    </svg>
  );
}

/** Three pale blue leaves fanning out — the collage's top-right corner. */
export function BlueLeaves({ className }: { className?: string }) {
  const FILL = 'oklch(0.9 0.04 245)';
  const LINE = 'oklch(0.72 0.08 245)';
  // [rotation°, length, width]
  const leaves: [number, number, number][] = [
    [-118, 46, 11],
    [-84, 54, 12.5],
    [-48, 44, 11],
  ];
  return (
    <svg aria-hidden="true" viewBox="0 0 110 100" className={cn('pointer-events-none', className)}>
      <g transform="translate(52 96)">
        {leaves.map(([r, l, w]) => (
          <g key={r} transform={`rotate(${r})`}>
            <path
              d={`M0 0 C ${l * 0.3} ${-w}, ${l * 0.75} ${-w}, ${l} 0 C ${l * 0.75} ${w}, ${l * 0.3} ${w}, 0 0 Z`}
              fill={FILL}
              stroke={LINE}
              strokeWidth="1.4"
            />
            <path
              d={`M${l * 0.1} 0 L ${l * 0.88} 0`}
              fill="none"
              stroke={LINE}
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** A small orange sprig in outline, beside "View More Programs". */
export function SprigFlourish({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 40" className={cn('pointer-events-none', className)}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 34 C 14 30, 26 22, 40 6" strokeWidth="1.8" />
        <path d="M16 28 C 15 21, 18 15, 22 12" strokeWidth="1.6" />
        <path d="M24 22 C 25 15, 29 10, 34 8" strokeWidth="1.6" />
        <path d="M14 29 C 20 31, 26 31, 31 28" strokeWidth="1.6" />
        <path d="M23 23 C 29 25, 35 24, 39 20" strokeWidth="1.6" />
      </g>
    </svg>
  );
}

/**
 * The pale sun at the photograph's top-left corner, with three thick orange
 * rays fanning out from it — as the design draws it. The rays are
 * `currentColor`; the sun takes its fill from `sunClassName`.
 */
export function SunBurst({
  className,
  sunClassName,
}: {
  className?: string;
  sunClassName?: string;
}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 80 70" className={cn('pointer-events-none', className)}>
      <circle cx="52" cy="44" r="18" className={sunClassName} />
      <path
        d="M43.8 21.4 L39 8.3 M31.2 32 L19.1 25 M28.5 49 L14.8 51.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A small leafy stem in outline — the "Community led solutions" mark. */
export function PlantIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('pointer-events-none', className)}
    >
      <path d="M11 21c0-4.5.6-9.5 3-14" />
      <path d="M14 7c.3-2.2 1.9-3.6 4.2-3.8-.2 2.3-1.8 3.7-4.2 3.8Z" />
      <path d="M12.6 11.2c1.2-1.9 3.2-2.6 5.4-2-1 2-3.1 2.7-5.4 2Z" />
      <path d="M12.2 12.6c-.8-2-2.6-3.1-4.9-2.9.7 2.2 2.6 3.2 4.9 2.9Z" />
      <path d="M11.4 17.3c-1-1.9-3-2.7-5.2-2.2.9 2.1 2.9 2.9 5.2 2.2Z" />
      <path d="M11.7 16c1.1-1.8 3-2.5 5.1-1.9-1 1.9-2.9 2.6-5.1 1.9Z" />
    </svg>
  );
}
