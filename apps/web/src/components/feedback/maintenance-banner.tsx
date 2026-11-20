'use client';

import * as React from 'react';
import { Banner } from '@sailent/ui';

/**
 * A site-wide notice of planned work (docs/ui-feedback.md, Phase 4).
 *
 * Shown on every page, public and admin, while `NEXT_PUBLIC_MAINTENANCE_MESSAGE`
 * holds a message ("Donations will be unavailable on 2 Dec, 1–2am IST, while
 * we upgrade our systems."); nothing at all while it is empty. Like every
 * NEXT_PUBLIC_ value it is fixed when the site is BUILT, so changing it means
 * a redeploy (DEPLOYMENT.md).
 *
 * Dismissible, and the dismissal is remembered for that exact message only: a
 * new message is shown again to everyone who closed the last one.
 */
const CONFIGURED = process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE?.trim() ?? '';

/** A short, stable key per message, so a changed message is not already dismissed. */
function keyFor(message: string): string {
  let hash = 0;
  for (let index = 0; index < message.length; index += 1) {
    hash = (hash * 31 + message.charCodeAt(index)) | 0;
  }
  return `maintenance:${(hash >>> 0).toString(36)}`;
}

export function MaintenanceBanner({ message = CONFIGURED }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="border-warning/40 bg-warning-subtle border-b">
      <Banner
        tone="warning"
        title="Planned maintenance"
        storageKey={keyFor(message)}
        className="mx-auto max-w-7xl rounded-none border-0 bg-transparent px-4 py-3 sm:px-6"
      >
        {message}
      </Banner>
    </div>
  );
}
