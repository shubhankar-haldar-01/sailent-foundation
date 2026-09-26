import { permanentRedirect } from 'next/navigation';

/**
 * `/account` was the Phase 0 name for this area and shipped as a placeholder.
 * The Phase 7 brief names it `/dashboard`, so this is a permanent redirect
 * rather than a second route for the same thing — any link or bookmark that
 * predates the rename still lands somewhere useful.
 */
export default function AccountRedirect(): never {
  permanentRedirect('/dashboard');
}
