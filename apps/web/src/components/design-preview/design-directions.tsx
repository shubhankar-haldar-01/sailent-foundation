import * as React from 'react';
import { Check, ChevronDown, CircleCheck, Lock, Search, Share2, X } from 'lucide-react';

import { formatCurrency } from '@sailent/ui';

import type { CampaignFaq } from '@/components/campaigns/campaign-default-faqs';
import { PaymentLogos } from '@/components/donations/payment-logos';
import { MediaFrame } from '@/components/media/media-frame';
import type { Campaign } from '@/lib/mock/types';

/**
 * Phase 1 of the visual polish brief (2026-11-21): two design directions on
 * the same real content, side by side, for the owner to choose or mix.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A PROPOSAL, NOT THE SITE. Every value here is local to this page: each
 * direction sets its own CSS variables on its wrapper, so nothing on the real
 * site changes until Phase 2 turns the chosen direction into tokens.
 *
 *   Direction 1 — logo BLUE as the brand colour, type option A (Manrope
 *                 headings on a clean scale, Inter for everything else).
 *   Direction 2 — logo GREEN as the brand colour, type option B (Inter only).
 *
 * Both: orange is the ACTION colour, only for Donate and a page's one main
 * conversion button (AGENTS.md §11 item 12, owner 2026-11-21); cool neutral
 * greys in place of the peach tints; borders before shadows; three elevation
 * levels; sentence case. Colour and type are independent, so "blue with type
 * B" is as easy to build as either column.
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface Palette {
  /** Brand colour: links, focus, selected, active nav and tabs, progress. */
  brand: string;
  brandHover: string;
  /** The label on a brand-coloured fill: white in light mode, near-black in dark. */
  brandOn: string;
  /** Tint for selected chips and active tabs. */
  brandTint: string;
  brandInk: string;
  /** Action colour: Donate and the page's one main conversion only. */
  action: string;
  actionHover: string;
  text: string;
  textMuted: string;
  surface: string;
  page: string;
  subtle: string;
  border: string;
  borderStrong: string;
  success: string;
  danger: string;
}

export interface Direction {
  id: string;
  name: string;
  summary: string;
  headingFont: string;
  headingTracking: string;
  light: Palette;
  dark: Palette;
}

const SHARED_ACTION = { action: '#EB6A1F', actionHover: '#D45914' };

/**
 * The three Donate oranges the owner chooses between (2026-11-21). The middle
 * one is the brightest orange with #EB6A1F's hue (OKLCH 45°) whose white label
 * still meets 4.5:1: found by lowering OKLCH lightness at the largest in-gamut
 * chroma until the ratio passes.
 */
export const DONATE_ORANGES = [
  { hex: '#EB6A1F', hover: '#D45914', name: 'Today’s orange', note: 'Below AA for its label' },
  { hex: '#C75300', hover: '#B14900', name: 'Brightest passing', note: 'Same hue, just passes' },
  { hex: '#C2410C', hover: '#9A3412', name: 'Deeper', note: 'Redder, passes with room' },
] as const;

/** OKLCH hue in degrees, to show that success and the brand are different hues. */
export function hueOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
}

