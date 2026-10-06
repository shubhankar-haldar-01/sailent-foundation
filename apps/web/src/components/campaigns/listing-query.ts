/**
 * The campaign listing's state, as it lives in the URL.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * EVERY FILTER ON /campaigns IS A QUERY PARAMETER, AND THE SERVER RENDERS IT.
 *
 * Search, cause, status and "View More" all change the URL rather than local
 * state. That makes a filtered listing a link somebody can share, survives the
 * back button, and works with scripting off — the search is a GET form and the
 * cause tiles are plain links. The client components only make the same
 * navigation smoother.
 *
 * This module is shared by the server page and the client search bar, so the
 * two cannot disagree about what a parameter is called or what its default is.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** In the order the status menu lists them: the campaign lifecycle, then everything. */
export const CAMPAIGN_STATUSES = ['active', 'closed', 'completed', 'all'] as const;
export type CampaignStatusFilter = (typeof CAMPAIGN_STATUSES)[number];

/**
 * ACTIVE IS THE DEFAULT, and the label says so.
 *
 * The API's default listing is what is running today. Calling that "All
 * Campaigns" would be a label the grid does not back up — closed and completed
 * campaigns are one choice away, under their own names.
 */
export const STATUS_LABELS: Record<CampaignStatusFilter, string> = {
  active: 'Active Campaigns',
  closed: 'Closed Campaigns',
  completed: 'Completed Campaigns',
  all: 'All Campaigns',
};

/**
 * What each choice asks the API for.
 *
 * "Active" is what takes a donation today — the API's `open`: active, and not
 * past its end date. "Closed" is everything public that does not, short of
 * finished: paused, or active but past its deadline (`closed`). The two never
 * overlap, and "Completed" and "All" are as they say.
 */
export const API_STATUS: Record<CampaignStatusFilter, ApiListingStatus> = {
  active: 'open',
  closed: 'closed',
  completed: 'completed',
  all: 'all',
};

/** The public API's names for the listing's status filter. */
export type ApiListingStatus = 'open' | 'closed' | 'completed' | 'all';

/** Two rows of four at desktop — one full screen of cards per "View More". */
export const PAGE_SIZE = 8;

/**
 * The API caps `limit` at 100, and "View More" asks for `PAGE_SIZE × page`
 * in one request so the server can render every visible card. Twelve pages is
 * 96 cards — the last multiple of eight under the cap. Past that, search and
 * the cause filter are the way in.
 */
export const MAX_PAGES = 12;

/** The API rejects a longer `q`; trimming here keeps a pasted essay from erroring. */
const MAX_QUERY_LENGTH = 200;

export interface ListingQuery {
  q: string;
  /** A category SLUG as it arrived, resolved against real categories by the page. */
  category: string | null;
  status: CampaignStatusFilter;
  /** How many pages of cards are showing — "View More" adds one. */
  page: number;
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseStatus(value: unknown): CampaignStatusFilter {
  return CAMPAIGN_STATUSES.includes(value as CampaignStatusFilter)
    ? (value as CampaignStatusFilter)
    : 'active';
}

export function parseListingQuery(params: SearchParams): ListingQuery {
  const page = Number.parseInt(first(params.page) ?? '1', 10);

  return {
    q: (first(params.q) ?? '').trim().slice(0, MAX_QUERY_LENGTH),
    /*
      `category` is what the homepage's focus strip sends; `categorySlug` is
      what the footer's links have always sent. Both are honoured — the footer
      pointed at a parameter this page used to ignore.
    */
    category: first(params.category) || first(params.categorySlug) || null,
    status: parseStatus(first(params.status)),
    page: Number.isFinite(page) ? Math.min(MAX_PAGES, Math.max(1, page)) : 1,
  };
}

/** The listing URL for a query, with every default left out so links stay short. */
export function listingHref(query: Partial<ListingQuery>): string {
  const params = new URLSearchParams();
  const q = query.q?.trim();

  if (q) params.set('q', q);
  if (query.category) params.set('category', query.category);
  if (query.status && query.status !== 'active') params.set('status', query.status);
  if (query.page && query.page > 1) params.set('page', String(query.page));

  const search = params.toString();
  return search ? `/campaigns?${search}` : '/campaigns';
}
