import type { Metadata } from 'next';
import { Card, CardContent } from '@sailent/ui';
import { KeyRound } from 'lucide-react';

import { StaffPasswordForm } from '@/components/admin/staff-password-form';

export const metadata: Metadata = { title: 'Choose a new password — Sailent Foundation' };

/** Reached from an emailed link; the token is in the fragment (Phase 13). */
export default function ResetPasswordPage() {
  return (
    <main className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="bg-primary/10 text-primary mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="font-display text-foreground text-2xl font-bold tracking-tight">
            Choose a new password
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Setting a new password securely revokes all active sessions on this staff account.
          </p>
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-8">
            <StaffPasswordForm mode="reset" />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
