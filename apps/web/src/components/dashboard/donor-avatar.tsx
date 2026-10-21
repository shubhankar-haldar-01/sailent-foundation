'use client';

import * as React from 'react';
import { cn } from '@sailent/ui';

import { initialsOf } from './format';

/**
 * The donor's avatar: a profile photo when set, or their initials on a disc.
 */
export function DonorAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  const [errored, setErrored] = React.useState(false);

  React.useEffect(() => {
    setErrored(false);
  }, [src]);

  if (src && !errored) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'bg-muted relative inline-flex shrink-0 overflow-hidden rounded-full',
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          onError={() => setErrored(true)}
          className="size-full rounded-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-success text-success-foreground grid shrink-0 place-items-center rounded-full font-semibold',
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
