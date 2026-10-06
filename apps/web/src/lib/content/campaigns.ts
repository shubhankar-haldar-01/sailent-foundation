import 'server-only';

import type { Campaign, CampaignProduct } from '@/lib/mock/types';
import { donationAvailability } from '@sailent/validation';

import { campaigns as campaignFixtures } from '@/lib/mock/campaigns';
import { FEATURED_BAND_SIZE, orderFeaturedFirst } from '@/lib/featured-campaigns';
import { acceptsDonationsNow } from '@/components/campaigns/campaign-status';
import type { ApiListingStatus } from '@/components/campaigns/listing-query';

import { isNotFound } from './programs';
import { loadContent, publicCache, toMedia, type Paginated } from './source';

/**
 * Whole days from now until `endDate`, or null.
 *
 * The LIST endpoint does not send `daysRemaining` — only the detail one does —
 * and the approved card carries "N days left". This is a reading of a date, not
 * a derived money figure, so computing it here breaks no rule (decision A6
 * governs `amountRaised` and the counters, which are still only ever the
 * API's).
 *
 * It runs on the SERVER — this module is `server-only` and the cards that use
 * it are server components — so the figure is computed once and serialised.
 * Recomputing it in the browser would let a page rendered at 23:59 disagree
 * with itself a minute later.
 *
 * A campaign that has already ended reports null rather than a negative: "-3
 * days left" is worse than saying nothing.
 */
function daysUntil(endDate: string | null): number | null {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  if (Number.isNaN(end)) return null;
  const days = Math.ceil((end - Date.now()) / 86_400_000);
  return days > 0 ? days : null;
}

interface ApiCampaignSummary {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  coverImage: string | null;
  category: string | null;
  location: string | null;
  fundraisingGoal: number;
  amountRaised: number;
  donorCount: number;
  beneficiaryTarget: number | null;
  beneficiariesReached: number;
  startDate: string | null;
  endDate: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  isFeatured: boolean;
  hasProducts?: boolean;
  programTitle: string | null;
  programSlug: string | null;
  /** Computed by the API's shared implementation — never recomputed here. */
  progress?: CampaignProgressDto;
  daysRemaining?: number | null;
  donation?: DonationAvailabilityDto;
}

interface ApiCampaignProduct {
  /** The JUNCTION row's id — what a donation line points at. */
  id: string;
  /** The catalogue entry, carried so a donation survives the offer being removed. */
  productId: string;
  name: string;
  slug: string;
  description: string | null;
  /** The CAMPAIGN'S price, not the catalogue's. The default is not sent publicly. */
  price: number;
  unit: string;
  targetQuantity: number | null;
  providedQuantity: number;
  maxPerDonation: number;
  status: 'active' | 'inactive' | 'fulfilled';
  image: string | null;
}

export interface CampaignProgressDto {
  goal: number;
  raised: number;
  remaining: number;
  percent: number;
  rawPercent: number;
  goalReached: boolean;
  surplus: number;
}

export interface DonationAvailabilityDto {
  /** `ended`: active, but past its end date — closed by the deadline, not by a person. */
  state: 'open' | 'not-open' | 'paused' | 'completed' | 'ended' | 'unavailable';
  reason?: string;
}

export interface CampaignFaq {
  id: string;
  question: string;
  answer: string;
  displayOrder: number;
}

export interface CampaignGalleryImage {
  id: string;
  url: string | null;
  storageKey: string;
  altText: string;
  caption: string | null;
  displayOrder: number;
}

export interface CampaignUpdate {
  id: string;
  title: string;
  /** Its own page, `/impact/[slug]` — added in Phase 9. */
  slug: string;
  description: string;
  impactDate: string;
  location: string | null;
  metricValue: number | null;
  metricUnit: string | null;
  verificationMethod: string | null;
}

export interface CampaignDocument {
  id: string;
  title: string;
  description: string | null;
  documentType: string;
  fileName: string;
  sizeBytes: number;
  fileUrl: string | null;
  publishedAt: string | null;
}

