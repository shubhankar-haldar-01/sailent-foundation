import Link from 'next/link';

import { cn } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';
import { BrandGlyph } from '@/components/layout/brand-mark';
import { MediaFrame } from '@/components/media/media-frame';
import { GreenSprig, LeafOutline } from '@/components/programs/decor';
import { headingExtraBold } from '@/lib/fonts';
import { localMedia } from '@/lib/media/public-asset';
import { siteConfig } from '@/lib/site-config';

/**
 * The sign-in and sign-up pages' frame, matched to the owner's login design
 * (2026-10-08): one rounded card, a welcome panel with the photograph on the
 * left and the page's own content on the right.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE FORM COMES FIRST IN THE SOURCE. The welcome panel is drawn on the left
 * from `lg` by grid order, but a keyboard or screen-reader user reaches the
 * heading and the form before the decoration. Below `lg` the panel is left
 * out: on a phone the form is the page.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <PageShell className="py-6 md:py-6">
      <div className="border-border/60 bg-surface mx-auto grid max-w-[66rem] overflow-hidden rounded-[1.5rem] border shadow-[0_24px_60px_-36px_rgb(15_23_42/0.35)] lg:grid-cols-[minmax(0,1.17fr)_minmax(0,1fr)]">
        <div className="px-6 py-8 sm:px-10 lg:flex lg:flex-col lg:justify-center lg:px-10 lg:py-5 xl:px-12">
          {children}
        </div>
        <WelcomePanel />
      </div>
    </PageShell>
  );
}

/** The brand lockup at the top of the form panel — larger than the header's. */
export function AuthBrand() {
  return (
    <Link
      href="/"
      className="focus-visible:outline-ring inline-flex items-center gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <span className="text-accent-800 dark:bg-primary/10 dark:text-foreground bg-(--cta-50) grid size-11 shrink-0 place-items-center rounded-full">
        <BrandGlyph className="size-6" />
      </span>
      <span>
        <span className="font-display text-foreground block text-[1.25rem] font-bold leading-tight tracking-[-0.01em]">
          {siteConfig.name}
        </span>
        <span className="text-muted-foreground block text-[0.8125rem] leading-snug">
          {siteConfig.tagline}
        </span>
      </span>
    </Link>
  );
}

/** "OR" between two ways forward. */
export function OrDivider({ label = 'OR', className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn('text-muted-foreground flex items-center gap-4 text-[0.8125rem]', className)}
    >
      <span aria-hidden="true" className="bg-border h-px flex-1" />
      <span>{label}</span>
      <span aria-hidden="true" className="bg-border h-px flex-1" />
    </div>
  );
}

/**
 * The welcome panel: greeting and tagline over a soft peach shape, the
 * photograph filling the rest, leaves at its corners and a quotation card.
 *
 * The photograph is the homepage banner's — the owner's choice (2026-10-08):
 * it is large enough to fill a tall panel sharply, which the smaller copy of
 * the design's photograph is not.
 *
 * THE PANEL KEEPS ITS PROPORTIONS (`aspect-[770/840]`, near the design's
 * 770×905): its peach shapes stretch with its height, so a panel only as tall
 * as a short form squashed the greeting's ground and the text ran onto the
 * photograph. The form column centres in whatever height that gives.
 *
 * EVERYTHING IS SIZED TO THE PANEL, not the screen: positions in percentages,
 * type and spacing in container units (`cqw`, hundredths of the panel's
 * width) taken from the design's 770px panel. So the greeting keeps to its
 * peach ground at 1024px as it does at 1536px, rather than running into the
 * photograph as the panel narrows. Small text has a floor, for legibility.
 */
