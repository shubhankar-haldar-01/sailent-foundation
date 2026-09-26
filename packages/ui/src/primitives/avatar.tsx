'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '../lib/cn';

export const Avatar = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & { size?: 'sm' | 'md' | 'lg' | 'xl' }
>(function Avatar({ className, size = 'md', ...props }, ref) {
  const sizes = { sm: 'size-8', md: 'size-10', lg: 'size-12', xl: 'size-20' } as const;
  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        'bg-muted relative flex shrink-0 overflow-hidden rounded-full',
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});

export const AvatarImage = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(function AvatarImage({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Image
      ref={ref}
      className={cn('aspect-square size-full object-cover', className)}
      {...props}
    />
  );
});

export const AvatarFallback = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(function AvatarFallback({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        'bg-muted text-body-sm text-muted-foreground flex size-full items-center justify-center font-medium',
        className,
      )}
      {...props}
    />
  );
});
