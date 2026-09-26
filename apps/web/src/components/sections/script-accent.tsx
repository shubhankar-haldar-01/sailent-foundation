import { cn } from '@sailent/ui';

/**
 * The handwritten accent that sits over photography in the design.
 *
 * DECORATIVE, and treated as such:
 *   • `aria-hidden`, because a script face read aloud is noise, and because
 *     every one of these repeats something the surrounding real text already
 *     says. It never carries information of its own.
 *   • Never the only place a message appears — see the point above. If you
 *     find yourself wanting to put something here that is not said elsewhere,
 *     it belongs in a heading or a paragraph instead.
 *   • `select-none` so it does not land in a copied selection of the page.
 *
 * A script face is hard to read for a lot of people, and impossible for some.
 * That is acceptable for ornament and unacceptable for content.
 */
export function ScriptAccent({
  children,
  className,
  size = 'md',
  heart = false,
}: {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /**
   * The small hand-drawn heart the approved design sets beside each of these.
   * It inherits `currentColor`, so it is the same ink as the words it follows
   * and needs no colour of its own at any call site.
   */
  heart?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'font-script pointer-events-none select-none leading-[1.15]',
        size === 'sm' && 'text-[1.125rem] sm:text-[1.375rem]',
        size === 'md' && 'text-[1.375rem] sm:text-[1.75rem]',
        size === 'lg' && 'text-[1.625rem] sm:text-[2.125rem]',
        className,
      )}
    >
      {children}
      {heart ? <HandHeart /> : null}
    </span>
  );
}

/**
 * The doodled heart, drawn rather than imported.
 *
 * `lucide`'s heart is a UI icon — even stroke, geometric curves — and beside a
 * script face it reads as a button that lost its label. This one is an open
 * outline with an uneven weight, which is what the approved design shows.
 */
function HandHeart() {
  return (
    <svg
      viewBox="0 0 24 22"
      className="ml-1.5 inline-block size-[0.7em] align-baseline"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      <path d="M12 20.5C10.5 19 2.5 13.5 2.5 7.8 2.5 4.6 4.9 2.2 8 2.2c2 0 3.3 1 4 2.3.7-1.3 2-2.3 4-2.3 3.1 0 5.5 2.4 5.5 5.6 0 5.7-8 11.2-9.5 12.7Z" />
    </svg>
  );
}
