import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import {
  blogPosts,
  campaigns,
  events,
  impactUpdates,
  successStories,
  programs,
  slugHistory,
  teamMembers,
  type DatabaseClient,
} from '@sailent/database';
import { isValidSlug, slugify, uniqueSlug } from '@sailent/validation';

import { DATABASE } from '../database/database.module.js';
import { ConflictException } from '../../common/exceptions.js';

/**
 * The entity kinds that own slugs. Used as the `entity_type` discriminator.
 *
 * Phase 9 added the last three. They are listed HERE rather than given their
 * own allocator because `slug_history.entity_type` is already a free-form
 * varchar and every one of these obligations — no collision with a retired
 * slug, a history row written inside the renaming transaction — applies to a
 * team member's URL exactly as it applies to a campaign's. A second
 * implementation would be a second set of bugs.
 */
export type SluggedEntity = 'program' | 'campaign' | 'team' | 'event' | 'impact' | 'story' | 'blog';

const TABLES = {
  program: programs,
  campaign: campaigns,
  team: teamMembers,
  event: events,
  impact: impactUpdates,
  story: successStories,
  blog: blogPosts,
} as const;

/**
 * Slug allocation and history.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * docs/seo-strategy.md: "Slugs never change silently. A change 301-redirects
 * permanently from the old slug, and slug history is retained in the database."
 *
 * Two obligations follow, and this service is the only place both are met:
 *
 *   1. A NEW slug must not collide with a live one OR with any retired one.
 *      Reusing a retired slug would make its redirect point at the wrong
 *      record — worse than a 404, because it is confidently wrong.
 *
 *   2. CHANGING a slug must record the old one. A campaign's URL ends up in
 *      printed material, QR codes, WhatsApp forwards and search results; an
 *      edit to the title must not quietly break all of them.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class SlugService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  /** Is this slug live on, or retired from, any record of this kind? */
  async isTaken(entity: SluggedEntity, slug: string, exceptId?: string): Promise<boolean> {
    const table = TABLES[entity];

    const [live] = await this.database.db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.slug, slug))
      .limit(1);

    if (live && live.id !== exceptId) return true;

    const [retired] = await this.database.db
      .select({ entityId: slugHistory.entityId })
      .from(slugHistory)
      .where(and(eq(slugHistory.entityType, entity), eq(slugHistory.slug, slug)))
      .limit(1);

    // A record may reclaim a slug it previously used — that is a correction,
    // not a collision, and the redirect it would shadow points at itself.
    return Boolean(retired && retired.entityId !== exceptId);
  }

  /**
   * Allocate a slug for a new or renamed record.
   *
   * A caller-supplied slug is honoured but still checked; an absent one is
   * derived from the title and de-duplicated with a counter.
   */
  async allocate(
    entity: SluggedEntity,
    input: { title: string; slug?: string; exceptId?: string },
  ): Promise<string> {
    if (input.slug) {
      if (!isValidSlug(input.slug)) {
        throw new ConflictException(
          'That URL is not valid. Use lowercase letters, numbers and hyphens.',
        );
      }
      if (await this.isTaken(entity, input.slug, input.exceptId)) {
        throw new ConflictException(`The URL “${input.slug}” is already in use.`);
      }
      return input.slug;
    }

    const derived = slugify(input.title);
    if (!derived) {
      throw new ConflictException(
        'A URL could not be derived from that title. Enter one explicitly.',
      );
    }

    return uniqueSlug(input.title, (candidate) => this.isTaken(entity, candidate, input.exceptId));
  }

  /**
   * Record that a record has stopped using a slug.
   *
   * Called INSIDE the transaction that changes the slug, so the history entry
   * and the change cannot be written apart from one another — a rename that
   * committed without its redirect would be exactly the silent breakage the
   * rule exists to prevent.
   *
   * `onConflictDoNothing` because a record that flips back and forth between
   * two slugs would otherwise collide with its own earlier entry.
   */
  async retire(
    entity: SluggedEntity,
    entityId: string,
    slug: string,
    changedBy?: string,
    // Accepts a transaction so the caller can make this atomic with the update.
    tx?: { insert: DatabaseClient['db']['insert'] },
  ): Promise<void> {
    const db = tx ?? this.database.db;

    await db
      .insert(slugHistory)
      .values({ entityType: entity, entityId, slug, changedBy: changedBy ?? null })
      .onConflictDoNothing();
  }

  /**
   * Resolve a slug that is not live: has some record used it before?
   *
   * The public route handler calls this on a miss and issues a 301 to the
   * record's current slug. Returns null when the slug has genuinely never
   * existed, which is a real 404.
   */
  async resolveRedirect(entity: SluggedEntity, slug: string): Promise<string | null> {
    const table = TABLES[entity];

    const [row] = await this.database.db
      .select({ currentSlug: table.slug })
      .from(slugHistory)
      .innerJoin(table, eq(table.id, slugHistory.entityId))
      .where(and(eq(slugHistory.entityType, entity), eq(slugHistory.slug, slug)))
      .limit(1);

    return row?.currentSlug ?? null;
  }

  /** Every slug a record has ever had, newest first. For the admin detail page. */
  async history(entity: SluggedEntity, entityId: string) {
    return this.database.db
      .select({ slug: slugHistory.slug, changedAt: slugHistory.createdAt })
      .from(slugHistory)
      .where(and(eq(slugHistory.entityType, entity), eq(slugHistory.entityId, entityId)))
      .orderBy(sql`${slugHistory.createdAt} DESC`);
  }
}
