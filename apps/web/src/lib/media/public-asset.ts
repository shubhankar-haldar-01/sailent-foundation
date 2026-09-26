import 'server-only';

import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Does a file exist under `public/`?
 *
 * ══════════════════════════════════════════════════════════════════════════
 * This is what lets a page ask for a real photograph and fall back to its
 * placeholder when the photograph has not arrived yet.
 *
 * Next.js serves `public/` statically and does not know at build time whether
 * a given file is there — a missing one is a 404 and a broken image box, on
 * the most prominent part of the page, with nothing in the build output to
 * say so. Checking on the server means the fallback is chosen before any HTML
 * is sent, so the page is never wrong.
 *
 * SERVER ONLY, and evaluated at module scope by its callers, so the disk is
 * touched once per server process rather than once per request. The trade is
 * that adding a photograph to a RUNNING production server needs a restart to
 * be picked up; in practice a new asset arrives with a deploy, which is a new
 * process anyway.
 *
 * The path is confined to `public/`: it is joined and then checked to be
 * inside that directory, so a caller cannot reach a file elsewhere on the
 * machine by passing `../`.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function publicAssetExists(publicPath: string): boolean {
  const root = path.join(process.cwd(), 'public');
  const resolved = path.resolve(root, `.${path.posix.normalize(`/${publicPath}`)}`);

  // `path.resolve` collapses any `..`, so this is the check that the result
  // is still inside `public/` rather than a trust in the caller.
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return false;

  try {
    return existsSync(resolved);
  } catch {
    // A permissions error is not a reason to fail a page render — it is a
    // reason to show the placeholder.
    return false;
  }
}

/** Extensions tried, in order of preference. */
const IMAGE_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png'] as const;

/**
 * A media reference for a hard-coded slot, with a real photograph if one is
 * there.
 *
 * Content from the API goes through `toMedia`, which does this already. This is
 * for the handful of pictures written directly into a component — the community
 * band's backdrop, the collage on the homepage — so they gain the same
 * "drop a file in and it appears" behaviour instead of being the only
 * placeholders on the site that cannot be replaced without a code change.
 *
 * SERVER ONLY, like everything in this file. The components that call it are
 * server components; the resolved shape is what reaches the browser.
 */
export function localMedia(seed: string, alt: string): { seed: string; alt: string; url?: string } {
  for (const extension of IMAGE_EXTENSIONS) {
    const path = `/images/${seed}${extension}`;
    if (publicAssetExists(path)) return { seed, alt, url: path };
  }
  return { seed, alt };
}
