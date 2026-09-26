import 'server-only';

import { demoOrg } from '@/lib/demo-org';

import { isNotFound } from './programs';
import { loadContent, publicCache, toMedia } from './source';
import type { MediaRef } from '@/lib/mock/types';

/**
 * Impact figures.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * The most consequential thing in this directory.
 *
 * Decision A14: every public statistic must trace to a database aggregate or a
 * dated, sourced impact record, and where a real figure does not exist the
 * section does not render. So these numbers are COMPUTED BY THE API from the
 * actual tables — not stored, not hand-maintained, not adjusted here. A number
 * on the impact page is therefore a statement about what is in the database,
 * which is the only kind of claim an NGO can safely publish.
 *
 * `derivation` travels with each figure so the page can say, in plain words,
 * where it came from.
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface ImpactTotals {
  programmes: number;
  campaigns: number;
  beneficiariesReached: number;
  donorCount: number;
  activeVolunteers: number;
  verifiedVolunteerHours: number;
}

export interface ImpactUpdate {
  id: string;
  title: string;
  /** Its own address, `/impact/[slug]`. Added in Phase 9. */
  slug: string;
  description: string;
  coverImage: string | null;
  impactDate: string;
  location: string | null;
  programSlug?: string | null;
  eventId?: string | null;
  metricType: string | null;
  metricValue: number | null;
  metricUnit: string | null;
  /** How the figure was established. Absent means it is not yet verified. */
  verificationMethod: string | null;
}

/**
 * One impact record, in full.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * `verificationMethod` IS THE POINT OF THIS PAGE, not a footnote on it.
 *
 * Decision A14 is that a published figure traces to something checkable. A
 * detail page that prints "1,240 children reached" and keeps the method out of
 * sight has published the claim and withheld the evidence. So the page renders
 * it prominently, and the API sends it on the public payload.
 * ══════════════════════════════════════════════════════════════════════════
 */
export interface ImpactRecord {
  id: string;
  title: string;
  slug: string;
  description: string;
  cover: MediaRef | null;
  images: { seed?: string; url?: string; alt: string; caption?: string }[];
  location: string | null;
  state: string | null;
  impactDate: string;
  statistics: { label: string; value: number; unit?: string }[];
  metricType: string | null;
  metricValue: number | null;
  metricUnit: string | null;
  verificationMethod: string | null;
  publishedAt: string | null;
  programSlug: string | null;
  programTitle: string | null;
  campaignSlug: string | null;
  campaignTitle: string | null;
  /** Null when the event exists but was never published — see the API. */
  eventSlug: string | null;
  eventTitle: string | null;
}

export interface GeographicReach {
  state: string;
  districts: string[];
  programmes: string[];
}

export interface ImpactReach {
  states: number;
  districts: number;
  byState: GeographicReach[];
}

export interface ImpactData {
  totals: ImpactTotals;
  reach: ImpactReach;
  updates: ImpactUpdate[];
}

export interface ImpactMetric {
  id: string;
  label: string;
  value: number;
  unit?: string;
  derivation: string;
}

const EMPTY: ImpactData = {
  reach: { states: 0, districts: 0, byState: [] },
  totals: {
    programmes: 0,
    campaigns: 0,
    beneficiariesReached: 0,
    donorCount: 0,
    activeVolunteers: 0,
    verifiedVolunteerHours: 0,
  },
  updates: [],
};

export async function getImpact(): Promise<ImpactData> {
  return loadContent({
    label: 'impact',
    fromApi: async (api) => api.get<ImpactData>('impact', publicCache('impact')),
    // Zeroes, not invented figures. If the API is unreachable the honest
    // answer is "we cannot tell you right now", and every band that would show
    // a statistic renders nothing.
    fallback: () => EMPTY,
  });
}

/**
 * One impact record.
 *
 * NO FIXTURE FALLBACK, unlike every other loader in this directory. An impact
 * record is a specific, dated, sourced claim about what happened; serving a
 * made-up one during an outage would be exactly the fabricated statistic
 * decision A14 exists to prevent. A 404 is the honest answer.
 */
