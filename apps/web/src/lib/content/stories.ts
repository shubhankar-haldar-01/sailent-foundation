import 'server-only';

import type { Story } from '@/lib/mock/types';
import { stories as storyFixtures } from '@/lib/mock/stories';

import { isNotFound } from './programs';
import { loadContent, publicCache, toMedia, type Paginated } from './source';

interface ApiStorySummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  category: string | null;
  location: string | null;
  publishedAt: string;
  subjectName?: string | null;
  programId: string | null;
  campaignId: string | null;
}

interface ApiStoryDetail extends ApiStorySummary {
  content: string | null;
  challenge: string | null;
  intervention: string | null;
  journey: string | null;
  outcome: string | null;
  impact: string | null;
  gallery: { seed?: string; alt?: string; caption?: string }[] | null;
  consentObtained: boolean;
  isAnonymised: boolean;
  programSlug?: string | null;
  campaignSlug?: string | null;
  programTitle?: string | null;
}

function toStory(row: ApiStorySummary | ApiStoryDetail): Story {
  const detail = row as Partial<ApiStoryDetail>;

  return {
    slug: row.slug,
    title: row.title,
    summary: row.excerpt ?? '',
    /**
     * A named subject only ever reaches this object when the API has already
     * checked consent — the database refuses to publish a named, non-anonymised
     * story without it. The frontend is not the control here; it is the
     * beneficiary of one.
     */
    subjectName: row.subjectName ?? null,
    location: row.location,
    category: row.category,
    programName: detail.programTitle ?? null,
    publishedAt: row.publishedAt,
    cover: toMedia(row.coverImage, `story-${row.slug}`, row.title),

    challenge: detail.challenge ?? '',
    intervention: detail.intervention ?? '',
    journey: detail.journey ?? '',
    outcome: detail.outcome ?? '',
    impact: detail.impact ?? '',
    gallery: (detail.gallery ?? []).map((item, index) => ({
      seed: item.seed ?? `story-${row.slug}-${index}`,
      alt: item.alt ?? `${row.title} photograph`,
      caption: item.caption,
    })),
    programSlug: detail.programSlug ?? null,
    campaignSlug: detail.campaignSlug ?? null,
    campaignId: row.campaignId ?? null,
    consentRecorded: detail.consentObtained ?? false,
    isFeatured: false,
  };
}

export async function getStories(): Promise<Story[]> {
  return loadContent({
    label: 'stories',
    fromApi: async (api) => {
      const page = await api.get<Paginated<ApiStorySummary>>('stories', {
        query: { limit: 100, sort: '-publishedAt' },
        ...publicCache('stories'),
      });
      return page.items.map(toStory);
    },
    fallback: () => storyFixtures,
  });
}

/**
 * One page of stories, for the public listing.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * `getStories()` above asks for a hundred and stops. That is fine for three
 * stories and silently wrong at a hundred and one — the newest would simply
 * not be there, with nothing on the page to say so.
 *
 * This is the paginated read the listing uses. `getStories()` stays for the
 * callers that genuinely want "all of them to pick from" — the featured story
 * and the per-programme strips — where a page number would mean nothing.
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function getStoriesPage(
  page = 1,
  options: { category?: string; limit?: number } = {},
): Promise<{ stories: Story[]; page: number; totalPages: number; total: number }> {
  const limit = options.limit ?? 12;
  return loadContent({
    label: `stories?page=${page}&limit=${limit}&category=${options.category ?? ''}`,
    fromApi: async (api) => {
      const result = await api.get<Paginated<ApiStorySummary>>('stories', {
        query: {
          page,
          limit,
          sort: '-publishedAt',
          ...(options.category ? { category: options.category } : {}),
        },
        ...publicCache('stories'),
      });
      return {
        stories: result.items.map(toStory),
        page: result.pagination.page,
        totalPages: result.pagination.totalPages,
        total: result.pagination.total,
      };
    },
    fallback: () => ({
      stories: storyFixtures,
      page: 1,
      totalPages: 1,
      total: storyFixtures.length,
    }),
  });
}

export async function getStory(slug: string): Promise<Story | null> {
  return loadContent({
    label: `stories/${slug}`,
    fromApi: async (api) => {
      try {
        return toStory(
          await api.get<ApiStoryDetail>(`stories/${slug}`, publicCache(`story-${slug}`)),
        );
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    fallback: () => storyFixtures.find((story) => story.slug === slug) ?? null,
  });
}

/**
 * The story to lead the page with.
 *
 * No `isFeatured` column exists yet, so this is the most recent published
 * story — a defensible rule rather than an arbitrary one, and it means the
 * page always has a lead without an editor having to remember to set a flag.
 */
/**
 * The categories that published stories are filed under, for the listing's
 * filter — only ones with at least one story, so no filter leads to an empty
 * page. Ordered as `order` lists them (the programmes' display order), then
 * alphabetically for any category no programme carries.
 */
export async function getStoryCategories(order: string[] = []): Promise<string[]> {
  const stories = await getStories();
  const present = [
    ...new Set(stories.map((story) => story.category).filter((c): c is string => Boolean(c))),
  ];
  const rank = (category: string) => {
    const index = order.findIndex((name) => name.toLowerCase() === category.toLowerCase());
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return present.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export async function getFeaturedStory(): Promise<Story | undefined> {
  const stories = await getStories();
  return stories[0];
}

export async function getStoriesByProgram(programSlug: string): Promise<Story[]> {
  const stories = await getStories();
  return stories.filter((story) => story.programSlug === programSlug);
}
