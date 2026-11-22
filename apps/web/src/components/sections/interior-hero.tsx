import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle2 } from 'lucide-react';

import { cn, Skeleton } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import type { BreadcrumbEntry } from '@/lib/seo/structured-data';

/** A photograph for a hero: no words baked into it — the words are the page's own text. */
export interface InteriorHeroImage {
  src: string;
  alt: string;
  /** CSS `object-position`, so the subject stays in frame at every crop. */
  position?: string;
}

interface InteriorHeroProps {
  /**
   * `split`   — words on one side, the photograph on the other (stacks on a phone).
   * `overlay` — the photograph behind the words from `lg`; above them on a phone.
   * `compact` — no photograph: for a page whose content carries the pictures.
   * `editorial` — typography-led and open: a ruled eyebrow, a large heading
   *               revealed word by word, the lead and actions, and an aside
   *               beside them; no panel, gradient or photograph (Team, owner
   *               brief 2026-11-22).
   */
  variant: 'split' | 'overlay' | 'compact' | 'editorial';
  /** The `id` of the h1, for `aria-labelledby`. */
  id: string;
  breadcrumbs: BreadcrumbEntry[];
  eyebrow?: string;
  eyebrowIcon?: LucideIcon;
  title: string;
  lead?: string;
  /** Required for `split` and `overlay`. */
  image?: InteriorHeroImage;
  /** Buttons or links, already styled. */
  actions?: React.ReactNode;
  /** Short facts drawn from records (registration and the like), never claims. */
  facts?: string[];
  /** `compact` and `editorial`: what sits beside the heading (a count, faces). */
  aside?: React.ReactNode;
  /** `compact` only: a row under a hairline (a search box, filters). */
  footer?: React.ReactNode;
}

