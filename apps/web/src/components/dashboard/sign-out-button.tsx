'use client';

import { useFormStatus } from 'react-dom';
import { LogOut } from 'lucide-react';

import { cn } from '@sailent/ui';

import { signOutDonor } from '@/lib/auth/donor-actions';

/**
 * Logout.
 *
 * A form POST rather than a link, because signing out is a state change and a
 * GET that changes state can be fired by any image tag on any page. The server
 * action revokes the session family at the API as well as dropping the cookie.
 *
 * Red, and set apart from the navigation (design, 2026-10-08): it is the one
 * destructive action in the account.
 */
function Submit({ className }: { className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'text-body-sm text-destructive hover:bg-destructive-subtle focus-visible:outline-ring xl:pointer-coarse:min-h-11 flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 xl:min-h-10',
        className,
      )}
    >
      <LogOut className="size-[1.125rem] shrink-0" aria-hidden="true" />
      {pending ? 'Signing out…' : 'Logout'}
    </button>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOutDonor}>
      <Submit className={className} />
    </form>
  );
}
