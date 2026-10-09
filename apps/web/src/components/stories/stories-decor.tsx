import { cn } from '@sailent/ui';

/**
 * The Stories page's decorations (owner's page design, 2026-10-08): an
 * outlined leaf spray, a filled sprig and three short rays.
 *
 * All decorative — `aria-hidden`, no pointer events — and coloured by the
 * caller (`currentColor`), so the same shapes serve the orange line art, the
 * green and blue sprigs and dark mode.
 */

/** One almond leaf along +x, length `l`, half-width `w`, starting at the origin. */
const leaf = (l: number, w: number) =>
  `M0 0 C ${l * 0.3} ${-w}, ${l * 0.75} ${-w}, ${l} 0 C ${l * 0.75} ${w}, ${l * 0.3} ${w}, 0 0 Z`;

/** A stem with leaves either side, drawn as OUTLINES — the orange line art. */
export function OutlineLeaves({ className }: { className?: string }) {
  // [x, y, rotation°, length, half-width] — each leaf starts on the stem.
  const leaves: [number, number, number, number, number][] = [
    [44, 12, -96, 34, 10],
    [46, 40, -148, 40, 12],
    [50, 52, -38, 38, 11.5],
    [55, 82, -156, 40, 12],
    [59, 94, -30, 36, 11],
  ];
  return (
    <svg
      aria-hidden="true"
      // Starts above 0: the top leaf rises to y = -22, and a box from 0 cut it off.
      viewBox="0 -24 110 164"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      className={cn('pointer-events-none', className)}
    >
      <path d="M66 138 C 60 100, 52 56, 44 12" strokeLinecap="round" />
      {leaves.map(([x, y, r, l, w]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path d={leaf(l, w)} />
          {/* The midrib, so it reads as a leaf rather than a lozenge. */}
          <path d={`M2 0 L${l - 5} 0`} strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

/** A filled sprig — green or blue, at the caller's colour. */
export function FilledSprig({ className, flip = false }: { className?: string; flip?: boolean }) {
  const leaves: [number, number, number, number, number][] = [
    [32, 10, -98, 30, 11],
    [35, 32, -150, 34, 12.5],
    [38, 42, -40, 32, 12],
    [43, 66, -158, 34, 12.5],
    [47, 76, -32, 32, 12],
    [51, 98, -164, 30, 11],
  ];
  return (
    <svg
      aria-hidden="true"
      // Starts above 0 so the top leaf (to y = -20) is drawn whole.
      viewBox="0 -22 90 152"
      className={cn('pointer-events-none', flip && '-scale-x-100', className)}
    >
      <path
        d="M54 118 C 49 86, 41 50, 32 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {leaves.map(([x, y, r, l, w]) => (
        <path
          key={`${x}-${y}`}
          d={leaf(l, w)}
          fill="currentColor"
          opacity="0.85"
          transform={`translate(${x} ${y}) rotate(${r})`}
        />
      ))}
    </svg>
  );
}

/** Four outlined leaves fanned from one point — the doodle beside "View More Stories". */
export function LeafFan({ className }: { className?: string }) {
  // [x, y, rotation°, length, half-width], all rising from the bottom left.
  const leaves: [number, number, number, number, number][] = [
    [7, 42, -74, 30, 4.5],
    [9, 41, -52, 35, 5.5],
    [11, 42, -31, 31, 5],
    [8, 44, -12, 20, 4],
  ];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 44 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      className={cn('pointer-events-none', className)}
    >
      <path d="M3 47 C 5 45, 7 44, 10 42" strokeLinecap="round" />
      {leaves.map(([x, y, r, l, w]) => (
        <path key={`${x}-${y}`} d={leaf(l, w)} transform={`translate(${x} ${y}) rotate(${r})`} />
      ))}
    </svg>
  );
}

/** Three short strokes, fanned — the accent beside a photograph or heading. */
export function TripleRays({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" className={cn('pointer-events-none', className)}>
      <path
        d="M14 3 L17 12 M30 10 L22 17 M34 26 L25 26"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
