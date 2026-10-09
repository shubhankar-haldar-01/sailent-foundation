import { cn } from '@sailent/ui';

/**
 * The dashboard's right-hand artwork, drawn to the owner's design
 * (2026-10-08): solid icons for the profile rows, the green leaf beside "Your
 * Impact", the sprout growing from a soil mound, and the leaves in the corner
 * of "Explore More Campaigns".
 *
 * All decorative — `aria-hidden`, no pointer events. The icons take
 * `currentColor`; the illustrations carry their own soft palette, dimmed a
 * little in dark mode by the caller.
 */

/** A solid handset. */
export function PhoneSolid({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M6.6 2.2c.6-.3 1.4-.1 1.8.5l2 3.1c.4.6.3 1.4-.2 1.9l-1.4 1.3c1 2.2 2.8 4 5 5l1.3-1.4c.5-.5 1.3-.6 1.9-.2l3.1 2c.6.4.8 1.2.5 1.8l-.9 1.9c-.6 1.2-1.9 1.9-3.2 1.7C10 18.9 5.1 14 4.2 7.4c-.2-1.3.5-2.6 1.7-3.2l.7-2Z" />
    </svg>
  );
}

/** A solid map pin with a round hole. */
export function PinSolid({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2a7.5 7.5 0 0 0-7.5 7.5c0 5.3 6.3 11.6 6.6 11.9a1.3 1.3 0 0 0 1.8 0c.3-.3 6.6-6.6 6.6-11.9A7.5 7.5 0 0 0 12 2Zm0 4.6a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Z"
      />
    </svg>
  );
}

/** A solid calendar with its date grid cut out. */
export function CalendarSolid({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1.5A2.5 2.5 0 0 1 21 6.5v12a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-12A2.5 2.5 0 0 1 5.5 4H7V3a1 1 0 0 1 1-1Zm-3 7.5V18a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5V9.5H5Zm2 2h2v2H7v-2Zm4 0h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-8 3.5h2v2H7v-2Zm4 0h2v2h-2v-2Zm4 0h2v2h-2v-2Z"
      />
    </svg>
  );
}

/** A solid leaf with a pale midrib. */
export function LeafSolid({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <path
        d="M20.5 3.2c.3 0 .5.2.5.5.2 6.4-1.5 10.9-4.8 13.6-2.6 2.1-6 2.7-9.3 2.1l-2.1 2.1a1 1 0 0 1-1.4-1.4l2.1-2.1c-.6-3.3 0-6.7 2.1-9.3C10.3 5.4 14.6 3.1 20.5 3.2Z"
        fill="currentColor"
      />
      <path
        d="M17 7 7.6 16.4"
        fill="none"
        stroke="white"
        strokeOpacity="0.7"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * A sprout growing from a soil mound on a sandy ground, the sun and its rays
 * above it — the "Your Impact" illustration.
 */
export function SproutIllustration({ className }: { className?: string }) {
  const LIGHT = 'oklch(0.75 0.13 135)';
  const DEEP = 'oklch(0.6 0.13 140)';
  // [x, y, rotation°, length, width, tone] — each leaf starts on the stem.
  const leaves: [number, number, number, number, number, string][] = [
    [74, 94, -158, 28, 11.5, DEEP],
    [77, 90, -24, 30, 12, LIGHT],
    [75, 74, -148, 30, 12, LIGHT],
    [77, 68, -30, 32, 12.5, DEEP],
    [76, 52, -120, 24, 10, DEEP],
    [78, 50, -56, 24, 10, LIGHT],
  ];
  return (
    <svg aria-hidden="true" viewBox="0 0 150 132" className={cn('pointer-events-none', className)}>
      {/* Ground: a pale green rise behind, the sand in front. */}
      <ellipse cx="128" cy="112" rx="22" ry="14" fill="oklch(0.89 0.04 140)" />
      <path
        d="M8 132 C 30 112, 70 106, 110 112 C 130 115, 144 122, 150 132 Z"
        fill="oklch(0.95 0.035 80)"
      />
      {/* The soil mound. */}
      <path d="M36 120 C 44 98, 104 95, 116 120 Z" fill="oklch(0.42 0.07 45)" />
      <path
        d="M52 112 C 62 104, 88 103, 98 110"
        fill="none"
        stroke="oklch(0.5 0.07 45)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* The plant. */}
      <path
        d="M76 106 C 75 88, 78 66, 77 44"
        fill="none"
        stroke={DEEP}
        strokeWidth="2.6"
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
      {/* The sun and its rays. */}
      <circle cx="104" cy="22" r="8" fill="oklch(0.8 0.12 70)" />
      <g stroke="oklch(0.68 0.17 50)" strokeWidth="2.4" strokeLinecap="round">
        <path d="M104 5V9" />
        <path d="M116 10 113.5 12.5" />
        <path d="M121 22H117" />
        <path d="M92 10 94.5 12.5" />
        <path d="M87 22H91" />
      </g>
    </svg>
  );
}

/** A soft peach rise with a few leaves on it — the "Explore More Campaigns" corner. */
export function ExploreLeaves({ className }: { className?: string }) {
  const LIGHT = 'oklch(0.82 0.06 150)';
  const DEEP = 'oklch(0.7 0.08 155)';
  // [x, y, rotation°, length, width, tone] — long, pointed leaves fanning up
  // from one base, as the design draws them.
  const leaves: [number, number, number, number, number, string][] = [
    [84, 110, -150, 40, 8, LIGHT],
    [85, 110, -122, 50, 9.5, DEEP],
    [86, 110, -96, 56, 10, LIGHT],
    [87, 110, -70, 48, 9.5, DEEP],
    [88, 110, -44, 38, 8, LIGHT],
  ];
  return (
    <svg aria-hidden="true" viewBox="0 0 120 110" className={cn('pointer-events-none', className)}>
      <path
        d="M0 110 C 18 84, 40 72, 70 70 C 96 68, 112 50, 120 30 V110 Z"
        fill="oklch(0.9 0.06 60)"
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
