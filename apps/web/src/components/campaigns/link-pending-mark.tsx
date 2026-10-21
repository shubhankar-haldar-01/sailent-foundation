'use client';

import { useLinkStatus } from 'next/link';

/**
 * Placed inside a `<Link>`: renders an empty `data-pending` marker while that
 * link's navigation is in flight, and nothing otherwise.
 *
 * It lets server-rendered markup react to a pending click with CSS alone —
 * `has-[[data-pending]]:` on the link itself (the tapped cause tile lights
 * up at once) or on an ancestor (the campaign grid dims while the new
 * results load) — without turning the whole listing into a client component.
 */
export function LinkPendingMark() {
  const { pending } = useLinkStatus();
  return pending ? <span data-pending="" hidden /> : null;
}
