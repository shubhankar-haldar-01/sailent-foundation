/**
 * The shapes the product components pass between themselves.
 *
 * Kept here rather than in `lib/mock/types` because these describe what the
 * ADMIN API sends, which is a different thing from what the public page shows.
 * The admin sees the catalogue default beside the campaign's own price, and the
 * public never does — a number that is not what you will pay has no business on
 * a donation page.
 */

/** A row in the master catalogue. */
export interface CatalogueProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string | null;
  /** Paise. A suggestion, copied when added to a campaign; never a live lookup. */
  defaultPrice: number;
  unit: string;
  status: 'active' | 'inactive' | 'archived';
  /** How many campaigns offer it. Zero is a normal, not a broken, state. */
  campaignCount: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Where a catalogue product is being offered, and on what terms. */
export interface ProductUsage {
  campaignProductId: string;
  campaignId: string;
  campaignTitle: string;
  campaignSlug: string;
  campaignStatus: string;
  price: number;
  targetQuantity: number | null;
  providedQuantity: number;
  isActive: boolean;
}

export interface CatalogueProductDetail extends CatalogueProduct {
  campaigns: ProductUsage[];
}

/**
 * One campaign's offer of a catalogue product.
 *
 * `price` is the CAMPAIGN'S. `defaultPrice` is the catalogue's, carried so the
 * admin can see where the two have diverged and decide whether that was
 * intentional — a relief kit at ₹1,500 in the monsoon appeal and ₹1,200 in the
 * winter one is correct, and the interface should not imply otherwise.
 */
export interface CampaignProductRow {
  id: string;
  productId: string;
  name: string;
  slug: string;
  description: string;
  image: string | null;
  unit: string;
  productStatus: 'active' | 'inactive' | 'archived';
  defaultPrice: number;
  price: number;
  targetQuantity: number | null;
  providedQuantity: number;
  maxPerDonation: number;
  sortOrder: number;
  isActive: boolean;
  progress: { percent: number; fulfilled: number; target: number | null };
}
