'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Alert, Button } from '@sailent/ui';

import { updateDonorSettings, type DonorActionState } from '@/lib/donor/actions';
import type { DonorSettings } from '@/lib/donor/api';

/**
 * Notification and visibility preferences.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO INDEPENDENT QUESTIONS, ASKED SEPARATELY.
 *
 *   HOW we reach you    — email, SMS, WhatsApp
 *   WHAT you hear about — campaign news, impact updates, the newsletter
 *
 * They are separate columns in the database and separate groups here, because
 * they genuinely are separate: somebody may want email, but only about the
 * campaigns they actually funded. Collapsing them into one list of seven
 * checkboxes would make that combination impossible to express.
 *
 * TRANSACTIONAL MAIL IS DELIBERATELY NOT ON THIS PAGE. Receipts and sign-in
 * codes are not a preference — a donor cannot switch off the record of their
 * own gift, and there is no column that would let them try. The note at the
 * bottom says so rather than leaving somebody hunting for the switch.
 * ══════════════════════════════════════════════════════════════════════════
 */
function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Saving…' : 'Save preferences'}
    </Button>
  );
}

function Toggle({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        id={name}
        name={name}
        defaultChecked={defaultChecked}
        // 20px box inside a 44px row: the label is part of the target, so the
        // whole line is comfortably pressable on a phone.
        className="border-input text-primary focus-visible:outline-ring mt-0.5 size-5 shrink-0 rounded focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      <label htmlFor={name} className="min-w-0 cursor-pointer">
        <span className="text-body-sm block font-medium">{label}</span>
        <span className="text-caption text-muted-foreground block">{description}</span>
      </label>
    </div>
  );
}

export function SettingsForm({ settings }: { settings: DonorSettings }) {
  const [state, action] = useActionState<DonorActionState, FormData>(updateDonorSettings, {});

  return (
    <form action={action} className="space-y-8">
      {state.error ? (
        <Alert variant="destructive" role="alert">
          {state.error}
        </Alert>
      ) : null}
      {state.ok ? (
        <Alert variant="success" role="status">
          Your preferences have been saved.
        </Alert>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="text-h3 font-semibold">What you hear about</legend>
        <Toggle
          name="notifyCampaignUpdates"
          label="Campaign updates"
          description="News from campaigns you have funded."
          defaultChecked={settings.notifyCampaignUpdates}
        />
        <Toggle
          name="notifyImpactUpdates"
          label="Impact updates"
          description="Verified updates from the field, with the figures behind them."
          defaultChecked={settings.notifyImpactUpdates}
        />
        <Toggle
          name="notifyNewsletter"
          label="Newsletter"
          description="Occasional news about the organisation as a whole."
          defaultChecked={settings.notifyNewsletter}
        />
      </fieldset>

      <fieldset className="border-border space-y-4 border-t pt-6">
        <legend className="text-h3 font-semibold">How we reach you</legend>
        <Toggle
          name="communicationConsent"
          label="I am happy to be contacted"
          description="Switch this off and we will send you nothing but your receipts."
          defaultChecked={settings.communicationConsent}
        />
        <Toggle
          name="emailOptIn"
          label="Email"
          description="To the address on your profile."
          defaultChecked={settings.emailOptIn}
        />
        <Toggle
          name="smsOptIn"
          label="SMS"
          description="To the number you sign in with."
          defaultChecked={settings.smsOptIn}
        />
        <Toggle
          name="whatsappOptIn"
          label="WhatsApp"
          description="To the same number."
          defaultChecked={settings.whatsappOptIn}
        />
      </fieldset>

      <fieldset className="border-border space-y-4 border-t pt-6">
        <legend className="text-h3 font-semibold">How you appear</legend>
        <Toggle
          name="isAnonymous"
          label="Give anonymously"
          description="Your name is not shown on campaign pages or donor lists. Our finance team can still identify your donations — an anonymous gift is anonymous in public, not in the books, and your receipt is unaffected."
          defaultChecked={settings.isAnonymous}
        />
      </fieldset>

      <div className="border-border border-t pt-6">
        <p className="text-caption text-muted-foreground mb-5">
          Receipts and sign-in codes are always sent. They are the record of your own giving and the
          way you get into this account, so they are not switched off here.
        </p>
        <Submit />
      </div>
    </form>
  );
}
