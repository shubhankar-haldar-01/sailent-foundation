'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  Alert,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@sailent/ui';

import { correctDonor } from '@/lib/admin/actions';
import type { ActionState } from '@/lib/admin/actions';
import { INDIAN_STATES, STATE_CITIES } from '@/lib/india-locations';
import { useRevealResult } from '@/lib/ui/reveal-result';

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

function Submit({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="md" disabled={pending || disabled}>
      {pending ? 'Saving…' : 'Save correction'}
    </Button>
  );
}

/**
 * Enforce PAN format:
 * - Positions 0-4 (first 5 chars): Letters only [A-Z]
 * - Positions 5-8 (next 4 chars): Numbers only [0-9]
 * - Position 9 (last 1 char): Letter only [A-Z]
 * Max length: 10 chars.
 */
function formatPanInput(raw: string): string {
  const upper = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let result = '';
  for (const char of upper) {
    if (result.length >= 10) break;
    const pos = result.length;
    if (pos < 5) {
      if (/[A-Z]/.test(char)) result += char;
    } else if (pos < 9) {
      if (/[0-9]/.test(char)) result += char;
    } else if (pos === 9) {
      if (/[A-Z]/.test(char)) result += char;
    }
  }
  return result;
}

export function DonorCorrectionForm({ donor }: { donor: CorrectableDonor }) {
  const [state, action] = useActionState<ActionState, FormData>(correctDonor, {});
  const resultRef = useRevealResult(state);

  useEffect(() => {
    if (state.ok && !state.error) {
      toast.success('Record corrected', { description: 'The change is in the audit log.' });
    }
  }, [state]);

  const [pan, setPan] = useState<string>(donor.taxIdNumber ?? '');
  const isPanIncomplete = pan.length > 0 && pan.length < 10;
  const isPanValid = pan.length === 10 && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);

  const handlePanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control/nav keys (backspace, delete, tab, arrows, copy/paste shortcuts, etc.)
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;

    const input = e.currentTarget;
    const start = input.selectionStart ?? pan.length;
    const end = input.selectionEnd ?? pan.length;

    // Character position being inserted/typed
    const pos = start;
    if (pos < 5) {
      if (!/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
      }
    } else if (pos < 9) {
      if (!/^[0-9]$/.test(e.key)) {
        e.preventDefault();
      }
    } else if (pos === 9) {
      if (!/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
      }
    } else if (pos >= 10 && start === end) {
      e.preventDefault();
    }
  };

  const [selectedState, setSelectedState] = useState<string>(donor.state ?? '');
  const [selectedCity, setSelectedCity] = useState<string>(donor.city ?? '');
  const [isCustomCity, setIsCustomCity] = useState<boolean>(() => {
    if (!donor.city) return false;
    if (!donor.state) return true;
    const cities = STATE_CITIES[donor.state] ?? [];
    return !cities.includes(donor.city);
  });

  const availableCities = useMemo(() => {
    if (!selectedState) return [];
    const list = STATE_CITIES[selectedState] ?? [];
    if (donor.city && donor.state === selectedState && !list.includes(donor.city)) {
      return [donor.city, ...list];
    }
    return list;
  }, [selectedState, donor.city, donor.state]);

  const handleStateChange = (newState: string) => {
    setSelectedState(newState);
    setIsCustomCity(false);
    const citiesInNewState = STATE_CITIES[newState] ?? [];
    if (!citiesInNewState.includes(selectedCity)) {
      setSelectedCity('');
    }
  };

  const handleCitySelectChange = (val: string) => {
    if (val === '__custom__') {
      setIsCustomCity(true);
      setSelectedCity('');
    } else {
      setSelectedCity(val);
    }
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="donorId" value={donor.id} />

      {state.error ? (
        <Alert ref={resultRef} variant="destructive" role="alert">
          {state.error}
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" name="firstName" defaultValue={donor.firstName ?? ''} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" name="lastName" defaultValue={donor.lastName ?? ''} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={donor.email ?? ''} />
        {state.fieldErrors?.email ? (
          <p className="text-destructive text-caption">{state.fieldErrors.email}</p>
        ) : null}
      </div>

      <input type="hidden" name="taxIdType" value="pan" />

      <div className="flex flex-col gap-1.5">
        <div className="flex h-5 items-center justify-between">
          <Label htmlFor="taxIdNumber">PAN (permanent account number)</Label>
          <span className="text-caption text-muted-foreground font-mono text-xs">
            {pan.length}/10
          </span>
        </div>
        <Input
          id="taxIdNumber"
          name="taxIdNumber"
          value={pan}
          onChange={(e) => setPan(formatPanInput(e.target.value))}
          onKeyDown={handlePanKeyDown}
          placeholder="e.g. ABCDE1234F"
          maxLength={10}
          autoComplete="off"
          spellCheck={false}
          pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}"
          title="PAN must be 5 letters followed by 4 numbers and 1 letter (e.g. ABCDE1234F)"
          hasError={isPanIncomplete || Boolean(state.fieldErrors?.taxIdNumber)}
          className="font-mono uppercase tracking-wider"
        />
        {state.fieldErrors?.taxIdNumber ? (
          <p className="text-destructive text-caption">{state.fieldErrors.taxIdNumber}</p>
        ) : isPanIncomplete ? (
          <p className="text-caption text-warning-foreground">
            {pan.length < 5
              ? `First 5 characters must be letters (${5 - pan.length} more needed)`
              : pan.length < 9
                ? `Next 4 characters must be numbers (${9 - pan.length} more needed)`
                : 'Last character must be a letter'}
          </p>
        ) : isPanValid ? (
          <p className="text-caption text-success font-medium">
            ✓ Valid PAN format (5 letters, 4 numbers, 1 letter)
          </p>
        ) : (
          <p className="text-caption text-muted-foreground">
            10-digit alphanumeric permanent account number (5 letters, 4 numbers, 1 letter).
            Required for Form 10BD/10BE filing.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="addressLine1">Address</Label>
        <Input id="addressLine1" name="addressLine1" defaultValue={donor.addressLine1 ?? ''} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex h-5 items-center justify-between">
            <Label htmlFor="state">State</Label>
          </div>
          <Select name="state" value={selectedState || undefined} onValueChange={handleStateChange}>
            <SelectTrigger id="state">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" align="start" className="max-h-72">
              {donor.state &&
              !INDIAN_STATES.includes(donor.state as (typeof INDIAN_STATES)[number]) ? (
                <SelectItem value={donor.state}>{donor.state}</SelectItem>
              ) : null}
              {INDIAN_STATES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex h-5 items-center justify-between">
            <Label htmlFor="city">City</Label>
            {selectedState ? (
              <button
                type="button"
                onClick={() => {
                  setIsCustomCity((prev) => !prev);
                  if (!isCustomCity) {
                    setSelectedCity('');
                  }
                }}
                className="text-primary text-xs hover:underline"
              >
                {isCustomCity ? 'Choose from list' : 'Enter manually'}
              </button>
            ) : null}
          </div>
          {isCustomCity ? (
            <Input
              id="city"
              name="city"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              placeholder="Enter city or town name"
            />
          ) : (
            <Select
              name="city"
              value={selectedCity || undefined}
              disabled={!selectedState}
              onValueChange={handleCitySelectChange}
            >
              <SelectTrigger id="city">
                <SelectValue placeholder={selectedState ? 'Select city' : 'Select state first'} />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" className="max-h-72">
                {availableCities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
                <SelectItem value="__custom__">+ Other (Enter manually)</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex h-5 items-center justify-between">
            <Label htmlFor="postalCode">PIN code</Label>
          </div>
          <Input
            id="postalCode"
            name="postalCode"
            defaultValue={donor.postalCode ?? ''}
            placeholder="e.g. 110016"
            maxLength={6}
          />
        </div>
      </div>

      <div className="border-border border-t pt-4">
        <div className="flex flex-col gap-1.5">
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
          <p id="reason-help" className="text-caption text-muted-foreground">
            Goes into the audit log with the before and after values.
          </p>
        </div>
      </div>

      <Submit disabled={isPanIncomplete} />
    </form>
  );
}
