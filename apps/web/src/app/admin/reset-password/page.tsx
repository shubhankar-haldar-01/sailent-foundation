import type { Metadata } from 'next';

import { StaffPasswordForm } from '@/components/admin/staff-password-form';

export const metadata: Metadata = { title: 'Choose a new password' };

/** Reached from an emailed link; the token is in the fragment (Phase 13). */
export default function ResetPasswordPage() {
  return (
    <main className="bg-surface-sunken grid min-h-dvh place-items-center px-4 py-12">
      <div className="bg-surface border-border w-full max-w-sm rounded-xl border p-7 shadow-sm">
        <h1 className="font-display text-h2 font-bold tracking-tight">Choose a new password</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Setting a new password signs out every session on this account.
        </p>
        <div className="mt-7">
          <StaffPasswordForm mode="reset" />
        </div>
      </div>
    </main>
  );
}
