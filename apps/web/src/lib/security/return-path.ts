/**
 * A same-site path to send someone to after signing in, or null.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * `next` comes from a query string, so it is attacker-controlled, and "sign
 * in, then be taken somewhere" is the shape of a phishing link.
 *
 * The old check — starts with `/`, not with `//` — let `/\evil.example`
 * through: browsers read a backslash there as a slash, so it left the site
 * (and so did `/<tab>/evil.example`, as browsers drop tabs and newlines in
 * URLs). Rather than list spellings, the value is resolved the way a browser
 * would resolve it, against a placeholder origin, and kept only if it is still
 * on that origin. What comes back is the normalised path, query and fragment.
 * ══════════════════════════════════════════════════════════════════════════
 */
const PLACEHOLDER_ORIGIN = 'https://same-site.invalid';

export function sameSitePath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw.startsWith('/')) return null;
  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
