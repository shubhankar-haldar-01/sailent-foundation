'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '../lib/cn';
import { buttonVariants } from './button';

/**
 * Accessible Alert Dialog built on Radix Dialog primitive with role="alertdialog".
 * Focus is trapped, background is blurred, clicking outside is disabled by default
 * to require explicit user confirmation or cancellation.
 */
export const AlertDialog = DialogPrimitive.Root;
export const AlertDialogTrigger = DialogPrimitive.Trigger;
export const AlertDialogPortal = DialogPrimitive.Portal;

export const AlertDialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function AlertDialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-neutral-950/50 backdrop-blur-[2px]',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        className,
      )}
      {...props}
    />
  );
});

export const AlertDialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(function AlertDialogContent({ className, children, ...props }, ref) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        role="alertdialog"
        onPointerDownOutside={(e) => e.preventDefault()}
        className={cn(
          'bg-surface fixed z-50 flex flex-col gap-4 p-6 shadow-xl',
          'border-border rounded-2xl border',
          'left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
          'duration-200 focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </AlertDialogPortal>
  );
});

export function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-2 text-left sm:text-left', className)} {...props} />;
}

export function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2.5',
        className,
      )}
      {...props}
    />
  );
}

export const AlertDialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function AlertDialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('font-display text-h3 text-foreground font-bold tracking-tight', className)}
      {...props}
    />
  );
});

export const AlertDialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function AlertDialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-body-sm text-muted-foreground leading-relaxed', className)}
      {...props}
    />
  );
});

export const AlertDialogAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'destructive' | 'secondary';
  }
>(function AlertDialogAction({ className, variant = 'primary', ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(buttonVariants({ variant, size: 'sm' }), className)}
      {...props}
    />
  );
});

export const AlertDialogCancel = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(function AlertDialogCancel({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Close
      ref={ref}
      className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), className)}
      {...props}
    />
  );
});
