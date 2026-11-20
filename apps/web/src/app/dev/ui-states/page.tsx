import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { UiStatesShowcase } from '@/components/feedback/ui-states-showcase';

export const metadata: Metadata = {
  title: 'UI states (development)',
  robots: { index: false, follow: false },
};

/**
 * The feedback building blocks in isolation, for review before rollout
 * (2026-11-19, Phase 1). Not part of the product: production answers 404,
 * as the API refuses its own /dev routes there.
 */
export default function UiStatesPage() {
  if (process.env.APP_ENV === 'production') notFound();
  return <UiStatesShowcase />;
}
