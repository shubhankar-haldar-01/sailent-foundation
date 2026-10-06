import 'server-only';

import { API_PREFIX } from '@sailent/config';

import { getDonorAccessToken } from '@/lib/auth/donor-session';

/**
 * Server-side donor API client.
 *
 * The mirror of `lib/admin/api.ts`, pointed at the donor session. Kept separate
 * rather than parameterised by audience, because "which token does this call
 * use?" should be answerable by looking at the import — not by tracing an
 * argument. A donor page that reaches for `adminFetch` is then obviously wrong.
 *
 * NEVER CACHED. Every response here is one person's own data.
 */

const API_BASE = process.env.API_URL ?? 'http://localhost:4000';

export class DonorApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DonorApiError';
  }
}

export async function donorFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<T> {
  const token = await getDonorAccessToken();
  if (!token) throw new DonorApiError(401, 'UNAUTHENTICATED', 'Your session has expired.');

  const url = new URL(`${API_PREFIX}/${path.replace(/^\//, '')}`, ensureTrailingSlash(API_BASE));
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: { code?: string; message?: string };
  };

  if (!response.ok || payload.success === false) {
    throw new DonorApiError(
      response.status,
      payload.error?.code ?? 'INTERNAL_ERROR',
      payload.error?.message ?? 'Something went wrong.',
    );
  }

  return payload.data as T;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

// --- Shapes the dashboard reads -------------------------------------------

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean };
}

export interface DonorProfile {
  id: string;
  donorCode: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  taxIdType: string | null;
  /** Phase 12: the API never returns the full number to the donor — `XXXXXX234F`. */
  taxIdNumberMasked: string | null;
  hasTaxId: boolean;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  totalDonated: number;
  donationCount: number;
  firstDonatedAt: string | null;
  lastDonatedAt: string | null;
}

export interface DonorDonation {
  id: string;
  reference: string;
  amount: number;
  status: 'pending' | 'processing' | 'successful' | 'failed' | 'cancelled';
  donationType: string;
  donationDate: string;
  completedAt: string | null;
  anonymous: boolean;
  campaignId: string | null;
  campaignTitle: string | null;
  campaignSlug: string | null;
  receiptId: string | null;
  receiptNumber: string | null;
}

export interface DonorDonationDetail extends DonorDonation {
  donorMessage: string | null;
  items: {
    id: string;
    itemType: 'product' | 'custom';
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    fulfilledQuantity: number;
  }[];
  payment: {
    status: string;
    method: string | null;
    cardLast4: string | null;
    paidAt: string | null;
  } | null;
}

export interface DonorReceipt {
  receiptNumber: string;
  financialYear: number;
  donorName: string | null;
  donorEmail: string | null;
  campaignTitle: string | null;
  programTitle: string | null;
  amount: number;
  lineItems: { name: string; quantity: number; unitPrice: number; totalPrice: number }[];
  paymentReference: string | null;
  eightyGEligible: string | null;
  registrationNumber: string | null;
  issuedAt: string;
  donationReference: string;
}

export interface SupportedCampaign {
  campaignId: string;
  title: string;
  slug: string;
  coverImage: string | null;
  category: string | null;
  status: string;
  fundraisingGoal: number | null;
  amountRaised: number;
  /** This donor's own total, not the campaign's. */
  contributed: string;
  donationCount: number;
  lastDonatedAt: string;
}

export interface SavedCampaign {
  campaignId: string;
  title: string;
  slug: string;
  coverImage: string | null;
  category: string | null;
  status: string;
  shortDescription: string | null;
  fundraisingGoal: number | null;
  amountRaised: number;
  savedAt: string;
}

export interface DonorImpact {
  totalGiven: number;
  donationCount: number;
  campaignsSupported: number;
  firstDonatedAt: string | null;
  lastDonatedAt: string | null;
  itemsProvided: { itemName: string; quantity: number; amount: string }[];
}

export interface DonorUpdate {
  id: string;
  title: string;
  description: string | null;
  images: { url?: string; seed?: string; alt?: string }[] | null;
  location: string | null;
  state: string | null;
  impactDate: string | null;
  metricType: string | null;
  metricValue: number | null;
  metricUnit: string | null;
  publishedAt: string;
  campaignId: string | null;
  campaignTitle: string | null;
  campaignSlug: string | null;
}

export interface DonorSettings {
  communicationConsent: boolean;
  emailOptIn: boolean;
  smsOptIn: boolean;
  whatsappOptIn: boolean;
  notifyCampaignUpdates: boolean;
  notifyImpactUpdates: boolean;
  notifyNewsletter: boolean;
  isAnonymous: boolean;
}

export interface DonorOverview {
  profile: DonorProfile;
  impact: DonorImpact;
  recentDonations: DonorDonation[];
  savedCampaigns: SavedCampaign[];
}