function WelcomePanel() {
  const photo = localMedia(
    'sailent-foundation-banner',
    'A smiling schoolgirl in uniform holding a notebook, her classmates and village behind her',
  );
  const [first, second, third] = siteConfig.tagline.split('•').map((word) => word.trim());

  return (
    <aside
      aria-label="Welcome to Sailent Foundation"
      className="bg-(--cta-50) dark:bg-primary-soft @container relative hidden overflow-hidden lg:order-first lg:block lg:aspect-[770/840]"
    >
      <MediaFrame
        media={photo}
        rounded={false}
        // The girl a little right of centre, as the design places her.
        focus="77% 50%"
        // Zoomed on the girl, so she reads at the design's size and less of
        // the busy village behind her shows.
        className="absolute inset-0 aspect-auto h-full w-full [&_img]:origin-[61%_42%] [&_img]:scale-[1.24]"
        sizes="(min-width: 1024px) 570px, 1px"
      />

      {/* The peach shapes: the greeting's ground at the top left, a soft band along the foot. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 770 905"
        preserveAspectRatio="none"
        className="fill-(--cta-50) dark:fill-primary-soft pointer-events-none absolute inset-0 size-full"
      >
        <path d="M0 0 H476 C 414 70, 370 134, 372 214 C 374 294, 332 358, 282 416 C 238 468, 168 496, 104 508 C 60 516, 26 530, 0 550 Z" />
        <path d="M0 905 V 812 C 58 794, 132 806, 190 826 C 252 848, 296 818, 330 786 C 364 756, 420 768, 462 758 C 522 742, 562 702, 620 714 C 678 726, 718 690, 770 696 V 905 Z" />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 770 905"
        preserveAspectRatio="none"
        className="fill-(--cta-100)/50 dark:fill-cta-glow/10 pointer-events-none absolute inset-0 size-full"
      >
        {/* Cream behind the top-right leaves, and a second, deeper wave at the foot. */}
        <circle cx="720" cy="74" r="104" />
        <path d="M360 905 C 372 856, 412 820, 470 818 C 520 790, 566 762, 622 770 C 676 760, 724 748, 770 760 V 905 Z" />
      </svg>

      {/* Leaves: top right, left edge, and two sprigs along the foot. */}
      <GreenSprig className="absolute -right-[3%] -top-[3%] h-[24%] w-auto rotate-[56deg]" />
      <GreenSprig className="absolute -left-[3%] top-[49%] h-[22%] w-auto rotate-[14deg] -scale-x-100" />
      <GreenSprig className="absolute bottom-0 left-[46%] h-[25%] w-auto -rotate-[8deg]" />
      <LeafOutline className="text-cta-glow absolute bottom-[1%] left-[70%] h-[22%] w-auto rotate-[24deg]" />

      <div className="relative px-[6.6%] pt-[11%]">
        <p className="text-muted-foreground flex items-center gap-[1.6cqw] text-[clamp(1rem,3.12cqw,1.5rem)] leading-tight">
          <span aria-hidden="true" className="bg-cta-glow h-0.5 w-[6.2cqw] rounded-full" />
          Welcome to
        </p>
        <p
          className={cn(
            headingExtraBold.className,
            'text-foreground mt-[1cqw] text-[clamp(2.25rem,7cqw,3.375rem)] leading-[1.04] tracking-[-0.025em]',
          )}
        >
          <span className="block">Sailent</span>
          <span className="block">Foundation</span>
        </p>
        <p className="text-muted-foreground mt-[2.1cqw] flex items-center gap-[1cqw] text-[clamp(0.6875rem,2.34cqw,1.125rem)]">
          {first}
          <span aria-hidden="true" className="text-cta-glow">
            •
          </span>
          {second}
          <span aria-hidden="true" className="text-cta-glow">
            •
          </span>
          {third}
        </p>
        <p className="text-muted-foreground mt-[3.6cqw] text-[clamp(0.8125rem,2.34cqw,1.125rem)] leading-relaxed">
          {/* Broken where the design breaks it. */}
          <span className="block">Together, we can create</span>
          <span className="block">brighter futures for</span>
          <span className="block">stronger communities.</span>
        </p>
      </div>

      <figure className="bg-primary-soft absolute bottom-[10%] left-[6.6%] w-[43%] rounded-[3.6cqw] border border-white/70 py-[3.6cqw] pl-[3.6cqw] pr-[3.1cqw] shadow-[0_18px_40px_-28px_rgb(15_23_42/0.35)] dark:border-white/10">
        <blockquote className="flex gap-[2.1cqw]">
          <QuoteMark className="text-cta-glow mt-[0.8cqw] h-[3.6cqw] w-[4.7cqw] shrink-0" />
          <p className="text-foreground text-[clamp(0.9375rem,2.86cqw,1.375rem)] leading-[1.45]">
            <span className="block">Education</span>
            <span className="block">today for a</span>
            <span className="block">brighter tomorrow.</span>
          </p>
        </blockquote>
      </figure>
    </aside>
  );
}

/** Two heavy opening quotation marks, as the design draws them. */
function QuoteMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 36 28" fill="currentColor" className={className}>
      <path d="M15 4.5C9.4 6.6 6.4 10.3 6.2 15.6c.9-.4 1.9-.6 3-.6 3.6 0 6.1 2.4 6.1 5.9 0 3.6-2.7 6.1-6.4 6.1C4.3 27 1 23.4 1 17.9 1 10.7 5.3 4.6 13.3 1.1L15 4.5Zm19 0c-5.6 2.1-8.6 5.8-8.8 11.1.9-.4 1.9-.6 3-.6 3.6 0 6.1 2.4 6.1 5.9 0 3.6-2.7 6.1-6.4 6.1-4.6 0-7.9-3.6-7.9-9.1 0-7.2 4.3-13.3 12.3-16.8L34 4.5Z" />
    </svg>
  );
}
