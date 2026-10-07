import 'server-only';

import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { connection } from 'next/server';

import { createServerApiClient } from '@/lib/api/server';
import { publicAssetExists } from '@/lib/media/public-asset';
import type { ApiClient } from '@/lib/api/client';
import { mockDataEnabled } from '@/lib/runtime-flags';

/**
 * The content source.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE rule governs this directory: the API is the source of truth, and the
 * fixtures are a DEVELOPMENT CONVENIENCE that cannot survive into production.
 *
 * Phase 2 built the entire public site against fixtures in `@/lib/mock`.
 * Phase 3 gives that site a real backend. Rather than rewriting twenty pages —
 * which would mean re-reviewing twenty pages of design — the pages now import
 * from here, and this layer decides where the data comes from.
 *
 * The fallback is deliberately narrow:
 *
 *   • It runs only when `FEATURE_MOCK_DATA` is on, and the config schema
 *     REFUSES to boot with that flag enabled in production. A production
 *     build therefore has no path to a fixture at all — a failed API call is
 *     an error, loudly, rather than a page that silently shows invented
 *     content to a donor.
 *   • It is confined to this directory. No component, page or API module
 *     imports a fixture; they import a function from here.
 *   • Every use logs what happened, so "the API is down and you are looking at
 *     fixtures" is never a silent state during development.
 *
 * Deleting the fallback is deleting one function.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** True while the fixtures are permitted. False in every production build. */
export const fixturesEnabled = mockDataEnabled();

export interface LoadOptions<T> {
  /** What to ask the API for. */
  fromApi: (api: ApiClient) => Promise<T>;
  /**
   * Development-only substitute, used ONLY when the API is unreachable and
   * fixtures are enabled. Omit it for content that has no fixture.
   */
  fallback?: () => T;
  /** Cache tag and revalidation for the Next.js fetch cache. */
  label: string;
}

/**
 * Never call the API while `next build` runs (Phase 14).
 *
 * During the build, `connection()` bails the route out of static
 * prerendering instead of letting it fetch, so a production image builds with
 * no API, database or secrets. Every public page already rendered per request
 * (the layout reads the session cookie), so nothing that used to be static
 * becomes dynamic beyond the few routes that had been prerendered from API
 * data at build time.
 *
 * ONLY during the build. At request time `connection()` is not needed — the
 * route is already dynamic — and it is not free: under `NODE_ENV=development`,
 * which the E2E stack uses with `next start`, Next.js resolves it on a timer,
 * and that stalled renders triggered by a server action (a sign-in redirect
 * never arrived; a page revalidated by an action never finished loading).
 * Calling it only in the build phase keeps request-time behaviour exactly as
 * it was before Phase 14.
 */
export async function requestTimeOnly(): Promise<void> {
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) await connection();
}

/**
 * Fetch content, with a development fallback.
 *
 * Errors are deliberately NOT swallowed in production: a page that renders
 * plausible-looking placeholder numbers when the database is unreachable is
 * worse than a page that fails, because nobody finds out.
 */
export async function loadContent<T>(options: LoadOptions<T>): Promise<T> {
  await requestTimeOnly();
  const api = createServerApiClient();

  try {
    return await options.fromApi(api);
  } catch (error) {
    if (!fixturesEnabled || !options.fallback) {
      throw error;
    }

    console.warn(
      `[content] ${options.label}: the API is unreachable, serving development fixtures. ` +
        `This branch cannot run in production. (${error instanceof Error ? error.message : String(error)})`,
    );
    return options.fallback();
  }
}

/**
 * Shared cache policy for public content.
 *
 * Five minutes: long enough that a burst of traffic to a campaign page does not
 * become a burst of database queries, short enough that publishing something
 * shows up while the person who published it is still looking at the page.
 * Tagged so a future CMS save can revalidate precisely instead of waiting.
 */
export function publicCache(tag: string): { next: { revalidate: number; tags: string[] } } {
  return { next: { revalidate: 300, tags: [tag] } };
}

/** The pagination envelope every list endpoint returns. */
export interface Paginated<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Turn a stored image reference into the shape the components expect.
 *
 * Real photography does not exist yet, so the API returns null for every cover
 * image and `MediaFrame` renders its deterministic placeholder from the seed.
 * When real URLs arrive this function is where they start being used, and
 * nothing else changes.
 */
export function toMedia(
  url: string | null | undefined,
  seed: string,
  alt: string,
): { seed: string; alt: string; url?: string } {
  if (url) return { seed, alt, url };

  /*
    No stored image — so look for one named after the seed under
    `public/images/`. A story seeded as `story-a-new-beginning` picks up
    `public/images/story-a-new-beginning.jpg` the moment that file exists, with
    no code change and nothing to wire up.

    This is the homepage hero's mechanism generalised: it is how a generated
    placeholder gets replaced by a real photograph ONE AT A TIME, rather than
    everything having to wait for the media library.
  */
  const local = findLocalImage(seed);
  return local ? { seed, alt, url: local } : { seed, alt };
}

/** Extensions tried, in order of preference. */
const IMAGE_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png'] as const;

function findLocalImage(seed: string): string | null {
  for (const extension of IMAGE_EXTENSIONS) {
    const path = `/images/${seed}${extension}`;
    if (publicAssetExists(path)) return path;
  }
  return null;
}
