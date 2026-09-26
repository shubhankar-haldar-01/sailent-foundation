'use client';

import * as React from 'react';

import { Button, Input } from '@sailent/ui';

import { FormStatus } from '@/components/admin/form-shell';
import { setProductStatus, type ActionState } from '@/lib/admin/actions';

/**
 * Archiving, kept away from the edit form.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THERE IS NO DELETE HERE, AND THERE IS NO DELETE ANYWHERE.
 *
 * A product cited by a donation from two years ago must still resolve, or that
 * donation's receipt has a hole in it. So the strongest action available is
 * archiving: the row stays, every reference keeps working, and the product
 * stops being offerable.
 *
 * The panel states what archiving does and does not do BEFORE the button,
 * because "archive" reads as "delete, politely" to most people and the
 * difference is the entire point.
 *
 * Blocking campaigns are listed HERE rather than surfaced as a 409 after the
 * click. The API refuses either way; being told in advance is the difference
 * between a control that explains itself and one that argues.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function ArchiveProductPanel({
  productId,
  productName,
  status,
  blockingCampaigns,
}: {
  productId: string;
  productName: string;
  status: 'active' | 'inactive' | 'archived';
  blockingCampaigns: string[];
}) {
  const [state, action] = React.useActionState<ActionState, FormData>(setProductStatus, {});

  if (status === 'archived') {
    return (
      <div className="border-border rounded-lg border p-4">
        <h3 className="text-body-sm font-semibold">Archived</h3>
        <p className="text-body-sm text-muted-foreground mt-1">
          This product is retired. Nothing was deleted — donations that cite it still resolve, and
          campaigns that offered it keep their record. Restoring brings it back as inactive, so it
          is reviewed before it goes back on sale.
        </p>
        <FormStatus state={state} />
        <form action={action} className="mt-3">
          <input type="hidden" name="id" value={productId} />
          <input type="hidden" name="status" value="inactive" />
          <Button type="submit" size="sm" variant="secondary">
            Restore as inactive
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="border-border rounded-lg border p-4">
      <h3 className="text-body-sm font-semibold">Archive this product</h3>
      <p className="text-body-sm text-muted-foreground mt-1">
        Retires it everywhere. It disappears from the pickers and can no longer be added to a
        campaign. Nothing is deleted: every donation that names it keeps resolving, and every
        receipt keeps saying what the donor paid.
      </p>

      {blockingCampaigns.length > 0 ? (
        <p className="border-warning/30 bg-warning-subtle text-body-sm mt-3 rounded-md border p-3">
          {blockingCampaigns.length} live campaign
          {blockingCampaigns.length === 1 ? '' : 's'} still offer
          {blockingCampaigns.length === 1 ? 's' : ''} this: {blockingCampaigns.join(', ')}. Remove
          it from each one first — withdrawing it from under an appeal that is actively asking for
          it is a decision to make campaign by campaign.
        </p>
      ) : (
        <>
          <FormStatus state={state} />
          <form action={action} className="mt-3 space-y-3">
            <input type="hidden" name="id" value={productId} />
            <input type="hidden" name="status" value="archived" />

            <div className="space-y-1.5">
              <label htmlFor="archive-reason" className="text-body-sm font-medium">
                Why is this being archived?
                <span className="text-destructive ml-0.5" aria-hidden="true">
                  *
                </span>
              </label>
              <Input
                id="archive-reason"
                name="reason"
                required
                minLength={3}
                placeholder="No longer distributed after the 2026 programme review"
              />
              <p className="text-caption text-muted-foreground">
                Recorded in the audit log. This is the note somebody reads in a year when they ask
                why the product vanished.
              </p>
            </div>

            <Button
              type="submit"
              size="sm"
              variant="secondary"
              onClick={(event) => {
                if (!window.confirm(`Archive “${productName}”?`)) event.preventDefault();
              }}
            >
              Archive
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
