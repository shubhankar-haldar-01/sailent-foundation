import type { Metadata } from 'next';
import { Card, CardContent } from '@sailent/ui';
import { UserCheck } from 'lucide-react';

import { StaffPasswordForm } from '@/components/admin/staff-password-form';

export const metadata: Metadata = { title: 'Accept your invitation — Sailent Foundation' };

/** Reached from an emailed link; the token is in the fragment (Phase 13). */
export default function AcceptInvitePage() {
  return (
    <main className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="bg-primary/10 text-primary mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl">
            <UserCheck className="h-6 w-6" />
          </div>
          <h1 className="font-display text-foreground text-2xl font-bold tracking-tight">
            Accept your invitation
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Choose a secure password to activate your staff administrator account.
          </p>
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-8">
            <StaffPasswordForm mode="invite" />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
