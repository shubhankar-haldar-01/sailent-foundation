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
 *   secondary — brand outline;  outline — neutral outline (Login, Cancel)
 *   ghost, destructive, link
 *
 * Shape (owner, 2026-11-21): 8px corners at every size. Sizes sm 36px (44px
 * hit area on touch), md 44px, lg 48px. A press scales to 0.98.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer',
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
         * in dark). The default for every main action that is not Donate.
         */
        primary:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active active:text-primary-active-foreground shadow-xs active:scale-[0.98] motion-reduce:active:scale-100',

        /**
         * ACTION: the orange #EB6A1F with a white label, for Donate and the page's
         * one primary conversion button only. White on it is 3.18:1, below WCAG
         * AA for text, by owner decision (2026-10-23, kept 2026-11-21).
         */
        action:
          'bg-action text-action-foreground hover:bg-action-hover active:bg-action-active shadow-xs active:scale-[0.98] motion-reduce:active:scale-100',

        /**
         * SECONDARY: a brand outline — brand border and text on the surface.
         * Second actions, alternative paths, filters.
         */
        secondary:
          'border border-primary/60 bg-surface text-primary hover:border-primary hover:bg-accent active:bg-accent/80 active:scale-[0.98] motion-reduce:active:scale-100',

        /**
         * OUTLINE: a neutral outline for quiet actions (Login, Cancel, Back).
         */
        outline:
          'border border-border-strong bg-surface text-foreground hover:border-input hover:bg-muted active:bg-muted/80 active:scale-[0.98] motion-reduce:active:scale-100',

        /**
         * GHOST: no fill until hovered. Toolbars, icon triggers, tertiary actions.
         */
        ghost:
          'bg-transparent text-foreground hover:bg-muted active:bg-muted/80 active:scale-[0.98] motion-reduce:active:scale-100',
        /** @deprecated Same as `ghost`. */
        tertiary:
          'bg-transparent text-foreground hover:bg-muted active:bg-muted/80 active:scale-[0.98] motion-reduce:active:scale-100',

        /**
         * DESTRUCTIVE: always confirmation-gated (`ConfirmationDialog`).
         */
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80 shadow-xs active:scale-[0.98] motion-reduce:active:scale-100',

        /**
         * LINK: inline navigation, brand text.
         */
        link: 'bg-transparent text-primary underline-offset-4 hover:underline h-auto px-0',

        /**
         * DARK: on photographs and always-dark grounds.
         */
        dark: 'bg-surface-inverse text-surface-inverse-foreground hover:bg-surface-inverse/90 active:bg-surface-inverse/80 shadow-xs active:scale-[0.98] motion-reduce:active:scale-100',

        /** @deprecated The old trust-blue button; the brand since 2026-11-21. Use `primary`. */
        info: 'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active shadow-xs active:scale-[0.98] motion-reduce:active:scale-100',

        /** @deprecated Use `outline`. */
        subtle:
          'bg-muted text-foreground hover:bg-border active:bg-border/80 active:scale-[0.98] motion-reduce:active:scale-100',
      },
      size: {
        /**
         * Small: 36px, compact contexts. On a touch screen the hit area grows to
         * 44px around it (`touch-target`) without moving the layout.
         */
        sm: 'pointer-coarse:relative pointer-coarse:touch-target h-9 rounded-lg px-3.5 text-sm',

        /** Medium: 44px, the default. */
        md: 'h-11 rounded-lg px-5 text-sm sm:text-[0.9375rem]',

        /** Large: 48px, the page's main action. */
        lg: 'h-12 rounded-lg px-6 text-base',

        /** @deprecated Same as `lg` (one large size, 2026-11-21). */
        xl: 'h-12 rounded-lg px-6 text-base',

        /** Icon only: 44×44px. Give it an `aria-label`. */
        icon: 'size-11 rounded-lg',
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
