'use client';

import * as React from 'react';

import { Alert, Input, Label } from '@sailent/ui';

import { Field, FormStatus, SubmitButton, TextArea } from '@/components/admin/form-shell';
import { createImpactRecord, updateImpactRecord, type ActionState } from '@/lib/admin/actions';
import type { AdminCampaign, AdminEvent, AdminImpactRecord, AdminProgram } from '@/lib/admin/api';

/**
 * Record an impact.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE FORM ENFORCES DECISION A14 BY SHOWING THE CONSEQUENCE BEFORE THE SAVE.
 *
 * "Every public statistic must trace to a database aggregate or a dated,
 * sourced impact record." These rows ARE the sourced records, and the API
 * refuses to publish one that claims a figure with no stated method.
 *
 * Refusing at publish is correct — a draft should be writable before the count
 * comes back from the field — but an editor who fills in a number, saves, and
 * then finds they cannot publish has learned the rule the slow way. So the
 * moment a figure is typed, this form says what will be required. The rule is
 * still enforced server-side; this only stops it being a surprise.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function ImpactForm({
  record,
  programs,
  campaigns,
  events,
}: {
  record?: AdminImpactRecord;
  programs: AdminProgram[];
  campaigns: AdminCampaign[];
  events: AdminEvent[];
}) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    record ? updateImpactRecord : createImpactRecord,
    {},
  );

  const [claimsFigure, setClaimsFigure] = React.useState(
    record?.metricValue !== null && record?.metricValue !== undefined,
  );
  const [hasMethod, setHasMethod] = React.useState(Boolean(record?.verificationMethod));

  return (
    <form action={action} className="max-w-2xl space-y-5">
      {record ? <input type="hidden" name="id" value={record.id} /> : null}
      <FormStatus state={state} />

      <Field label="Title" name="title" errors={state.fieldErrors} required>
        <Input id="title" name="title" defaultValue={record?.title} required />
      </Field>

      <Field
        label="URL"
        name="slug"
        errors={state.fieldErrors}
        hint={
          record
            ? 'Changing this redirects the old address permanently. Annual reports cite these.'
            : 'Left blank, this is made from the title.'
        }
      >
        <Input id="slug" name="slug" defaultValue={record?.slug} />
      </Field>

      <Field
        label="What happened"
        name="description"
        errors={state.fieldErrors}
        required
        hint="A blank line starts a new paragraph."
      >
        <TextArea
          name="description"
          defaultValue={record?.description}
          rows={7}
          errors={state.fieldErrors}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Date reported on"
          name="impactDate"
          errors={state.fieldErrors}
          required
          hint="The day the work happened, not the day you are writing this."
        >
          <Input
            id="impactDate"
            name="impactDate"
            type="date"
            defaultValue={record?.impactDate ?? ''}
            required
          />
        </Field>
        <Field label="Location" name="location" errors={state.fieldErrors}>
          <Input id="location" name="location" defaultValue={record?.location ?? ''} />
        </Field>
      </div>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-body-sm px-1 font-medium">What this belongs to</legend>
        <p className="text-caption text-muted-foreground">
          At least one. An update attached to nothing cannot be attributed, and the database refuses
          it. A record filed against a campaign also rolls up to that campaign’s programme
          automatically.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="campaignId">Campaign</Label>
          <select
            id="campaignId"
            name="campaignId"
            defaultValue={record?.campaignId ?? ''}
            className="border-input bg-surface text-body-sm h-10 w-full rounded-md border px-3"
          >
            <option value="">None</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="programId">Programme</Label>
          <select
            id="programId"
            name="programId"
            defaultValue={record?.programId ?? ''}
            className="border-input bg-surface text-body-sm h-10 w-full rounded-md border px-3"
          >
            <option value="">None</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="eventId">Event</Label>
          <select
            id="eventId"
            name="eventId"
            defaultValue={record?.eventId ?? ''}
            className="border-input bg-surface text-body-sm h-10 w-full rounded-md border px-3"
          >
            <option value="">None</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
          <p className="text-caption text-muted-foreground">
            Use this on its own for figures that belong to the activity rather than to whatever
            funded it — a camp’s patients seen are the camp’s.
          </p>
        </div>
      </fieldset>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-body-sm px-1 font-medium">The headline figure</legend>
        <p className="text-caption text-muted-foreground">
          Optional. A narrative update with no number publishes without any of this.
        </p>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="What is counted" name="metricType" errors={state.fieldErrors}>
            <Input
              id="metricType"
              name="metricType"
              defaultValue={record?.metricType ?? ''}
              placeholder="children_reached"
            />
          </Field>
          <Field label="How many" name="metricValue" errors={state.fieldErrors}>
            <Input
              id="metricValue"
              name="metricValue"
              type="number"
              min={0}
              defaultValue={record?.metricValue ?? ''}
              onChange={(changed) => setClaimsFigure(changed.target.value.trim() !== '')}
            />
          </Field>
          <Field label="Unit" name="metricUnit" errors={state.fieldErrors}>
            <Input
              id="metricUnit"
              name="metricUnit"
              defaultValue={record?.metricUnit ?? ''}
              placeholder="children"
            />
          </Field>
        </div>

        <Field
          label="How this figure was arrived at"
          name="verificationMethod"
          errors={state.fieldErrors}
          hint="Shown on the public page beside the number. Name the source — a register, a signed list, a survey — not the conclusion."
        >
          <TextArea
            name="verificationMethod"
            defaultValue={record?.verificationMethod}
            rows={4}
            errors={state.fieldErrors}
            onChange={(value) => setHasMethod(value.trim() !== '')}
          />
        </Field>

        {/*
          Shown while a figure is typed and no method is written. Not an error —
          the draft saves fine — but the publish button will refuse, and saying
          so now is cheaper than saying so then.
        */}
        {claimsFigure && !hasMethod ? (
          <Alert variant="warning" role="status">
            This record claims a figure, so it cannot be published until you say how the number was
            arrived at. You can still save it as a draft.
          </Alert>
        ) : null}
      </fieldset>

      <Field label="Cover image URL" name="coverImage" errors={state.fieldErrors}>
        <Input id="coverImage" name="coverImage" defaultValue={record?.coverImage ?? ''} />
      </Field>

      <SubmitButton pending={pending}>{record ? 'Save changes' : 'Create as draft'}</SubmitButton>
    </form>
  );
}
