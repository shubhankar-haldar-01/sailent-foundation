'use client';

import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button, CampaignProgress, Card } from '@sailent/ui';

import { DonationBuilder } from './donation-builder';
import type { Campaign } from '@/lib/mock/types';

/**
 * Standalone donation flow for /donate.
 *
 * Differs from the campaign page by adding a campaign SELECTION step, because
 * someone arriving at /donate has not chosen where their money goes yet.
 *
 * Phase 5 is what makes this real, and the split matters: the donor-details
 * step below collects information, but the AMOUNT is never sent from here. The
 * eventual request carries product ids and quantities only, and the server
 * recomputes every price from the database. A client-supplied total is the
 * oldest vulnerability in e-commerce.
 *
 * The tax-ID field is deliberately absent. Phase 0 decision A7: demanding a PAN
 * before payment destroys conversion, so it is requested afterwards, on the
 * confirmation page and in the receipt email.
 */
export function DonateFlow({ campaigns }: { campaigns: Campaign[] }) {
  const [selectedSlug, setSelectedSlug] = React.useState<string | null>(null);
  const [stage, setStage] = React.useState<'choose' | 'build'>('choose');

  const selected = campaigns.find((campaign) => campaign.slug === selectedSlug);

  if (stage === 'choose' || !selected) {
    return (
      <div>
        <h2 className="text-h2 font-bold">Where would you like to give?</h2>
        <p className="text-body text-muted-foreground mt-2 max-w-prose">
          Each campaign lists exactly what it funds. If you would rather not choose, pick the one
          closest to its deadline — that is usually where money is most useful.
        </p>

        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <li key={campaign.slug}>
              <Card className="flex h-full flex-col p-5">
                <p className="text-overline tracking-(--text-overline--letter-spacing) text-muted-foreground uppercase">
                  {campaign.programName}
                </p>
                <h3 className="text-h4 mt-1 font-semibold">{campaign.title}</h3>
                <p className="text-body-sm text-muted-foreground mt-2">
                  {campaign.shortDescription}
                </p>
                <div className="mt-4">
                  <CampaignProgress
                    raised={campaign.amountRaised}
                    goal={campaign.goalAmount}
                    size="sm"
                  />
                </div>
                <Button
                  className="mt-4"
                  fullWidth
                  onClick={() => {
                    setSelectedSlug(campaign.slug);
                    setStage('build');
                  }}
                >
                  Give to this campaign
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (stage === 'build') {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => setStage('choose')} className="mb-4">
          <ArrowLeft aria-hidden="true" />
          Choose a different campaign
        </Button>

        <div className="border-border bg-surface rounded-lg border p-4">
          <p className="text-overline tracking-(--text-overline--letter-spacing) text-muted-foreground uppercase">
            Giving to
          </p>
          <p className="text-h4 mt-1 font-semibold">{selected.title}</p>
        </div>

        {/*
          The builder carries the flow from here: choose what to fund, then
          donor details, then Checkout. There used to be a second "Continue to
          your details" button below it leading to a separate mock step — two
          controls for one journey, and the one down here was the dead end.
        */}
        <DonationBuilder campaign={selected} className="mt-8" />
      </div>
    );
  }
}