interface ApiCampaignDetail extends ApiCampaignSummary {
  /**
   * The detail endpoint returns the program NESTED; the listing returns it
   * flattened onto the row. Both shapes are handled below rather than changing
   * one endpoint to match the other — a list that embedded a full program
   * object per campaign would be paying for it twenty times over.
   */
  program: { id: string; title: string; slug: string } | null;
  description: string | null;
  beneficiaryContext: string | null;
  impactNotes: { label: string; value: number; unit?: string }[] | null;
  products?: ApiCampaignProduct[];
  /** Normalised from Phase 4 — each was a JSON array on the campaign before. */
  faqs?: CampaignFaq[];
  gallery?: CampaignGalleryImage[];
  updates?: CampaignUpdate[];
  documents?: CampaignDocument[];
}

/** Split a stored body into paragraphs. Blank lines separate them, as in any editor. */
function paragraphs(body: string | null): string[] {
  if (!body) return [];
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function toProduct(row: ApiCampaignProduct, campaignSlug: string): CampaignProduct {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    // Paise, exactly as stored. Nothing here divides, rounds or reformats it
    // — the only component that turns paise into rupees is the formatter.
    unitAmount: row.price,
    targetQuantity: row.targetQuantity,
    providedQuantity: row.providedQuantity,
    /**
     * The per-donation ceiling comes from the API, not from a constant here.
     * It is a business rule about what a donor may buy at once, and a rule the
     * frontend keeps its own copy of is a rule that will disagree with the
     * server the first time it changes.
     */
    maxPerDonation: row.maxPerDonation,
    status: row.status,
    image: toMedia(row.image, `product-${campaignSlug}-${row.slug}`, row.name),
  };
}

function toCampaign(row: ApiCampaignSummary | ApiCampaignDetail): Campaign {
  const detail = row as Partial<ApiCampaignDetail>;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.shortDescription ?? '',
    programName: detail.program?.title ?? row.programTitle ?? '',
    programSlug: detail.program?.slug ?? row.programSlug ?? '',
    location: row.location,
    category: row.category ?? '',
    cover: toMedia(row.coverImage, `campaign-${row.slug}`, row.title),

    // Paise, straight through. No client-side arithmetic on money, ever
    // (decision A2) — and `amountRaised` is a derived column the API owns, so
    // nothing here may compute or adjust it (decision A6).
    goalAmount: row.fundraisingGoal,
    amountRaised: row.amountRaised,
    donorCount: row.donorCount,
    beneficiaryTarget: row.beneficiaryTarget,
    beneficiariesReached: row.beneficiariesReached,

    /**
     * Server-computed. The API owns the one implementation of progress and of
     * whether a campaign may take money, so the page never recalculates either
     * — a percentage that differs between the API and the page is the kind of
     * discrepancy a donor screenshots.
     *
     * A detail carries `donation`; a LIST row does not, so it is worked out
     * here by the same shared rule the API and the checkout use — status, then
     * end date. Without it every card would offer "Donate Now" on a campaign
     * whose deadline has passed and whose checkout already refuses.
     */
    progress: row.progress,
    donation: row.donation ?? donationAvailability(row.status, row.endDate),
    daysLeft: row.daysRemaining ?? daysUntil(row.endDate),

    startsAt: row.startDate ?? new Date().toISOString(),
    endsAt: row.endDate,
    status: row.status,
    isFeatured: row.isFeatured,
    // From the API on a listing; from the products themselves on a detail.
    hasProducts: row.hasProducts ?? (detail.products?.length ?? 0) > 0,

    story: paragraphs(detail.description ?? null),
    beneficiaryContext: detail.beneficiaryContext ?? '',
    // Gallery images now come from `media` joined through `campaign_gallery`.
    // The storage key doubles as the placeholder seed until real uploads land,
    // so the deterministic artwork stays stable per image.
    gallery: (detail.gallery ?? []).map((item) => ({
      seed: item.storageKey,
      alt: item.altText,
      caption: item.caption ?? undefined,
      ...(item.url ? { url: item.url } : {}),
    })),
    products: (detail.products ?? []).map((product) => toProduct(product, row.slug)),
    // Progress updates are `impact_updates` rows from Phase 4 onward, so they
    // carry a verified figure and the basis for it rather than loose prose.
    updates: (detail.updates ?? []).map((update) => ({
      id: update.id,
      title: update.title,
      body: update.description,
      publishedAt: update.impactDate,
      slug: update.slug,
    })),
    faqs: (detail.faqs ?? []).map((faq) => ({ question: faq.question, answer: faq.answer })),
    /*
      Public documents attached to this campaign (Phase 10.10).

      The API has already excluded anything not public, and returns `fileUrl`
      as null for anything that is not — so this is a straight pass-through
      rather than a filter. Defaulting to `[]` keeps the page's
      `.length > 0` check honest when the fixture fallback is serving.
    */
    documents: detail.documents ?? [],
    impactNotes: detail.impactNotes ?? [],
  };
}

