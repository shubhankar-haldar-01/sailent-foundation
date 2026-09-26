import { ImpactStat, cn, formatNumber } from '@sailent/ui';

import type { ImpactMetric } from '@/lib/mock/impact';

/**
 * A band of impact statistics.
 *
 * Every figure is passed with `source: { kind: 'demo' }`, which renders a
 * visible "Demo data" marker. That is decision A14 doing its job: a number
 * nobody can verify must never be displayed as though it were verified, and
 * the marker disappears on its own when Phase 6 supplies real aggregates.
 *
 * `ImpactStat` renders nothing at all for a zero or absent value, and the band
 * collapses entirely if every figure is missing — so a new organization shows
 * no statistics rather than a row of zeros.
 */
export function StatBand({
  metrics,
  size = 'md',
  columns = 4,
  className,
}: {
  metrics: ImpactMetric[];
  size?: 'sm' | 'md' | 'lg';
  columns?: 3 | 4;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-6 md:gap-8',
        columns === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
        className,
      )}
    >
      {metrics.map((metric) => (
        <ImpactStat
          key={metric.id}
          label={metric.label}
          value={metric.value}
          unit={metric.unit}
          size={size}
          format={formatNumber}
          source={{ kind: 'demo', description: metric.derivation }}
        />
      ))}
    </div>
  );
}
