/**
 * Document labels and formatting, shared by both sides of the boundary.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A PLAIN MODULE, NOT A CLIENT ONE, AND THAT IS THE WHOLE POINT.
 *
 * These lived in `components/admin/document-library.tsx`, which carries
 * `'use client'`. The server-rendered list imported `formatBytes` from there
 * and React refused it at runtime: "Attempted to call formatBytes() from the
 * server but formatBytes is on the client."
 *
 * A function exported from a client module is a client REFERENCE, not a
 * function — it can be rendered or passed as a prop, never called. Pure
 * helpers with no state and no hooks belong outside that boundary so both
 * sides can simply use them.
 * ══════════════════════════════════════════════════════════════════════════
 */

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  annual_report: 'Annual report',
  financial: 'Audited financial',
  impact_report: 'Impact report',
  utilisation: 'Utilisation report',
  policy: 'Policy',
  registration: 'Registration',
  internal: 'Internal',
  other: 'Other',
};

export const VISIBILITY_LABELS: Record<string, string> = {
  public: 'Public',
  private: 'Private',
  admin_only: 'Admin only',
};

/** What each visibility actually MEANS, in the terms §4.20 sets. */
export const VISIBILITY_MEANING: Record<string, string> = {
  public:
    'Served from the public bucket at a permanent URL. Reachable by anyone who has the link, ' +
    'and shown on the campaign it is attached to.',
  private: 'Private bucket. Reachable only through a link that expires after five minutes.',
  admin_only:
    'Private bucket, and treated as internal. Reachable only through a link that expires ' +
    'after five minutes.',
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
