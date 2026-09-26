'use client';

import * as React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { createQueryClient } from '@/lib/query/client';

let browserQueryClient: ReturnType<typeof createQueryClient> | undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: a fresh client per request, so one user's data can never be
    // served to another.
    return createQueryClient();
  }
  // Browser: reuse across renders, or every suspense boundary refetches.
  browserQueryClient ??= createQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(getQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
