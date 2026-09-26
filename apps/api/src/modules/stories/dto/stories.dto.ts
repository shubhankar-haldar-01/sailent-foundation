import { z } from 'zod';

import { paginationQuerySchema } from '../../../common/dto/pagination.dto.js';

/**
 * Success stories.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE STATUS MODEL IS THE EXISTING ONE. `publish_status` already carries
 * `draft | published | archived` and `success_stories` already has
 * `deleted_at`. Nothing here invents a second lifecycle.
 * ══════════════════════════════════════════════════════════════════════════
 */

const optionalText = (max: number) => z.string().trim().max(max).nullish();

/** The narrative sections, which the public page renders under fixed headings. */
const narrative = {
  challenge: optionalText(5_000),
  intervention: optionalText(5_000),
  journey: optionalText(5_000),
  outcome: optionalText(5_000),
  impact: optionalText(5_000),
};

export const createStorySchema = z
  .object({
    title: z.string().trim().min(3, 'A title is required').max(200),
    /** Optional: the slug service derives one from the title when absent. */
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase words separated by hyphens')
      .max(200)
      .optional(),
    excerpt: optionalText(500),
    content: optionalText(50_000),
    ...narrative,

    category: optionalText(80),
    location: optionalText(160),

    /**
     * The person the story is about.
     *
     * Nullable, and the publish gate treats its presence as the trigger for
     * the consent requirement — a story with no named subject identifies
     * nobody and needs no consent record.
     */
    subjectName: optionalText(160),

    /*
      MEDIA IS A REFERENCE, NOT AN UPLOAD.

      `cover_image` and `gallery` already exist as plain references, so an
      editor can point at an image that is already hosted. Building an upload
      pipeline is the Media Library, which is a later phase; keeping these as
      references means the story work does not have to wait for it and does not
      have to be redone when it arrives.
    */
    coverImage: optionalText(1_000),
    gallery: z.array(z.string().trim().max(1_000)).max(24).nullish(),

    programId: z.string().uuid().nullish(),
    campaignId: z.string().uuid().nullish(),

    consentObtained: z.boolean().optional(),
    consentDocumentId: z.string().uuid().nullish(),
    isAnonymised: z.boolean().optional(),

    metaTitle: optionalText(200),
    metaDescription: optionalText(320),
  })
  .strict();

export const updateStorySchema = createStorySchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

/**
 * Status changes go through their own route.
 *
 * Publishing is not an edit: it is the moment a story about a real person
 * becomes visible to everybody, and it is gated on consent. Folding it into
 * the general update would mean every field edit had to re-run that gate.
 */
export const storyStatusSchema = z
  .object({
    status: z.enum(['draft', 'published', 'archived']),
    /** Recorded on the audit row. Who changed it is not the same as why. */
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export const storyListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['all', 'draft', 'published', 'archived']).default('all'),
  q: z.string().trim().max(200).optional(),
  programId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
});

export type CreateStoryInput = z.infer<typeof createStorySchema>;
export type UpdateStoryInput = z.infer<typeof updateStorySchema>;
export type StoryStatusInput = z.infer<typeof storyStatusSchema>;
export type StoryListQuery = z.infer<typeof storyListQuerySchema>;
