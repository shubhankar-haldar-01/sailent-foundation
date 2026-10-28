'use client';

import * as React from 'react';
import { TriangleAlert, AlertCircle, Info, Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../primitives/alert-dialog';

export interface ConfirmationDialogProps {
  /** Controlled open state. */
  open?: boolean;
  /** Handler for open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Dialog heading. */
  title: string;
  /** Descriptive message or details explaining the consequence. */
  description: React.ReactNode;
  /** Text for the confirm action button. Defaults to 'Confirm'. */
  confirmLabel?: string;
  /** Text for the cancel action button. Defaults to 'Cancel'. */
  cancelLabel?: string;
  /** Semantic visual style for the action. Defaults to 'primary'. */
  variant?: 'primary' | 'destructive' | 'secondary';
  /** Optional icon or preset ('danger' | 'warning' | 'info'). */
  icon?: 'danger' | 'warning' | 'info' | React.ReactNode;
  /** External loading state (if controlled by caller). */
  loading?: boolean;
  /** Optional trigger element. */
  trigger?: React.ReactNode;
  /** Action called when confirming. Can return a Promise for async loading. */
  onConfirm: () => void | Promise<void>;
  /** Action called when cancelling. */
  onCancel?: () => void;
  /** Disable the confirm button. */
  confirmDisabled?: boolean;
  /** Error message to show inside dialog if the action failed. */
  error?: string | null;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  icon,
  loading: externalLoading,
  trigger,
  onConfirm,
  onCancel,
  confirmDisabled = false,
  error: externalError,
}: ConfirmationDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [internalLoading, setInternalLoading] = React.useState(false);
  const [internalError, setInternalError] = React.useState<string | null>(null);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const isLoading = Boolean(externalLoading || internalLoading);
  const errorMessage = externalError || internalError;
  const closingOnSuccessRef = React.useRef(false);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (isLoading) return; // Prevent closing while action is in-flight
      if (!nextOpen) {
        setInternalError(null);
        if (!closingOnSuccessRef.current) {
          onCancel?.();
        }
        closingOnSuccessRef.current = false;
      }
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isLoading, isControlled, onCancel, onOpenChange],
  );

  const handleConfirm = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isLoading || confirmDisabled) return;

    try {
      setInternalLoading(true);
      setInternalError(null);
      const result = onConfirm();
      if (result instanceof Promise) {
        await result;
      }
      // Successfully completed
      closingOnSuccessRef.current = true;
      handleOpenChange(false);
    } catch (err) {
      setInternalError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    } finally {
      setInternalLoading(false);
    }
  };

  // Determine icon to display
  let iconElement: React.ReactNode = null;
  const resolvedIcon = icon ?? (variant === 'destructive' ? 'danger' : null);

  if (resolvedIcon === 'danger') {
    iconElement = (
      <div
        className="bg-destructive/10 text-destructive flex size-11 shrink-0 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <TriangleAlert className="size-5" />
      </div>
    );
  } else if (resolvedIcon === 'warning') {
    iconElement = (
      <div
        className="bg-warning/15 text-warning flex size-11 shrink-0 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <AlertCircle className="size-5" />
      </div>
    );
  } else if (resolvedIcon === 'info') {
    iconElement = (
      <div
        className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <Info className="size-5" />
      </div>
    );
  } else if (React.isValidElement(resolvedIcon)) {
    iconElement = resolvedIcon;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent className="sm:max-w-[440px]">
        <div className="flex items-start gap-4">
          {iconElement}
          <div className="flex-1 space-y-1.5">
            <AlertDialogHeader className="p-0">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-body-sm text-muted-foreground mt-1.5">{description}</div>
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive text-caption rounded-lg border p-3 font-medium"
          >
            {errorMessage}
          </div>
        ) : null}

        <AlertDialogFooter className="mt-2 sm:gap-2">
          <AlertDialogCancel disabled={isLoading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={variant}
            disabled={isLoading || confirmDisabled}
            onClick={handleConfirm}
            className="min-w-[5.5rem]"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                <span>Working…</span>
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
