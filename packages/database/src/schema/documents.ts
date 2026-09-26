import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { primaryId, timestamps } from './_shared.js';
import { documentTypeEnum, documentVisibilityEnum } from './enums.js';
import { users } from './users.js';

/**
 * Documents — the public/private boundary, made explicit.
 *
 * `fileKey` is the storage object key; `fileUrl` is populated ONLY for public
 * documents. A private document is never addressable by URL: it is served
 * through a short-lived signed URL issued after a permission check, and every
 * access is audited (docs/security-architecture.md §6).
 *
 * Changing `visibility` requires re-authentication and writes an audit row — a
 * private document promoted to public by accident is a data breach, and a
 * confirmation step is cheap.
 */
export const documents = pgTable(
  'documents',
  {
    id: primaryId(),
    title: varchar('title', { length: 240 }).notNull(),
    description: text('description'),

    /** Public CDN URL. NULL for anything not public. */
    fileUrl: text('file_url'),
    /** Storage object key. Randomised, never derived from user input. */
    fileKey: text('file_key').notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 127 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),

    documentType: documentTypeEnum('document_type').notNull().default('other'),
    visibility: documentVisibilityEnum('visibility').notNull().default('private'),
    financialYear: varchar('financial_year', { length: 9 }),

    relatedType: varchar('related_type', { length: 48 }),
    relatedId: uuid('related_id'),

    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    downloadCount: bigint('download_count', { mode: 'number' }).notNull().default(0),

    ...timestamps,
  },
  (table) => [
    index('documents_visibility_type_idx').on(table.visibility, table.documentType),
    index('documents_financial_year_idx').on(table.financialYear),
    index('documents_related_idx').on(table.relatedType, table.relatedId),
    // Newest first — what every page of the admin library is ordered by.
    index('documents_created_at_idx').on(table.createdAt),

    /*
      One row per stored object (migration 0021).

      Two rows naming one object turn a single visibility change into a silent
      inconsistency: one says public, the other private, and the bytes can only
      be in one bucket.
    */
    uniqueIndex('documents_file_key_unique').on(table.fileKey),

    check('documents_size_positive', sql`size_bytes > 0`),
    // Only a public document may carry a directly addressable URL.
    check('documents_url_only_when_public', sql`file_url IS NULL OR visibility = 'public'`),
    /*
      A public document must have been published (migration 0021).

      The public read filters on `visibility = 'public' AND published_at IS NOT
      NULL`; without this a row can satisfy the first half and not the second,
      and be invisible on the site while the admin screen calls it public.
    */
    check(
      'documents_public_has_published_at',
      sql`visibility <> 'public' OR published_at IS NOT NULL`,
    ),
  ],
);

export type SailentDocument = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
