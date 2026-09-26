import { z } from 'zod';

/**
 * File metadata validation.
 *
 * Phase 1 defines the contract only; upload handling, magic-byte checks and
 * signed URLs land in Phase 4 (docs/security-architecture.md §6).
 *
 * Note SVG is deliberately absent from the image list — it is an XSS vector
 * and is never accepted from untrusted input.
 */

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;

export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024; // 25 MB

export const fileMetadataSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(127),
  sizeBytes: z.number().int().positive(),
});

export const imageUploadSchema = fileMetadataSchema.extend({
  mimeType: z.enum(IMAGE_MIME_TYPES, {
    errorMap: () => ({ message: 'Upload a JPEG, PNG, WebP or AVIF image' }),
  }),
  sizeBytes: z.number().int().positive().max(MAX_IMAGE_BYTES, 'Image must be 10 MB or smaller'),
  /** Required: publishing content with missing alt text is blocked. */
  altText: z.string().trim().min(1, 'Alt text is required for accessibility').max(500),
});

export const documentUploadSchema = fileMetadataSchema.extend({
  mimeType: z.enum(DOCUMENT_MIME_TYPES),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_DOCUMENT_BYTES, 'Document must be 25 MB or smaller'),
});

/**
 * Document visibility.
 *
 * SUPERSEDED — see `domain/documents.ts`.
 *
 * This was written in Phase 1 from the design document, which said
 * `restricted`. The enum that actually shipped in migration `0000` is
 * `admin_only`, and Phase 10.10 validates against the database rather than
 * against the plan. Kept because it is exported, re-pointed so the two cannot
 * disagree.
 */
export const documentVisibilitySchema = z.enum(['public', 'private', 'admin_only']);
