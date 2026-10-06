'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Alert, Button, Input, Label } from '@sailent/ui';

import {
  requestEmailChange,
  updateDonorProfile,
  verifyEmailChange,
  type DonorActionState,
  type EmailChangeState,
} from '@/lib/donor/actions';
import type { DonorProfile } from '@/lib/donor/api';

/**
 * Edit the fields a donor owns.
 *
 * A PLAIN FORM POSTING TO A SERVER ACTION. No client-side fetch, so no token
 * reaches JavaScript and the whole thing still works without it — it degrades
 * to a form post and a reload.
 *
 * Validation is the API's. The fields here have the right `type` and
 * `autoComplete` so browsers help, but nothing is enforced client-side and then
 * trusted: the server rejects unknown keys outright and re-checks every value.
 */
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
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  );
}

export function ProfileForm({ profile }: { profile: DonorProfile }) {
  const [state, action] = useActionState<DonorActionState, FormData>(updateDonorProfile, {});

  return (
    <div className="space-y-10">
      <form action={action} className="space-y-6">
        {state.error ? (
          <Alert variant="destructive" role="alert">
            {state.error}
          </Alert>
        ) : null}
        {state.ok ? (
          <Alert variant="success" role="status">
            Your profile has been saved.
          </Alert>
        ) : null}

        <fieldset className="space-y-4">
          <legend className="text-h3 font-semibold">Your name</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                defaultValue={profile.firstName ?? ''}
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                name="lastName"
                autoComplete="family-name"
                defaultValue={profile.lastName ?? ''}
              />
            </div>
          </div>

          {/*
          Read-only here (Phase 12): an address changes only once a code sent to
          the NEW address is entered — the form below the profile.
        */}
          <div>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              value={profile.email ?? ''}
              readOnly
              aria-describedby="email-help"
            />
            <p id="email-help" className="text-caption text-muted-foreground mt-2">
              Where receipts and sign-in codes are sent. To change it, use “Change your email
              address” below.
            </p>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-h3 font-semibold">Address</legend>
          <p className="text-body-sm text-muted-foreground">
            Needed on the annual statement of donations if you want 80G relief.
          </p>

          <div>
            <Label htmlFor="addressLine1">Address</Label>
            <Input
              id="addressLine1"
              name="addressLine1"
              autoComplete="address-line1"
              defaultValue={profile.addressLine1 ?? ''}
            />
          </div>
          <div>
            <Label htmlFor="addressLine2">
              Address line 2 <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="addressLine2"
              name="addressLine2"
              autoComplete="address-line2"
              defaultValue={profile.addressLine2 ?? ''}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                name="city"
                autoComplete="address-level2"
                defaultValue={profile.city ?? ''}
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                name="state"
                autoComplete="address-level1"
                defaultValue={profile.state ?? ''}
              />
            </div>
            <div>
              <Label htmlFor="postalCode">PIN code</Label>
              <Input
                id="postalCode"
                name="postalCode"
                inputMode="numeric"
                autoComplete="postal-code"
                defaultValue={profile.postalCode ?? ''}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-h3 font-semibold">Tax identification</legend>
          <p className="text-body-sm text-muted-foreground">
            We report donations to the Income Tax Department each year on Form 10BD. Without your
            PAN we cannot include you, and the department cannot issue your Form 10BE.
          </p>

          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <div>
              <Label htmlFor="taxIdType">Type</Label>
              {/* A NATIVE select, matching the admin forms. The design system's
                `Select` is a Radix primitive and needs JavaScript to post its
                value; this form is meant to work without it. */}
              <select
                id="taxIdType"
                name="taxIdType"
                defaultValue={profile.taxIdType ?? 'pan'}
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
              <Label htmlFor="taxIdNumber">Number</Label>
              {/*
              The full number is never sent back to the browser (Phase 12): the
              field starts empty, shows the masked number on file, and leaving
              it empty keeps that number.
            */}
              <Input
                id="taxIdNumber"
                name="taxIdNumber"
                defaultValue=""
                placeholder={profile.taxIdNumberMasked ?? ''}
                autoComplete="off"
                spellCheck={false}
                className="uppercase"
                aria-describedby="tax-help"
              />
              <p id="tax-help" className="text-caption text-muted-foreground mt-2">
                {profile.hasTaxId
                  ? `On file: ${profile.taxIdNumberMasked ?? 'yes'}. Leave empty to keep it, or type a new number to replace it. `
                  : ''}
                Stored encrypted and used only for the statutory filing. Never shown publicly.
              </p>
            </div>
          </div>
        </fieldset>

        <Submit />
      </form>

      <EmailChangeForm currentEmail={profile.email} />
    </div>
  );
}

/**
 * Change the account's email address, in two steps (Phase 12): a code is sent
 * to the NEW address, and the address changes only when that code is entered.
 */
function EmailChangeForm({ currentEmail }: { currentEmail: string | null }) {
  const [requested, request] = useActionState<EmailChangeState, FormData>(requestEmailChange, {});
  const [verified, verify] = useActionState<EmailChangeState, FormData>(verifyEmailChange, {});
  const pending = verified.pendingEmail ?? requested.pendingEmail;

  return (
    <section aria-labelledby="change-email" className="border-border space-y-4 border-t pt-8">
      <h2 id="change-email" className="text-h3 font-semibold">
        Change your email address
      </h2>

      {verified.ok ? (
        <Alert variant="success" role="status">
          Your email address has been changed.
        </Alert>
      ) : null}

      {!pending || verified.ok ? (
        <form action={request} className="space-y-3">
          {requested.error ? (
            <Alert variant="destructive" role="alert">
              {requested.error}
            </Alert>
          ) : null}
          <p className="text-body-sm text-muted-foreground">
            We will send a six-digit code to the new address. Your address stays{' '}
            {currentEmail ?? 'as it is'} until you enter it.
          </p>
          <div>
            <Label htmlFor="newEmail">New email address</Label>
            <Input id="newEmail" name="newEmail" type="email" autoComplete="email" required />
          </div>
          <Button type="submit" variant="secondary">
            Send a code
          </Button>
        </form>
      ) : (
        <form action={verify} className="space-y-3">
          {verified.error ? (
            <Alert variant="destructive" role="alert">
              {verified.error}
            </Alert>
          ) : null}
          <p className="text-body-sm text-muted-foreground">
            We sent a code to <strong>{pending}</strong>. Enter it to finish the change.
          </p>
          <input type="hidden" name="newEmail" value={pending} />
          <div>
            <Label htmlFor="emailCode">Six-digit code</Label>
            <Input
              id="emailCode"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
            />
          </div>
          <Button type="submit">Confirm the new address</Button>
        </form>
      )}
    </section>
  );
}
