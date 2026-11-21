import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn';
import { ButtonWidthLock } from './button-width-lock';
import { Spinner } from './spinner';

/**
 * Button.
 *
 * Colour roles (owner, 2026-11-21; `AGENTS.md` §11 item 12):
 *   action    — orange: Donate, and the page's one primary conversion button
 *   primary   — the brand green: the default, every other main action
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
    // One focus ring for every variant: the base layer's 2px brand outline.
    'focus-visible:outline-2 focus-visible:outline-offset-2',
    'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
    // While loading, the spinner takes the place of the button's own icon, so
    // a button that keeps its label keeps its width exactly (docs/ui-feedback.md).
    'aria-busy:[&>svg:not([data-slot=spinner])]:hidden',
  ],
  {
    variants: {
      variant: {
        /**
         * PRIMARY: the brand green with its label (white in light mode, near-black
         * in dark). The default. Darker on hover; a press settles it.
         */
        primary:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active active:text-primary-active-foreground shadow-xs active:translate-y-px motion-reduce:transform-none',

        /**
         * ACTION: the orange #EB6A1F with a white label, for Donate and the page's
         * one primary conversion button only. White on it is 3.18:1, below WCAG
         * AA for text, by owner decision (2026-10-23, kept 2026-11-21).
         */
        action:
          'bg-action text-action-foreground hover:bg-action-hover active:bg-action-active shadow-xs active:translate-y-px motion-reduce:transform-none',

        /**
         * SECONDARY: surface background with a brand border and brand text.
         * For secondary actions, alternative pathways, filtering. (`info-action`
         * is the brand since 2026-11-21; Phase 3 renames it.)
         */
        secondary:
          'border-2 border-info-action bg-surface text-info-action hover:bg-info-action/10 active:bg-info-action/20 active:translate-y-px motion-reduce:transform-none shadow-xs',

        /**
         * TERTIARY / GHOST: Transparent background with navy or blue text; no unnecessary shadow.
         * For quiet actions, toolbars, icon triggers.
         */
        ghost:
          'bg-transparent text-foreground hover:bg-muted active:bg-muted/80 active:translate-y-px motion-reduce:transform-none',
        tertiary:
          'bg-transparent text-foreground hover:bg-muted active:bg-muted/80 active:translate-y-px motion-reduce:transform-none',

        /**
         * DARK: near-black neutral background with white text.
         * Selected contexts only.
         */
        dark: 'bg-surface-inverse text-surface-inverse-foreground hover:bg-surface-inverse/90 active:bg-surface-inverse/80 active:translate-y-px motion-reduce:transform-none shadow-sm',

        /**
         * DESTRUCTIVE: Semantic destructive token with white text.
         * Never brand orange by default. Confirmation-gated actions.
         */
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/95 active:translate-y-px motion-reduce:transform-none shadow-sm',

        /**
         * INFO: Existing trust-blue button (learn more, explore, read).
         */
        info: 'bg-info-action text-info-action-foreground hover:bg-info-action-hover active:bg-primary-active active:translate-y-px motion-reduce:transform-none shadow-sm',

        /**
         * LINK: Inline text navigation.
         */
        link: 'bg-transparent text-info-action underline underline-offset-4 hover:no-underline',

        /**
         * SUBTLE: Quiet neutral button.
         */
        subtle:
          'bg-secondary text-secondary-foreground hover:bg-muted active:translate-y-px motion-reduce:transform-none shadow-xs',
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
  /**
   * Shows the spinner and disables the button. Set it on the FIRST click, so a
   * second click cannot submit twice.
   */
  isLoading?: boolean;
  /** Announced to assistive tech while loading. */
  loadingLabel?: string;
  /** Shown instead of the label while loading, e.g. "Saving…". Defaults to the label. */
  loadingText?: React.ReactNode;
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
    loadingText,
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
      disabled={isLoading || disabled}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {/* Holds the width while loading; see button-width-lock.tsx. */}
          <ButtonWidthLock active={isLoading} />
          {isLoading ? (
            <>
              <Spinner label={loadingLabel} />
              {loadingText ?? children}
            </>
          ) : (
            children
          )}
        </>
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
