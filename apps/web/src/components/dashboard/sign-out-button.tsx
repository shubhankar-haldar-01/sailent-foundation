'use client';

import { useFormStatus } from 'react-dom';
import { LogOut } from 'lucide-react';

import { Button } from '@sailent/ui';

import { signOutDonor } from '@/lib/auth/donor-actions';

/**
 * Sign out.
 *
 * A form POST rather than a link, because signing out is a state change and a
 * GET that changes state can be fired by any image tag on any page. The server
 * action revokes the session family at the API as well as dropping the cookie.
 */
function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="md" className="w-full" disabled={pending}>
      <LogOut className="size-4" aria-hidden="true" />
      {pending ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}

export function SignOutButton() {
  return (
    <form action={signOutDonor}>
      <Submit />
    </form>
  );
}
