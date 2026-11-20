'use client';

import * as React from 'react';
import { OfflineBanner, ToastProvider, TooltipProvider } from '@sailent/ui';

import { MaintenanceBanner } from '@/components/feedback/maintenance-banner';
import { TopProgressBar } from '@/components/feedback/top-progress-bar';

import { QueryProvider } from './query-provider';
import { ThemeProvider } from './theme-provider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <TooltipProvider delayDuration={300}>
          {/* Says so when the connection drops (docs/ui-feedback.md); payments depend on it. */}
          <OfflineBanner />
          {/* A thin bar while the next page loads (only if it takes over 150ms). */}
          <TopProgressBar />
          {/* Planned work, when NEXT_PUBLIC_MAINTENANCE_MESSAGE says so; otherwise nothing. */}
          <MaintenanceBanner />
          <ToastProvider>{children}</ToastProvider>
        </TooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