/**
 * The hero for the inside pages (About, Programs, Stories, Events, Team).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE WORDS ARE TEXT, NEVER PART OF THE PICTURE.
 *
 * The banners this replaces carried their titles inside the image: invisible
 * to screen readers, search and translation (each page hid a second heading
 * for them), unreadable once a phone shrank the banner, and impossible to crop
 * without cutting the words. Here the h1, the lead and the breadcrumb are the
 * page's own text, in the site's type, over or beside a photograph that holds
 * no writing at all.
 *
 * ONE SYSTEM, THREE SHAPES, so the inside pages read as one site: the same
 * breadcrumb, the same badge, the same heading scale, the same corner radius.
 * Inside pages stay short — the page's own content starts on the first screen.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function InteriorHero(props: InteriorHeroProps) {
  if (props.variant === 'split') return <SplitHero {...props} />;
  if (props.variant === 'overlay') return <OverlayHero {...props} />;
  if (props.variant === 'editorial') return <EditorialHero {...props} />;
  return <CompactHero {...props} />;
}

function Eyebrow({
  label,
  icon: Icon,
  onPhoto = false,
}: {
  label: string;
  icon?: LucideIcon;
  /** Over the photograph (the `overlay` hero from `lg`). */
  onPhoto?: boolean;
}) {
  return (
    <p
      className={cn(
        'bg-accent text-primary inline-flex w-fit items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-semibold',
        onPhoto && 'lg:bg-white/15 lg:text-white lg:ring-1 lg:ring-white/25 lg:backdrop-blur-sm',
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : null}
      {label}
    </p>
  );
}

function Facts({ facts }: { facts: string[] }) {
  return (
    <ul className="border-border mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t pt-6">
      {facts.map((fact) => (
        <li
          key={fact}
          className="text-foreground flex items-center gap-2 text-sm font-medium leading-snug"
        >
          <CheckCircle2 aria-hidden="true" className="text-primary size-4 shrink-0" />
          {fact}
        </li>
      ))}
    </ul>
  );
}

function SplitHero({
  id,
  breadcrumbs,
  eyebrow,
  eyebrowIcon,
  title,
  lead,
  image,
  actions,
  facts,
}: InteriorHeroProps) {
  return (
    <section aria-labelledby={id} className="relative isolate overflow-hidden">
      {/* A faint brand wash behind the top of the page: warmth, not decoration. */}
      <div
        aria-hidden="true"
        className="from-accent/60 pointer-events-none absolute inset-x-0 top-0 -z-10 h-[85%] bg-gradient-to-b to-transparent"
      />
      <PageShell className="pb-10 pt-6 sm:pb-14 sm:pt-8 lg:pb-16">
        <Breadcrumbs entries={breadcrumbs} className="mb-6 sm:mb-8" />
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
          <div className="max-w-xl">
            {eyebrow ? <Eyebrow label={eyebrow} icon={eyebrowIcon} /> : null}
            <h1
              id={id}
              className="font-display text-display text-foreground mt-4 text-balance font-semibold"
            >
              {title}
            </h1>
            {lead ? (
              <p className="text-body sm:text-body-lg text-muted-foreground mt-4 leading-relaxed">
                {lead}
              </p>
            ) : null}
            {actions ? <div className="mt-7 flex flex-wrap gap-3">{actions}</div> : null}
            {facts?.length ? <Facts facts={facts} /> : null}
          </div>

          {image ? (
            <div className="relative">
              <div className="bg-muted shadow-card relative aspect-[4/3] overflow-hidden rounded-3xl ring-1 ring-black/5 dark:ring-white/10">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 640px"
                  className="object-cover"
                  style={image.position ? { objectPosition: image.position } : undefined}
                />
              </div>
            </div>
          ) : null}
        </div>
      </PageShell>
    </section>
  );
}

function OverlayHero({
  id,
  breadcrumbs,
  eyebrow,
  eyebrowIcon,
  title,
  lead,
  image,
  actions,
  facts,
}: InteriorHeroProps) {
  return (
    <section aria-labelledby={id} className="pt-6 sm:pt-8">
      <PageShell>
        <Breadcrumbs entries={breadcrumbs} className="mb-5 sm:mb-6" />
        {/*
          On a phone the photograph sits ABOVE the words: text over a photo
          that narrow covers the faces and fights for contrast. From `lg` the
          words move onto the photograph, over a scrim that keeps them at
          WCAG AA whatever the picture does.
        */}
        <div className="lg:shadow-card relative lg:isolate lg:h-[30rem] lg:overflow-hidden lg:rounded-3xl">
          {image ? (
            <div className="bg-muted shadow-card relative aspect-[16/10] overflow-hidden rounded-3xl lg:absolute lg:inset-0 lg:-z-10 lg:aspect-auto lg:rounded-none lg:shadow-none">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                priority
                sizes="(max-width: 1280px) 100vw, 1280px"
                className="object-cover"
                style={image.position ? { objectPosition: image.position } : undefined}
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 hidden bg-gradient-to-r from-black/80 via-black/45 to-black/0 lg:block"
              />
            </div>
          ) : null}

          <div className="pt-6 lg:flex lg:h-full lg:max-w-2xl lg:flex-col lg:justify-center lg:p-14 lg:pt-14">
            {eyebrow ? <Eyebrow label={eyebrow} icon={eyebrowIcon} onPhoto /> : null}
            <h1
              id={id}
              className="font-display text-display text-foreground mt-4 text-balance font-semibold lg:text-white"
            >
              {title}
            </h1>
            {lead ? (
              <p className="text-body sm:text-body-lg text-muted-foreground mt-4 leading-relaxed lg:text-white/85">
                {lead}
              </p>
            ) : null}
            {actions ? <div className="mt-7 flex flex-wrap gap-3">{actions}</div> : null}
            {facts?.length ? (
              <div className="lg:[&_li]:text-white lg:[&_svg]:text-white lg:[&_ul]:border-white/20">
                <Facts facts={facts} />
              </div>
            ) : null}
          </div>
        </div>
      </PageShell>
    </section>
  );
}

function CompactHero({
  id,
  breadcrumbs,
  eyebrow,
  eyebrowIcon,
  title,
  lead,
  actions,
  aside,
  footer,
}: InteriorHeroProps) {
  return (
    <section aria-labelledby={id} className="pt-6 sm:pt-8">
      <PageShell>
        <Breadcrumbs entries={breadcrumbs} className="mb-5 sm:mb-6" />
        <div className="border-border bg-surface shadow-xs relative overflow-hidden rounded-3xl border">
          <div
            aria-hidden="true"
            className="from-accent/70 pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent"
          />
          <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12 lg:p-10">
            <div className="max-w-2xl">
              {eyebrow ? <Eyebrow label={eyebrow} icon={eyebrowIcon} /> : null}
              <h1
                id={id}
                className="font-display text-display text-foreground mt-3 text-balance font-semibold"
              >
                {title}
              </h1>
              {lead ? (
                <p className="text-body sm:text-body-lg text-muted-foreground mt-3 leading-relaxed">
                  {lead}
                </p>
              ) : null}
              {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
            </div>
            {aside ?? null}
          </div>
          {footer ? (
            <div className="border-border relative border-t px-6 py-4 sm:px-8 lg:px-10">
              {footer}
            </div>
          ) : null}
        </div>
      </PageShell>
    </section>
  );
}

/**
 * A figure for the `compact` hero's aside: a count the site already holds
 * (upcoming events, published stories) — never an estimate or a claim.
 */
export function HeroStat({
  value,
  label,
  icon: Icon,
}: {
  value: number;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-3 lg:flex-col lg:items-end lg:gap-2 lg:text-right">
      <span className="bg-accent text-primary grid size-12 shrink-0 place-items-center rounded-2xl">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p>
        <span
          data-numeric=""
          className="font-display text-foreground block text-3xl font-semibold tabular-nums leading-none"
        >
          {value}
        </span>
        <span className="text-muted-foreground mt-1 block whitespace-nowrap text-sm">{label}</span>
      </p>
    </div>
  );
}

/** `HeroStat`'s footprint while its count loads, so the heading beside it does not move. */
export function HeroStatSkeleton() {
  return (
    <div aria-hidden="true" className="flex items-center gap-3 lg:flex-col lg:items-end lg:gap-2">
      <Skeleton className="size-12 rounded-2xl" />
      <div className="flex flex-col gap-1.5 lg:items-end">
        <Skeleton className="h-7 w-10 rounded-md" />
        <Skeleton className="h-3.5 w-28 rounded-md" />
      </div>
    </div>
  );
}

/** Milliseconds between one heading word's entrance and the next. */
const WORD_STAGGER = 55;

/**
 * `editorial`: the typography carries the hero (Team, owner brief 2026-11-22).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * OPEN, RULED, TYPOGRAPHY-LED. No panel, no gradient, no photograph: a hairline
 * under the breadcrumb, an eyebrow led by a short rule, a large heading, the
 * lead at a reading measure, the actions, and an aside set off by a vertical
 * hairline from `lg`. The brand's green and Inter, like every other page.
 *
 * THE ENTRANCE IS CSS, NOT A LIBRARY. The words rise in one after another, the
 * lead and the actions follow — the site's own `rise-in` (opacity and
 * translate only, so nothing reflows), staggered by `--rise-delay`. It starts
 * on the first paint, before any JavaScript, so the text is never held back
 * waiting for hydration; under `prefers-reduced-motion` there is no movement
 * at all. Each word is an inline-block so it can move; the spaces between
 * them stay real text, so the heading wraps, balances and reads as one line
 * of text to a screen reader.
 * ══════════════════════════════════════════════════════════════════════════
 */
function EditorialHero({
  id,
  breadcrumbs,
  eyebrow,
  title,
  lead,
  actions,
  aside,
}: InteriorHeroProps) {
  const words = title.split(/\s+/).filter(Boolean);
  const afterHeading = 120 + words.length * WORD_STAGGER;
  const rise = (delay: number) => ({ '--rise-delay': `${delay}ms` }) as React.CSSProperties;

  return (
    <section aria-labelledby={id}>
      <PageShell className="pt-6 sm:pt-8">
        <Breadcrumbs entries={breadcrumbs} className="mb-0" />
        <div className="border-border mt-6 grid gap-10 border-t pb-12 pt-10 sm:mt-8 sm:pb-16 sm:pt-14 lg:grid-cols-12 lg:gap-12 lg:pt-16">
          <div className="lg:col-span-8">
            {eyebrow ? (
              <p className="rise-in text-primary flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em]">
                <span aria-hidden="true" className="bg-primary h-px w-8" />
                {eyebrow}
              </p>
            ) : null}
            <h1
              id={id}
              className="font-display text-foreground mt-5 text-balance text-[clamp(2.5rem,1.4rem+4.4vw,4.25rem)] font-semibold leading-[1.04] tracking-[-0.035em]"
            >
              {words.map((word, index) => (
                <span key={`${word}-${index}`}>
                  <span className="rise-in inline-block" style={rise(80 + index * WORD_STAGGER)}>
                    {word}
                  </span>
                  {index < words.length - 1 ? ' ' : null}
                </span>
              ))}
            </h1>
            {lead ? (
              <p
                className="rise-in text-body sm:text-body-lg text-muted-foreground mt-6 max-w-[34rem] leading-relaxed"
                style={rise(afterHeading)}
              >
                {lead}
              </p>
            ) : null}
            {actions ? (
              <div
                className="rise-in mt-8 flex flex-wrap items-center gap-3"
                style={rise(afterHeading + 80)}
              >
                {actions}
              </div>
            ) : null}
          </div>

          {aside ? (
            <div
              className="rise-in lg:col-span-4 lg:flex lg:items-end"
              style={rise(afterHeading + 160)}
            >
              {/* The rule marks the aside itself, not the column's empty height. */}
              <div className="lg:border-border lg:border-l lg:pl-8">{aside}</div>
            </div>
          ) : null}
        </div>
      </PageShell>
    </section>
  );
}
