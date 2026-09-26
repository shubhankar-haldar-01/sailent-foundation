import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { primaryId, timestamps } from './_shared.js';
import { mediaVisibilityEnum } from './enums.js';
import { campaigns } from './campaigns.js';
import { users } from './users.js';

/**
 * Uploaded media.
 *
 * Stores the STORAGE KEY, not only a URL. A public URL is a property of the
 * bucket and the CDN in front of it — both of which change — while the key is
 * the thing that actually identifies the object. Keeping the key means moving
 * providers is a configuration change rather than a rewrite of every row.
 *
 * `url` is a cache of the currently-resolvable public address, and is null for
 * private objects, which are only ever served through a signed URL generated
 * at request time (docs/security-architecture.md).
 */
export const media = pgTable(
  'media',
  {
    id: primaryId(),
    /** Object key within the bucket. The durable identifier. */
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    /** Resolvable public URL, when the object is public. Never for private. */
    url: text('url'),
    /**
     * REQUIRED. An image without alt text is invisible to anyone using a
     * screen reader, and the moment to write it is upload — not "later",
     * which never comes.
     */
    altText: varchar('alt_text', { length: 300 }).notNull(),
    caption: varchar('caption', { length: 300 }),

    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    width: integer('width'),
    height: integer('height'),

    visibility: mediaVisibilityEnum('visibility').notNull().default('public'),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('media_storage_key_unique').on(table.storageKey),
    index('media_visibility_idx').on(table.visibility),
    check('media_size_positive', sql`size_bytes > 0`),
    // A private object must not carry a public URL: the column being empty is
    // what guarantees nothing can accidentally render one.
    check('media_private_has_no_url', sql`visibility = 'public' OR url IS NULL`),
  ],
);

export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;

/**
 * A campaign's gallery: ordered, individually publishable media.
 *
 * A join table rather than an array column on `campaigns`, because each entry
 * carries its own state — position in the gallery, and whether it is shown at
 * all. An image can also then be reused across campaigns without a second
 * upload.
 */
export const campaignGallery = pgTable(
  'campaign_gallery',
  {
    id: primaryId(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    mediaId: uuid('media_id')
      .notNull()
      // RESTRICT: removing an image that a gallery still shows should fail
      // loudly rather than silently blanking a published page.
      .references(() => media.id, { onDelete: 'restrict' }),
    displayOrder: integer('display_order').notNull().default(100),
    visibility: mediaVisibilityEnum('visibility').notNull().default('public'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('campaign_gallery_unique').on(table.campaignId, table.mediaId),
    index('campaign_gallery_order_idx').on(table.campaignId, table.displayOrder),
  ],
);

export type CampaignGalleryItem = typeof campaignGallery.$inferSelect;
export type NewCampaignGalleryItem = typeof campaignGallery.$inferInsert;
