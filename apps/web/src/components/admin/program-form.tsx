'use client';

import * as React from 'react';

import { Input, Label } from '@sailent/ui';

import { Field, FormStatus, SubmitButton, TextArea } from '@/components/admin/form-shell';
import { createProgram, updateProgram, type ActionState } from '@/lib/admin/actions';
import type { AdminCategory } from '@/lib/admin/api';

export function ProgramForm({
  categories,
  program,
}: {
  categories: AdminCategory[];
  program?: {
    id: string;
    title: string;
    slug: string;
    shortDescription: string | null;
    description: string | null;
    problem?: string | null;
    approach?: string | null;
    beneficiaries?: string | null;
    categoryId: string | null;
    displayOrder: number;
  };
}) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    program ? updateProgram : createProgram,
    {},
  );

  return (
    <form action={action} className="max-w-2xl space-y-5">
      {program ? <input type="hidden" name="id" value={program.id} /> : null}
      <FormStatus state={state} />

      <Field label="Title" name="title" errors={state.fieldErrors} required>
        <Input id="title" name="title" defaultValue={program?.title} required />
      </Field>

      <Field
        label="URL"
        name="slug"
        errors={state.fieldErrors}
        hint={
          program
            ? 'Changing this leaves a permanent redirect from the old address, so existing links keep working.'
            : 'Left blank, this is generated from the title.'
        }
      >
        <Input id="slug" name="slug" defaultValue={program?.slug} placeholder="education" />
      </Field>

      <div className="space-y-1.5">
        <Label htmlFor="categoryId">Category</Label>
        <select
          id="categoryId"
          name="categoryId"
          defaultValue={program?.categoryId ?? ''}
          className="border-input bg-surface text-body-sm h-10 w-full rounded-md border px-3"
        >
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {state.fieldErrors?.categoryId ? (
          <p className="text-caption text-destructive">{state.fieldErrors.categoryId}</p>
        ) : null}
      </div>

      <Field
        label="Short description"
        name="shortDescription"
        errors={state.fieldErrors}
        hint="Appears on every card and in search results. Required before publishing."
      >
        <TextArea
          name="shortDescription"
          rows={3}
          defaultValue={program?.shortDescription}
          errors={state.fieldErrors}
        />
      </Field>

      {program ? (
        <>
          <Field label="The problem" name="problem" errors={state.fieldErrors}>
            <TextArea name="problem" rows={5} defaultValue={program.problem} />
          </Field>
          <Field label="What we do about it" name="approach" errors={state.fieldErrors}>
            <TextArea name="approach" rows={5} defaultValue={program.approach} />
          </Field>
          <Field label="Who it serves" name="beneficiaries" errors={state.fieldErrors}>
            <TextArea name="beneficiaries" rows={3} defaultValue={program.beneficiaries} />
          </Field>
        </>
      ) : null}

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

      <SubmitButton pending={pending}>{program ? 'Save changes' : 'Create program'}</SubmitButton>
    </form>
  );
}
