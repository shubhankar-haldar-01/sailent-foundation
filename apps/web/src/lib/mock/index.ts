/**
 * Development content layer.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️  EVERYTHING IN THIS DIRECTORY IS PLACEHOLDER CONTENT.
 *
 * Phase 2 builds the complete public website before the API exists. These
 * fixtures let every page, state and interaction be built and reviewed for
 * real, and are replaced module by module from Phase 4 onward.
 *
 * Three rules govern what may appear here, from decision A14 and the Phase 2
 * brief:
 *
 *   1. NO invented statutory identifiers. Registration numbers, PAN, 12A and
 *      80G numbers are absent everywhere — an invented registration number on
 *      an NGO website is a legal problem, not a placeholder.
 *   2. NO invented financial figures. The fixtures describe published work
 *      without asserting anything about their contents.
 *   3. Every impact figure is rendered through a component that marks it as
 *      demo data, and the site carries a standing notice while
 *      `FEATURE_MOCK_DATA` is on.
 *
 * Narrative copy (campaign stories, program descriptions, article bodies) is
 * realistic by design so the layouts can be judged honestly, and is written to
 * be replaced wholesale.
 * ══════════════════════════════════════════════════════════════════════════
 */

import { campaigns } from './campaigns';
import { events } from './events';
import { programs } from './programs';
import { stories } from './stories';
import type { SearchRecord } from './types';
import { mockDataEnabled } from '@/lib/runtime-flags';

export * from './types';
export * from './programs';
export * from './campaigns';
export * from './stories';
export * from './events';
export * from './team';
export * from './faqs';
export * from './testimonials';
export * from './impact';

/**
 * Whether the demo notice should be shown.
 *
 * Tied to the same flag the config schema REFUSES to leave enabled in
 * production, so the notice cannot be forgotten and the fixtures cannot
 * silently become the live site.
 */
export const isDemoContent = mockDataEnabled();

/**
 * Search index.
 *
 * Built from the same fixtures rather than maintained separately, so a new
 * campaign is searchable without a second edit. Phase 4 replaces this with a
 * server-side query against Postgres full-text search; the shape stays.
 */
export const searchIndex: SearchRecord[] = [
  ...campaigns.map<SearchRecord>((campaign) => ({
    id: `campaign-${campaign.slug}`,
    title: campaign.title,
    excerpt: campaign.shortDescription,
    href: `/campaigns/${campaign.slug}`,
    type: 'campaign',
    keywords: [campaign.programName, campaign.category, campaign.location ?? '', campaign.status],
  })),
  ...programs.map<SearchRecord>((program) => ({
    id: `program-${program.slug}`,
    title: program.name,
    excerpt: program.shortDescription,
    href: `/programs/${program.slug}`,
    type: 'program',
    keywords: [program.tagline, ...program.locations.map((l) => `${l.district} ${l.state}`)],
  })),
  ...stories.map<SearchRecord>((story) => ({
    id: `story-${story.slug}`,
    title: story.title,
    excerpt: story.summary,
    href: `/stories/${story.slug}`,
    type: 'story',
    keywords: [story.programName ?? '', story.location ?? ''],
  })),
  ...events.map<SearchRecord>((event) => ({
    id: `event-${event.slug}`,
    title: event.title,
    excerpt: event.summary,
    href: `/events/${event.slug}`,
    type: 'event',
    keywords: [event.city ?? '', event.isOnline ? 'online' : 'in person'],
  })),
];

/**
 * Naive scoring search over the index.
 *
 * Title matches outrank excerpt matches, which outrank keyword matches —
 * enough to make the UI behave believably. Deliberately simple: it is thrown
 * away when real search arrives, so investing in it would be waste.
 */
export function searchContent(query: string): SearchRecord[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return [];

  const terms = trimmed.split(/\s+/);

  return searchIndex
    .map((record) => {
      const title = record.title.toLowerCase();
      const excerpt = record.excerpt.toLowerCase();
      const keywords = record.keywords.join(' ').toLowerCase();

      let score = 0;
      for (const term of terms) {
        if (title.includes(term)) score += 10;
        if (excerpt.includes(term)) score += 4;
        if (keywords.includes(term)) score += 2;
      }
      return { record, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.record);
}
