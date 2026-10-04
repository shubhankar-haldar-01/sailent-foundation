import { BadgeCheck, Gift, ShieldCheck } from 'lucide-react';

import { cn } from '@sailent/ui';

/**
 * The three assurances at the foot of the donation card, side by side.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE APPROVED PANEL: one pale green band, three columns, a rule between each.
 *
 * Each column is an icon on its own tinted tile, a bold title and a short
 * line under it, all centred — so the three read as one row of reassurance
 * rather than a list to work through. The wording is the approved design's.
 *
 * The icons are decoration (`aria-hidden`); the titles carry the meaning.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function CampaignAssurances() {
  return (
    <ul className="from-wash-mint/60 to-surface-tint divide-border/80 grid grid-cols-3 divide-x rounded-xl bg-gradient-to-br py-2">
      <Assurance
        icon={Gift}
        tone="bg-wash-mint text-wash-mint-ink-strong"
        title="80G Tax Benefit"
        body="Get tax deduction on your donation."
      />
      <Assurance
        icon={ShieldCheck}
        tone="bg-wash-blue text-wash-blue-ink"
        title="Secure Payments"
        body="Your payment information is safe."
      />
      <Assurance
        icon={BadgeCheck}
        tone="bg-wash-amber text-wash-amber-ink"
        title="Trusted NGO"
        body="Verified and transparent organization."
      />
    </ul>
  );
}

function Assurance({
  icon: Icon,
  tone,
  title,
  body,
}: {
  icon: typeof Gift;
  tone: string;
  title: string;
  body: string;
}) {
  return (
    <li className="flex flex-col items-center px-1 text-center">
      <span
        aria-hidden="true"
        className={cn('grid size-8 shrink-0 place-items-center rounded-lg', tone)}
      >
        <Icon className="size-[1.125rem]" />
      </span>
      <span className="mt-1.5 block whitespace-nowrap text-[0.8125rem] font-bold leading-tight tracking-tight">
        {title}
      </span>
      <span className="text-muted-foreground mt-0.5 block text-[0.75rem] leading-snug">{body}</span>
    </li>
  );
}