export const DIRECTIONS: Direction[] = [
  {
    id: 'blue-a',
    name: 'Direction 1 — Logo blue, type A',
    summary:
      'Calm and institutional. The logo blue carries every interactive state; Manrope stays for headings only, at 600, on a clean scale; Inter for text.',
    headingFont: 'var(--font-heading)',
    headingTracking: '-0.02em',
    light: {
      brand: '#0063BF',
      brandHover: '#00539F',
      brandOn: '#FFFFFF',
      brandTint: '#EAF2FC',
      brandInk: '#00498C',
      ...SHARED_ACTION,
      text: '#0F172A',
      textMuted: '#475569',
      surface: '#FFFFFF',
      page: '#F8FAFC',
      subtle: '#F1F5F9',
      border: '#E2E8F0',
      borderStrong: '#64748B',
      success: '#15803D',
      danger: '#B91C1C',
    },
    dark: {
      brand: '#5AA7F0',
      brandHover: '#7DBBF4',
      brandOn: '#0B1220',
      brandTint: '#0E2A47',
      brandInk: '#A9D1F7',
      ...SHARED_ACTION,
      text: '#E2E8F0',
      textMuted: '#94A3B8',
      surface: '#111827',
      page: '#0B1220',
      subtle: '#1A2333',
      border: '#263244',
      borderStrong: '#64748B',
      success: '#4ADE80',
      danger: '#F87171',
    },
  },
  {
    id: 'green-b',
    name: 'Direction 2 — Logo green, type B',
    summary:
      'Warm and hopeful. The logo green, deepened so text and buttons pass AA, carries every interactive state; one family (Inter) for headings and text, tighter tracking on headings.',
    headingFont: 'var(--font-body)',
    headingTracking: '-0.025em',
    light: {
      brand: '#1E7B24',
      brandHover: '#18661D',
      brandOn: '#FFFFFF',
      brandTint: '#EBF6EC',
      brandInk: '#155A19',
      ...SHARED_ACTION,
      text: '#111827',
      textMuted: '#4B5563',
      surface: '#FFFFFF',
      page: '#F9FAFB',
      subtle: '#F3F4F6',
      border: '#E5E7EB',
      borderStrong: '#6B7280',
      success: '#0F766E', // teal, not the brand green: owner 2026-11-21
      danger: '#B91C1C',
    },
    dark: {
      brand: '#5CC461',
      brandHover: '#7AD27E',
      brandOn: '#0B0D10',
      brandTint: '#14301A',
      brandInk: '#A6E3A9',
      ...SHARED_ACTION,
      text: '#E5E7EB',
      textMuted: '#9CA3AF',
      surface: '#121417',
      page: '#0B0D10',
      subtle: '#1B1E23',
      border: '#2A2E35',
      borderStrong: '#6B7280',
      success: '#2DD4BF',
      danger: '#F87171',
    },
  },
];

// --- Contrast (WCAG 2.2) ------------------------------------------------------

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const PAIRS: {
  label: string;
  fg: keyof Palette | 'white';
  bg: keyof Palette | `#${string}`;
  need: number;
}[] = [
  { label: 'Body text on card', fg: 'text', bg: 'surface', need: 4.5 },
  { label: 'Secondary text on page', fg: 'textMuted', bg: 'page', need: 4.5 },
  { label: 'Link (brand) on card', fg: 'brand', bg: 'surface', need: 4.5 },
  { label: 'Label on brand button', fg: 'brandOn', bg: 'brand', need: 4.5 },
  { label: 'Selected chip text on tint', fg: 'brandInk', bg: 'brandTint', need: 4.5 },
  ...DONATE_ORANGES.map((orange) => ({
    label: `White on ${orange.hex} (Donate, ${orange.name.toLowerCase()})`,
    fg: 'white' as const,
    bg: orange.hex,
    need: 4.5,
  })),
  { label: 'Success text on card', fg: 'success', bg: 'surface', need: 4.5 },
  { label: 'Input border on card (UI, 3:1)', fg: 'borderStrong', bg: 'surface', need: 3 },
];

