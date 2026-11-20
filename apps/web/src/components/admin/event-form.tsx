'use client';

import * as React from 'react';
import Link from 'next/link';

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sailent/ui';

import { Field, FormStatus, SubmitButton, TextArea } from '@/components/admin/form-shell';
import { CoverImagePicker } from '@/components/admin/cover-image-picker';
import { DateTimePicker } from '@/components/admin/date-time-picker';
import { useEditorGuard } from '@/lib/feedback/use-unsaved-changes-guard';
import { createEvent, updateEvent, type ActionState } from '@/lib/admin/actions';
import type { AdminEvent, AdminMedia, AdminProgram } from '@/lib/admin/api';

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
  mediaOptions = [],
}: {
  event?: AdminEvent;
  programs: AdminProgram[];
  mediaOptions?: AdminMedia[];
}) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    event ? updateEvent : createEvent,
    {},
  );
  // A long editor: leaving with unsaved edits asks first (docs/ui-feedback.md).
  const guard = useEditorGuard(state);

  // Persistent form state so validation errors never clear the user's filled data
  const [title, setTitle] = React.useState(event?.title ?? '');
  const [summary, setSummary] = React.useState(event?.summary ?? '');
  const [description, setDescription] = React.useState(event?.description ?? '');
  const [startDate, setStartDate] = React.useState(toLocalInput(event?.startDate));
  const [endDate, setEndDate] = React.useState(toLocalInput(event?.endDate));
  const [registrationDeadline, setRegistrationDeadline] = React.useState(
    toLocalInput(event?.registrationDeadline),
  );
  const [venueName, setVenueName] = React.useState(event?.venueName ?? '');
  const [address, setAddress] = React.useState(event?.address ?? '');
  const [city, setCity] = React.useState(event?.city ?? '');
  const [stateName, setStateName] = React.useState(event?.state ?? '');
  const [capacity, setCapacity] = React.useState(
    event?.capacity !== null && event?.capacity !== undefined ? String(event.capacity) : '',
  );
  const [isPaid, setIsPaid] = React.useState<boolean>(event?.isPaid ?? false);
  const [feeAmount, setFeeAmount] = React.useState<string>(
    event?.feeAmount ? String(Math.round(event.feeAmount / 100)) : '',
  );
  const [programId, setProgramId] = React.useState(event?.programId || 'none');
  const [functionsText, setFunctionsText] = React.useState(
    event?.functions ? event.functions.join(', ') : '',
  );
  const [coverImage, setCoverImage] = React.useState(event?.coverImage ?? '');
  const [coverError, setCoverError] = React.useState<string | null>(null);

  const formTopRef = React.useRef<HTMLDivElement>(null);

  const scrollToTop = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const main = document.getElementById('admin-content');
      if (main) main.scrollTop = 0;
    }
    formTopRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, []);

  // Scroll completely to the top on form action feedback (success or error)
  // so the user immediately sees the status message
  React.useEffect(() => {
    if (state.ok || state.error) {
      scrollToTop();
      const raf = requestAnimationFrame(scrollToTop);
      const timer = setTimeout(scrollToTop, 100);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
  }, [state.ok, state.error, scrollToTop]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    scrollToTop();
    if (!coverImage.trim()) {
      e.preventDefault();
      setCoverError('Please choose or upload a cover image.');
      return;
    }
    setCoverError(null);
  };

  return (
    <form
      action={action}
      onSubmit={handleSubmit}
      onChange={guard.markDirty}
      className="max-w-2xl space-y-6"
    >
      {guard.dialog}
      <div ref={formTopRef} className="scroll-mt-8" />
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      {event?.slug ? <input type="hidden" name="slug" value={event.slug} /> : null}
      <FormStatus state={state} success="Event saved" />

      <Field label="Title" name="title" errors={state.fieldErrors} required>
        <Input
          id="title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </Field>

      <Field
        label="Summary"
        name="summary"
        errors={state.fieldErrors}
        required
        hint="What appears on every card and in search results."
      >
        <TextArea
          name="summary"
          value={summary}
          onChange={setSummary}
          rows={3}
          required
          errors={state.fieldErrors}
        />
      </Field>

      <Field label="Description" name="description" errors={state.fieldErrors} required>
        <TextArea
          name="description"
          value={description}
          onChange={setDescription}
          rows={6}
          required
          errors={state.fieldErrors}
        />
      </Field>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-body-sm px-1 font-medium">When</legend>
        <p className="text-caption text-muted-foreground">All times are India Standard Time.</p>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Starts" name="startDate" errors={state.fieldErrors} required>
            <DateTimePicker
              id="startDate"
              name="startDate"
              value={startDate}
              onChange={setStartDate}
              hasError={Boolean(state.fieldErrors?.startDate)}
              required
            />
          </Field>
          <Field label="Ends" name="endDate" errors={state.fieldErrors} required>
            <DateTimePicker
              id="endDate"
              name="endDate"
              value={endDate}
              onChange={setEndDate}
              hasError={Boolean(state.fieldErrors?.endDate)}
              required
            />
          </Field>
        </div>

        <Field
          label="Registration closes"
          name="registrationDeadline"
          errors={state.fieldErrors}
          hint="Cannot be after the start time."
          required
        >
          <DateTimePicker
            id="registrationDeadline"
            name="registrationDeadline"
            value={registrationDeadline}
            onChange={setRegistrationDeadline}
            hasError={Boolean(state.fieldErrors?.registrationDeadline)}
            required
          />
        </Field>
      </fieldset>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-body-sm px-1 font-medium">Where</legend>

        <Field label="Venue" name="venueName" errors={state.fieldErrors} required>
          <Input
            id="venueName"
            name="venueName"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            required
          />
        </Field>
        <Field label="Address" name="address" errors={state.fieldErrors} required>
          <TextArea name="address" value={address} onChange={setAddress} rows={2} required />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="City" name="city" errors={state.fieldErrors} required>
            <Input
              id="city"
              name="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </Field>
          <Field label="State" name="state" errors={state.fieldErrors} required>
            <Input
              id="state"
              name="state"
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
              required
            />
          </Field>
        </div>
      </fieldset>

      <Field
        label="Total Seats / Capacity"
        name="capacity"
        errors={state.fieldErrors}
        hint="Maximum attendee capacity for this event."
        required
      >
        <Input
          id="capacity"
          name="capacity"
          type="number"
          min={1}
          placeholder="e.g. 50"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          className="max-w-40"
          required
        />
      </Field>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-body-sm px-1 font-medium">
          Registration Fee & Payment Gateway
        </legend>
        <p className="text-caption text-muted-foreground">
          Choose whether this event is free or requires attendees to pay a registration fee via
          Razorpay.
        </p>

        <div className="space-y-3">
          <Label>Event Fee Type</Label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="isPaidChoice"
                checked={!isPaid}
                onChange={() => setIsPaid(false)}
                className="accent-primary"
              />
              <span className="text-sm font-medium">Free Event</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="isPaidChoice"
                checked={isPaid}
                onChange={() => setIsPaid(true)}
                className="accent-primary"
              />
              <span className="text-sm font-medium">Paid Event (Razorpay)</span>
            </label>
          </div>
          <input type="hidden" name="isPaid" value={isPaid ? 'true' : 'false'} />
        </div>

        {isPaid ? (
          <Field
            label="Registration Fee (₹)"
            name="feeAmount"
            errors={state.fieldErrors}
            hint="Fixed registration fee in Rupees (₹) collected via Razorpay during registration."
            required
          >
            <div className="relative max-w-48">
              <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium">
                ₹
              </span>
              <Input
                id="feeAmount"
                name="feeAmount"
                type="number"
                min={1}
                step={1}
                placeholder="500"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                className="pl-7"
                required={isPaid}
              />
            </div>
          </Field>
        ) : null}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="programId">
          Programme (Category){' '}
          <span className="text-caption text-muted-foreground font-normal">(Optional)</span>
        </Label>
        <p className="text-caption text-muted-foreground">
          Assigns the event to a focus area (e.g. Healthcare, Education). This sets the category
          badge on the event card.
        </p>
        <Select name="programId" value={programId} onValueChange={setProgramId}>
          <SelectTrigger id="programId" className="max-w-md">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent position="popper" side="bottom" align="start">
            <SelectItem value="none">None (No Category)</SelectItem>
            {programs.map((program) => (
              <SelectItem key={program.id} value={program.id}>
                {program.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="functions">
          Functions / Activities{' '}
          <span className="text-caption text-muted-foreground font-normal">(Optional)</span>
        </Label>
        <p className="text-caption text-muted-foreground">
          Enter sub-activities or functions separated by commas (e.g.{' '}
          <code>Dance, Singing, Running</code>). When provided, attendees can choose which function
          to register for.
        </p>
        <Input
          id="functions"
          name="functions"
          value={functionsText}
          onChange={(e) => setFunctionsText(e.target.value)}
          placeholder="Dance, Singing, Running"
          className="max-w-xl"
        />
      </div>

      <CoverImagePicker
        name="coverImage"
        label="Cover Image"
        hint="Photograph displayed on event cards and at the top of the event page. Upload directly from your device or choose from media."
        value={coverImage}
        options={mediaOptions}
        onSelect={(media) => {
          setCoverImage(media?.url ?? '');
          if (media?.url) setCoverError(null);
        }}
        error={coverError || state.fieldErrors?.coverImage}
        required
      />

      <div className="border-border flex items-center justify-between border-t pt-5">
        <Button
          type="button"
          variant="ghost"
          asChild
          className="text-muted-foreground hover:text-foreground h-9 rounded-lg px-4 text-xs font-semibold"
        >
          <Link href="/admin/events">Cancel</Link>
        </Button>
        <SubmitButton
          pending={pending}
          onClick={scrollToTop}
          className="shadow-xs h-9 rounded-lg px-6 text-xs font-semibold"
        >
          {event ? 'Save changes' : 'Create as draft'}
        </SubmitButton>
      </div>
    </form>
  );
}
