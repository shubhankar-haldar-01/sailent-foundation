import type { SVGProps } from 'react';

/**
 * The solid marks used by the focus strip and the community panel.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * Why these are not `lucide` icons.
 *
 * The approved strip uses chunky filled glyphs — a solid book, a solid heart
 * with a white pulse cut through it, a solid paw. `lucide` is a stroke set:
 * every icon is an outline built from several elements, and putting
 * `fill="currentColor"` on one closes shapes that were never meant to be
 * closed. `PawPrint` becomes four discs and a blob, `Users` becomes a smear.
 * There is no flag that converts a stroke icon into a filled one.
 *
 * So these are drawn, in a shared 24×24 box, as single filled paths. They are
 * the only icons on the site that work this way, which is why they live here
 * rather than being added to the design system: everything else is `lucide`,
 * and that stays true.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Each takes the usual icon props, so they size with `className` and inherit
 * `currentColor` like the rest. All are decorative — the label beside them
 * carries the meaning — so callers mark them `aria-hidden`.
 */
type IconProps = SVGProps<SVGSVGElement>;

const BASE = {
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  focusable: 'false',
} as const;

/** Education — an open book. */
export function BookSolid(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="M11 6.6C9 5.2 6.2 4.5 3.5 4.8a1.7 1.7 0 0 0-1.5 1.7v10.8c0 1 .9 1.8 1.9 1.7 2.3-.2 4.5.3 6.2 1.4.4.2.9 0 .9-.5V6.6Z" />
      <path d="M13 6.6c2-1.4 4.8-2.1 7.5-1.8a1.7 1.7 0 0 1 1.5 1.7v10.8c0 1-.9 1.8-1.9 1.7-2.3-.2-4.5.3-6.2 1.4-.4.2-.9 0-.9-.5V6.6Z" />
    </svg>
  );
}

/** Healthcare — a heart with a pulse trace cut out of it. */
export function HeartPulseSolid(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="M12 21.3 10.5 20C5.3 15.3 2 12.2 2 8.4 2 5.3 4.4 2.9 7.5 2.9c1.8 0 3.4.8 4.5 2.1 1.1-1.3 2.7-2.1 4.5-2.1C19.6 2.9 22 5.3 22 8.4c0 3.8-3.3 6.9-8.5 11.6L12 21.3Z" />
      {/* Drawn in the badge's own wash rather than white: these sit on a tinted
          disc, and a pure-white cut reads as a hole in it. */}
      <path
        d="M3.6 10.6h3.3l1.4-2.6a.85.85 0 0 1 1.5.05l1.9 4.2 1.4-2.8a.85.85 0 0 1 1.4-.15l.9 1.25h4.6"
        fill="none"
        stroke="var(--wash-rose)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Food security — a fork and a spoon. */
export function UtensilsSolid(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="M5.2 2.6a1 1 0 0 1 1 1v4h.9v-4a1 1 0 1 1 2 0v4h.9v-4a1 1 0 1 1 2 0v5.2a3.3 3.3 0 0 1-2.4 3.1v9.5a1.4 1.4 0 0 1-2.9 0v-9.5a3.3 3.3 0 0 1-2.4-3.1V3.6a1 1 0 0 1 .9-1Z" />
      <path d="M17.6 2.6c2.2 0 4 2.3 4 5.1 0 2.4-1.3 4.4-3 4.9v8.8a1.4 1.4 0 0 1-2.9 0v-8.8c-1.7-.5-3-2.5-3-4.9 0-2.8 1.8-5.1 4-5.1Z" />
    </svg>
  );
}

/** Disaster relief — a shield. */
export function ShieldSolid(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="m12 2.1 7.6 3a1.7 1.7 0 0 1 1.1 1.6v5.2c0 5-3.5 9.6-8.3 10.9a1.5 1.5 0 0 1-.8 0C6.8 21.5 3.3 16.9 3.3 11.9V6.7a1.7 1.7 0 0 1 1.1-1.6l7.6-3Z" />
      <path
        d="M12 6.3v11.4"
        fill="none"
        stroke="var(--wash-violet)"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

/** Women empowerment — a group. */
export function PeopleSolid(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <circle cx="12" cy="6.2" r="3.3" />
      <circle cx="5.5" cy="8.4" r="2.5" />
      <circle cx="18.5" cy="8.4" r="2.5" />
      <path d="M12 10.6c3.1 0 5.6 2.3 5.6 5.2v3.4c0 .7-.5 1.2-1.2 1.2H7.6c-.7 0-1.2-.5-1.2-1.2v-3.4c0-2.9 2.5-5.2 5.6-5.2Z" />
      <path d="M5.5 12.2c.9 0 1.7.2 2.4.6a7 7 0 0 0-2.7 5.5v2.1H2.4c-.7 0-1.2-.5-1.2-1.2v-2.3c0-2.6 1.9-4.7 4.3-4.7Z" />
      <path d="M18.5 12.2c2.4 0 4.3 2.1 4.3 4.7v2.3c0 .7-.5 1.2-1.2 1.2h-2.8v-2.1a7 7 0 0 0-2.7-5.5c.7-.4 1.5-.6 2.4-.6Z" />
    </svg>
  );
}

