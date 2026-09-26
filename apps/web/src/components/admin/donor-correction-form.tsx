'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Alert, Button, Card, Input, Label } from '@sailent/ui';

import { correctDonor } from '@/lib/admin/actions';
import type { ActionState } from '@/lib/admin/actions';

/**
 * Correct a donor record.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE REASON FIELD IS MANDATORY AND IS THE POINT.
 *
 * Correcting somebody else's record is the kind of act that gets questioned a
 * year later — by a trustee, by an auditor, or by the donor. A sentence written
 * at the time answers it better than any category chosen from a dropdown, and
 * it goes straight into the audit row alongside the before/after diff.
 *
 * The API enforces this too. The field is required here so the person typing
 * knows it before they submit, not required only here.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * WHAT IS ABSENT: lifetime totals, donation count, donor code and phone number.
 * They are server-controlled and the API rejects them outright. A form that
 * offered them and then failed would imply the restriction was arbitrary.
 */
interface CorrectableDonor {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  taxIdType?: string | null;
  taxIdNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  internalNotes?: string | null;
  id: string;
}

const TAX_ID_TYPES = [
  { value: 'pan', label: 'PAN' },
  { value: 'aadhaar', label: 'Aadhaar' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_licence', label: 'Driving licence' },
  { value: 'voter_id', label: 'Voter ID' },
  { value: 'foreign_tin', label: 'Foreign TIN' },
] as const;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="md" disabled={pending}>
      {pending ? 'Saving…' : 'Save correction'}
    </Button>
  );
}

export function DonorCorrectionForm({ donor }: { donor: CorrectableDonor }) {
  const [state, action] = useActionState<ActionState, FormData>(correctDonor, {});

  return (
    <section aria-labelledby="correct-heading">
      <h2 id="correct-heading" className="text-h3 font-semibold">
        Correct this record
      </h2>
      <p className="text-body-sm text-muted-foreground mt-1">
        For transcription errors — a misspelled name, a bounced email, a mistyped PAN. Every change
        is audited with the reason you give. This needs a recent re-authentication.
      </p>

      <Card className="mt-3 p-5">
        <form action={action} className="space-y-4">
          <input type="hidden" name="donorId" value={donor.id} />

          {state.error ? (
            <Alert variant="destructive" role="alert">
              {state.error}
            </Alert>
          ) : null}
          {state.ok ? (
            <Alert variant="success" role="status">
              The record has been corrected and the change audited.
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" defaultValue={donor.firstName ?? ''} />
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" defaultValue={donor.lastName ?? ''} />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={donor.email ?? ''} />
          </div>

          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <div>
              <Label htmlFor="taxIdType">Tax id type</Label>
              <select
                id="taxIdType"
                name="taxIdType"
                defaultValue={donor.taxIdType ?? 'pan'}
                className="border-input bg-surface text-body-sm h-10 w-full rounded-md border px-3"
              >
                {TAX_ID_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="taxIdNumber">Tax id number</Label>
              <Input
                id="taxIdNumber"
                name="taxIdNumber"
                defaultValue={donor.taxIdNumber ?? ''}
                autoComplete="off"
                spellCheck={false}
                className="uppercase"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="addressLine1">Address</Label>
            <Input id="addressLine1" name="addressLine1" defaultValue={donor.addressLine1 ?? ''} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={donor.city ?? ''} />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" defaultValue={donor.state ?? ''} />
            </div>
            <div>
              <Label htmlFor="postalCode">PIN code</Label>
              <Input id="postalCode" name="postalCode" defaultValue={donor.postalCode ?? ''} />
            </div>
          </div>

          <div>
            <Label htmlFor="internalNotes">Internal notes</Label>
            <textarea
              id="internalNotes"
              name="internalNotes"
              rows={3}
              defaultValue={donor.internalNotes ?? ''}
              className="border-input bg-surface text-body-sm w-full rounded-md border px-3 py-2"
            />
            <p className="text-caption text-muted-foreground mt-1">
              Staff only. Never returned to the donor by any donor-facing route.
            </p>
          </div>

          <div className="border-border border-t pt-4">
            <Label htmlFor="reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Input
              id="reason"
              name="reason"
              required
              minLength={5}
              placeholder="Donor called to correct a typo in their surname"
              aria-describedby="reason-help"
            />
            <p id="reason-help" className="text-caption text-muted-foreground mt-1">
              Goes into the audit log with the before and after values.
            </p>
          </div>

          <Submit />
        </form>
      </Card>
    </section>
  );
}
