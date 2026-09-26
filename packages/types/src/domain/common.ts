/** Shapes reused across domains. Kept deliberately small. */

export type UUID = string;
export type Slug = string;
/** ISO-8601 timestamp string as it crosses the wire. */
export type IsoDateTime = string;

export interface Timestamped {
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Identified {
  id: UUID;
}

/**
 * Data privacy tier (docs/database-architecture.md §2).
 * Present in the type system so serialisers can be checked against it.
 */
export type PrivacyTier = 'PUBLIC' | 'PRIVATE' | 'SENSITIVE' | 'ADMIN_ONLY';

export interface ImageRef {
  url: string;
  /** Required — publishing is blocked without it (database-architecture §11). */
  alt: string;
  width?: number;
  height?: number;
  blurhash?: string;
}