/** Livelihood — a leaf. */
export function LeafSolid(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="M20.9 2.6c.6 0 1.1.5 1.1 1.1.3 5.6-1 9.9-3.7 12.6-2.8 2.9-6.8 3.7-10.6 2.6L5.1 21.7a1.3 1.3 0 0 1-1.8-1.8l2.5-2.5C4.7 13.6 5.5 9.6 8.4 6.8 11.2 4 15.4 2.7 20.9 2.6Z" />
      <path
        d="M18.6 5.7 7.2 17.1"
        fill="none"
        stroke="var(--wash-mint)"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

/** Animal welfare — a paw print. */
export function PawSolid(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <ellipse cx="6.1" cy="9.6" rx="2.3" ry="2.9" transform="rotate(-18 6.1 9.6)" />
      <ellipse cx="10.5" cy="6" rx="2.4" ry="3.1" />
      <ellipse cx="15.5" cy="6.3" rx="2.4" ry="3.1" transform="rotate(12 15.5 6.3)" />
      <ellipse cx="19.4" cy="10.4" rx="2.3" ry="2.8" transform="rotate(22 19.4 10.4)" />
      <path d="M12.7 12.4c2.9 0 6 2.4 6 5.2 0 2.1-1.7 3.6-3.8 3.6-.9 0-1.6-.2-2.2-.5-.6.3-1.3.5-2.2.5-2.1 0-3.8-1.5-3.8-3.6 0-2.8 3.1-5.2 6-5.2Z" />
    </svg>
  );
}

/** Fundraise — a flag. */
export function FlagSolid(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="M5.4 1.8c.8 0 1.4.6 1.4 1.4v.7c3.6-1.6 7.2 1.4 10.8-.2.9-.4 1.9.3 1.9 1.3v7.6c0 .5-.3 1-.8 1.2-3.6 1.6-7.2-1.4-10.8.2-.4.2-.7.1-1.1 0v7c0 .8-.6 1.4-1.4 1.4S4 21.8 4 21V3.2c0-.8.6-1.4 1.4-1.4Z" />
    </svg>
  );
}

/** Partner — two figures side by side. */
export function PartnerSolid(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <circle cx="7.6" cy="7" r="3.5" />
      <circle cx="16.6" cy="7.4" r="3.1" />
      <path d="M7.6 12.4c3.2 0 5.8 2.4 5.8 5.3v2.1c0 .7-.6 1.2-1.3 1.2H3.1c-.7 0-1.3-.5-1.3-1.2v-2.1c0-2.9 2.6-5.3 5.8-5.3Z" />
      <path d="M16.6 12.8c3 0 5.4 2.2 5.4 4.9v2.1c0 .7-.6 1.2-1.3 1.2h-5.2c.1-.4.2-.8.2-1.2v-2.1c0-2-.8-3.9-2.1-5.3a6.8 6.8 0 0 1 3-.6Z" />
    </svg>
  );
}

/** Communities — a solid map pin. */
export function PinSolid(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="M12 1.8c-4.2 0-7.6 3.3-7.6 7.4 0 5.3 6.7 12 7 12.3a.9.9 0 0 0 1.3 0c.3-.3 7-7 7-12.3 0-4.1-3.4-7.4-7.7-7.4Z" />
      {/*
        The hole in the pin, cut in the WASH rather than in white — these sit
        on a tinted disc, and a pure-white cut reads as a gap in the circle
        rather than as part of the mark. Same reasoning as HeartPulseSolid.
      */}
      <circle cx="12" cy="9.1" r="2.7" fill="var(--wash-blue)" />
    </svg>
  );
}

/**
 * A small hand-drawn heart, scattered around the collage.
 *
 * The same outline the script accents carry, standing on its own here — the
 * approved band sets two of these loose beside the photographs. Decorative, so
 * it is hidden from assistive tech and takes no space in the layout.
 */
export function HeartDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 22"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20.5C10.5 19 2.5 13.5 2.5 7.8 2.5 4.6 4.9 2.2 8 2.2c2 0 3.3 1 4 2.3.7-1.3 2-2.3 4-2.3 3.1 0 5.5 2.4 5.5 5.6 0 5.7-8 11.2-9.5 12.7Z" />
    </svg>
  );
}
