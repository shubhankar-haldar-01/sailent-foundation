'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, Save, Send } from 'lucide-react';
import {
  Alert,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sailent/ui';

import {
  requestEmailChange,
  updateDonorProfile,
  verifyEmailChange,
  type DonorActionState,
  type EmailChangeState,
} from '@/lib/donor/actions';
import type { DonorProfile } from '@/lib/donor/api';

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary hover:bg-primary/90 text-primary-foreground focus-visible:outline-ring shadow-xs inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Save className="size-4 stroke-[2]" aria-hidden="true" />
      )}
      <span>{pending ? 'Saving…' : 'Save changes'}</span>
    </button>
  );
}

export function ProfileForm({ profile }: { profile: DonorProfile }) {
  const [state, action] = useActionState<DonorActionState, FormData>(updateDonorProfile, {});

  return (
    <div className="space-y-6">
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

        {/* ──────── Card 2: Your details ──────── */}
        <div className="card-standard rounded-2xl p-6">
          <h2 className="font-display text-foreground text-lg font-bold sm:text-xl">
            Your details
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName" className="text-body-sm text-foreground font-medium">
                First name
              </Label>
              <Input
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                defaultValue={profile.firstName ?? ''}
                className="mt-1.5 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="lastName" className="text-body-sm text-foreground font-medium">
                Last name
              </Label>
              <Input
                id="lastName"
                name="lastName"
                autoComplete="family-name"
                defaultValue={profile.lastName ?? ''}
                className="mt-1.5 rounded-xl"
              />
            </div>
          </div>

          <div className="mt-4">
            <Label htmlFor="email" className="text-body-sm text-foreground font-medium">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              value={profile.email ?? ''}
              readOnly
              aria-describedby="email-help"
              className="bg-muted/40 text-muted-foreground mt-1.5 cursor-not-allowed rounded-xl"
            />
            <p id="email-help" className="text-caption text-muted-foreground mt-1.5">
              Where receipts and sign-in codes are sent. To change it, use the section below.
            </p>
          </div>
        </div>

        {/* ──────── Card 3: Address ──────── */}
        <div className="card-standard rounded-2xl p-6">
          <h2 className="font-display text-foreground text-lg font-bold sm:text-xl">Address</h2>
          <p className="text-body-sm text-muted-foreground mt-0.5">
            Needed on the annual statement of donations if you want 80G relief.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="addressLine1" className="text-body-sm text-foreground font-medium">
                Address
              </Label>
              <Input
                id="addressLine1"
                name="addressLine1"
                autoComplete="address-line1"
                defaultValue={profile.addressLine1 ?? ''}
                placeholder="123 Green Park Colony"
                className="mt-1.5 rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="addressLine2" className="text-body-sm text-foreground font-medium">
                Address line 2 <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="addressLine2"
                name="addressLine2"
                autoComplete="address-line2"
                defaultValue={profile.addressLine2 ?? ''}
                placeholder="Apartment, suite, building (optional)"
                className="mt-1.5 rounded-xl"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="city" className="text-body-sm text-foreground font-medium">
                  City
                </Label>
                <Input
                  id="city"
                  name="city"
                  autoComplete="address-level2"
                  defaultValue={profile.city ?? ''}
                  placeholder="City"
                  className="mt-1.5 rounded-xl"
                />
              </div>

              <div>
                <Label htmlFor="state" className="text-body-sm text-foreground font-medium">
                  State
                </Label>
                <Select name="state" defaultValue={profile.state ?? undefined}>
                  <SelectTrigger id="state" className="mt-1.5 h-11 rounded-xl">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    align="start"
                    sideOffset={4}
                    className="max-h-60"
                  >
                    {INDIAN_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="postalCode" className="text-body-sm text-foreground font-medium">
                  PIN code
                </Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  defaultValue={profile.postalCode ?? ''}
                  placeholder="110016"
                  className="mt-1.5 rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <SaveButton />
          </div>
        </div>
      </form>

      {/* ──────── Card 4: Change your email address ──────── */}
      <EmailChangeCard currentEmail={profile.email} />
    </div>
  );
}

function EmailChangeCard({ currentEmail }: { currentEmail: string | null }) {
  const [requested, request] = useActionState<EmailChangeState, FormData>(requestEmailChange, {});
  const [verified, verify] = useActionState<EmailChangeState, FormData>(verifyEmailChange, {});
  const pending = verified.pendingEmail ?? requested.pendingEmail;

  return (
    <div className="card-standard rounded-2xl p-6">
      <h2 className="font-display text-foreground text-lg font-bold sm:text-xl">
        Change your email address
      </h2>

      {verified.ok ? (
        <div className="mt-4">
          <Alert variant="success" role="status">
            Your email address has been changed.
          </Alert>
        </div>
      ) : null}

      {!pending || verified.ok ? (
        <form action={request} className="mt-4 space-y-4">
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
            <Label htmlFor="newEmail" className="text-body-sm text-foreground font-medium">
              New email address
            </Label>
            <Input
              id="newEmail"
              name="newEmail"
              type="email"
              autoComplete="email"
              placeholder="Enter new email address"
              required
              className="mt-1.5 rounded-xl"
            />
          </div>

          <div>
            <button
              type="submit"
              className="border-primary text-primary hover:bg-primary/10 focus-visible:outline-ring inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold transition-colors focus-visible:outline-2"
            >
              <Send className="size-4 stroke-[2]" aria-hidden="true" />
              <span>Send a code</span>
            </button>
          </div>
        </form>
      ) : (
        <form action={verify} className="mt-4 space-y-4">
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
            <Label htmlFor="emailCode" className="text-body-sm text-foreground font-medium">
              Six-digit code
            </Label>
            <Input
              id="emailCode"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              className="mt-1.5 rounded-xl font-mono text-base tracking-widest"
            />
          </div>
          <div>
            <button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground focus-visible:outline-ring shadow-xs inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors focus-visible:outline-2"
            >
              <span>Confirm the new address</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
