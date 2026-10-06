'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Input } from '@sailent/ui';

import { Field, FormStatus, SubmitButton } from '@/components/admin/form-shell';
import { updateSettings, type ActionState } from '@/lib/admin/actions';
import type { AdminSettings } from '@/lib/admin/api';
import { SOCIAL_NETWORKS } from '@sailent/validation';

/**
 * The organisation settings form.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT EACH SECTION CHANGES (Phase 13). The organisation name, contact
 * details, social links and registration identifiers are what the public site
 * shows (footer, /contact, /about, structured data), and contact-form messages
 * are emailed to the contact email. The registration number is printed on
 * every receipt issued afterwards.
 *
 * TWO SETTINGS STILL GOVERN NOTHING, AND THE FORM SAYS SO.
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

  const contact = settings.organization_contact;
  const registration = settings.registration_details;
  const social = new Map(settings.organization_social.map((link) => [link.label, link.url]));

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
          hint="Shown on the website: the footer, the About page and the site's structured data."
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
        <h2 className="text-h3 font-semibold">Public contact details</h2>
        <p className="text-body-sm text-muted-foreground">
          Shown in the footer of every page and on the contact page. Leave a field blank to leave it
          off the site. Contact-form messages are emailed to the contact email.
        </p>
        <Field label="Contact email" name="contactEmail" errors={state.fieldErrors}>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            defaultValue={contact.email ?? ''}
          />
        </Field>
        <Field label="Press email" name="pressEmail" errors={state.fieldErrors}>
          <Input
            id="pressEmail"
            name="pressEmail"
            type="email"
            defaultValue={contact.pressEmail ?? ''}
          />
        </Field>
        <Field
          label="Phone"
          name="phone"
          errors={state.fieldErrors}
          hint="As it should be displayed, e.g. +91 20 4000 1234."
        >
          <Input id="phone" name="phone" type="tel" defaultValue={contact.phone ?? ''} />
        </Field>
        <Field label="Office hours" name="officeHours" errors={state.fieldErrors}>
          <Input id="officeHours" name="officeHours" defaultValue={contact.officeHours ?? ''} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address line 1" name="addressLine1" errors={state.fieldErrors}>
            <Input
              id="addressLine1"
              name="addressLine1"
              defaultValue={contact.address.line1 ?? ''}
            />
          </Field>
          <Field label="Address line 2" name="addressLine2" errors={state.fieldErrors}>
            <Input
              id="addressLine2"
              name="addressLine2"
              defaultValue={contact.address.line2 ?? ''}
            />
          </Field>
          <Field label="City" name="city" errors={state.fieldErrors}>
            <Input id="city" name="city" defaultValue={contact.address.city ?? ''} />
          </Field>
          <Field label="PIN code" name="postalCode" errors={state.fieldErrors}>
            <Input
              id="postalCode"
              name="postalCode"
              inputMode="numeric"
              defaultValue={contact.address.postalCode ?? ''}
            />
          </Field>
          <Field label="State" name="state" errors={state.fieldErrors}>
            <Input id="state" name="state" defaultValue={contact.address.state ?? ''} />
          </Field>
          <Field label="Country" name="country" errors={state.fieldErrors}>
            <Input id="country" name="country" defaultValue={contact.address.country ?? ''} />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-h3 font-semibold">Social media</h2>
        <p className="text-body-sm text-muted-foreground">
          Full https:// addresses. A blank field is left off the footer and the contact page.
        </p>
        {SOCIAL_NETWORKS.map((label) => (
          <Field key={label} label={label} name={`social_${label}`} errors={state.fieldErrors}>
            <Input
              id={`social_${label}`}
              name={`social_${label}`}
              type="url"
              placeholder="https://"
              defaultValue={social.get(label) ?? ''}
            />
          </Field>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-h3 font-semibold">Statutory registration</h2>
        {/*
          Not cosmetic. The 80G number is what a donor claims tax relief
          against, and a receipt carrying a wrong one is a problem for them
          rather than for us.
        */}
        <Alert>
          These identifiers are shown on the About page, and the registration number is printed on
          every new donation receipt. Leave a field blank if it has not been issued yet — a blank
          reads as “not supplied”, which is accurate, while a placeholder would read as real.
        </Alert>

        <Field
          label="Registered as"
          name="registeredAs"
          errors={state.fieldErrors}
          hint="E.g. Public Charitable Trust."
        >
          <Input
            id="registeredAs"
            name="registeredAs"
            defaultValue={registration.registeredAs ?? ''}
          />
        </Field>
        <Field
          label="Trust deed / registration certificate number"
          name="trustDeedNumber"
          errors={state.fieldErrors}
        >
          <Input
            id="trustDeedNumber"
            name="trustDeedNumber"
            defaultValue={registration.trustDeedNumber ?? ''}
          />
        </Field>
        <Field label="Date of registration" name="registeredOn" errors={state.fieldErrors}>
          <Input
            id="registeredOn"
            name="registeredOn"
            type="date"
            defaultValue={registration.registeredOn ?? ''}
          />
        </Field>

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
        <Field label="CSR-1 registration" name="csr1" errors={state.fieldErrors}>
          <Input id="csr1" name="csr1" defaultValue={registration.csr1 ?? ''} />
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
