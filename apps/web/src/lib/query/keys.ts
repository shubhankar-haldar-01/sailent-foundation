/**
 * Query key factory.
 *
 * Centralised so invalidation is precise rather than a guess. Domain keys are
 * added as each phase implements its module; keeping them here means a
 * mutation can invalidate exactly what it affected.
 *
 * Convention: `[domain, scope, params]`, broadest first, so a partial key
 * invalidates everything beneath it.
 */
export const queryKeys = {
  health: ['health'] as const,

  // Added in later phases — listed so the convention is visible:
  // campaigns: {
  //   all: ['campaigns'] as const,
  //   list: (filters: CampaignFilters) => [...queryKeys.campaigns.all, 'list', filters] as const,
  //   detail: (slug: string) => [...queryKeys.campaigns.all, 'detail', slug] as const,
  // },
} as const;
