import { z } from 'zod';

import { paginationQuerySchema } from '../../../common/dto/pagination.dto.js';

/**
 * Blog posts.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NOTHING HERE INVENTS A LIFECYCLE. `publish_status` already carries
 * `draft | published | archived` and `blog_posts` already has `deleted_at`,
 * exactly as `success_stories` does. This is the story module's shape applied
 * to articles, not a second content system.
 * ══════════════════════════════════════════════════════════════════════════
 */

const optionalText = (max: number) => z.string().trim().max(max).nullish();

/** Lowercase words separated by single hyphens — the site's URL shape. */
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Tag names as an author types them.
 *
 * Normalisation to a slug happens in the service, because that is where the
 * "does this tag already exist" question can be answered. Here we only bound
 * the size and the count: a post carrying forty tags is a tagging mistake, and
 * a tag list is not a place to paste an article.
 */
const tagNames = z.array(z.string().trim().min(1).max(60)).max(12).optional();

export const createBlogPostSchema = z.object({
  title: z.string().trim().min(3, 'A title is required').max(200),
  /** Optional: the slug service derives one from the title when absent. */
  slug: z
    .string()
    .trim()
    .regex(slugPattern, 'Lowercase words separated by hyphens')
    .max(200)
    .optional(),
  excerpt: optionalText(500),
  /*
    MARKDOWN. Generous, because an article is long — but bounded, because an
    unbounded text field reachable by an authenticated request is a way to fill
    a disk.
  */
  content: optionalText(100_000),

  /*
    MEDIA IS A REFERENCE. The blog never uploads: Phase 10.6 owns that, and a
    second upload path would mean a second place for the magic-byte validation,
    the bucket choice and the delete-safety rules to drift.
  */
  featuredMediaId: z.string().uuid().nullish(),
  categoryId: z.string().uuid().nullish(),
  tags: tagNames,

  metaTitle: optionalText(240),
  metaDescription: optionalText(400),
  /**
   * Only for an article first published elsewhere. Left null the page is its
   * own canonical, which is the honest default.
   */
  canonicalUrl: z.string().trim().url().max(500).nullish(),
});

export const updateBlogPostSchema = createBlogPostSchema.partial();

/**
 * A status change, with the reason that will land in the audit row.
 *
 * `draft` is reachable from `published` — unpublishing to fix something is a
 * normal editorial act, and refusing it would push people towards deleting.
 */
export const blogStatusSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']),
  reason: z.string().trim().max(500).optional(),
});

export const blogListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['draft', 'published', 'archived', 'all']).default('all'),
  /** Free text over title and excerpt. */
  q: z.string().trim().max(200).optional(),
  categoryId: z.string().uuid().optional(),
});

/** The public listing. No `status` — the public may only ever see published. */
export const publicBlogQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(120).optional(),
  tag: z.string().trim().max(80).optional(),
});

export type CreateBlogPostInput = z.infer<typeof createBlogPostSchema>;
export type UpdateBlogPostInput = z.infer<typeof updateBlogPostSchema>;
export type BlogStatusInput = z.infer<typeof blogStatusSchema>;
export type BlogListQuery = z.infer<typeof blogListQuerySchema>;
export type PublicBlogQuery = z.infer<typeof publicBlogQuerySchema>;
