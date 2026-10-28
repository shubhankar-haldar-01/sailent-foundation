import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '../lib/cn';

/**
 * Button.
 *
 * Variants map to the CTA hierarchy in docs/design-system.md §5:
 *   primary   — Donate Now, and one main action per view
 *   secondary — Become a Volunteer, secondary actions
 *   ghost     — tertiary, toolbars
 *   destructive — always confirmation-gated
 *   link      — inline navigation
 *
 * Minimum touch target is 44×44px on touch devices, reached through padding
 * rather than by shrinking the label.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2.5 whitespace-nowrap cursor-pointer',
    'font-sans font-semibold transition-all duration-200 ease-out motion-reduce:transition-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2',
    'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
  ],
  {
    variants: {
      variant: {
        /**
         * PRIMARY: Orange background with pure white text.
         * The flagship CTA for Donate Now and primary conversion actions.
         * Background is the brand orange #EB6A1F with white text — 3.18:1, below
         * WCAG AA, by owner decision (2026-10-14; `AGENTS.md` §11).
         * Subtle, soft, warm-toned shadow; darker orange on hover; tactile active press.
         */
        primary:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active active:text-primary-active-foreground shadow-[0_2px_8px_rgba(235,106,31,0.22)] hover:shadow-[0_4px_14px_rgba(235,106,31,0.32)] active:shadow-xs active:translate-y-px motion-reduce:transform-none focus-visible:outline-primary',

        /**
         * SECONDARY: White or transparent background with blue border and blue text.
         * For secondary actions, alternative pathways, filtering.
         * Uses approved info-action trust blue (oklch(0.515 0.155 250), 4.60:1 contrast).
         */
        secondary:
          'border-2 border-info-action bg-surface text-info-action hover:bg-info-action/10 active:bg-info-action/20 active:translate-y-px motion-reduce:transform-none shadow-xs focus-visible:outline-info-action',

        /**
         * TERTIARY / GHOST: Transparent background with navy or blue text; no unnecessary shadow.
         * For quiet actions, toolbars, icon triggers.
         */
        ghost:
          'bg-transparent text-foreground hover:bg-muted active:bg-muted/80 active:translate-y-px motion-reduce:transform-none focus-visible:outline-ring',
        tertiary:
          'bg-transparent text-foreground hover:bg-muted active:bg-muted/80 active:translate-y-px motion-reduce:transform-none focus-visible:outline-ring',

        /**
         * DARK: Deep navy background (#102A43) with white text.
         * Selected contexts only. Contrast 14.4:1 with white.
         */
        dark: 'bg-accent-950 text-white hover:bg-accent-900 active:bg-accent-850 active:translate-y-px motion-reduce:transform-none shadow-sm focus-visible:outline-accent-950 dark:bg-accent-900 dark:hover:bg-accent-850',

        /**
         * DESTRUCTIVE: Semantic destructive token with white text.
         * Never brand orange by default. Confirmation-gated actions.
         */
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/95 active:translate-y-px motion-reduce:transform-none shadow-sm focus-visible:outline-destructive',

        /**
         * INFO: Existing trust-blue button (learn more, explore, read).
         */
        info: 'bg-info-action text-info-action-foreground hover:bg-info-action-hover active:bg-accent-800 active:translate-y-px motion-reduce:transform-none shadow-sm focus-visible:outline-info-action',

        /**
         * LINK: Inline text navigation.
         */
        link: 'bg-transparent text-info-action underline underline-offset-4 hover:no-underline focus-visible:outline-info-action',

        /**
         * SUBTLE: Quiet neutral button.
         */
        subtle:
          'bg-secondary text-secondary-foreground hover:bg-muted active:translate-y-px motion-reduce:transform-none shadow-xs focus-visible:outline-ring',
      },
      size: {
        /**
         * Small: compact contexts (36px height, ~16px horizontal padding).
         */
        sm: 'h-9 rounded-full px-4 text-xs font-semibold sm:text-sm',

        /**
         * Medium: standard interface buttons (44px height, ~24px horizontal padding).
         */
        md: 'h-11 rounded-full px-6 text-sm font-semibold sm:text-[0.9375rem]',

        /**
         * Large: standard primary CTAs (48–52px height, 28–32px horizontal padding, ~16px desktop text).
         */
        lg: 'h-12 rounded-full px-7 text-[0.9375rem] font-semibold sm:h-12.5 sm:px-8 sm:text-base',

        /**
         * Extra Large: prominent hero or landing CTAs (56px height, 36px horizontal padding).
         */
        xl: 'h-14 rounded-full px-9 text-base font-semibold sm:text-lg',

        /**
         * Icon: balanced circular button meeting 44×44px touch target.
         */
        icon: 'size-11 rounded-full',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render as the child element (e.g. a Next.js `<Link>`) instead of `<button>`. */
  asChild?: boolean;
  isLoading?: boolean;
  /** Announced to assistive tech while loading. */
  loadingLabel?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    fullWidth,
    asChild = false,
    isLoading = false,
    loadingLabel = 'Loading',
    disabled,
    children,
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot : 'button';

  // The label is KEPT while loading and the width is locked. A button whose
  // text vanishes into a spinner leaves the user unsure what they clicked.
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={disabled ?? isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <span className="sr-only">{loadingLabel}</span>
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
});

/** Groups related buttons, merging their adjoining edges. */
export function ButtonGroup({
  className,
  orientation = 'horizontal',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      role="group"
      className={cn(
        'inline-flex',
        orientation === 'horizontal'
          ? '[&>*:not(:first-child)]:-ml-px [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none'
          : 'flex-col [&>*:not(:first-child)]:-mt-px [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none',
        className,
      )}
      {...props}
    />
  );
}

export { buttonVariants };
