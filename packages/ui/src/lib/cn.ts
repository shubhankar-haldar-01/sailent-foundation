import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Class merging, taught about this project's custom scales.
 *
 * WHY THE EXTENSION IS REQUIRED — this is not optional tuning.
 *
 * tailwind-merge resolves conflicts by classifying each utility into a group.
 * Out of the box it only knows Tailwind's DEFAULT scales, so it classifies
 * `text-body-lg` (our font size) as a text COLOUR, decides it conflicts with
 * `text-primary-foreground`, and silently drops the colour — because in a merge
 * the later class wins.
 *
 * The symptom is a button that renders with the right background and the wrong
 * text colour, with no error anywhere. It was caught here by an automated
 * contrast check on the Donate button, which measured 2.42:1 against a required
 * 4.5:1. Any custom scale added to `tokens.css` must be declared below, or the
 * same class of bug returns.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // Font sizes from the `--text-*` namespace in tokens.css.
      'font-size': [
        {
          text: [
            'display-lg',
            'display',
            'h1',
            'h2',
            'h3',
            'h4',
            'body-lg',
            'body',
            'body-sm',
            'caption',
            'overline',
          ],
        },
      ],
      // Semantic colours from the `--color-*` namespace.
      'text-color': [
        {
          text: [
            'foreground',
            'muted-foreground',
            'surface-foreground',
            'primary',
            'primary-foreground',
            'secondary-foreground',
            'accent-foreground',
            'success',
            'success-foreground',
            'warning',
            'warning-foreground',
            'destructive',
            'destructive-foreground',
            'info',
            'info-foreground',
          ],
        },
      ],
      'bg-color': [
        {
          bg: [
            'background',
            'surface',
            'surface-raised',
            'surface-sunken',
            'muted',
            'primary',
            'primary-hover',
            'secondary',
            'accent',
            'success',
            'success-subtle',
            'warning',
            'warning-subtle',
            'destructive',
            'destructive-subtle',
            'info',
            'info-subtle',
          ],
        },
      ],
      'border-color': [{ border: ['border', 'border-strong', 'input', 'primary', 'destructive'] }],
    },
  },
});

/**
 * Merge class names, with later Tailwind utilities winning over earlier ones.
 * Every component takes `className` and merges through this, so a caller can
 * always override without fighting specificity.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
