import { cn } from '@sailent/ui';

/**
 * The About page's small decorations: leaf sprigs, an orange squiggle, the
 * "rays" beside the hero photograph and the hero card's people icon.
 *
 * All decorative — `aria-hidden`, no pointer events — and drawn in soft,
 * low-contrast tints so they sit behind the content rather than competing
 * with it. Each takes a `className` for its size and position.
 */
const LEAF = 'oklch(0.78 0.06 185)';

export function LeafSprig({
  className,
  flip = false,
}: {
  className?: string;
  /** Mirror horizontally, for a sprig leaning the other way. */
  flip?: boolean;
}) {
  // A curved stem with alternating leaves, each an almond shape rotated to
  // lean out from the stem.
  const leaves = [
    { x: 52, y: 22, r: -38 },
    { x: 34, y: 34, r: 32 },
    { x: 54, y: 50, r: -30 },
    { x: 30, y: 64, r: 38 },
    { x: 48, y: 80, r: -26 },
    { x: 24, y: 94, r: 42 },
  ];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 80 130"
      className={cn('pointer-events-none', flip && '-scale-x-100', className)}
    >
      <path
        d="M14 128 C 24 96, 34 66, 60 8"
        fill="none"
        stroke={LEAF}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {leaves.map((leaf) => (
        <path
          key={`${leaf.x}-${leaf.y}`}
          d="M0 0 C 6 -7, 18 -7, 24 0 C 18 7, 6 7, 0 0 Z"
          fill={LEAF}
          opacity="0.85"
          transform={`translate(${leaf.x - 12} ${leaf.y}) rotate(${leaf.r} 12 0)`}
        />
      ))}
    </svg>
  );
}

export function Squiggle({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 160 60" className={cn('pointer-events-none', className)}>
      <path
        d="M4 52 C 22 22, 44 18, 64 30 S 104 50, 122 30 S 146 6, 156 4"
        fill="none"
        className="stroke-primary/45"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="4" cy="52" r="2" className="fill-primary/45" />
    </svg>
  );
}

/**
 * The burst of short strokes around the hero photograph's top-left corner:
 * six dashes on an arc, pointing in towards the corner. Drawn in the
 * corner's own coordinates — position the SVG 44px left of and 18px above
 * the photograph.
 */
export function Rays({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 68 90" className={cn('pointer-events-none', className)}>
      <path
        d="M63 3 L64.5 13 M34 6 L39.5 15.5 M20 18.5 L23.5 21.5 M4 34 L19.5 38.5 M5 67.5 L19.5 61 M22 86 L31.5 80.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The hero's fuller sprig: two leafy branches leaning out from behind the
 * photograph's lower-left corner, in two soft teals.
 */
export function LeafSpray({ className }: { className?: string }) {
  const DEEP = 'oklch(0.78 0.055 195)';
  const PALE = 'oklch(0.85 0.04 195)';
  // [x, y, rotation°, length, width, tone] — each leaf starts on its stem.
  const leaves: [number, number, number, number, number, string][] = [
    // Upper branch, from the base up to the tip.
    [82, 122, -162, 34, 11, PALE],
    [84, 114, -60, 30, 9.5, DEEP],
    [73, 94, -154, 36, 11.5, DEEP],
    [75, 86, -56, 32, 10, PALE],
    [63, 66, -148, 36, 11.5, PALE],
    [65, 58, -64, 32, 10, DEEP],
    [54, 40, -108, 38, 12, DEEP],
    // Lower branch, from the base out to the tip.
    [84, 188, -126, 34, 11, DEEP],
    [78, 194, 158, 34, 11, PALE],
    [61, 178, -116, 34, 11, PALE],
    [55, 186, 166, 36, 12, DEEP],
    [40, 170, -106, 32, 10.5, DEEP],
    [33, 176, 176, 38, 12.5, PALE],
  ];
  return (
    <svg aria-hidden="true" viewBox="0 0 100 210" className={cn('pointer-events-none', className)}>
      <g fill="none" strokeWidth="2" strokeLinecap="round">
        <path d="M96 140 C 84 110, 70 74, 54 38" stroke={DEEP} />
        <path d="M98 200 C 80 186, 56 176, 28 172" stroke={DEEP} />
      </g>
      {leaves.map(([x, y, r, l, w, tone]) => (
        <path
          key={`${x}-${y}`}
          d={`M0 0 C ${l * 0.3} ${-w}, ${l * 0.75} ${-w}, ${l} 0 C ${l * 0.75} ${w}, ${l * 0.3} ${w}, 0 0 Z`}
          fill={tone}
          opacity="0.9"
          transform={`translate(${x} ${y}) rotate(${r})`}
        />
      ))}
    </svg>
  );
}

/** Three people side by side — the hero card's icon. Outline, `currentColor`. */
export function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('pointer-events-none', className)}
    >
      <circle cx="6.5" cy="7" r="3" />
      <circle cx="16" cy="6.5" r="3" />
      <circle cx="25.5" cy="7" r="3" />
      <path d="M1.5 20v-2.5a5 5 0 0 1 8.2-3.8" />
      <path d="M10.5 21v-3a5.5 5.5 0 0 1 11 0v3" />
      <path d="M30.5 20v-2.5a5 5 0 0 0-8.2-3.8" />
    </svg>
  );
}

/**
 * A single leafy branch with broad leaves, leaning in from the right edge —
 * the "Our story" corner. Pale teal, partly cropped by the section edge.
 */
export function LeafBranch({ className }: { className?: string }) {
  const TONE = 'oklch(0.84 0.045 195)';
  // [x, y, rotation°, length, width] — each leaf starts on the stem.
  const leaves: [number, number, number, number, number][] = [
    [36, 12, -112, 32, 11],
    [42, 28, -152, 36, 12],
    [47, 38, -38, 32, 11],
    [53, 56, -160, 40, 13],
    [58, 66, -30, 34, 11.5],
    [63, 86, -166, 40, 13],
    [67, 96, -24, 34, 11.5],
    [72, 118, -170, 38, 12.5],
    [76, 128, -20, 32, 11],
  ];
  return (
    <svg
      aria-hidden="true"
      // Sized to the whole branch — the tip leaf rises above the stem's top
      // and the right-hand leaves reach past it — so nothing is cut off.
      viewBox="6 -22 104 182"
      className={cn('pointer-events-none', className)}
    >
      <path
        d="M90 158 C 80 120, 64 72, 34 8"
        fill="none"
        stroke={TONE}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {leaves.map(([x, y, r, l, w]) => (
        <path
          key={`${x}-${y}`}
          d={`M0 0 C ${l * 0.3} ${-w}, ${l * 0.75} ${-w}, ${l} 0 C ${l * 0.75} ${w}, ${l * 0.3} ${w}, 0 0 Z`}
          fill={TONE}
          opacity="0.9"
          transform={`translate(${x} ${y}) rotate(${r})`}
        />
      ))}
    </svg>
  );
}

/**
 * Two quick brush marks — a tick and an underline — that finish the
 * handwritten line in "Our story". `currentColor`, so the caller sets the ink.
 */
export function ScribbleMarks({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 56 44" className={cn('pointer-events-none', className)}>
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d="M44 2 C 44.5 6, 44 10, 43 13" strokeWidth="2.6" />
        <path d="M4 38 C 18 35.5, 34 34, 52 35" strokeWidth="3.2" />
      </g>
    </svg>
  );
}
