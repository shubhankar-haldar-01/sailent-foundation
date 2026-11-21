import { BadgeCheck, FileText, Landmark, ReceiptText, ShieldCheck } from 'lucide-react';

import { PageShell } from '@/components/layout/page-shell';
import { SectionHeading } from '@/components/sections/section-heading';
import { getOrganisation } from '@/lib/content/organisation';

/**
 * Why give here — the homepage's trust section (visual polish Phase 4, owner
 * 2026-11-21).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONLY WHAT IS ON RECORD (owner's choice; `AGENTS.md` §10).
 *
 * The registration, 12A and 80G entries come from Admin → Settings — the
 * same numbers the donation receipt prints — and each appears ONLY when it is
 * set. A missing number hides its item rather than being described. The other
 * items are things the site itself does, every time: a receipt by email for
 * every donation, payments taken by Razorpay, and each campaign's own figures,
 * updates and documents on its page. No "trusted", "verified" or "100%".
 *
 * The 80G sentence is the approved one (§11 item 20 and the campaign FAQ).
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function TrustSection() {
  const organisation = await getOrganisation();
  const { registration } = organisation;

  const items: { icon: typeof Landmark; title: string; body: string }[] = [];

  if (registration.registrationNumber) {
    items.push({
      icon: Landmark,
      title: 'Registered',
      body: `${organisation.registeredAs ? `${organisation.registeredAs}, r` : 'R'}egistration ${registration.registrationNumber}.`,
    });
  }
  if (registration.section80G) {
    items.push({
      icon: BadgeCheck,
      title: 'Tax relief (80G)',
      body: `80G ${registration.section80G}. Relief is claimed through Form 10BE, issued after our annual Form 10BD filing.`,
    });
  }
  if (registration.section12A) {
    items.push({
      icon: FileText,
      title: '12A registration',
      body: `12A ${registration.section12A}.`,
    });
  }
  items.push(
    {
      icon: ReceiptText,
      title: 'A receipt for every donation',
      body: 'Sent by email, with a PDF, as soon as a payment is confirmed.',
    },
    {
      icon: ShieldCheck,
      title: 'Secure payments',
      body: 'Payments are taken by Razorpay. Card and bank details never reach this site.',
    },
    {
      icon: FileText,
      title: 'Open campaign figures',
      body: 'Every campaign page shows what has been raised against its goal, with the updates and documents published for it.',
    },
  );

  return (
    <section aria-labelledby="trust-heading" className="section-y">
      <PageShell>
        <SectionHeading
          id="trust-heading"
          eyebrow="Why give here"
          title="Giving you can check"
          lead="What we can show you, from our own records."
        />
        <ul className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <Icon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div>
                <h3 className="text-body font-semibold">{title}</h3>
                <p className="text-body-sm text-muted-foreground mt-1 leading-relaxed">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </PageShell>
    </section>
  );
}
