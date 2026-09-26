import { QueryClient, defaultShouldDehydrateQuery } from '@tanstack/react-query';

import { ApiClientError } from '../api/client';

/**
 * TanStack Query configuration.
 *
 * Defaults are chosen for a content site that also runs a checkout:
 *   • staleTime > 0 so a server-prefetched page does not immediately refetch
 *     on hydration, which would waste the render we already paid for
 *   • no retry on 4xx — a 403 will still be a 403 on the third attempt, and
 *     retrying a validation failure just delays the error the user needs to see
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiClientError && !error.isRetryable) {
            return false;
          }
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      },
      mutations: {
        // Mutations are never retried automatically. A retried donation is a
        // duplicate donation; idempotency keys are the mechanism for safe
        // retries, and they are explicit (docs/api-architecture.md §2).
        retry: false,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
  });
}
