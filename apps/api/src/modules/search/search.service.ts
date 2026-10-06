import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, inArray, isNull, or, type SQL } from 'drizzle-orm';

import {
  blogPosts,
  campaigns,
  events,
  programs,
  successStories,
  type DatabaseClient,
} from '@sailent/database';
import { PUBLIC_CAMPAIGN_STATUSES } from '@sailent/validation';

import { DATABASE } from '../database/database.module.js';

export type SearchResultType = 'campaign' | 'program' | 'story' | 'event' | 'blog';

export interface SearchResult {
  type: SearchResultType;
  title: string;
  excerpt: string | null;
  href: string;
}

const PER_TYPE = 5;

/** `%` and `_` are wildcards in LIKE; a search for "100%" means the text. */
function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

function excerpt(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > 200 ? `${text.slice(0, 197)}…` : text;
}

/**
 * Public site search (Phase 13).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONLY WHAT THE PUBLIC PAGES THEMSELVES SHOW. Each type is filtered by the
 * same rule its own public listing uses, IN THE QUERY:
 *
 *   campaigns  status in PUBLIC_CAMPAIGN_STATUSES, not deleted (never draft
 *              or archived)
 *   programmes published, not deleted
 *   stories    published, not deleted
 *   events     published, not deleted
 *   blog       published, not deleted
 *
 * Until Phase 13 the search page searched the development FIXTURES in the
 * browser, so in production it would have offered records that do not exist.
 * Matching is a plain case-insensitive substring on the title and summary —
 * enough for a site of this size; no search engine to run.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class SearchService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  async search(query: string): Promise<{ query: string; results: SearchResult[] }> {
    const pattern = likePattern(query);
    const db = this.database.db;
    const match = (...columns: Parameters<typeof ilike>[0][]): SQL =>
      or(...columns.map((column) => ilike(column, pattern)))!;

    const [campaignRows, programRows, storyRows, eventRows, blogRows] = await Promise.all([
      db
        .select({
          title: campaigns.title,
          slug: campaigns.slug,
          summary: campaigns.shortDescription,
        })
        .from(campaigns)
        .where(
          and(
            inArray(campaigns.status, PUBLIC_CAMPAIGN_STATUSES),
            isNull(campaigns.deletedAt),
            match(campaigns.title, campaigns.shortDescription),
          ),
        )
        .orderBy(desc(campaigns.createdAt))
        .limit(PER_TYPE),
      db
        .select({ title: programs.title, slug: programs.slug, summary: programs.shortDescription })
        .from(programs)
        .where(
          and(
            eq(programs.status, 'published'),
            isNull(programs.deletedAt),
            match(programs.title, programs.shortDescription),
          ),
        )
        .limit(PER_TYPE),
      db
        .select({
          title: successStories.title,
          slug: successStories.slug,
          summary: successStories.excerpt,
        })
        .from(successStories)
        .where(
          and(
            eq(successStories.status, 'published'),
            isNull(successStories.deletedAt),
            match(successStories.title, successStories.excerpt),
          ),
        )
        .orderBy(desc(successStories.publishedAt))
        .limit(PER_TYPE),
      db
        .select({ title: events.title, slug: events.slug, summary: events.summary })
        .from(events)
        .where(
          and(
            eq(events.status, 'published'),
            isNull(events.deletedAt),
            match(events.title, events.summary),
          ),
        )
        .orderBy(desc(events.startDate))
        .limit(PER_TYPE),
      db
        .select({ title: blogPosts.title, slug: blogPosts.slug, summary: blogPosts.excerpt })
        .from(blogPosts)
        .where(
          and(
            eq(blogPosts.status, 'published'),
            isNull(blogPosts.deletedAt),
            match(blogPosts.title, blogPosts.excerpt),
          ),
        )
        .orderBy(desc(blogPosts.publishedAt))
        .limit(PER_TYPE),
    ]);

    const results: SearchResult[] = [
      ...campaignRows.map((row) => ({
        type: 'campaign' as const,
        title: row.title,
        excerpt: excerpt(row.summary),
        href: `/campaigns/${row.slug}`,
      })),
      ...programRows.map((row) => ({
        type: 'program' as const,
        title: row.title,
        excerpt: excerpt(row.summary),
        href: `/programs/${row.slug}`,
      })),
      ...storyRows.map((row) => ({
        type: 'story' as const,
        title: row.title,
        excerpt: excerpt(row.summary),
        href: `/stories/${row.slug}`,
      })),
      ...eventRows.map((row) => ({
        type: 'event' as const,
        title: row.title,
        excerpt: excerpt(row.summary),
        href: `/events/${row.slug}`,
      })),
      ...blogRows.map((row) => ({
        type: 'blog' as const,
        title: row.title,
        excerpt: excerpt(row.summary),
        href: `/blog/${row.slug}`,
      })),
    ];

    return { query, results };
  }
}
