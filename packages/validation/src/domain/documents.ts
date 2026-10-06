import { z } from 'zod';

/**
 * Documents — the public/private boundary, stated once.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THERE IS NO PUBLIC DOCUMENT LIBRARY, AND THAT IS THE POINT OF THIS MODULE.
 *
 * `docs/product-requirements.md` §4.20: "Annual reports, audited statements
 * and policies are ADMIN-ONLY … Nothing in this module is publicly reachable —
 * the only documents a visitor sees are ones explicitly attached to a campaign
 * and marked public."
 *
 * So `visibility` is not a display preference. It decides which BUCKET the
 * bytes live in, whether a URL exists at all, and who may ask for one. The
 * schema below is what the API validates every write against, so a hand-made
 * request cannot introduce a value the storage layer has no rule for.
 *
 * `admin_only`, NOT `restricted`. The Phase 1 contract in `schemas/file.ts`
 * guessed `restricted`; the enum that shipped in migration `0000` is
 * `admin_only`, and the database is the thing that is actually true.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** Mirrors `document_visibility` in the database, exactly. */
export const DOCUMENT_VISIBILITIES = ['public', 'private', 'admin_only'] as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

/** Mirrors `document_type` in the database, exactly. */
export const DOCUMENT_TYPES = [
  'annual_report',
  'financial',
  'impact_report',
  'utilisation',
  'policy',
  'registration',
  'internal',
  'other',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * The visibilities whose bytes live in the PRIVATE bucket.
 *
 * Expressed as a list rather than `!== 'public'` so that adding a fourth
 * visibility is a decision somebody has to make here, in the open, rather than
 * something that silently inherits private storage — or silently does not.
 */
export const PRIVATE_DOCUMENT_VISIBILITIES: readonly DocumentVisibility[] = [
  'private',
  'admin_only',
];

export function isPubliclyReadable(visibility: DocumentVisibility): boolean {
  return visibility === 'public';
}

/**
 * A financial year, as India writes it: `2025-2026`.
 *
 * Checked as a RANGE, not just a shape. `2025-2019` matches every sensible
 * regex and is not a year; so does `2025-2030`, which is a typo that would
 * quietly file an audited statement under a year nobody will look in.
 */
export const financialYearSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{4}$/, 'Write the financial year as 2025-2026.')
  .refine((value) => {
    const [start, end] = value.split('-').map(Number) as [number, number];
    return end === start + 1;
  }, 'A financial year must end the year after it starts, as in 2025-2026.');

export const documentVisibilityValueSchema = z.enum(DOCUMENT_VISIBILITIES);
export const documentTypeValueSchema = z.enum(DOCUMENT_TYPES);

const title = z
  .string()
  .trim()
  .min(3, 'Give the document a title of at least three characters.')
  .max(240, 'Titles are limited to 240 characters.');

const description = z
  .string()
  .trim()
  .max(2000, 'Descriptions are limited to 2000 characters.')
  .optional();

/**
 * What an editor supplies alongside the file.
 *
 * The FILE itself is not described here: its type and size are decided from
 * the bytes on the server (`document-inspection.ts`), never from anything the
 * client says about them.
 */
export const createDocumentSchema = z.object({
  title,
  description,
  documentType: documentTypeValueSchema.default('other'),
  /*
    Defaults to PRIVATE, and the default is load bearing.

    An upload whose visibility field went missing — a renamed form input, a
    client that forgot it — must not become a public annual report. Failing
    towards the closed state costs an editor one extra click and costs nobody
    a disclosure.
  */
  visibility: documentVisibilityValueSchema.default('private'),
  financialYear: financialYearSchema.optional(),
  /** Attaching to a campaign is what makes a PUBLIC document reachable at all. */
  relatedType: z.literal('campaign').optional(),
  relatedId: z.string().uuid('That is not a valid campaign id.').optional(),
});

export type CreateDocumentInput = z.input<typeof createDocumentSchema>;

/** Metadata only. The file and the visibility each have their own route. */
export const updateDocumentSchema = z
  .object({
    title,
    description: description.or(z.literal('')),
    documentType: documentTypeValueSchema,
    financialYear: financialYearSchema.or(z.literal('')).optional(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Change at least one field.');

/**
 * The visibility change, on its own route because it is its own decision.
 *
 * `reason` is required. Promoting a document to public is the one action in
 * this module that can disclose something, and an audit row that records only
 * "private → public" answers what happened without answering why — which is
 * the question anybody reading the log afterwards actually has.
 */
export const changeDocumentVisibilitySchema = z.object({
  visibility: documentVisibilityValueSchema,
  reason: z
    .string()
    .trim()
    .min(10, 'Say why this is changing, in at least ten characters.')
    .max(500, 'Keep the reason under 500 characters.'),
});

/** Deleting a document (Phase 13): a reason is required, as for a visibility change. */
export const deleteDocumentSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(10, 'Say why this is being deleted, in at least ten characters.')
      .max(500, 'Keep the reason under 500 characters.'),
  })
  .strict();

export const documentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  visibility: documentVisibilityValueSchema.optional(),
  documentType: documentTypeValueSchema.optional(),
  financialYear: financialYearSchema.optional(),
  search: z.string().trim().max(120).optional(),
});
