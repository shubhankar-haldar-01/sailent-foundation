import { z } from 'zod';

import { paginationQuerySchema } from '../../../common/dto/pagination.dto.js';

/** The formats this phase accepts. SVG is deliberately absent — see `image-inspection.ts`. */
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Ten megabytes.
 *
 * Enforced in two places for different reasons: multer refuses a larger body
 * before it is buffered (so a huge upload cannot exhaust memory), and the
 * service checks again because the limit is a rule about what belongs in the
 * library, not only a defence against resource use.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const uploadMediaSchema = z
  .object({
    /*
      Required, and NOT NULL in the database.

      An image without alternative text is unusable to anybody reading the site
      with a screen reader, and "add it later" is the state every library ends
      up in permanently. Asking at upload is the only moment somebody actually
      knows what the picture shows.
    */
    altText: z.string().trim().min(1, 'Describe what the image shows').max(300),
    caption: z.string().trim().max(500).optional(),
    visibility: z.enum(['public', 'private']).default('public'),
  })
  .strict();

export const updateMediaSchema = z
  .object({
    altText: z.string().trim().min(1, 'Describe what the image shows').max(300).optional(),
    caption: z.string().trim().max(500).nullish(),
    visibility: z.enum(['public', 'private']).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const mediaListQuerySchema = paginationQuerySchema.extend({
  visibility: z.enum(['all', 'public', 'private']).default('all'),
  q: z.string().trim().max(200).optional(),
});

export type UploadMediaInput = z.infer<typeof uploadMediaSchema>;
export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;
export type MediaListQuery = z.infer<typeof mediaListQuerySchema>;
