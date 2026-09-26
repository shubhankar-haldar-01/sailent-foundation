'use client';

import * as React from 'react';

import { Input } from '@sailent/ui';

import { Field, FormStatus, SubmitButton, TextArea } from '@/components/admin/form-shell';
import { createProduct, updateProduct, type ActionState } from '@/lib/admin/actions';

import type { CatalogueProduct } from './types';

/**
 * Create or edit a catalogue product.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE FORM, TWO ACTIONS, chosen by whether a product was passed. The
 * alternative — two components — is two places for the hint text about
 * `defaultPrice` to be written, and one of them will eventually be wrong.
 *
 * THE PRICE FIELD IS THE ONE THAT NEEDS EXPLAINING. Every operator who sees
 * "Default price" on a catalogue form assumes that editing it changes what
 * campaigns charge. It does not, and the hint says so in the place where the
 * assumption is formed rather than in documentation nobody opens.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Money is entered in RUPEES and travels as paise. That conversion happens once,
 * in the server action, and this is the only surface in the system where a
 * monetary value is a decimal.
 */
export function ProductForm({ product }: { product?: CatalogueProduct }) {
  const isEdit = Boolean(product);
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    isEdit ? updateProduct : createProduct,
    {},
  );

  return (
    <form action={action} className="space-y-6">
      {isEdit ? <input type="hidden" name="id" value={product?.id} /> : null}
      <FormStatus state={state} />

      <Field
        label="Name"
        name="name"
        errors={state.fieldErrors}
        required
        hint="What a donor sees. “School Kit”, not “Education pack (2026 revision)”."
      >
        <Input
          id="name"
          name="name"
          required
          defaultValue={product?.name}
          placeholder="School Kit"
        />
      </Field>

      <Field
        label="URL"
        name="slug"
        errors={state.fieldErrors}
        hint={
          isEdit
            ? 'Changing this changes the product’s address. Existing donations are unaffected.'
            : 'Left blank, this is generated from the name.'
        }
      >
        <Input id="slug" name="slug" defaultValue={product?.slug} placeholder="school-kit" />
      </Field>

      <Field
        label="What it funds"
        name="description"
        errors={state.fieldErrors}
        required
        hint="Concrete, and written once for every campaign that offers this. This is what a donor reads before deciding."
      >
        <TextArea
          name="description"
          rows={3}
          defaultValue={product?.description}
          errors={state.fieldErrors}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Default price (₹)"
          name="defaultPrice"
          errors={state.fieldErrors}
          required
          hint="A STARTING POINT, not a live price. It fills in the price field when this product is added to a campaign. Changing it here does not change what any existing campaign charges, and does not touch a single donation already taken."
        >
          <Input
            id="defaultPrice"
            name="defaultPrice"
            type="number"
            min={1}
            step={1}
            required
            defaultValue={product ? product.defaultPrice / 100 : undefined}
          />
        </Field>

        <Field
          label="Unit"
          name="unit"
          errors={state.fieldErrors}
          hint="What one of these is. Reads as “₹900 per kit”."
        >
          <Input id="unit" name="unit" defaultValue={product?.unit ?? 'unit'} placeholder="kit" />
        </Field>
      </div>

      {isEdit && product && product.campaignCount > 0 ? (
        <p className="border-border bg-muted text-body-sm rounded-md border p-3">
          This product is offered on {product.campaignCount} campaign
          {product.campaignCount === 1 ? '' : 's'}. Editing the name and description changes what
          donors read on all of them. Editing the default price changes none of their prices.
        </p>
      ) : null}

      <SubmitButton pending={pending}>{isEdit ? 'Save product' : 'Add to catalogue'}</SubmitButton>
    </form>
  );
}
