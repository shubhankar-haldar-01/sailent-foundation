import { Gift, ReceiptText, ShieldCheck } from 'lucide-react';

import { cn } from '@sailent/ui';

/**
 * The three assurances at the foot of the donation card.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * MINIMAL, ON THE OWNER'S REQUEST (2026-11-21).
 *
 * The earlier panel (a tinted band, three titles, three sentences) read as a
 * wall of text under the Donate button. Now: one row, three equal columns,
 * each a small tinted icon over a short label, divided by hairlines. No
 * sentences.
 *
 * Every label is a fact the site can stand behind (AGENTS.md §10):
 * - "Tax relief (80G)": the approved title. Its sentence ("Relief is claimed
 *   through Form 10BE, issued after our annual Form 10BD filing.") now lives
 *   in every campaign's FAQ, "Do I get a tax benefit on my donation?".
 * - "Secure payments": payments are taken by Razorpay, never by this site.
 * - "Email receipt": every donation gets a receipt by email, with a PDF.
 *   It replaced "Trusted NGO / Verified and transparent organization", a
 *   claim with no record behind it.
 *
 * The icons are decoration (`aria-hidden`); the labels carry the meaning.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function CampaignAssurances() {
  return (
    <ul
      aria-label="Why give here"
      className="border-border/70 divide-border/70 grid grid-cols-3 divide-x border-t pt-3"
    >
      <Assurance
        icon={Gift}
        tone="bg-wash-mint text-wash-mint-ink-strong"
        label="Tax relief (80G)"
      />
      <Assurance
        icon={ShieldCheck}
        tone="bg-wash-blue text-wash-blue-ink"
        label="Secure payments"
      />
      <Assurance
        icon={ReceiptText}
        tone="bg-wash-amber text-wash-amber-ink"
        label="Email receipt"
      />
    </ul>
  );
}

function Assurance({
  icon: Icon,
  tone,
  label,
}: {
  icon: typeof Gift;
  tone: string;
  label: string;
}) {
  return (
    <li className="flex flex-col items-center gap-1.5 px-1 text-center">
      <span
        aria-hidden="true"
        className={cn('grid size-7 shrink-0 place-items-center rounded-full', tone)}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="text-foreground/85 text-[0.75rem] font-semibold leading-tight">{label}</span>
    </li>
  );
}
