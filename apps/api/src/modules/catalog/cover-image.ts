import { and, eq } from 'drizzle-orm';

import { media, type DatabaseClient } from '@sailent/database';

import { ValidationException } from '../../common/exceptions.js';

/**
 * A campaign or programme cover must be a PUBLIC image from the media library
 * (Phase 13) — the same rule blog featured images follow.
 *
 * The column is a URL (`cover_image text`), so the check is that the URL is
 * one the media library issued for a public image. That makes every cover an
 * upload whose type was sniffed from its bytes and whose EXIF/GPS was removed,
 * and refuses a typed-in link to somewhere else entirely. `null` clears it,
 * and the public page falls back to its placeholder as before.
 */
export async function assertPublicMediaCover(
  database: DatabaseClient,
  coverImage: string | null | undefined,
): Promise<void> {
  if (coverImage === undefined || coverImage === null || coverImage === '') return;

  const [row] = await database.db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.url, coverImage), eq(media.visibility, 'public')))
    .limit(1);

  if (!row) {
    throw new ValidationException([
      {
        field: 'coverImage',
        code: 'not_in_library',
        message: 'Choose a public image from the media library.',
      },
    ]);
  }
}
