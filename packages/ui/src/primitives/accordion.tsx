'use client';

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

import { cn } from '../lib/cn';

type AccordionProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root> & {
  /**
   * `plain` (default): rows divided by a hairline, no box.
   * `list`: the same rows inside ONE bordered card — the FAQ pattern (one
   * card, divided rows, never a box per question).
   */
  variant?: 'plain' | 'list';
};

export const Accordion = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Root>,
  AccordionProps
>(function Accordion({ variant = 'plain', className, ...props }, ref) {
  return (
    <AccordionPrimitive.Root
      ref={ref}
      data-variant={variant}
      className={cn(
        variant === 'list' &&
          'border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border [&>[data-accordion-item]]:border-b-0 [&>[data-accordion-item]]:px-4 sm:[&>[data-accordion-item]]:px-5',
        className,
      )}
      {...(props as React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>)}
    />
  );
});

export const AccordionItem = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(function AccordionItem({ className, ...props }, ref) {
  return (
    <AccordionPrimitive.Item
      ref={ref}
      data-accordion-item=""
      className={cn('border-border border-b', className)}
      {...props}
    />
  );
});

export const AccordionTrigger = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(function AccordionTrigger({ className, children, ...props }, ref) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          'text-body flex flex-1 items-center justify-between gap-4 py-4 text-left font-medium',
          'hover:text-primary duration-(--duration-base) transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2',
          '[&[data-state=open]>svg]:text-primary [&[data-state=open]>svg]:rotate-180',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          className="text-muted-foreground ease-(--ease-out-soft) size-5 shrink-0 transition-transform duration-[250ms] motion-reduce:transition-none"
          aria-hidden="true"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
});

export const AccordionContent = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(function AccordionContent({ className, children, ...props }, ref) {
  return (
    <AccordionPrimitive.Content
      ref={ref}
      className="text-body-sm accordion-motion overflow-hidden"
      {...props}
    >
      <div className={cn('text-muted-foreground pb-4 pt-0', className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
});
