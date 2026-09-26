import { ArrowRight } from 'lucide-react';
import { cn } from '@sailent/ui';

/**
 * How donations work.
 *
 * Five steps, shown as a horizontal flow on desktop and a vertical one on
 * mobile. Kept concise deliberately: the point is to remove uncertainty before
 * someone gives, not to narrate a process.
 */
const steps = [
  {
    title: 'Choose where to help',
    description: 'Pick a campaign, or give to a program and let the team allocate it.',
  },
  {
    title: 'Select products or an amount',
    description: 'Fund specific items — a kit, a clinic day — or give any amount. Or both.',
  },
  {
    title: 'Complete your donation',
    description: 'Pay by UPI, card or netbanking. Your details stay with the payment provider.',
  },
  {
    title: 'Receive confirmation',
    description: 'A receipt by email, itemised, as soon as the payment is confirmed by our bank.',
  },
  {
    title: 'See what happened',
    description: 'Dated updates from the campaign you funded, with figures and photographs.',
  },
];

export function HowDonationsWork({ className }: { className?: string }) {
  return (
    <div className={cn('grid gap-6 md:grid-cols-5 md:gap-4', className)}>
      {steps.map((step, index) => (
        <div key={step.title} className="relative flex gap-4 md:block">
          <div className="flex flex-col items-center md:flex-row md:gap-3">
            <span
              aria-hidden="true"
              className="border-border bg-surface text-body-sm text-primary flex size-9 shrink-0 items-center justify-center rounded-full border font-semibold"
            >
              {index + 1}
            </span>
            {/* Connector: vertical on mobile, horizontal on desktop. */}
            {index < steps.length - 1 ? (
              <>
                <span aria-hidden="true" className="bg-border my-1 w-px flex-1 md:hidden" />
                <ArrowRight
                  aria-hidden="true"
                  className="text-border-strong hidden size-4 shrink-0 md:block"
                />
              </>
            ) : null}
          </div>
          <div className="pb-6 md:pb-0 md:pt-4">
            <h3 className="text-body font-semibold">{step.title}</h3>
            <p className="text-body-sm text-muted-foreground mt-1">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
