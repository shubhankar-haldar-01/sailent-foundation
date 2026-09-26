import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';

import { campaignGallery, media, type DatabaseClient } from '@sailent/database';
import type { AuthenticatedActor } from '@sailent/types';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditContext } from '../catalog/programs.service.js';
import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  ValidationException,
} from '../../common/exceptions.js';
import { offsetFor, paginate, resolveSort } from '../../common/dto/pagination.dto.js';
import { StorageService, type StorageBucket } from '../storage/storage.service.js';
import { UnsupportedImageError, inspectImage } from '../storage/image-inspection.js';
import { MAX_UPLOAD_BYTES, type MediaListQuery, type UpdateMediaInput } from './dto/media.dto.js';

/**
 * The media library.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO THINGS MUST AGREE: THE ROW AND THE OBJECT.
 *
 * Every operation here writes to a database and to an object store, and the
 * two cannot be made atomic. So the ORDER is chosen so that the failure modes
 * are survivable:
 *
 *   UPLOAD — object first, then the row. A failure leaves an object nobody
 *   references: invisible, costs a fraction of a penny, and is collectable.
 *   The other order leaves a row pointing at nothing, which renders as a
 *   broken image on a public page.
 *
 *   DELETE — row first, then the object. A failure leaves an orphan object
 *   again, rather than a row pointing at something that is gone.
 *
 * Both failure modes are the same one, chosen deliberately: an unreferenced
 * object, never a dangling reference.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class MediaService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  private get db() {
    return this.database.db;
  }

  /**
   * Refuse clearly when there is nowhere to put anything.
   *
   * `StorageNotConfiguredError` is a plain Error, so it would surface as a 500
   * and read as a bug. This is a deployment state with a specific remedy, and
   * the message says what it is — without naming which variable is missing,
   * which is not an administrator's problem to solve from a browser.
   */
  private assertStorageReady(): void {
    if (this.storage.isConfigured) return;
    throw new ServiceUnavailableException(
      'Image storage is not configured on this server, so there is nowhere to put the file. ' +
        'Nothing was uploaded or changed. This needs a deployment change, not a different image.',
    );
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async list(query: MediaListQuery) {
    const filters: SQL[] = [];
    if (query.visibility !== 'all') filters.push(eq(media.visibility, query.visibility));

    if (query.q) {
      const term = `%${query.q}%`;
      // Alt text and caption — what a person would remember about an image.
      // NOT the storage key, which is random hex and searchable by nobody.
      const search = or(ilike(media.altText, term), ilike(media.caption, term));
      if (search) filters.push(search);
    }

    const where = filters.length > 0 ? and(...filters) : undefined;
    const sortable = { createdAt: media.createdAt, sizeBytes: media.sizeBytes };
    const { column } = resolveSort(query.sort, sortable, 'createdAt');

    const [items, [count]] = await Promise.all([
      this.db
        .select()
        .from(media)
        .where(where)
        .orderBy(desc(column))
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(media)
        .where(where),
    ]);

    return paginate(
      await Promise.all(items.map((item) => this.present(item))),
      query.page,
      query.limit,
      count?.value ?? 0,
    );
  }

  async getById(id: string) {
    const [row] = await this.db.select().from(media).where(eq(media.id, id)).limit(1);
    if (!row) throw new NotFoundException('Media');

    return { ...(await this.present(row)), references: await this.referencesFor(id) };
  }

  /**
   * Add a usable URL, without ever exposing where the object really lives.
   *
   * A public object gets its permanent URL. A PRIVATE one gets a signed URL
   * that expires — the private bucket has no public hostname, so this is the
   * only way to see it, and a link copied out of the browser stops working.
   *
   * The `storageKey` stays on the admin payload: an administrator debugging a
   * missing image needs it, and this response is already behind `media.read`.
   * It is never on a public response.
   */
  private async present(row: typeof media.$inferSelect) {
    if (row.visibility === 'public') {
      return { ...row, url: row.url ?? this.storage.publicUrl(row.storageKey) };
    }

    let signedUrl: string | null = null;
    try {
      signedUrl = this.storage.isConfigured ? await this.storage.signedUrl(row.storageKey) : null;
    } catch {
      // A preview is a convenience. Failing to mint one must not make the
      // library unreadable.
      signedUrl = null;
    }

    // `url` stays null — `media_private_has_no_url` enforces that in the
    // database, and the signed URL is a separate, expiring field.
    return { ...row, url: null, signedUrl };
  }

  // -------------------------------------------------------------------------
  // Upload
  // -------------------------------------------------------------------------

  async upload(
    file: { buffer: Buffer; mimetype?: string; size?: number },
    input: { altText: string; caption?: string; visibility: 'public' | 'private' },
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    /*
      Refused before anything is read or written — and as a 503 naming the
      cause, not a 500.

      An administrator whose upload fails needs to know it is a deployment
      problem rather than something wrong with their file. "Something went
      wrong" sends them to re-export the image half a dozen times.
    */
    this.assertStorageReady();

    if (file.buffer.byteLength > MAX_UPLOAD_BYTES) {
      throw new ValidationException([
        {
          code: 'file_too_large',
          field: 'file',
          message: `That file is larger than ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.`,
        },
      ]);
    }

    /*
      THE DECLARED TYPE DECIDES NOTHING.

      `file.mimetype` is whatever the multipart part claimed. The real type
      comes from the bytes, and everything downstream — the stored content
      type, the extension in the key, the database column — uses the sniffed
      one.
    */
    let inspected;
    try {
      inspected = inspectImage(file.buffer, file.mimetype);
    } catch (error) {
      if (error instanceof UnsupportedImageError) {
        throw new ValidationException(
          [{ code: 'unsupported_type', field: 'file', message: error.message }],
          'That file cannot be uploaded.',
        );
      }
      throw error;
    }

    const bucket: StorageBucket = input.visibility === 'public' ? 'public' : 'private';
    const key = this.storage.buildKey({ prefix: 'media', mimeType: inspected.mimeType });

    // Object first. See the note at the top of this class.
    await this.storage.put(bucket, key, file.buffer, inspected.mimeType);

    const [created] = await this.db
      .insert(media)
      .values({
        storageKey: key,
        // Only a PUBLIC object carries a URL. The database enforces this too.
        url: input.visibility === 'public' ? this.storage.publicUrl(key) : null,
        altText: input.altText,
        caption: input.caption ?? null,
        mimeType: inspected.mimeType,
        sizeBytes: file.buffer.byteLength,
        width: inspected.width,
        height: inspected.height,
        visibility: input.visibility,
        uploadedBy: actor.id,
      })
      .returning({ id: media.id });

    if (!created) throw new ConflictException('Could not record the upload.');

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: 'media.upload',
      entityType: 'media',
      entityId: created.id,
      // Metadata only. Never the file, and never a URL that would outlive the
      // row in a log with a longer retention period.
      newValues: {
        storageKey: key,
        mimeType: inspected.mimeType,
        sizeBytes: file.buffer.byteLength,
        visibility: input.visibility,
      },
      ...context,
    });

    return this.getById(created.id);
  }

  // -------------------------------------------------------------------------
  // Metadata
  // -------------------------------------------------------------------------

  /**
   * Edit the fields a person is allowed to edit.
   *
   * `storageKey`, `mimeType`, `sizeBytes`, `width`, `height`, `uploadedBy` and
   * the timestamps are all absent from the schema that reaches here — they
   * describe what was actually stored, and letting somebody retype them would
   * let the row disagree with the object it names.
   */
  async update(
    id: string,
    input: UpdateMediaInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const existing = await this.getById(id);

    /*
      CHANGING VISIBILITY MOVES THE OBJECT BETWEEN BUCKETS.

      The two buckets differ in exactly the way that matters: one has a public
      hostname and the other does not. Flipping the column without moving the
      object would leave a "private" row whose bytes are still served from a
      public URL that anybody who saw it once can still use.

      Copy to the new bucket, then delete from the old. If the delete fails the
      object exists twice, which is wasteful and safe; the other order would
      lose it.
    */
    const movingTo =
      input.visibility && input.visibility !== existing.visibility ? input.visibility : null;

    if (movingTo) {
      this.assertStorageReady();

      const from: StorageBucket = existing.visibility === 'public' ? 'public' : 'private';
      const to: StorageBucket = movingTo === 'public' ? 'public' : 'private';

      const bytes = await this.storage.read(from, existing.storageKey);
      await this.storage.put(to, existing.storageKey, bytes, existing.mimeType);
      await this.storage.delete(from, existing.storageKey);
    }

    await this.db
      .update(media)
      .set({
        ...(input.altText !== undefined ? { altText: input.altText } : {}),
        ...(input.caption !== undefined ? { caption: input.caption ?? null } : {}),
        ...(movingTo
          ? {
              visibility: movingTo,
              url: movingTo === 'public' ? this.storage.publicUrl(existing.storageKey) : null,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(media.id, id));

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: movingTo ? 'media.visibility_changed' : 'media.update',
      entityType: 'media',
      entityId: id,
      oldValues: { altText: existing.altText, visibility: existing.visibility },
      newValues: {
        altText: input.altText ?? existing.altText,
        visibility: movingTo ?? existing.visibility,
      },
      // Making something public is a disclosure decision.
      severity: movingTo === 'public' ? 'warning' : 'info',
      ...context,
    });

    return this.getById(id);
  }

  // -------------------------------------------------------------------------
  // Deletion
  // -------------------------------------------------------------------------

  /**
   * Where this image is used.
   *
   * `campaign_gallery.media_id` is the only FOREIGN KEY to `media`, and it is
   * `ON DELETE CASCADE` — so a delete would silently empty a gallery rather
   * than fail. That is precisely why this check exists in the service: the
   * database would not stop it.
   *
   * Stories and campaigns reference images by URL or storage key rather than
   * by id, so those are matched on the key.
   */
  private async referencesFor(id: string) {
    const [row] = await this.db.select().from(media).where(eq(media.id, id)).limit(1);
    if (!row) return [];

    const gallery = await this.db
      .select({ campaignId: campaignGallery.campaignId })
      .from(campaignGallery)
      .where(eq(campaignGallery.mediaId, id));

    const references: { kind: string; count: number }[] = [];
    if (gallery.length > 0) references.push({ kind: 'campaign gallery', count: gallery.length });

    // Anything storing the key or the URL as a plain column.
    const [byKey] = await this.db
      .execute<{ n: number }>(
        sql`
      SELECT (
        (SELECT count(*) FROM success_stories WHERE cover_image = ${row.storageKey} OR cover_image = ${row.url ?? ''})
      + (SELECT count(*) FROM campaigns       WHERE cover_image = ${row.storageKey} OR cover_image = ${row.url ?? ''})
      + (SELECT count(*) FROM programs        WHERE cover_image = ${row.storageKey} OR cover_image = ${row.url ?? ''})
      )::int AS n
    `,
      )
      .then((result) => (result.rows ?? []) as unknown as { n: number }[]);

    if (byKey && byKey.n > 0) references.push({ kind: 'content cover image', count: byKey.n });

    return references;
  }

  /**
   * Delete a media record and its object.
   *
   * HARD DELETION, stated plainly: `media` has no `deleted_at` column, so
   * there is no archived state to move a row into, and adding one was not
   * justified by anything this phase needs. What makes it safe is the
   * reference check — an image in use cannot be deleted at all.
   */
  async remove(id: string, actor: AuthenticatedActor, context: AuditContext) {
    const existing = await this.getById(id);
    const references = await this.referencesFor(id);

    if (references.length > 0) {
      const described = references.map((r) => `${r.count} ${r.kind}`).join(', ');
      throw new ConflictException(
        `This image is in use (${described}). Remove it from those first — deleting it here ` +
          'would leave a broken image on a public page.',
      );
    }

    this.assertStorageReady();

    // Row first. See the note at the top of this class.
    await this.db.delete(media).where(eq(media.id, id));

    const bucket: StorageBucket = existing.visibility === 'public' ? 'public' : 'private';
    await this.storage.delete(bucket, existing.storageKey);

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: 'media.delete',
      entityType: 'media',
      entityId: id,
      // The row is gone; the audit entry is the only remaining record of it.
      oldValues: {
        storageKey: existing.storageKey,
        altText: existing.altText,
        visibility: existing.visibility,
      },
      severity: 'warning',
      ...context,
    });

    return { id, deleted: true };
  }
}
