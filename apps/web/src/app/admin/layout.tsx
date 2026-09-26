import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s — Sailent Admin' },
  // The admin area is never indexed, and is disallowed in robots.txt as well.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The outermost admin layout carries METADATA ONLY — no session check.
 *
 * The guard lives in the `(workspace)` route group instead, so that
 * `/admin/login` is reachable without one. A guard at this level would require
 * a session to reach the page where you get a session, which is a redirect
 * loop that only shows up once somebody is actually signed out.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
