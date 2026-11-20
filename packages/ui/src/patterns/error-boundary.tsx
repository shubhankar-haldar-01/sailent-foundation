'use client';

import * as React from 'react';

import { ErrorState } from './states';

/**
 * Keeps one failing section from taking the whole page down (2026-11-19,
 * docs/ui-feedback.md). Routes have their own `error.tsx`; this is for a
 * section inside a page.
 *
 *   <ErrorBoundary title="Updates didn't load"><CampaignUpdates /></ErrorBoundary>
 *
 * Retry re-renders the section. `onError` reports the failure (error
 * tracking); the person sees only the friendly state.
 */
interface Props {
  children: React.ReactNode;
  title?: string;
  description?: string;
  onError?: (error: Error) => void;
  className?: string;
}

export class ErrorBoundary extends React.Component<Props, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error('[section error]', error);
    this.props.onError?.(error);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <ErrorState
        title={this.props.title ?? 'This section didn’t load'}
        description={this.props.description ?? 'The rest of the page is fine. Try again.'}
        onRetry={() => this.setState({ error: null })}
        className={this.props.className}
      />
    );
  }
}
