'use client';

import * as React from 'react';

import { Input } from '@sailent/ui';

import { CoverImagePicker } from '@/components/admin/cover-image-picker';
import { Field, FormStatus, SubmitButton, TextArea } from '@/components/admin/form-shell';
import { createProgram, updateProgram, type ActionState } from '@/lib/admin/actions';
import type { AdminMedia } from '@/lib/admin/api';

export function ProgramForm({
  program,
  mediaOptions = [],
}: {
  program?: {
    id: string;
    title: string;
    slug: string;
    shortDescription: string | null;
    description: string | null;
    problem?: string | null;
    approach?: string | null;
    beneficiaries?: string | null;
    coverImage?: string | null;
    displayOrder: number;
  };
  mediaOptions?: AdminMedia[];
}) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    program ? updateProgram : createProgram,
    {},
  );

  return (
    <form action={action} className="max-w-2xl space-y-6">
      {program ? <input type="hidden" name="id" value={program.id} /> : null}
      <FormStatus state={state} success="Program saved" />

      {/* 1. Title */}
      <Field label="Title" name="title" errors={state.fieldErrors} required>
        <Input
          id="title"
          name="title"
          defaultValue={program?.title}
          placeholder="e.g. Healthcare for All"
          required
        />
      </Field>

      {/* 2. Short description */}
      <Field
        label="Short description"
        name="shortDescription"
        errors={state.fieldErrors}
        hint="Appears on every card and in search results."
        required
      >
        <TextArea
          name="shortDescription"
          rows={3}
          defaultValue={program?.shortDescription ?? ''}
          errors={state.fieldErrors}
          placeholder="Brief summary of this program and its focus..."
          required
        />
      </Field>

      {/* 3. About this program */}
      <Field
        label="About this program"
        name="description"
        errors={state.fieldErrors}
        hint="Comprehensive overview of this program's mission and purpose."
        required
      >
        <TextArea
          name="description"
          rows={5}
          defaultValue={program?.description ?? ''}
          errors={state.fieldErrors}
          placeholder="Describe the overarching goals, background, and vision of this program..."
          required
        />
      </Field>

      {/* 4. The challenge */}
      <Field
        label="The challenge"
        name="problem"
        errors={state.fieldErrors}
        hint="The specific problem or community obstacle this program exists to address."
        required
      >
        <TextArea
          name="problem"
          rows={5}
          defaultValue={program?.problem ?? ''}
          errors={state.fieldErrors}
          placeholder="Explain the systemic issue, community challenges, or unmet needs..."
          required
        />
      </Field>

      {/* 5. Our approach */}
      <Field
        label="Our approach"
        name="approach"
        errors={state.fieldErrors}
        hint="What we actually do about it and how our interventions work."
        required
      >
        <TextArea
          name="approach"
          rows={5}
          defaultValue={program?.approach ?? ''}
          errors={state.fieldErrors}
          placeholder="Explain the concrete interventions, key activities, and methodology..."
          required
        />
      </Field>

      {/* 6. Upload image */}
      <CoverImagePicker
        name="coverImage"
        label="Upload image"
        hint="Banner photograph displayed on the program page and promotional cards. Choose from library or upload from your device."
        value={program?.coverImage}
        options={mediaOptions}
        error={state.fieldErrors?.coverImage}
        required
      />

      {/* Additional / Advanced Settings */}
      <details className="border-border group rounded-lg border p-4">
        <summary className="text-body-sm text-foreground/80 hover:text-foreground cursor-pointer select-none font-medium">
          Additional settings (URL slug, beneficiaries, display order)
        </summary>
        <div className="mt-4 space-y-4 pt-2">
          <Field
            label="URL slug"
            name="slug"
            errors={state.fieldErrors}
            hint={
              program
                ? 'Changing this leaves a permanent redirect from the old address, so existing links keep working.'
                : 'Left blank, this is generated automatically from the title.'
            }
          >
            <Input
              id="slug"
              name="slug"
              defaultValue={program?.slug}
              placeholder="auto-generated-from-title"
            />
          </Field>

          <Field
            label="Who it serves"
            name="beneficiaries"
            errors={state.fieldErrors}
            hint="Target demographic or community served by this initiative."
          >
            <TextArea
              name="beneficiaries"
              rows={3}
              defaultValue={program?.beneficiaries ?? ''}
              placeholder="e.g. Children aged 5–14 from underserved rural communities."
            />
          </Field>

          <Field
            label="Display order"
            name="displayOrder"
            errors={state.fieldErrors}
            hint="Lower numbers appear first."
          >
            <Input
              id="displayOrder"
              name="displayOrder"
              type="number"
              min={0}
              defaultValue={program?.displayOrder ?? 100}
            />
          </Field>
        </div>
      </details>

      <SubmitButton pending={pending}>{program ? 'Save changes' : 'Create program'}</SubmitButton>
    </form>
  );
}
