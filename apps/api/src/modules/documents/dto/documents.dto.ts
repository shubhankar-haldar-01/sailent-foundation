import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  changeDocumentVisibilitySchema,
  createDocumentSchema,
  deleteDocumentSchema,
  documentListQuerySchema,
  updateDocumentSchema,
  DOCUMENT_TYPES,
  DOCUMENT_VISIBILITIES,
} from '@sailent/validation';

/**
 * The schemas come from `@sailent/validation` so the admin UI and the API
 * enforce the same rules; the classes below exist only so Swagger has
 * something to describe.
 */
export {
  changeDocumentVisibilitySchema,
  createDocumentSchema,
  deleteDocumentSchema,
  documentListQuerySchema,
  updateDocumentSchema,
};

/**
 * 25 MB, from `docs/security-architecture.md` §6 ("Size caps: 10 MB images,
 * 25 MB documents").
 *
 * Enforced TWICE on purpose: multer refuses the stream at this size so a
 * 200 MB upload never reaches memory, and the service checks the buffer again
 * because a limit that only exists in a decorator is a limit that stops
 * applying the moment somebody adds a second route.
 */
export const MAX_DOCUMENT_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Five minutes, from `docs/security-architecture.md` §6 ("Signed URLs expire
 * in 5 minutes for sensitive documents").
 *
 * Long enough to click through to a PDF, short enough that a URL left in
 * browser history, a proxy log or a shared screenshot is useless by the time
 * anyone tries it.
 */
export const DOCUMENT_SIGNED_URL_SECONDS = 300;

export class CreateDocumentDto {
  @ApiProperty({ example: 'Annual report 2025-2026' })
  title!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({ enum: DOCUMENT_TYPES, default: 'other' })
  documentType?: string;

  @ApiPropertyOptional({
    enum: DOCUMENT_VISIBILITIES,
    default: 'private',
    description: 'Defaults to private. A missing value never yields a public document.',
  })
  visibility?: string;

  @ApiPropertyOptional({ example: '2025-2026' })
  financialYear?: string;

  @ApiPropertyOptional({ enum: ['campaign'] })
  relatedType?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  relatedId?: string;
}

export class UpdateDocumentDto {
  @ApiPropertyOptional() title?: string;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional({ enum: DOCUMENT_TYPES }) documentType?: string;
  @ApiPropertyOptional({ example: '2025-2026' }) financialYear?: string;
}

export class ChangeDocumentVisibilityDto {
  @ApiProperty({ enum: DOCUMENT_VISIBILITIES })
  visibility!: string;

  @ApiProperty({
    minLength: 10,
    description: 'Why this is changing. Recorded on the audit row.',
  })
  reason!: string;
}