function ContrastTable({ palette }: { palette: Palette }) {
  return (
    <table className="w-full text-left text-[13px]">
      <tbody>
        {PAIRS.map((pair) => {
          const fg = pair.fg === 'white' ? '#FFFFFF' : palette[pair.fg];
          const bg = pair.bg.startsWith('#') ? pair.bg : palette[pair.bg as keyof Palette];
          const ratio = contrast(fg, bg);
          const ok = ratio >= pair.need;
          return (
            <tr key={pair.label} className="border-(--d-border) border-t">
              <td className="py-1.5 pr-2">{pair.label}</td>
              <td className="py-1.5 pr-2 tabular-nums">{ratio.toFixed(2)}:1</td>
              <td
                className={`py-1.5 font-medium ${ok ? 'text-(--d-success)' : 'text-(--d-danger)'}`}
              >
                <span className="inline-flex items-center gap-1">
                  {ok ? (
                    <Check className="size-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <X className="size-3.5 shrink-0" aria-hidden="true" />
                  )}
                  {ok ? 'Pass' : `Below ${pair.need}:1`}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// --- Shared bits ---------------------------------------------------------------

function vars(direction: Direction, palette: Palette): React.CSSProperties {
  return {
    '--d-brand': palette.brand,
    '--d-brand-hover': palette.brandHover,
    '--d-brand-on': palette.brandOn,
    '--d-brand-tint': palette.brandTint,
    '--d-brand-ink': palette.brandInk,
    '--d-action': palette.action,
    '--d-action-hover': palette.actionHover,
    '--d-text': palette.text,
    '--d-muted': palette.textMuted,
    '--d-surface': palette.surface,
    '--d-page': palette.page,
    '--d-subtle': palette.subtle,
    '--d-border': palette.border,
    '--d-border-strong': palette.borderStrong,
    '--d-success': palette.success,
    '--d-danger': palette.danger,
    '--d-heading': direction.headingFont,
    '--d-tracking': direction.headingTracking,
    fontFamily: 'var(--font-body)',
  } as React.CSSProperties;
}

const H = 'font-(family-name:--d-heading) tracking-(--d-tracking) font-semibold text-(--d-text)';
const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--d-brand)';
const MOTION = 'transition-colors duration-200 ease-out motion-reduce:transition-none';

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-(--d-brand) text-[12px] font-semibold uppercase tracking-[0.08em]">
      {children}
    </p>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="bg-(--d-subtle) h-2 overflow-hidden rounded-full">
      <div
        className="bg-(--d-brand) h-full rounded-full"
        style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
      />
    </div>
  );
}

// --- Samples -------------------------------------------------------------------

function HeaderStrip() {
  return (
    <div className="border-(--d-border) bg-(--d-surface) flex items-center justify-between rounded-xl border px-4 py-3">
      <nav className="flex items-center gap-4 text-[14px] font-medium">
        <a className={`text-(--d-text) hover:text-(--d-brand) ${MOTION} ${FOCUS}`} href="#home">
          Home
        </a>
        <a
          className={`text-(--d-brand) underline decoration-2 underline-offset-[10px] ${FOCUS}`}
          href="#campaigns"
          aria-current="page"
        >
          Campaigns
        </a>
        <a className={`text-(--d-text) hover:text-(--d-brand) ${MOTION} ${FOCUS}`} href="#stories">
          Stories
        </a>
      </nav>
      <a
        href="#sign-in"
        className={`border-(--d-border) text-(--d-text) hover:border-(--d-border-strong) h-9 rounded-lg border px-3 text-[14px] font-medium leading-9 ${MOTION} ${FOCUS}`}
      >
        Sign in
      </a>
    </div>
  );
}

function CampaignHero({ campaign }: { campaign: Campaign }) {
  const goal = campaign.progress?.goal ?? campaign.goalAmount;
  const raised = campaign.progress?.raised ?? campaign.amountRaised;
  const percent = goal > 0 ? Math.floor((raised / goal) * 100) : 0;
  return (
    <section className="space-y-4">
      <MediaFrame media={campaign.cover} aspect="video" className="rounded-2xl" sizes="600px" />
      <span className="bg-(--d-brand-tint) text-(--d-brand-ink) inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium">
        {campaign.programName || campaign.category}
      </span>
      <h1 className={`${H} text-[36px] leading-[44px]`}>{campaign.title}</h1>
      <p className="text-(--d-muted) text-[16px] leading-[26px]">{campaign.shortDescription}</p>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-[14px]">
          <span className="text-(--d-text) tabular-nums">
            <strong className="text-[20px] font-semibold">{formatCurrency(raised)}</strong> raised
          </span>
          <span className="text-(--d-muted) tabular-nums">
            {percent}% of {formatCurrency(goal)}
          </span>
        </div>
        <ProgressBar percent={percent} />
      </div>
    </section>
  );
}

function DonateCard({ mode }: { mode: 'light' | 'dark' }) {
  const chips = [500, 1000, 2500, 5000];
  return (
    <section className="border-(--d-border) bg-(--d-surface) space-y-4 rounded-2xl border p-5">
      <h2 className={`${H} text-[20px] leading-[28px]`}>Your donation</h2>
      <div>
        <p className="text-(--d-text) mb-2 text-[14px] font-medium">Choose an amount</p>
        <div className="grid grid-cols-2 gap-2">
          {chips.map((rupees, index) => {
            const selected = index === 1;
            return (
              <button
                key={rupees}
                type="button"
                aria-pressed={selected}
                className={`flex h-11 items-center justify-center gap-1.5 rounded-lg border text-[15px] font-medium tabular-nums ${MOTION} ${FOCUS} ${
                  selected
                    ? 'border-(--d-brand) bg-(--d-brand-tint) text-(--d-brand-ink)'
                    : 'border-(--d-border-strong) text-(--d-text) hover:border-(--d-brand)'
                }`}
              >
                {selected ? <Check className="size-4" aria-hidden="true" /> : null}
                {formatCurrency(rupees * 100)}
              </button>
            );
          })}
        </div>
        <label className="mt-2 block">
          <span className="sr-only">Other amount</span>
          <span className="border-(--d-border-strong) focus-within:border-(--d-brand) focus-within:outline-(--d-brand) flex h-11 items-center rounded-lg border px-3 focus-within:outline-2 focus-within:outline-offset-0">
            <span className="text-(--d-muted) pr-2">₹</span>
            <input
              inputMode="numeric"
              placeholder="Other amount"
              className="text-(--d-text) placeholder:text-(--d-muted) w-full bg-transparent text-[15px] outline-none"
            />
          </span>
        </label>
      </div>
      <div className="border-(--d-border) flex items-baseline justify-between border-t pt-3">
        <span className="text-(--d-muted) text-[14px]">Total</span>
        <span className="text-(--d-text) text-[24px] font-semibold tabular-nums">₹1,000</span>
      </div>
      <button
        type="button"
        className={`bg-(--d-action) hover:bg-(--d-action-hover) h-12 w-full rounded-lg text-[16px] font-semibold text-white active:scale-[0.98] motion-reduce:active:scale-100 ${MOTION} ${FOCUS}`}
      >
        Donate ₹1,000
      </button>
      <p className="text-(--d-muted) flex items-center justify-center gap-1.5 text-[13px]">
        <Lock className="size-3.5" aria-hidden="true" /> Secure payment via Razorpay
      </p>
      <div
        className={`[&_img]:h-3.5 [&_svg]:h-3.5 [&_ul]:flex-nowrap [&_ul]:justify-center [&_ul]:gap-x-3 ${
          mode === 'dark' ? '[&_ul]:py-1.5' : 'opacity-70 grayscale'
        }`}
      >
        <PaymentLogos />
      </div>
      <button
        type="button"
        className={`border-(--d-border) text-(--d-text) hover:border-(--d-border-strong) flex h-10 w-full items-center justify-center gap-2 rounded-lg border text-[14px] font-medium ${MOTION} ${FOCUS}`}
      >
        <Share2 className="size-4" aria-hidden="true" /> Share campaign
      </button>
    </section>
  );
}

function SectionCard({ campaign }: { campaign: Campaign }) {
  const paragraphs = campaign.story.slice(0, 2);
  return (
    <section className="space-y-3">
      <Eyebrow>About this campaign</Eyebrow>
      <h2 className={`${H} text-[28px] leading-[36px]`}>Why this campaign</h2>
      {paragraphs.map((text, index) => (
        <p
          key={index}
          className={`text-[16px] leading-[26px] ${index === 0 ? 'text-(--d-text)' : 'text-(--d-muted)'}`}
        >
          {text}
        </p>
      ))}
      <div className="border-(--d-border) bg-(--d-surface) divide-(--d-border) grid grid-cols-1 divide-y rounded-xl border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          ['Goal', formatCurrency(campaign.progress?.goal ?? campaign.goalAmount)],
          ['Donors', String(campaign.donorCount)],
          ['People helped', String(campaign.beneficiariesReached)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-3 px-3 py-2.5 sm:block sm:py-3"
          >
            <p className="text-(--d-muted) text-[12px]">{label}</p>
            <p className="text-(--d-text) text-[17px] font-semibold tabular-nums sm:text-[20px]">
              {value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FaqList({ faqs }: { faqs: CampaignFaq[] }) {
  return (
    <section className="space-y-3">
      <h2 className={`${H} text-[28px] leading-[36px]`}>Questions</h2>
      <div className="border-(--d-border) bg-(--d-surface) divide-(--d-border) divide-y rounded-xl border">
        {faqs.slice(0, 5).map((faq, index) => (
          <details key={faq.question} open={index === 0} className="group px-4">
            <summary
              className={`text-(--d-text) flex cursor-pointer list-none items-center justify-between gap-3 py-3.5 text-[15px] font-medium ${FOCUS}`}
            >
              {faq.question}
              <ChevronDown
                className="text-(--d-muted) size-4 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </summary>
            <p className="text-(--d-muted) pb-4 text-[15px] leading-[24px]">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function CampaignCardSample({ campaign }: { campaign: Campaign }) {
  const goal = campaign.progress?.goal ?? campaign.goalAmount;
  const raised = campaign.progress?.raised ?? campaign.amountRaised;
  const percent = goal > 0 ? Math.floor((raised / goal) * 100) : 0;
  return (
    <a
      href="#card"
      className={`border-(--d-border) bg-(--d-surface) hover:border-(--d-border-strong) block overflow-hidden rounded-xl border hover:shadow-[0_4px_16px_rgb(15_23_42/0.08)] ${MOTION} ${FOCUS}`}
    >
      <MediaFrame media={campaign.cover} aspect="video" rounded={false} sizes="300px" />
      <div className="space-y-2.5 p-4">
        <span className="text-(--d-brand) text-[12px] font-medium">
          {campaign.programName || campaign.category}
        </span>
        <h3 className={`${H} text-[18px] leading-[26px]`}>{campaign.title}</h3>
        <ProgressBar percent={percent} />
        <p className="text-(--d-muted) flex justify-between text-[13px] tabular-nums">
          <span>
            <strong className="text-(--d-text) font-semibold">{formatCurrency(raised)}</strong> of{' '}
            {formatCurrency(goal)}
          </span>
          <span>{percent}%</span>
        </p>
      </div>
    </a>
  );
}

function ButtonsAndInputs() {
  const base = `inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-[15px] font-medium ${MOTION} ${FOCUS}`;
  return (
    <section className="space-y-4">
      <h2 className={`${H} text-[20px] leading-[28px]`}>Buttons and inputs</h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`${base} bg-(--d-action) hover:bg-(--d-action-hover) font-semibold text-white`}
        >
          Donate (action)
        </button>
        <button
          type="button"
          className={`${base} bg-(--d-brand) hover:bg-(--d-brand-hover) text-(--d-brand-on)`}
        >
          Primary
        </button>
        <button
          type="button"
          className={`${base} border-(--d-border) text-(--d-text) hover:border-(--d-border-strong) border`}
        >
          Secondary
        </button>
        <button type="button" className={`${base} text-(--d-text) hover:bg-(--d-subtle)`}>
          Ghost
        </button>
        <button
          type="button"
          className={`${base} text-(--d-brand) underline-offset-4 hover:underline`}
        >
          Link
        </button>
        <button
          type="button"
          disabled
          className={`${base} bg-(--d-subtle) text-(--d-muted) cursor-not-allowed`}
        >
          Disabled
        </button>
      </div>
      <p className="text-(--d-muted) text-[13px]">
        Tab to any control to see its focus ring (2px brand colour, 2px offset).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-(--d-text) text-[14px] font-medium">Full name</span>
          <input
            className={`border-(--d-border) bg-(--d-surface) text-(--d-text) focus:border-(--d-brand) focus:outline-(--d-brand) h-11 w-full rounded-lg border px-3 text-[15px] outline-none focus:outline-2 focus:outline-offset-0`}
            defaultValue="Asha Verma"
          />
          <span className="text-(--d-muted) block text-[13px]">
            As it should appear on your receipt.
          </span>
        </label>
        <label className="block space-y-1.5">
          <span className="text-(--d-text) text-[14px] font-medium">Email</span>
          <input
            aria-invalid="true"
            className="border-(--d-danger) bg-(--d-surface) text-(--d-text) h-11 w-full rounded-lg border px-3 text-[15px] outline-none"
            defaultValue="asha@"
          />
          <span className="text-(--d-danger) block text-[13px]">Enter a full email address.</span>
        </label>
      </div>
      <div className="space-y-2">
        <p className="text-(--d-text) text-[14px] font-medium">Selected is not success</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="border-(--d-brand) bg-(--d-brand-tint) text-(--d-brand-ink) inline-flex h-11 items-center gap-1.5 rounded-lg border px-4 text-[15px] font-medium tabular-nums">
            <Check className="size-4" aria-hidden="true" />
            ₹1,000 selected
          </span>
          <p
            role="status"
            className="border-(--d-border) bg-(--d-surface) text-(--d-text) inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-[15px]"
          >
            <CircleCheck className="text-(--d-success) size-5" aria-hidden="true" />
            Profile saved
          </p>
        </div>
        <p className="text-(--d-muted) text-[13px]">
          Brand green marks a choice; success is teal and always has its own icon.
        </p>
      </div>
      <label className="border-(--d-border-strong) bg-(--d-surface) flex h-11 items-center gap-2 rounded-lg border px-3">
        <Search className="text-(--d-muted) size-4" aria-hidden="true" />
        <input
          placeholder="Search campaigns"
          className="text-(--d-text) placeholder:text-(--d-muted) w-full bg-transparent text-[15px] outline-none"
        />
      </label>
    </section>
  );
}

function HomeSample({ campaign }: { campaign: Campaign }) {
  return (
    <section className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl">
        <MediaFrame media={campaign.cover} aspect="video" rounded={false} sizes="600px" />
        <div className="absolute inset-0 flex flex-col justify-end gap-3 bg-gradient-to-t from-black/85 via-black/55 to-black/10 p-6">
          <h2 className="font-(family-name:--d-heading) tracking-(--d-tracking) text-[36px] font-semibold leading-[44px] text-white">
            Every child deserves a brighter future
          </h2>
          <p className="text-[16px] text-white/85">
            Together, we can create safer spaces to learn, grow and thrive.
          </p>
          <a
            href="#donate"
            className={`bg-(--d-action) hover:bg-(--d-action-hover) inline-flex h-11 w-fit items-center rounded-lg px-5 text-[15px] font-semibold text-white ${MOTION} ${FOCUS}`}
          >
            Donate now
          </a>
        </div>
      </div>
    </section>
  );
}

function FooterStrip() {
  return (
    <footer className="border-(--d-border) grid grid-cols-2 gap-4 border-t pt-5 text-[14px] sm:grid-cols-3">
      {[
        ['Explore', ['Programmes', 'Campaigns', 'Stories']],
        ['Information', ['About us', 'Volunteer', 'Contact us']],
        ['Legal', ['Privacy policy', 'Terms of use']],
      ].map(([heading, links]) => (
        <div key={heading as string} className="space-y-2">
          <p className="text-(--d-text) font-semibold">{heading}</p>
          {(links as string[]).map((link) => (
            <a
              key={link}
              href="#footer"
              className={`text-(--d-muted) hover:text-(--d-text) block ${MOTION} ${FOCUS}`}
            >
              {link}
            </a>
          ))}
        </div>
      ))}
    </footer>
  );
}

function TypeScale() {
  const rows: [string, string, string][] = [
    ['Display', 'text-[48px] leading-[56px]', '48 / 56'],
    ['H1', 'text-[36px] leading-[44px]', '36 / 44'],
    ['H2', 'text-[28px] leading-[36px]', '28 / 36'],
    ['H3', 'text-[20px] leading-[28px]', '20 / 28'],
  ];
  return (
    <section className="space-y-2">
      <h2 className={`${H} text-[20px] leading-[28px]`}>Type scale</h2>
      {rows.map(([label, size, spec]) => (
        <div key={label} className="flex items-baseline justify-between gap-4">
          <span className={`${H} ${size} truncate`}>Every gift counts</span>
          <span className="text-(--d-muted) shrink-0 text-[12px] tabular-nums">
            {label} {spec} · 600
          </span>
        </div>
      ))}
      {[
        ['Body', 'text-[16px] leading-[26px]', '16 / 26 · 400'],
        ['Small', 'text-[14px] leading-[22px]', '14 / 22 · 400'],
        ['Caption', 'text-[12px] leading-[16px]', '12 / 16 · 500'],
      ].map(([label, size, spec]) => (
        <div key={label} className="flex items-baseline justify-between gap-4">
          <span className={`text-(--d-text) ${size}`}>Your receipt arrives by email.</span>
          <span className="text-(--d-muted) shrink-0 text-[12px] tabular-nums">
            {label} {spec}
          </span>
        </div>
      ))}
    </section>
  );
}

function Swatches({ palette }: { palette: Palette }) {
  const swatches: [string, string, string][] = [
    ['Brand', palette.brand, 'Links, focus, selected, active, progress'],
    ['Brand tint', palette.brandTint, 'Selected chip, active tab'],
    ['Action', palette.action, 'Donate and one main CTA only'],
    ['Success', palette.success, 'Confirmations, always with an icon'],
    ['Text', palette.text, 'Headings and body'],
    ['Muted', palette.textMuted, 'Secondary text'],
    ['Border', palette.border, 'Cards and dividers'],
    ['Control border', palette.borderStrong, 'Inputs and chips (3:1, WCAG 1.4.11)'],
    ['Page', palette.page, 'Page background'],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 text-[12px]">
      {swatches.map(([name, hex, use]) => (
        <div
          key={name}
          className="border-(--d-border) flex items-center gap-2 rounded-lg border p-2"
        >
          <span
            className="border-(--d-border) size-8 shrink-0 rounded-md border"
            style={{ background: hex }}
          />
          <span>
            <span className="text-(--d-text) block font-medium">
              {name} <span className="text-(--d-muted) font-normal">{hex}</span>
            </span>
            <span className="text-(--d-muted)">{use}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Panel({
  direction,
  mode,
  campaign,
  faqs,
}: {
  direction: Direction;
  mode: 'light' | 'dark';
  campaign: Campaign;
  faqs: CampaignFaq[];
}) {
  const palette = direction[mode];
  return (
    <div
      style={vars(direction, palette)}
      className="bg-(--d-page) text-(--d-text) min-w-0 space-y-10 rounded-3xl p-4 sm:p-6"
      data-direction={direction.id}
      data-mode={mode}
    >
      <p className="text-(--d-muted) text-[12px] font-semibold uppercase tracking-[0.08em]">
        {mode === 'light' ? 'Light mode' : 'Dark mode'}
      </p>
      <HeaderStrip />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <CampaignHero campaign={campaign} />
        <DonateCard mode={mode} />
      </div>
      <SectionCard campaign={campaign} />
      <FaqList faqs={faqs} />
      {mode === 'light' ? (
        <>
          <HomeSample campaign={campaign} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CampaignCardSample campaign={campaign} />
            <div className="space-y-3">
              <h2 className={`${H} text-[20px] leading-[28px]`}>Colour roles</h2>
              <Swatches palette={palette} />
            </div>
          </div>
          <ButtonsAndInputs />
          <TypeScale />
        </>
      ) : null}
      <div className="space-y-2">
        <h2 className={`${H} text-[20px] leading-[28px]`}>Contrast (WCAG 2.2 AA)</h2>
        <ContrastTable palette={palette} />
      </div>
      <FooterStrip />
    </div>
  );
}

function DonateOrangeChooser({ direction }: { direction: Direction }) {
  return (
    <section className="mx-auto mb-10 max-w-[1400px] space-y-4">
      <div className="space-y-1">
        <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Donate orange: pick one</h2>
        <p className="text-[14px] leading-[22px] text-slate-600">
          The same Donate button in each orange, on the chosen direction’s light and dark cards.
          Hover a button to see its hover shade.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {DONATE_ORANGES.map((orange) => (
          <div
            key={orange.hex}
            className="min-w-0 overflow-hidden rounded-2xl border border-slate-200"
          >
            {(['light', 'dark'] as const).map((mode) => (
              <div
                key={mode}
                style={
                  {
                    ...vars(direction, direction[mode]),
                    '--d-action': orange.hex,
                    '--d-action-hover': orange.hover,
                  } as React.CSSProperties
                }
                className="bg-(--d-surface) space-y-2 p-5"
              >
                <button
                  type="button"
                  className={`bg-(--d-action) hover:bg-(--d-action-hover) h-12 w-full rounded-lg text-[16px] font-semibold tabular-nums text-white active:scale-[0.98] motion-reduce:active:scale-100 ${MOTION} ${FOCUS}`}
                >
                  Donate ₹1,000
                </button>
                <p className="text-(--d-muted) text-[12px]">
                  {mode === 'light' ? 'Light' : 'Dark'}
                </p>
              </div>
            ))}
            <div className="space-y-0.5 border-t border-slate-200 bg-white p-4 text-[14px]">
              <p className="font-semibold text-slate-900">
                {orange.name} <span className="font-normal text-slate-500">{orange.hex}</span>
              </p>
              <p className="tabular-nums text-slate-600">
                White label {contrast('#FFFFFF', orange.hex).toFixed(2)}:1 ·{' '}
                {contrast('#FFFFFF', orange.hex) >= 4.5 ? 'passes AA' : 'below AA (4.5:1)'}
              </p>
              <p className="text-slate-500">
                {orange.note}; hover {orange.hover}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The owner chose direction 2 (2026-11-21); direction 1 stays above for the record. */
const CHOSEN = DIRECTIONS.find((direction) => direction.id === 'green-b')!;

export function DesignDirections({ campaign, faqs }: { campaign: Campaign; faqs: CampaignFaq[] }) {
  return (
    <main className="min-h-dvh bg-white px-4 py-10 text-slate-900 sm:px-8">
      <header className="mx-auto mb-10 max-w-3xl space-y-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          Visual polish · Phase 1 · proposal only
        </p>
        <h1 className="text-[32px] font-semibold leading-[40px] tracking-[-0.02em]">
          Direction 2: logo green, Inter only
        </h1>
        <p className="text-[16px] leading-[26px] text-slate-600">
          Chosen by the owner on 2026-11-21, shown on a real campaign (“{campaign.title}”). Green
          carries every interactive state; success is a separate teal with an icon; headings at 600
          with slight negative letter-spacing; amounts in tabular numbers. Orange is only for Donate
          and a page’s one main conversion button. Nothing here changes the live site.
        </p>
        <ul className="list-inside list-disc text-[14px] leading-[22px] text-slate-600">
          <li>Spacing on a 4px grid; sections 64/96px apart on desktop, 40/56px on mobile.</li>
          <li>Radius: 8px controls, 12px small cards, 16–20px large cards, full for pills.</li>
          <li>
            Elevation: border first; one hover shadow on clickable cards; overlays only above that.
          </li>
          <li>Motion: 200ms ease-out for hovers, tabs and accordions; off with reduced motion.</li>
        </ul>
      </header>
      <DonateOrangeChooser direction={CHOSEN} />
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="min-w-0">
          <Panel direction={CHOSEN} mode="light" campaign={campaign} faqs={faqs} />
        </section>
        <section className="min-w-0">
          <Panel direction={CHOSEN} mode="dark" campaign={campaign} faqs={faqs} />
        </section>
      </div>
    </main>
  );
}
