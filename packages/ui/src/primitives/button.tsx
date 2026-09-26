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
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-medium transition-colors duration-(--duration-fast)',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
  ],
  {
    variants: {
      variant: {
        /**
         * ACTION. Orange, and scarce: donate, volunteer, fundraise, register.
         * A page where three things are orange is a page where nothing is.
         */
        primary:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active shadow-sm',
        /**
         * TRUST AND INFORMATION. Blue: learn more, explore, read, view details.
         * It is a real button, not a lesser one — it simply is not the ask.
         */
        info: 'bg-info-action text-info-action-foreground hover:bg-info-action-hover shadow-sm',
        secondary:
          'border border-border-strong bg-surface text-foreground hover:bg-muted shadow-sm',
        ghost: 'bg-transparent text-foreground hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90 shadow-sm',
        link: 'bg-transparent text-info-action underline underline-offset-4 hover:no-underline',
        subtle: 'bg-secondary text-secondary-foreground hover:bg-muted',
      },
      size: {
        /**
         * Minimum 44px of touch target on every size that appears on a phone.
         * `sm` is 32px tall and is reserved for dense admin tables, where a
         * pointer is the input — it never appears on the public site.
         */
        sm: 'h-8 rounded-full px-3.5 text-body-sm',
        md: 'h-11 rounded-full px-5 text-body-sm',
        lg: 'h-12 rounded-full px-6 text-body',
        xl: 'h-14 rounded-full px-8 text-body-lg',
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
          <Loader2 className="animate-spin" aria-hidden="true" />
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
