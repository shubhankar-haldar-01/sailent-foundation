/**
 * Content types for the Phase 2 public website.
 *
 * These are PRESENTATION models, not database rows. They describe what a page
 * needs to render, which is what lets Phase 2 build the entire public site
 * against fixtures and Phase 4 swap in the API without touching a component.
 *
 * Field names deliberately mirror the Phase 0 domain model
 * (docs/database-architecture.md) so the eventual mapping is close to 1:1.
 */

import type {
  CampaignCardModel,
  EventCardModel,
  ProductDonationModel,
  ProgramCardModel,
  StoryCardModel,
  TeamMemberModel,
} from '@sailent/ui';

/** Where an image will come from once real photography exists. */
export interface MediaRef {
  /** Seed for the deterministic placeholder, used when there is no `url`. */
  seed: string;
  /** Required. Describes the photograph that belongs here. */
  alt: string;
  /**
   * A real photograph, when one exists. Set by the content layer — either from
   * the API's own `coverImage`, or by finding a file named for the seed under
   * `public/images/`. `MediaFrame` draws its placeholder only when this is
   * absent.
   */
  url?: string;
  caption?: string;
}

export interface Location {
  district: string;
  state: string;
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export interface Program extends Omit<ProgramCardModel, 'coverImage'> {
  cover: MediaRef;
  /** One line, used as the page subtitle. */
  tagline: string;
  /** The problem this program exists to address. */
  problem: string;
  /** What the organization actually does about it. */
  approach: string;
  goals: { title: string; description: string }[];
  beneficiaries: string;
  locations: Location[];
  activities: { title: string; description: string }[];
  /** Demo metrics — rendered with a demo marker, never as verified fact. */
  metrics: { label: string; value: number; unit?: string }[];
  accentIcon: 'book' | 'heart' | 'shield' | 'sprout' | 'briefcase' | 'leaf' | 'paw';
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export interface CampaignProduct extends Omit<ProductDonationModel, 'image'> {
  image: MediaRef;
}

export interface CampaignUpdate {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  media?: MediaRef;
  /**
   * The update's own address, `/impact/[slug]`.
   *
   * A progress update IS an `impact_updates` row, and since Phase 9 those have
   * a public page carrying the figure and — the part that matters — how it was
   * counted. Optional because the fixture fallback has no slugs, and a link to
   * `/impact/undefined` is worse than plain text.
   */
  slug?: string;
}

export interface Campaign extends Omit<CampaignCardModel, 'coverImage'> {
  /**
   * The campaign's own id.
   *
   * The public site addresses campaigns by SLUG everywhere, and still should —
   * a slug is what belongs in a URL. This is here because the donor API is
   * id-addressed like the rest of the API, so "save this campaign" needs the
   * id. It is not a licence to start linking by id.
   */
  id: string;
  cover: MediaRef;
  gallery: MediaRef[];
  /** The narrative. Rendered as paragraphs, not a wall of text. */
  story: string[];
  /** Who this campaign serves, concretely. */
  beneficiaryContext: string;
  category: string;
  products: CampaignProduct[];
  updates: CampaignUpdate[];
  faqs: { question: string; answer: string }[];
  /*
    Public documents attached to this campaign (Phase 10.10).

    The ONLY route by which a document reaches a visitor — §4.20 removed the
    public library outright. Anything private is filtered out by the API's
    WHERE clause, so nothing unpublished can arrive in this array.
  */
  documents: {
    id: string;
    title: string;
    description: string | null;
    documentType: string;
    fileName: string;
    sizeBytes: number;
    fileUrl: string | null;
    publishedAt: string | null;
  }[];
  impactNotes: { label: string; value: number; unit?: string }[];
  beneficiaryTarget: number | null;
  beneficiariesReached: number;
  startsAt: string;
  isFeatured: boolean;

  /**
   * Computed by the API (Phase 4) and passed straight through.
   *
   * Optional because the development fixtures do not carry them; every
   * consumer falls back to deriving locally, which is why `CampaignProgress`
   * in the UI package still exists.
   */
  progress?: {
    goal: number;
    raised: number;
    remaining: number;
    percent: number;
    rawPercent: number;
    goalReached: boolean;
    surplus: number;
  };
  donation?: { state: string; reason?: string };
  daysLeft?: number | null;
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export interface Story extends Omit<StoryCardModel, 'coverImage'> {
  cover: MediaRef;
  /** The five-part structure Phase 0 specifies for success stories. */
  challenge: string;
  intervention: string;
  journey: string;
  outcome: string;
  impact: string;
  gallery: MediaRef[];
  programSlug: string | null;
  campaignSlug: string | null;
  /** Consent is required before a story naming a person may be published. */
  consentRecorded: boolean;
  isFeatured: boolean;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface SailentEvent extends Omit<EventCardModel, 'coverImage'> {
  /**
   * The database id.
   *
   * Added in Phase 9: registration posts to `/events/:id/register`, and the
   * slug is not an identifier the API accepts there. Optional, because the
   * fixture fallback has no ids — and a registration form that cannot name an
   * event is correctly not rendered, which is what an absent id produces.
   */
  id?: string;
  cover: MediaRef;
  description: string[];
  schedule: { time: string; activity: string }[];
  address: string | null;
  programSlug: string | null;
  campaignSlug: string | null;
  requiresVolunteers: boolean;
  gallery: MediaRef[];
  /**
   * The event's OPERATIONAL state, kept alongside the collapsed `status`.
   *
   * `status` answers "can somebody register?" and is what a card badge reads.
   * This answers "what is happening to this event?", and the two differ in the
   * case that matters most: a CANCELLED event is not merely closed, and a page
   * that says "registration closed" over a cancelled camp has told somebody
   * holding a place the wrong thing.
   */
  lifecycle?: 'open' | 'closed' | 'full' | 'cancelled' | 'completed';
  /** When registration shuts, if it shuts before the event starts. */
  registrationDeadline?: string | null;
  organizer?: string | null;
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export interface TeamMember extends Omit<TeamMemberModel, 'photo'> {
  slug: string;
  photo: MediaRef;
  memberType: 'staff' | 'trustee' | 'advisor';
  displayOrder: number;
}

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Reports, FAQs, testimonials
// ---------------------------------------------------------------------------

export interface PublicDocument {
  id: string;
  title: string;
  description: string;
  documentType: 'annual_report' | 'financial' | 'impact_report' | 'utilisation' | 'policy';
  financialYear: string | null;
  fileName: string;
  sizeBytes: number;
  publishedAt: string;
  /** Public documents are downloadable; restricted ones state how to request access. */
  access: 'public' | 'on_request';
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  category: 'donations' | 'campaigns' | 'volunteering' | 'events' | 'transparency' | 'general';
}

export interface Testimonial {
  id: string;
  quote: string;
  authorName: string;
  authorRole: string;
  /** Donor, volunteer or partner — drives where it is shown. */
  kind: 'donor' | 'volunteer' | 'partner';
}

/** A single searchable record across every content type. */
export interface SearchRecord {
  id: string;
  title: string;
  excerpt: string;
  href: string;
  type: 'campaign' | 'program' | 'story' | 'blog' | 'event';
  keywords: string[];
}
