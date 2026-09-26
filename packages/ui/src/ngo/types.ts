/**
 * View models for the NGO components.
 *
 * These are deliberately PRESENTATION types, not database rows. A component
 * takes what it needs to render and nothing more, which is what lets Phase 2
 * build the whole public site against mock data and Phase 4 swap in the API
 * without touching a single component.
 */

export interface CampaignCardModel {
  slug: string;
  title: string;
  shortDescription: string;
  programName: string;
  programSlug: string;
  location: string | null;
  coverImage: { url: string; alt: string } | null;
  /** Paise. */
  goalAmount: number;
  /** Paise. Derived-cached, moved only on captured payment (decision A6). */
  amountRaised: number;
  /** Distinct donors. Suppressed in the UI below 5. */
  donorCount: number;
  /** Null when the campaign has no real deadline. No manufactured urgency. */
  endsAt: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  hasProducts: boolean;
}

export interface ProductDonationModel {
  id: string;
  name: string;
  /** What the donor is buying, concretely. Conversion depends on this. */
  description: string;
  /** Paise. */
  unitAmount: number;
  image: { url: string; alt: string } | null;
  /** Null = open-ended, no progress shown. */
  targetQuantity: number | null;
  providedQuantity: number;
  status: 'active' | 'inactive' | 'fulfilled';
  maxPerDonation: number;
}

export interface ProgramCardModel {
  slug: string;
  name: string;
  shortDescription: string;
  coverImage: { url: string; alt: string } | null;
  activeCampaignCount: number;
}

export interface StoryCardModel {
  slug: string;
  title: string;
  summary: string;
  subjectName: string | null;
  location: string | null;
  coverImage: { url: string; alt: string } | null;
  programName: string | null;
  publishedAt: string;
}

export interface EventCardModel {
  slug: string;
  title: string;
  summary: string;
  startsAt: string;
  endsAt: string | null;
  venueName: string | null;
  city: string | null;
  isOnline: boolean;
  coverImage: { url: string; alt: string } | null;
  capacity: number | null;
  registeredCount: number;
  status: 'registration_open' | 'registration_closed' | 'completed' | 'cancelled';
}

export interface TeamMemberModel {
  name: string;
  designation: string;
  department: string | null;
  bio: string | null;
  photo: { url: string; alt: string } | null;
  socialLinks?: { label: string; url: string }[];
}

export interface VolunteerCardModel {
  name: string;
  /** Permanent, assigned at approval (decision A13). */
  volunteerId: string;
  role: string | null;
  photo: { url: string; alt: string } | null;
  /** Verified hours only — unverified hours never appear. */
  verifiedHours: number;
  status: 'active' | 'inactive' | 'suspended';
}

export interface DocumentCardModel {
  id: string;
  title: string;
  description: string | null;
  documentType: string;
  financialYear: string | null;
  fileName: string;
  sizeBytes: number;
  publishedAt: string | null;
}

export interface DonationLineModel {
  id: string;
  type: 'product' | 'custom';
  name: string;
  quantity: number;
  /** Paise. Snapshotted at donation time (decision A5). */
  unitAmount: number;
}

export interface TestimonialModel {
  quote: string;
  authorName: string;
  authorRole: string | null;
  photo: { url: string; alt: string } | null;
}
