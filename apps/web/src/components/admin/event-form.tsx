'use client';

import * as React from 'react';

import { Input, Label } from '@sailent/ui';

import { Field, FormStatus, SubmitButton, TextArea } from '@/components/admin/form-shell';
import { createEvent, updateEvent, type ActionState } from '@/lib/admin/actions';
import type { AdminCampaign, AdminEvent, AdminProgram } from '@/lib/admin/api';

/**
 * An instant, as a `datetime-local` value in India Standard Time.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * `toISOString().slice(0, 16)` IS THE WRONG ANSWER, and it is the one every
 * codebase reaches for first: it renders the UTC wall clock, so a camp at 09:30
 * IST appears in the form as 04:00 and an editor who saves without touching the
 * field has silently moved it five and a half hours.
 *
 * `en-CA` is used for the date because it formats as `YYYY-MM-DD`, which is
 * what the input wants, while still honouring the `timeZone` option — a
 * manual `getFullYear()` would read the SERVER's zone again and reintroduce
 * the bug this exists to avoid.
 * ══════════════════════════════════════════════════════════════════════════
 */
function toLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const day = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(date);

  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }).format(date);

  return `${day}T${time}`;
}

/**
 * Create or edit an event.
 *
 * Publication and the open/closed/cancelled lifecycle are NOT here — they are
 * transitions with their own controls, because cancelling emails every
 * registrant and that must never be a side effect of saving a typo.
 */
export function EventForm({
  event,
  programs,
  campaigns,
}: {
  event?: AdminEvent;
  programs: AdminProgram[];
  campaigns: AdminCampaign[];
}) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    event ? updateEvent : createEvent,
    {},
  );

  // Controlled, because the venue fields and the joining link are mutually
  // relevant: an online event needs a link to publish and a physical one needs
  // somewhere to be, and showing both sets at once invites filling in both.
  const [isOnline, setIsOnline] = React.useState(event?.isOnline ?? false);

  return (
    <form action={action} className="max-w-2xl space-y-5">
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      <FormStatus state={state} />

      <Field label="Title" name="title" errors={state.fieldErrors} required>
        <Input id="title" name="title" defaultValue={event?.title} required />
      </Field>

      <Field
        label="URL"
        name="slug"
        errors={state.fieldErrors}
        hint={
          event
            ? 'Changing this redirects the old address permanently. Posters and WhatsApp forwards keep working.'
            : 'Left blank, this is made from the title.'
        }
      >
        <Input id="slug" name="slug" defaultValue={event?.slug} />
      </Field>

      <Field
        label="Summary"
        name="summary"
        errors={state.fieldErrors}
        hint="Required before publishing — it is what appears on every card and in search results."
      >
        <TextArea
          name="summary"
          defaultValue={event?.summary}
          rows={3}
          errors={state.fieldErrors}
        />
      </Field>

      <Field label="Description" name="description" errors={state.fieldErrors}>
        <TextArea
          name="description"
          defaultValue={event?.description}
          rows={6}
          errors={state.fieldErrors}
        />
      </Field>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-body-sm px-1 font-medium">When</legend>
        <p className="text-caption text-muted-foreground">All times are India Standard Time.</p>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Starts" name="startDate" errors={state.fieldErrors} required>
            <Input
              id="startDate"
              name="startDate"
              type="datetime-local"
              defaultValue={toLocalInput(event?.startDate)}
              required
            />
          </Field>
          <Field label="Ends" name="endDate" errors={state.fieldErrors}>
            <Input
              id="endDate"
              name="endDate"
              type="datetime-local"
              defaultValue={toLocalInput(event?.endDate)}
            />
          </Field>
        </div>

        <Field
          label="Registration closes"
          name="registrationDeadline"
          errors={state.fieldErrors}
          hint="Leave blank to accept registrations until the event starts. Cannot be after the start."
        >
          <Input
            id="registrationDeadline"
            name="registrationDeadline"
            type="datetime-local"
            defaultValue={toLocalInput(event?.registrationDeadline)}
          />
        </Field>
      </fieldset>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-body-sm px-1 font-medium">Where</legend>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isOnline"
            checked={isOnline}
            onChange={(changed) => setIsOnline(changed.target.checked)}
            className="size-4"
          />
          <span className="text-body-sm">This is an online event</span>
        </label>

        {isOnline ? (
          <Field
            label="Joining link"
            name="meetingUrl"
            errors={state.fieldErrors}
            hint="PRIVATE. Sent to registrants and never shown on a public page. Required before an online event can be published."
          >
            <Input id="meetingUrl" name="meetingUrl" defaultValue={event?.meetingUrl ?? ''} />
          </Field>
        ) : (
          <>
            <Field
              label="Venue"
              name="venueName"
              errors={state.fieldErrors}
              hint="A venue, an address or at least a city is required before publishing."
            >
              <Input id="venueName" name="venueName" defaultValue={event?.venueName ?? ''} />
            </Field>
            <Field label="Address" name="address" errors={state.fieldErrors}>
              <TextArea name="address" defaultValue={event?.address} rows={2} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="City" name="city" errors={state.fieldErrors}>
                <Input id="city" name="city" defaultValue={event?.city ?? ''} />
              </Field>
              <Field label="State" name="state" errors={state.fieldErrors}>
                <Input id="state" name="state" defaultValue={event?.state ?? ''} />
              </Field>
            </div>
          </>
        )}
      </fieldset>

      <Field
        label="Places"
        name="capacity"
        errors={state.fieldErrors}
        hint="Leave blank for no limit. Enforced under a row lock, so the number cannot be exceeded however many people register at once. It cannot be lowered below the places already taken."
      >
        <Input
          id="capacity"
          name="capacity"
          type="number"
          min={0}
          defaultValue={event?.capacity ?? ''}
          className="max-w-32"
        />
      </Field>

      <Field
        label="Organiser"
        name="organizer"
        errors={state.fieldErrors}
        hint="Only when it is not simply the foundation — a partner, or a committee."
      >
        <Input id="organizer" name="organizer" defaultValue={event?.organizer ?? ''} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="programId">Programme</Label>
          <select
            id="programId"
            name="programId"
            defaultValue={event?.programId ?? ''}
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
          <Label htmlFor="campaignId">Campaign</Label>
          <select
            id="campaignId"
            name="campaignId"
            defaultValue={event?.campaignId ?? ''}
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
      </div>

      <Field label="Cover image URL" name="coverImage" errors={state.fieldErrors}>
        <Input id="coverImage" name="coverImage" defaultValue={event?.coverImage ?? ''} />
      </Field>

      <SubmitButton pending={pending}>{event ? 'Save changes' : 'Create as draft'}</SubmitButton>
    </form>
  );
}
