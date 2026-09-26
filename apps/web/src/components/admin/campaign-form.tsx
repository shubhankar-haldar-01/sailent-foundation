'use client';

import * as React from 'react';

import { Input, Label } from '@sailent/ui';

import { Field, FormStatus, SubmitButton, TextArea } from '@/components/admin/form-shell';
import { createCampaign, updateCampaign, type ActionState } from '@/lib/admin/actions';
import type { AdminCategory, AdminProgram } from '@/lib/admin/api';

/** Paise on the wire, rupees in the form. Converted at this one boundary. */
function toRupees(paise: number | undefined): string {
  if (paise === undefined || paise === null) return '';
  return String(paise / 100);
}

function toDateInput(value: string | null | undefined): string {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

export function CampaignForm({
  programs,
  categories,
  campaign,
}: {
  programs: AdminProgram[];
  categories: AdminCategory[];
  campaign?: {
    id: string;
    title: string;
    slug: string;
    shortDescription: string | null;
    description: string | null;
    beneficiaryContext: string | null;
    fundUtilization: string | null;
    internalNotes: string | null;
    programId: string | null;
    categoryId: string | null;
    location: string | null;
    state: string | null;
    fundraisingGoal: number;
    beneficiaryTarget: number | null;
    startDate: string | null;
    endDate: string | null;
    amountRaised: number;
  };
}) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    campaign ? updateCampaign : createCampaign,
    {},
  );

  return (
    <form action={action} className="max-w-2xl space-y-5">
      {campaign ? <input type="hidden" name="id" value={campaign.id} /> : null}
      <FormStatus state={state} />

      <Field label="Title" name="title" errors={state.fieldErrors} required>
        <Input id="title" name="title" defaultValue={campaign?.title} required />
      </Field>

      <Field
        label="URL"
        name="slug"
        errors={state.fieldErrors}
        hint={
          campaign
            ? 'Changing this leaves a permanent redirect behind, so posters and existing links keep working.'
            : 'Left blank, this is generated from the title.'
        }
      >
        <Input id="slug" name="slug" defaultValue={campaign?.slug} />
      </Field>

      <div className="space-y-1.5">
        <Label htmlFor="programId">Program</Label>
        <select
          id="programId"
          name="programId"
          defaultValue={campaign?.programId ?? ''}
          className="border-input bg-surface text-body-sm h-10 w-full rounded-md border px-3"
        >
          <option value="">Not attached yet</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.title}
            </option>
          ))}
        </select>
        <p className="text-caption text-muted-foreground">
          Required before publishing — a campaign funds a specific piece of a program.
        </p>
        {state.fieldErrors?.programId ? (
          <p className="text-caption text-destructive">{state.fieldErrors.programId}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="categoryId">Category</Label>
        <select
          id="categoryId"
          name="categoryId"
          defaultValue={campaign?.categoryId ?? ''}
          className="border-input bg-surface text-body-sm h-10 w-full rounded-md border px-3"
        >
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <Field
        label="Short description"
        name="shortDescription"
        errors={state.fieldErrors}
        hint="Appears on every card. Required before publishing."
      >
        <TextArea
          name="shortDescription"
          rows={3}
          defaultValue={campaign?.shortDescription}
          errors={state.fieldErrors}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Fundraising goal (₹)"
          name="fundraisingGoal"
          errors={state.fieldErrors}
          hint={
            campaign && campaign.amountRaised > 0
              ? `Cannot be set below the ₹${(campaign.amountRaised / 100).toLocaleString('en-IN')} already raised.`
              : 'Required above zero before publishing.'
          }
        >
          <Input
            id="fundraisingGoal"
            name="fundraisingGoal"
            type="number"
            min={1}
            step="1"
            inputMode="numeric"
            defaultValue={toRupees(campaign?.fundraisingGoal)}
          />
        </Field>

        <Field label="Beneficiary target" name="beneficiaryTarget" errors={state.fieldErrors}>
          <Input
            id="beneficiaryTarget"
            name="beneficiaryTarget"
            type="number"
            min={0}
            defaultValue={campaign?.beneficiaryTarget ?? ''}
          />
        </Field>

        <Field label="Location" name="location" errors={state.fieldErrors}>
          <Input id="location" name="location" defaultValue={campaign?.location ?? ''} />
        </Field>

        <Field label="State" name="state" errors={state.fieldErrors}>
          <Input id="state" name="state" defaultValue={campaign?.state ?? ''} />
        </Field>

        <Field label="Start date" name="startDate" errors={state.fieldErrors}>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={toDateInput(campaign?.startDate)}
          />
        </Field>

        <Field
          label="End date"
          name="endDate"
          errors={state.fieldErrors}
          hint="Leave blank if there is no real deadline."
        >
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={toDateInput(campaign?.endDate)}
          />
        </Field>
      </div>

      {campaign ? (
        <>
          <Field label="The story" name="description" errors={state.fieldErrors}>
            <TextArea name="description" rows={8} defaultValue={campaign.description} />
          </Field>
          <Field label="Who it serves" name="beneficiaryContext" errors={state.fieldErrors}>
            <TextArea
              name="beneficiaryContext"
              rows={3}
              defaultValue={campaign.beneficiaryContext}
            />
          </Field>
          <Field
            label="How funds are used"
            name="fundUtilization"
            errors={state.fieldErrors}
            hint="Shown publicly. Donors read this one."
          >
            <TextArea name="fundUtilization" rows={4} defaultValue={campaign.fundUtilization} />
          </Field>
          <Field
            label="Internal notes"
            name="internalNotes"
            errors={state.fieldErrors}
            hint="Never shown publicly — the public API strips this field."
          >
            <TextArea name="internalNotes" rows={3} defaultValue={campaign.internalNotes} />
          </Field>
        </>
      ) : null}

      <SubmitButton pending={pending}>{campaign ? 'Save changes' : 'Create campaign'}</SubmitButton>
    </form>
  );
}