export async function getImpactRecord(slug: string): Promise<ImpactRecord | null> {
  return loadContent({
    label: `impact/${slug}`,
    fromApi: async (api) => {
      try {
        const row = await api.get<
          Omit<ImpactRecord, 'cover' | 'images' | 'statistics'> & {
            coverImage: string | null;
            images: { seed?: string; url?: string; alt: string; caption?: string }[] | null;
            statistics: { label: string; value: number; unit?: string }[] | null;
          }
        >(`impact/${slug}`, publicCache(`impact-${slug}`));

        return {
          ...row,
          cover: row.coverImage ? toMedia(row.coverImage, `impact-${slug}`, row.title) : null,
          images: row.images ?? [],
          statistics: row.statistics ?? [],
        };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    fallback: () => null,
  });
}

/**
 * The headline band, built from the live aggregates.
 *
 * A metric whose value is zero is DROPPED rather than shown as "0 volunteers"
 * — an unbuilt module should read as absent, not as a failure.
 */
export async function getHeadlineMetrics(): Promise<ImpactMetric[]> {
  const { totals, reach } = await getImpact();

  /**
   * The five figures the approved homepage shows, in its order.
   *
   * Every one is still an AGGREGATE (decision A14) — the labels match the
   * design, the numbers come from the database:
   *
   *   Lives Impacted    sum of beneficiaries across published work
   *   Communities       distinct districts we have a presence in
   *   Active Campaigns  count of campaigns
   *   Volunteers        count of volunteers with status Active
   *   Years of Service  whole years since the registration date
   *
   * Anything that counts zero is dropped rather than shown as "0", so the
   * strip shortens instead of advertising an absence.
   */
  const candidates: ImpactMetric[] = [
    {
      id: 'beneficiaries',
      label: 'Lives Impacted',
      value: totals.beneficiariesReached,
      derivation: 'Sum of beneficiaries recorded across published programs and campaigns.',
    },
    {
      id: 'communities',
      label: 'Communities',
      value: reach.districts,
      derivation: 'Distinct districts with a published program or campaign.',
    },
    {
      id: 'campaigns',
      label: 'Active Campaigns',
      value: totals.campaigns,
      derivation: 'Count of active and completed campaigns.',
    },
    {
      id: 'volunteers',
      label: 'Volunteers',
      value: totals.activeVolunteers,
      derivation: 'Count of volunteers with status Active.',
    },
    {
      id: 'years',
      label: 'Years of Service',
      value: yearsOfService(),
      derivation: `Whole years since registration on ${demoOrg.registration.registeredOn}.`,
    },
  ];

  return candidates.filter((metric) => metric.value > 0);
}

/**
 * Whole years since the organisation was registered.
 *
 * Derived, not typed in — it moves on its own every March. The date lives in
 * `demoOrg` with the rest of the statutory details, and while those are marked
 * DEMO this figure is demo too; replacing that one file makes it true.
 */
function yearsOfService(): number {
  const registered = new Date(demoOrg.registration.registeredOn);
  if (Number.isNaN(registered.getTime())) return 0;
  const now = new Date();
  let years = now.getFullYear() - registered.getFullYear();
  const beforeAnniversary =
    now.getMonth() < registered.getMonth() ||
    (now.getMonth() === registered.getMonth() && now.getDate() < registered.getDate());
  if (beforeAnniversary) years -= 1;
  return Math.max(0, years);
}

/**
 * The reach band — districts and states we work in.
 *
 * Computed by the API from the program records, not stored. Returns an empty
 * list when no program has a location recorded, so the band disappears rather
 * than claiming a reach of zero.
 */
export async function getReachMetrics(): Promise<ImpactMetric[]> {
  const { reach } = await getImpact();

  return [
    {
      id: 'states',
      label: 'States',
      value: reach.states,
      derivation: 'Distinct states across every published program’s recorded locations.',
    },
    {
      id: 'districts',
      label: 'Districts',
      value: reach.districts,
      derivation: 'Distinct districts across every published program’s recorded locations.',
    },
  ].filter((metric) => metric.value > 0);
}

/**
 * How the figures on this page are arrived at.
 *
 * EDITORIAL COPY, not data — it makes no claim about results, only about
 * method. It stays in code until a CMS owns the page; every statement here is
 * a commitment the organization has to stand behind, so it belongs in review
 * rather than in a database row someone can quietly edit.
 */
export const methodologyNotes = [
  {
    title: 'We count people, not distributions',
    body: 'A kit handed out is an activity, not an outcome. Where we report people reached, we mean individuals recorded by name in a program register, counted once.',
  },
  {
    title: 'Volunteer hours are verified hours',
    body: 'Only attendance confirmed by a program manager is counted. Self-reported hours are recorded separately and excluded from every public figure.',
  },
  {
    title: 'We publish results that disappointed us',
    body: 'Programs that did not work are reported in the annual review alongside those that did. A report in which everything succeeded is describing a selection process.',
  },
] as const;
