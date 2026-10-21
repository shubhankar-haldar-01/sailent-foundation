import { categoryKey, categorySlug } from '@/lib/categories';
import type { Program } from '@/lib/mock/types';

/**
 * The programs listing's state, as it lives in the URL.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE MENU, THE SEARCH AND "VIEW MORE PROGRAMS" ALL LEAD TO URLS, AND THE
 * SERVER RENDERS WHAT THEY LEAD TO — the same pattern as the campaigns
 * listing (`components/campaigns/listing-query.ts`).
 *
 * A filtered listing is a URL somebody can share, it survives the back
 * button, and it works with scripting off. Every programme is already in
 * hand (the API returns up to 100 in one page and has no search of its own
 * for programmes), so narrowing, searching and paging are a slice of that
 * list, not another request.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** Two rows of three on a desktop — the reference design's first screen of cards. */
export const PROGRAMS_PAGE_SIZE = 6;

/** The most the search box carries, as the campaigns search does. */
const MAX_SEARCH_LENGTH = 200;

export interface ProgramsQuery {
  /** An area SLUG as it arrived; resolved against the real areas by the page. */
  category: string | null;
  /** The search box's text, trimmed; null when it is empty. */
  q: string | null;
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
    q: first(params.q)?.trim().slice(0, MAX_SEARCH_LENGTH) || null,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** The listing URL for a query, with every default left out so links stay short. */
export function programsHref(query: Partial<ProgramsQuery>): string {
  const params = new URLSearchParams();

  if (query.category) params.set('category', categorySlug(query.category));
  if (query.q) params.set('q', query.q);
  if (query.page && query.page > 1) params.set('page', String(query.page));

  const search = params.toString();
  return search ? `/programs?${search}` : '/programs';
}

export interface ProgramArea {
  /** The display name, spelt as the first programme in the area spells it. */
  name: string;
  /** That programme's icon, which stands for the whole area in the menu. */
  accent: Program['accentIcon'];
}

/**
 * The areas programmes actually have, in the order the programmes are shown.
 *
 * Derived from the live list, so a menu entry never leads to an empty area
 * and a new area appears the day its first programme is published. Compared
 * with `categoryKey`, so "Child Welfare" and "child welfare" are one area.
 */
export function programAreaOptions(programs: Program[]): ProgramArea[] {
  const seen = new Set<string>();
  const areas: ProgramArea[] = [];

  for (const program of programs) {
    const area = program.category?.trim();
    if (!area || seen.has(categoryKey(area))) continue;
    seen.add(categoryKey(area));
    areas.push({ name: area, accent: program.accentIcon });
  }
  return areas;
}

/** The area names alone — see `programAreaOptions`. */
export function programAreas(programs: Program[]): string[] {
  return programAreaOptions(programs).map((area) => area.name);
}

function words(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * The fields a search reads, weightiest first: a word in the NAME is a
 * better answer than one buried in the description.
 */
function fields(program: Program): { text: string; weight: number }[] {
  return [
    { text: program.name, weight: 4 },
    { text: program.category ?? '', weight: 3 },
    { text: program.tagline, weight: 2 },
    { text: program.shortDescription, weight: 1 },
  ].map((field) => ({ ...field, text: field.text.toLowerCase() }));
}

/**
 * How well a programme answers a search: the weight of the best field each
 * word is found in, summed — and 0 when any word is missing, so a rank of 0
 * means "not a match". "rural women" ranks Women Empowerment by its name;
 * "clinic" ranks Healthcare by its description.
 */
export function searchRank(program: Program, q: string): number {
  const haystack = fields(program);
  let rank = 0;
  for (const word of words(q)) {
    const best = Math.max(0, ...haystack.filter((f) => f.text.includes(word)).map((f) => f.weight));
    if (best === 0) return 0;
    rank += best;
  }
  return rank;
}

/** Whether a programme answers a search: every word of it, anywhere, in any order and case. */
export function matchesSearch(program: Program, q: string): boolean {
  return searchRank(program, q) > 0;
}

export interface ProgramsView {
  /** The resolved display name of the area in force, or null for every programme. */
  activeArea: string | null;
  /**
   * Every programme in that area (or all of them) that answers the search —
   * in the CMS's order, or with a search, the closest answers first (stable,
   * so programmes that rank alike keep the CMS's order).
   */
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
 * programme rather than to an empty page, and the menu then shows "All
 * categories" as selected — so the two halves of the page agree. A page
 * number past the end shows everything rather than nothing. A search that
 * matches nothing IS an empty page, because that is the honest answer.
 */
export function programsView(programs: Program[], query: ProgramsQuery): ProgramsView {
  const activeArea = query.category
    ? (programAreas(programs).find((area) => categoryKey(area) === categoryKey(query.category)) ??
      null)
    : null;

  const inArea = activeArea
    ? programs.filter((program) => categoryKey(program.category) === categoryKey(activeArea))
    : programs;
  const q = query.q;
  const matching = q
    ? inArea
        .filter((program) => matchesSearch(program, q))
        .sort((a, b) => searchRank(b, q) - searchRank(a, q))
    : inArea;

  const lastPage = Math.max(1, Math.ceil(matching.length / PROGRAMS_PAGE_SIZE));
  const page = Math.min(query.page, lastPage);
  const visible = matching.slice(0, PROGRAMS_PAGE_SIZE * page);

  return { activeArea, matching, visible, page, hasMore: visible.length < matching.length };
}
