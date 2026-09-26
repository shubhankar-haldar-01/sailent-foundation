import * as React from 'react';
import { ShieldCheck } from 'lucide-react';

import { cn } from '../lib/cn';
import { Button } from '../primitives/button';

type LinkLike = React.ComponentType<{
  href: string;
  className?: string;
  children: React.ReactNode;
}>;

const DefaultLink: LinkLike = ({ href, className, children }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

/**
 * SectionHeader.
 *
 * `as` defaults to h2 because a page has exactly one h1 and section headings
 * must not skip levels — heading order is a screen-reader navigation structure,
 * not a font-size picker.
 */
export interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  as?: 'h1' | 'h2' | 'h3';
  align?: 'left' | 'center';
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  as: Heading = 'h2',
  align = 'left',
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 md:flex-row md:items-end md:justify-between',
        align === 'center' && 'md:flex-col md:items-center md:text-center',
        className,
      )}
    >
      <div className={cn('max-w-2xl space-y-2', align === 'center' && 'mx-auto')}>
        {eyebrow ? (
          <p className="text-overline tracking-(--text-overline--letter-spacing) text-primary uppercase">
            {eyebrow}
          </p>
        ) : null}
        <Heading className={cn(Heading === 'h1' ? 'text-display' : 'text-h1', 'font-semibold')}>
          {title}
        </Heading>
        {description ? <p className="text-body-lg text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface CTASectionProps {
  title: string;
  description?: string;
  primaryAction: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  LinkComponent?: LinkLike;
  className?: string;
}

/**
 * CTASection — the closing block.
 *
 * One primary CTA and at most one secondary. Two equally-weighted CTAs halve
 * the effect of both (docs/information-architecture.md §3.4).
 */
export function CTASection({
  title,
  description,
  primaryAction,
  secondaryAction,
  LinkComponent = DefaultLink,
  className,
}: CTASectionProps) {
  const Link = LinkComponent;
  return (
    <section
      className={cn(
        'border-border bg-surface-sunken rounded-xl border px-6 py-12 text-center md:px-12 md:py-16',
        className,
      )}
    >
      <div className="mx-auto max-w-2xl space-y-4">
        <h2 className="text-h1 font-semibold">{title}</h2>
        {description ? <p className="text-body-lg text-muted-foreground">{description}</p> : null}
        <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
          <Button asChild size="lg">
            <Link href={primaryAction.href}>{primaryAction.label}</Link>
          </Button>
          {secondaryAction ? (
            <Button asChild variant="secondary" size="lg">
              <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export interface TrustSectionProps {
  /**
   * Registration identifiers. Each is OPTIONAL and omitted entirely when absent —
   * an invented or placeholder registration number is a serious problem, not a
   * cosmetic gap (docs/phase-0-decisions.md, open question 2).
   */
  registrations?: { label: string; value: string }[];
  points?: { title: string; description: string }[];
  reportsHref?: string;
  LinkComponent?: LinkLike;
  className?: string;
}

/**
 * TrustSection.
 *
 * Deliberately plain. Plain text reads as more credible than a badge graphic,
 * which reads as marketing — and for an organisation asking strangers for
 * money, credibility is the whole job of this block.
 */
export function TrustSection({
  registrations = [],
  points = [],
  reportsHref,
  LinkComponent = DefaultLink,
  className,
}: TrustSectionProps) {
  const Link = LinkComponent;
  const hasRegistrations = registrations.length > 0;

  return (
    <div className={cn('border-border bg-surface rounded-xl border p-6 md:p-8', className)}>
      <div className="flex items-start gap-3">
        <ShieldCheck className="text-success mt-0.5 size-6 shrink-0" aria-hidden="true" />
        <div className="flex-1 space-y-5">
          <h2 className="text-h3 font-semibold">Accountability</h2>

          {points.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2">
              {points.map((point) => (
                <li key={point.title}>
                  <p className="text-body-sm font-medium">{point.title}</p>
                  <p className="text-body-sm text-muted-foreground">{point.description}</p>
                </li>
              ))}
            </ul>
          ) : null}

          {hasRegistrations ? (
            <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {registrations.map((registration) => (
                <div
                  key={registration.label}
                  className="border-border flex justify-between gap-3 border-b py-1.5"
                >
                  <dt className="text-caption text-muted-foreground">{registration.label}</dt>
                  <dd data-numeric="" className="text-caption font-medium">
                    {registration.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {reportsHref ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={reportsHref}>See our reports</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
