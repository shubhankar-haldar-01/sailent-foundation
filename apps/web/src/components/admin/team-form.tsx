'use client';

import * as React from 'react';

import { Input, Label } from '@sailent/ui';

import { Field, FormStatus, SubmitButton, TextArea } from '@/components/admin/form-shell';
import { createTeamMember, updateTeamMember, type ActionState } from '@/lib/admin/actions';
import type { AdminTeamMember } from '@/lib/admin/api';

const MEMBER_TYPES = [
  { value: 'staff', label: 'Staff' },
  { value: 'trustee', label: 'Trustee' },
  { value: 'board', label: 'Board' },
  { value: 'advisor', label: 'Advisor' },
] as const;

/**
 * Add or edit somebody in the public directory.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS FORM DESCRIBES A REAL PERSON, and the copy under each field says so.
 *
 * Everything saved here is indexed and scraped within the week. The two fields
 * that carry the most risk of being filled in without thinking are the public
 * email address and the photograph URL, so both carry a warning rather than a
 * neutral hint — an editor who pastes a work address into `emailPublic` has
 * published a colleague's inbox, and nobody will tell them for months.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Publication is NOT on this form. It is a transition with its own control, so
 * that saving a half-written biography cannot put it on the site.
 */
export function TeamForm({ member }: { member?: AdminTeamMember }) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    member ? updateTeamMember : createTeamMember,
    {},
  );

  /*
    The two parallel textareas the action reads. Pre-filled by splitting the
    stored pairs back apart, so an edit round-trips rather than clearing the
    links every time somebody fixes a typo in the biography.
  */
  const labels = (member?.socialLinks ?? []).map((link) => link.label).join('\n');
  const urls = (member?.socialLinks ?? []).map((link) => link.url).join('\n');

  return (
    <form action={action} className="max-w-2xl space-y-5">
      {member ? <input type="hidden" name="id" value={member.id} /> : null}
      <FormStatus state={state} />

      <Field label="Full name" name="name" errors={state.fieldErrors} required>
        <Input id="name" name="name" defaultValue={member?.name} required />
      </Field>

      <Field
        label="URL"
        name="slug"
        errors={state.fieldErrors}
        hint={
          member
            ? 'Changing this redirects the old address permanently — it does not break existing links.'
            : 'Left blank, this is made from the name.'
        }
      >
        <Input id="slug" name="slug" defaultValue={member?.slug} />
      </Field>

      <Field label="Designation" name="designation" errors={state.fieldErrors} required>
        <Input
          id="designation"
          name="designation"
          defaultValue={member?.designation}
          required
          placeholder="Director of Programmes"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Department"
          name="department"
          errors={state.fieldErrors}
          hint="Groups the directory page. Leadership, Programs, Operations or Board."
        >
          <Input id="department" name="department" defaultValue={member?.department ?? ''} />
        </Field>

        <div className="space-y-1.5">
          <Label htmlFor="memberType">Type</Label>
          <select
            id="memberType"
            name="memberType"
            defaultValue={member?.memberType ?? 'staff'}
            className="border-input bg-surface text-body-sm h-10 w-full rounded-md border px-3"
          >
            {MEMBER_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Field
        label="Biography"
        name="bio"
        errors={state.fieldErrors}
        hint="Required before this page can go live. A blank line starts a new paragraph."
      >
        <TextArea name="bio" defaultValue={member?.bio} rows={6} errors={state.fieldErrors} />
      </Field>

      <Field
        label="Before Sailent"
        name="experience"
        errors={state.fieldErrors}
        hint="Optional. Where they worked and what they did, in prose."
      >
        <TextArea
          name="experience"
          defaultValue={member?.experience}
          rows={5}
          errors={state.fieldErrors}
        />
      </Field>

      <Field
        label="Photograph URL"
        name="photoUrl"
        errors={state.fieldErrors}
        hint="Optional — a member with no photograph still publishes. Do not use one you do not have permission to publish."
      >
        <Input id="photoUrl" name="photoUrl" defaultValue={member?.photoUrl ?? ''} />
      </Field>

      <Field
        label="Public email address"
        name="emailPublic"
        errors={state.fieldErrors}
        hint="PUBLISHED ON THE WEBSITE and scraped within the week. Leave blank unless this person has agreed to a public contact address."
      >
        <Input
          id="emailPublic"
          name="emailPublic"
          type="email"
          defaultValue={member?.emailPublic ?? ''}
        />
      </Field>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-body-sm px-1 font-medium">Links</legend>
        <p className="text-caption text-muted-foreground">
          One per line, and the two boxes line up: the first label goes with the first address. A
          line with only one of the two is ignored. Addresses must start with <code>https://</code>.
        </p>
        <Field label="Labels" name="socialLabels" errors={state.fieldErrors}>
          <TextArea name="socialLabels" defaultValue={labels} rows={3} />
        </Field>
        <Field label="Addresses" name="socialUrls" errors={state.fieldErrors}>
          <TextArea name="socialUrls" defaultValue={urls} rows={3} />
        </Field>
      </fieldset>

      <Field
        label="Display order"
        name="displayOrder"
        errors={state.fieldErrors}
        hint="Lower numbers come first within a department. Everyone defaults to 100."
      >
        <Input
          id="displayOrder"
          name="displayOrder"
          type="number"
          min={0}
          defaultValue={member?.displayOrder ?? 100}
          className="max-w-32"
        />
      </Field>

      <SubmitButton pending={pending}>{member ? 'Save changes' : 'Create as draft'}</SubmitButton>
    </form>
  );
}
