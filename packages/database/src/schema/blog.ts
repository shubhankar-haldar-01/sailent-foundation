import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { primaryId, softDelete, timestamps } from './_shared.js';
import { publishStatusEnum } from './enums.js';
import { categories } from './taxonomy.js';
import { media } from './media.js';
import { users } from './users.js';

/**
 * Blog posts.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT THIS REPLACES. Until Phase 10.7 `/blog` rendered eight FABRICATED
 * articles from `apps/web/src/lib/mock/blog.ts` — invented titles, invented
 * authors, invented dates — and both the page and the sitemap carried
 * deliberate exclusions saying so. This table is the real record those
 * exclusions were waiting on; the mock file and both exclusions go with it.
 *
 * NOTHING HERE IS NEW MACHINERY. The status is the existing `publish_status`,
 * the category is the existing `categories` lookup, redirects use the existing
 * `slug_history`, and the featured image is a row in the existing `media`
 * table. The only genuinely new concepts are the post itself and its tags.
 * ══════════════════════════════════════════════════════════════════════════
 */
export const blogPosts = pgTable(
  'blog_posts',
  {
    id: primaryId(),
    title: varchar('title', { length: 240 }).notNull(),
    slug: varchar('slug', { length: 240 }).notNull(),
    excerpt: text('excerpt'),
    /**
     * MARKDOWN, not HTML.
     *
     * Storing HTML means either trusting an editor's markup or sanitising it
     * on the way out, and a sanitiser is a denylist that has to stay ahead of
     * every parser quirk. Markdown is rendered to React ELEMENTS by
     * `apps/web/src/lib/blog/markdown.ts`, which never produces raw HTML at
     * all — so there is no injection point to defend rather than a defended
     * one. See docs/phase-10.7.md §Security.
     */
    content: text('content'),

    /**
     * The featured image, as a REFERENCE to the media library.
     *
     * `success_stories.cover_image` is a plain text URL because it predates
     * Phase 10.6. This is a real foreign key, so deleting an image cannot
     * leave a post pointing at an object that is gone — and `media.service`
     * already refuses to delete a referenced image.
     *
     * `set null` rather than `cascade`: losing an image must not delete the
     * article written around it.
     */
    featuredMediaId: uuid('featured_media_id').references(() => media.id, {
      onDelete: 'set null',
    }),

    /** One primary category, from the shared taxonomy. */
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),

    /**
     * The staff member who wrote it.
     *
     * `set null` so removing a user does not remove their articles. The public
     * API never returns this id — only a display name — see §Security.
     */
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),

    status: publishStatusEnum('status').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),

    metaTitle: varchar('meta_title', { length: 240 }),
    metaDescription: varchar('meta_description', { length: 400 }),
    /**
     * Set only when an article was first published elsewhere. Left null, the
     * page is its own canonical — which is the honest default and what
     * `buildMetadata` already does.
     */
    canonicalUrl: text('canonical_url'),

    ...timestamps,
    ...softDelete,
  },
  (table) => [
    uniqueIndex('blog_posts_slug_unique').on(table.slug),
    // The public listing's exact access path: published, newest first.
    index('blog_posts_status_published_idx').on(table.status, table.publishedAt),
    index('blog_posts_category_idx').on(table.categoryId),
    index('blog_posts_author_idx').on(table.authorId),
  ],
);

export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;

/**
 * Tags.
 *
 * A separate table from `categories` because they answer different questions.
 * A category is the one shelf an article sits on and is chosen from a list an
 * administrator curates; a tag is a free-form keyword an author adds while
 * writing. Filing both in `categories` would put ad-hoc keywords into the
 * lookup that campaign and programme pages read from.
 *
 * `slug` is the normalised identity — "Field Notes", "field notes" and
 * "Field-Notes" all normalise to `field-notes` — and it is UNIQUE, which is
 * what actually prevents duplicates. `name` keeps the spelling the author
 * used.
 */
export const blogTags = pgTable(
  'blog_tags',
  {
    id: primaryId(),
    name: varchar('name', { length: 80 }).notNull(),
    slug: varchar('slug', { length: 80 }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('blog_tags_slug_unique').on(table.slug)],
);

export type BlogTag = typeof blogTags.$inferSelect;
export type NewBlogTag = typeof blogTags.$inferInsert;

/**
 * Posts to tags.
 *
 * A composite primary key rather than a surrogate id: the pair IS the
 * identity, and it makes tagging the same post twice impossible rather than
 * merely discouraged.
 *
 * Both sides cascade. Unlike the featured image, a junction row has no meaning
 * once either end is gone — it is the relationship, not a thing that has one.
 */
export const blogPostTags = pgTable(
  'blog_post_tags',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => blogPosts.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => blogTags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    index('blog_post_tags_tag_idx').on(table.tagId),
  ],
);

export type BlogPostTag = typeof blogPostTags.$inferSelect;
