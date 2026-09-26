import { z } from 'zod';

import { pageSectionsSchema } from '@sailent/validation';

import { paginationQuerySchema } from '../../../common/dto/pagination.dto.js';

/**
 * Composed pages.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * `sections` IS VALIDATED BY THE SHARED REGISTRY, not by anything local. The
 * allowlist lives in `@sailent/validation` so the API, the admin UI and the
 * renderer all agree on what a section is — one definition, checked where it
 * is written.
 * ══════════════════════════════════════════════════════════════════════════
 */

const optionalText = (max: number) => z.string().trim().max(max).nullish();

export const createPageSchema = z.object({
  /**
   * The route this composes: `home`, `about`. Lowercase words and hyphens.
   *
   * Creating a row does not create a route — the routes exist already. A slug
   * nothing renders is simply a row nothing reads, which is why this is not a
   * free-form path and carries no leading slash.
   */
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase words separated by hyphens')
    .max(120),
  title: z.string().trim().min(2, 'A title is required').max(200),
  sections: pageSectionsSchema.optional(),
  metaTitle: optionalText(240),
  metaDescription: optionalText(400),
  /** Recorded on the revision this save creates. */
  note: optionalText(300),
});

/** The slug is fixed after creation: it names a route, not a title. */
export const updatePageSchema = createPageSchema.omit({ slug: true }).partial();

export const pageStatusSchema = z
  .object({
    status: z.enum(['draft', 'published', 'archived']),
    /**
     * Publish at a time rather than now.
     *
     * Only meaningful with `published`. A page carrying a future date is
     * `published` in the row and invisible on the site until the date passes —
     * the public read does the comparison, so there is no scheduler to run and
     * no moment where the two disagree.
     */
    scheduledAt: z.coerce.date().nullish(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.status === 'published' || !value.scheduledAt, {
    message: 'Only a published page can be scheduled.',
    path: ['scheduledAt'],
  });

export const pageListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['draft', 'published', 'archived', 'all']).default('all'),
});

/** Revert to an earlier snapshot. */
export const revertPageSchema = z.object({
  version: z.number().int().min(1),
  reason: z.string().trim().max(500).optional(),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
export type PageStatusInput = z.infer<typeof pageStatusSchema>;
export type PageListQuery = z.infer<typeof pageListQuerySchema>;
export type RevertPageInput = z.infer<typeof revertPageSchema>;