export interface CampaignQuery {
  programSlug?: string;
  category?: string;
  state?: string;
  /** `open`: taking donations today — active and not past its end date. */
  status?: 'active' | 'open' | 'completed' | 'all';
  q?: string;
  sort?: string;
  limit?: number;
}

export async function getCampaigns(query: CampaignQuery = {}): Promise<Campaign[]> {
  return loadContent({
    label: 'campaigns',
    fromApi: async (api) => {
      const page = await api.get<Paginated<ApiCampaignSummary>>('campaigns', {
        query: { limit: query.limit ?? 100, ...query },
        ...publicCache('campaigns'),
      });
      return page.items.map(toCampaign);
    },
    // The fixtures only honour `open`, the one filter a page relies on to keep
    // closed campaigns out of a list.
    fallback: () =>
      query.status === 'open' ? campaignFixtures.filter(acceptsDonationsNow) : campaignFixtures,
  });
}

/**
 * The homepage's Featured Campaigns band: the campaigns an administrator
 * marked featured, in their featured order, then the rest by deadline — active
 * ones only. See `lib/featured-campaigns.ts` for the rule.
 *
 * The API orders them (`sort=featured`), and that order is kept exactly — it
 * is the only one that knows each campaign's featured order. Paused campaigns
 * are dropped here, because the public `active` listing returns active and
 * paused together — and so are active ones past their end date, which can no
 * longer take a donation. The request asks for twice the band so that dropping
 * them still leaves it full. The fixtures have no API to order them, so
 * `orderFeaturedFirst` applies the same rule to them.
 */
export async function getFeaturedCampaigns(): Promise<Campaign[]> {
  return loadContent({
    label: 'featured campaigns',
    fromApi: async (api) => {
      const page = await api.get<Paginated<ApiCampaignSummary>>('campaigns', {
        query: { status: 'active', sort: 'featured', limit: FEATURED_BAND_SIZE * 2 },
        ...publicCache('campaigns'),
      });
      return page.items
        .map(toCampaign)
        .filter((campaign) => acceptsDonationsNow(campaign))
        .slice(0, FEATURED_BAND_SIZE);
    },
    fallback: () => orderFeaturedFirst(campaignFixtures),
  });
}

/** One screen of the public listing, and whether the API holds more behind it. */
export interface CampaignListing {
  items: Campaign[];
  /** Every campaign matching the query, not just the ones returned. */
  total: number;
  hasMore: boolean;
}

/**
 * The public campaign listing — searched, filtered and paginated BY THE API.
 *
 * `getCampaigns` fetches everything and drops the pagination envelope, which
 * suits the pages that want a whole set. The listing page needs the envelope:
 * "View More Campaigns" appears only when the API says there is more, rather
 * than when a client-side slice happens to be shorter than the array it came
 * from.
 *
 * `q` is the API's own free-text search over title and short description, and
 * `category` its exact match on the category's display name. Nothing here
 * re-implements either.
 *
 * The fixture fallback applies the same three filters locally, so a
 * development machine without the API still shows a search that searches.
 */
export async function getCampaignListing(query: {
  q?: string;
  category?: string;
  /** The API's own names — see `API_STATUS` in `listing-query.ts`. */
  status?: ApiListingStatus;
  limit: number;
}): Promise<CampaignListing> {
  return loadContent({
    label: 'campaigns',
    fromApi: async (api) => {
      const page = await api.get<Paginated<ApiCampaignSummary>>('campaigns', {
        query: { page: 1, ...query },
        ...publicCache('campaigns'),
      });
      return {
        items: page.items.map(toCampaign),
        total: page.pagination.total,
        hasMore: page.pagination.hasNext,
      };
    },
    fallback: () => {
      const needle = query.q?.toLowerCase();
      const matching = campaignFixtures.filter((campaign) => {
        const status = query.status ?? 'open';
        if (status === 'completed' && campaign.status !== 'completed') return false;
        if (status === 'open' && !acceptsDonationsNow(campaign)) return false;
        if (
          status === 'closed' &&
          (acceptsDonationsNow(campaign) || !['active', 'paused'].includes(campaign.status))
        ) {
          return false;
        }
        if (query.category && campaign.category !== query.category) return false;
        if (
          needle &&
          !campaign.title.toLowerCase().includes(needle) &&
          !campaign.shortDescription.toLowerCase().includes(needle)
        ) {
          return false;
        }
        return true;
      });
      return {
        items: matching.slice(0, query.limit),
        total: matching.length,
        hasMore: matching.length > query.limit,
      };
    },
  });
}

