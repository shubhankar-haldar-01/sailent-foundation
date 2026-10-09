import { categoryKey, categorySlug } from '@/lib/categories';
import type { Program } from '@/lib/mock/types';

/**
 * The programs listing's state, as it lives in the URL.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE AREA PILLS AND "VIEW MORE PROGRAMS" ARE LINKS, AND THE SERVER RENDERS
 * WHAT THEY LEAD TO — the same pattern as the campaigns listing
 * (`components/campaigns/listing-query.ts`).
 *
 * A filtered listing is a URL somebody can share, it survives the back
 * button, and it works with scripting off. No client component is needed:
 * every programme is already in hand (the API returns up to 100 in one page),
 * so narrowing and paging are a slice of that list, not another request.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** Two rows of three on a desktop — the reference design's first screen of cards. */
export const PROGRAMS_PAGE_SIZE = 6;

export interface ProgramsQuery {
  /** An area SLUG as it arrived; resolved against the real areas by the page. */
  category: string | null;
  /** How many pages of cards are showing — "View More Programs" adds one. */
  page: number;
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseProgramsQuery(params: SearchParams): ProgramsQuery {
  const page = Number.parseInt(first(params.page) ?? '1', 10);

  return {
    category: first(params.category)?.trim() || null,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** The listing URL for a query, with every default left out so links stay short. */
export function programsHref(query: Partial<ProgramsQuery>): string {
  const params = new URLSearchParams();

  if (query.category) params.set('category', categorySlug(query.category));
  if (query.page && query.page > 1) params.set('page', String(query.page));

  const search = params.toString();
  return search ? `/programs?${search}` : '/programs';
}

/**
 * The areas programmes actually have, in the order the programmes are shown.
 *
 * Derived from the live list, so a pill never leads to an empty area and a
 * new area appears the day its first programme is published. Compared with
 * `categoryKey`, so "Child Welfare" and "child welfare" are one pill.
 */
export function programAreas(programs: Program[]): string[] {
  const seen = new Set<string>();
  const areas: string[] = [];

  for (const program of programs) {
    const area = program.category?.trim();
    if (!area || seen.has(categoryKey(area))) continue;
    seen.add(categoryKey(area));
    areas.push(area);
  }
  return areas;
}

export interface ProgramsView {
  /** The resolved display name of the area in force, or null for every programme. */
  activeArea: string | null;
  /** Every programme in that area (or all of them). */
  matching: Program[];
  /** The first `PROGRAMS_PAGE_SIZE × page` of `matching`. */
  visible: Program[];
  /** The page actually shown, after clamping to what exists. */
  page: number;
  hasMore: boolean;
}

/**
 * What the listing shows for a query.
 *
 * RESOLVED, not merely present: a stale or mistyped area falls back to every
 * programme rather than to an empty page, and the pills then show "All
 * Programs" as selected — so the two halves of the page agree. A page number
 * past the end shows everything rather than nothing.
 */
export function programsView(programs: Program[], query: ProgramsQuery): ProgramsView {
  const activeArea = query.category
    ? (programAreas(programs).find((area) => categoryKey(area) === categoryKey(query.category)) ??
      null)
    : null;

  const matching = activeArea
    ? programs.filter((program) => categoryKey(program.category) === categoryKey(activeArea))
    : programs;

  const lastPage = Math.max(1, Math.ceil(matching.length / PROGRAMS_PAGE_SIZE));
  const page = Math.min(query.page, lastPage);
  const visible = matching.slice(0, PROGRAMS_PAGE_SIZE * page);

  return { activeArea, matching, visible, page, hasMore: visible.length < matching.length };
}
