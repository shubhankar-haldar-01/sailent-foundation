import * as React from 'react';

import { cn } from '../lib/cn';
import { formatNumber } from '../lib/format';

/**
 * ImpactStat — the component that enforces decision A14.
 *
 * Every public number must trace to a live database aggregate or a dated,
 * sourced impact record. This component therefore takes a `source`, not just
 * a value, and **renders nothing when the value is absent or zero**.
 *
 * That last behaviour is deliberate and is the whole point. A new campaign
 * shows its story and its goal — not "0 donors", and not a fabricated
 * placeholder. Reference sites in this sector routinely display round,
 * unverifiable numbers ("2K+ Lives Impacted"); that habit is exactly what
 * erodes the trust an NGO site exists to build.
 *
 * The consequence is that this site will show fewer numbers than a typical
 * NGO template, especially at launch. That is the intended outcome.
 */

export type StatSource =
  /** Computed live from the database (e.g. SUM of captured donations). */
  | { kind: 'aggregate'; description: string }
  /** A dated record entered by staff, with a method note and optional evidence. */
  | { kind: 'record'; description: string; asOf: string; evidenceUrl?: string }
  /**
   * Development placeholder. Renders a VISIBLE marker so a demo figure can
   * never be mistaken for a verified one. `description` states how the number
   * will be derived once real data exists, which is what makes the fixture
   * useful rather than arbitrary.
   */
  | { kind: 'demo'; description: string };

export interface ImpactStatProps {
  label: string;
  /** Absent or zero → the component renders nothing. */
  value: number | null | undefined;
  /** Where this number comes from. Required — a number without provenance is not publishable. */
  source: StatSource;
  /** Formatted display override, e.g. currency. Defaults to Indian number grouping. */
  format?: (value: number) => string;
  /** Unit suffix, e.g. "hours". */
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ImpactStat({
  label,
  value,
  source,
  format = formatNumber,
  unit,
  size = 'md',
  className,
}: ImpactStatProps) {
  // The A14 guard. Not a defensive nicety — the contract of this component.
  if (value === null || value === undefined || value === 0) {
    return null;
  }

  const valueSizes = {
    sm: 'text-h3',
    md: 'text-h1',
    lg: 'text-display',
  } as const;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span
        data-numeric=""
        className={cn('font-display text-foreground font-semibold leading-none', valueSizes[size])}
      >
        {format(value)}
        {unit ? (
          <span className="text-body-lg text-muted-foreground ml-1 font-normal">{unit}</span>
        ) : null}
      </span>
      <span className="text-body-sm text-muted-foreground">{label}</span>
      {source.kind === 'demo' ? (
        <span
          className="bg-warning-subtle text-warning-foreground inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide"
          title={source.description}
        >
          Demo data
        </span>
      ) : null}
      {source.kind === 'record' ? (
        <span className="text-caption text-muted-foreground/80">
          As of {source.asOf}
          {source.evidenceUrl ? (
            <>
              {' · '}
              <a
                href={source.evidenceUrl}
                className="underline underline-offset-2 hover:no-underline"
              >
                Source
              </a>
            </>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A band of stats. Collapses entirely when every child renders nothing, so a
 * site with no verifiable figures yet simply has no stats band rather than a
 * row of zeros.
 */
export function ImpactStatBand({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const visible = React.Children.toArray(children).filter(Boolean);
  if (visible.length === 0) return null;

  return (
    <div className={cn('grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8', className)}>{visible}</div>
  );
}