/** One row of the public donor list. Exactly what the API returns, no more. */
export interface CampaignDonor {
  name: string;
  anonymous: boolean;
  /** Paise. */
  amount: number;
  donatedAt: string | null;
}

/**
 * The people who recently gave to a campaign.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NO FIXTURE FALLBACK, DELIBERATELY.
 *
 * Every other loader here falls back to demo content when the API is
 * unreachable, so the site can be reviewed complete. This one returns an empty
 * list instead, and the section simply does not render.
 *
 * Inventing donors would mean publishing invented names next to invented
 * amounts on a page asking for money — the most damaging thing a demo build
 * could get wrong, and a different category of wrong from a placeholder
 * photograph (decision A14).
 * ══════════════════════════════════════════════════════════════════════════
 *
 * NOT CACHED. A donor who has just given looks for their own name here, and a
 * five-minute cache would show them a list without it.
 */
export async function getCampaignDonors(
  slug: string,
  options: { sort?: 'recent' | 'generous'; limit?: number } = {},
): Promise<CampaignDonor[]> {
  const search = new URLSearchParams({
    sort: options.sort ?? 'recent',
    limit: String(options.limit ?? 5),
  });

  return loadContent({
    label: `campaigns/${slug}/donors`,
    fromApi: async (api) => {
      try {
        const body = await api.get<{ items: CampaignDonor[] }>(
          `campaigns/${slug}/donors?${search.toString()}`,
          { cache: 'no-store' },
        );
        return body.items ?? [];
      } catch (error) {
        if (isNotFound(error)) return [];
        throw error;
      }
    },
    fallback: () => [],
  });
}

export async function getCampaign(slug: string): Promise<Campaign | null> {
  return loadContent({
    label: `campaigns/${slug}`,
    fromApi: async (api) => {
      try {
        const row = await api.get<ApiCampaignDetail>(
          `campaigns/${slug}`,
          publicCache(`campaign-${slug}`),
        );
        return toCampaign(row);
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    fallback: () => campaignFixtures.find((campaign) => campaign.slug === slug) ?? null,
  });
}

// ---------------------------------------------------------------------------
// Derived views
//
// Computed from what the API returned rather than hand-maintained, so a new
// campaign appears in the filters without a second edit — and a filter can
// never offer a category that no campaign has.
// ---------------------------------------------------------------------------

export async function getFeaturedCampaign(): Promise<Campaign | undefined> {
  const campaigns = await getCampaigns();
  const summary = campaigns.find((campaign) => campaign.isFeatured && campaign.status === 'active');
  if (!summary) return undefined;

  /**
   * Fetch the DETAIL for the featured one.
   *
   * The listing page renders `beneficiaryContext` in the featured block, and
   * that field only exists on the detail response — a list endpoint that
   * returned every campaign's full narrative would be paying for twenty
   * campaigns' prose to render one. One extra request for the one card that
   * needs it is the right trade.
   */
  return (await getCampaign(summary.slug)) ?? summary;
}

export async function getCampaignsByProgram(programSlug: string): Promise<Campaign[]> {
  return getCampaigns({ programSlug });
}

export async function getCampaignFilters(): Promise<{ categories: string[]; locations: string[] }> {
  const campaigns = await getCampaigns();

  return {
    categories: [...new Set(campaigns.map((campaign) => campaign.category).filter(Boolean))].sort(),
    locations: [
      ...new Set(
        campaigns
          .map((campaign) => campaign.location)
          .filter((value): value is string => Boolean(value)),
      ),
    ].sort(),
  };
}
