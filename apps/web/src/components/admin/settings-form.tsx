'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Input } from '@sailent/ui';

import { Field, FormStatus, SubmitButton } from '@/components/admin/form-shell';
import { updateSettings, type ActionState } from '@/lib/admin/actions';
import type { AdminSettings } from '@/lib/admin/api';

/**
 * The organisation settings form.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO OF THESE FOUR SETTINGS CURRENTLY GOVERN NOTHING, AND THE FORM SAYS SO.
 *
 * A settings screen carries an implicit promise: change this, and behaviour
 * changes. For `donation_minimum_paise` and `fcra_enabled` that promise would
 * be false — nothing in the application reads either row. An administrator who
 * sets a minimum and watches a smaller donation succeed has been misled by the
 * screen, not by the donation flow.
 *
 * So the minimum is editable and labelled as not yet enforced, and FCRA is
 * shown read-only. Wiring either up means changing the donation flow, which is
 * a different piece of work — and for FCRA a legal question first, since the
 * organisation is not registered and accepting a foreign contribution without
 * registration is unlawful rather than merely unbuilt.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function SettingsForm({ settings }: { settings: AdminSettings }) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(updateSettings, {});
  const router = useRouter();

  React.useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={action} className="max-w-2xl space-y-8">
      <FormStatus state={state} />

      <section className="space-y-4">
        <h2 className="text-h3 font-semibold">Organisation</h2>
        <Field
          label="Organisation name"
          name="organization_name"
          required
          errors={state.fieldErrors}
          hint="Appears on every receipt, in email, and in page metadata."
        >
          <Input
            id="organization_name"
            name="organization_name"
            defaultValue={settings.organization_name}
            required
          />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-h3 font-semibold">Statutory registration</h2>
        {/*
          Not cosmetic. The 80G number is what a donor claims tax relief
          against, and a receipt carrying a wrong one is a problem for them
          rather than for us.
        */}
        <Alert>
          These identifiers are printed on donation receipts. Leave a field blank if it has not been
          issued yet — a blank reads as “not supplied”, which is accurate, while a placeholder would
          read as real.
        </Alert>

        <Field label="Registration number" name="registrationNumber" errors={state.fieldErrors}>
          <Input
            id="registrationNumber"
            name="registrationNumber"
            defaultValue={settings.registration_details.registrationNumber ?? ''}
          />
        </Field>
        <Field
          label="PAN"
          name="pan"
          errors={state.fieldErrors}
          hint="Ten characters, in the form AAAAA9999A."
        >
          <Input
            id="pan"
            name="pan"
            defaultValue={settings.registration_details.pan ?? ''}
            maxLength={10}
            className="uppercase"
            autoCapitalize="characters"
          />
        </Field>
        <Field label="Section 12A registration" name="section12A" errors={state.fieldErrors}>
          <Input
            id="section12A"
            name="section12A"
            defaultValue={settings.registration_details.section12A ?? ''}
          />
        </Field>
        <Field label="Section 80G registration" name="section80G" errors={state.fieldErrors}>
          <Input
            id="section80G"
            name="section80G"
            defaultValue={settings.registration_details.section80G ?? ''}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-h3 font-semibold">Donations</h2>
        <Field
          label="Minimum donation (paise)"
          name="donation_minimum_paise"
          errors={state.fieldErrors}
          hint="Whole paise — 1000 is ₹10. NOT YET ENFORCED: nothing in the donation flow reads this value, so changing it does not currently reject smaller donations."
        >
          <Input
            id="donation_minimum_paise"
            name="donation_minimum_paise"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            defaultValue={settings.donation_minimum_paise}
          />
        </Field>

        <Field
          label="Foreign contributions (FCRA)"
          name="fcra_enabled"
          hint="Read-only. The organisation is not FCRA-registered, and no code reads this value — the donation flow flags foreign instruments for review regardless. Enabling foreign contributions is a registration question before it is a settings one."
        >
          <Input
            id="fcra_enabled"
            name="fcra_enabled_display"
            value={settings.fcra_enabled ? 'Enabled' : 'Not enabled'}
            disabled
            readOnly
          />
        </Field>
      </section>

      <section className="space-y-4">
        <Field
          label="Reason for this change"
          name="reason"
          errors={state.fieldErrors}
          hint="Optional, and recorded on the audit entry. Who changed it is not the same as why."
        >
          <Input id="reason" name="reason" minLength={3} />
        </Field>

        <SubmitButton pending={pending}>Save settings</SubmitButton>
      </section>
    </form>
  );
}
