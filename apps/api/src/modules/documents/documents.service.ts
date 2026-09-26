import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';

import { campaigns, documents, type DatabaseClient } from '@sailent/database';
import type { AuthenticatedActor } from '@sailent/types';
import {
  PRIVATE_DOCUMENT_VISIBILITIES,
  type DocumentVisibility,
  type DocumentType,
} from '@sailent/validation';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditContext } from '../catalog/programs.service.js';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  ValidationException,
} from '../../common/exceptions.js';
import { offsetFor, paginate } from '../../common/dto/pagination.dto.js';
import { StorageService, type StorageBucket } from '../storage/storage.service.js';
import { UnsupportedDocumentError, inspectDocument } from '../storage/document-inspection.js';
import { DOCUMENT_SIGNED_URL_SECONDS, MAX_DOCUMENT_UPLOAD_BYTES } from './dto/documents.dto.js';

interface CreateInput {
  title: string;
  description?: string;
  documentType: DocumentType;
  visibility: DocumentVisibility;
  financialYear?: string;
  relatedType?: 'campaign';
  relatedId?: string;
}

interface UpdateInput {
  title?: string;
  description?: string;
  documentType?: DocumentType;
  financialYear?: string;
}

interface ListQuery {
  page: number;
  pageSize: number;
  visibility?: DocumentVisibility;
  documentType?: DocumentType;
  financialYear?: string;
  search?: string;
}

/**
 * The document library.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE WHOLE MODULE IS ONE SENTENCE FROM §4.20, AND IT IS A NEGATIVE ONE.
 *
 * "Nothing in this module is publicly reachable — the only documents a visitor
 * sees are ones explicitly attached to a campaign and marked public."
 *
 * So there is no public list route, no public detail route and no public
 * search. The single public surface is the campaign page, which already reads
 * `visibility = 'public' AND published_at IS NOT NULL` in the query rather
 * than filtering afterwards. Nothing here changes that; this service is the
 * administrative half that was never built.
 *
 * TWO THINGS MUST AGREE: THE ROW AND THE OBJECT — the same problem the media
 * library has, solved the same way, because the failure modes are the same.
 * Upload puts the object first, so a failure leaves an unreferenced object
 * rather than a row pointing at nothing.
 *
 * VISIBILITY IS NOT A FLAG ON A ROW. It decides which BUCKET the bytes are in,
 * so changing it MOVES them. That is why `changeVisibility` is the longest
 * method here and why it is the one route marked `@Sensitive()`.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  private get db() {
    return this.database.db;
  }

  private assertStorageReady(): void {
    if (this.storage.isConfigured) return;
    throw new ServiceUnavailableException(
      'Document storage is not configured on this server, so there is nowhere to put the file. ' +
        'Nothing was uploaded or changed. This needs a deployment change, not a different file.',
    );
  }

  /**
   * Which visibilities this actor may SEE.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * APPLIED AS A QUERY FILTER, NEVER AS A CHECK AFTER THE FACT.
   *
   * `document.read` is "view public documents"; `document.read_private` is
   * "view private documents" and is a sensitive permission. An actor holding
   * only the first must not be able to learn that a private document exists —
   * not its title, not its count, and not by asking for it by id and being
   * told "forbidden" rather than "not found".
   *
   * Reading rows and then dropping them would satisfy the first two and fail
   * the third, and would still have pulled internal titles into a response
   * object something could serialise. So the boundary is in the WHERE clause.
   * ══════════════════════════════════════════════════════════════════════════
   */
  private visibleTo(actor: AuthenticatedActor): DocumentVisibility[] {
    const canSeePrivate = actor.permissions.includes('document.read_private');
    return canSeePrivate ? ['public', 'private', 'admin_only'] : ['public'];
  }

  private bucketFor(visibility: DocumentVisibility): StorageBucket {
    return PRIVATE_DOCUMENT_VISIBILITIES.includes(visibility) ? 'private' : 'public';
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async list(query: ListQuery, actor: AuthenticatedActor) {
    const filters: SQL[] = [inArray(documents.visibility, this.visibleTo(actor))];

    if (query.visibility) {
      /*
        Narrowing, never widening. Asking for `private` without
        `document.read_private` intersects to nothing and returns an empty
        page — the same answer as a library that holds no private documents,
        which is the answer that discloses least.
      */
      filters.push(eq(documents.visibility, query.visibility));
    }
    if (query.documentType) filters.push(eq(documents.documentType, query.documentType));
    if (query.financialYear) filters.push(eq(documents.financialYear, query.financialYear));

    if (query.search) {
      const term = `%${query.search}%`;
      // Title and description — what a person remembers. NOT `file_key`, which
      // is random hex, and not `file_name`, which may name an internal share.
      const search = or(ilike(documents.title, term), ilike(documents.description, term));
      if (search) filters.push(search);
    }

    const where = and(...filters);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select(this.publicColumns())
        .from(documents)
        .where(where)
        .orderBy(desc(documents.createdAt))
        .limit(query.pageSize)
        .offset(offsetFor(query.page, query.pageSize)),
      this.db.select({ total: count() }).from(documents).where(where),
    ]);

    return paginate(rows, query.page, query.pageSize, totals?.total ?? 0);
  }

  /**
   * The columns a document record may expose.
   *
   * An ALLOWLIST, for the reason `getStoryBySlug` became one: selecting the
   * whole row means every column added later is exposed by default, and this
   * table's `file_key` is the location of a private object in the bucket.
   * Nothing outside this service ever needs it.
   */
  private publicColumns() {
    return {
      id: documents.id,
      title: documents.title,
      description: documents.description,
      documentType: documents.documentType,
      visibility: documents.visibility,
      fileName: documents.fileName,
      mimeType: documents.mimeType,
      sizeBytes: documents.sizeBytes,
      financialYear: documents.financialYear,
      relatedType: documents.relatedType,
      relatedId: documents.relatedId,
      publishedAt: documents.publishedAt,
      downloadCount: documents.downloadCount,
      uploadedBy: documents.uploadedBy,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      // Only a public document has one, and the CHECK constraint agrees.
      fileUrl: documents.fileUrl,
    };
  }

  /**
   * One document, or a 404.
   *
   * A document this actor may not see answers **not found**, not forbidden —
   * "forbidden" confirms the id names something real, which is the one fact
   * the permission exists to withhold.
   */
  async getById(id: string, actor: AuthenticatedActor) {
    const [row] = await this.db
      .select(this.publicColumns())
      .from(documents)
      .where(and(eq(documents.id, id), inArray(documents.visibility, this.visibleTo(actor))))
      .limit(1);

    if (!row) throw new NotFoundException('That document does not exist.');
    return row;
  }

  /** The row itself, including `fileKey`. Private to this service. */
  private async requireRow(id: string, actor: AuthenticatedActor) {
    const [row] = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), inArray(documents.visibility, this.visibleTo(actor))))
      .limit(1);

    if (!row) throw new NotFoundException('That document does not exist.');
    return row;
  }

  // -------------------------------------------------------------------------
  // Upload
  // -------------------------------------------------------------------------

  async upload(
    file: { buffer: Buffer; mimetype?: string; originalname?: string },
    input: CreateInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    this.assertStorageReady();

    if (file.buffer.byteLength > MAX_DOCUMENT_UPLOAD_BYTES) {
      throw new ValidationException([
        {
          code: 'file_too_large',
          field: 'file',
          message: `That file is larger than ${MAX_DOCUMENT_UPLOAD_BYTES / (1024 * 1024)}MB.`,
        },
      ]);
    }

    /*
      THE DECLARED TYPE DECIDES NOTHING. The real type comes from the bytes,
      and the stored content type, the key's extension and the database column
      all use the sniffed one.
    */
    let inspected;
    try {
      inspected = inspectDocument(file.buffer, file.mimetype);
    } catch (error) {
      if (error instanceof UnsupportedDocumentError) {
        throw new ValidationException(
          [{ code: 'unsupported_type', field: 'file', message: error.message }],
          'That file cannot be uploaded.',
        );
      }
      throw error;
    }

    await this.assertAttachment(input);

    const visibility = input.visibility;
    const bucket = this.bucketFor(visibility);
    const key = this.storage.buildKey({ prefix: 'documents', mimeType: inspected.mimeType });

    // Object first. See the note at the top of this class.
    await this.storage.put(bucket, key, file.buffer, inspected.mimeType);

    /*
      `published_at` is stamped IF AND ONLY IF this is public, because the
      database now refuses a public document without one — and because the
      campaign page filters on it. A private document has never been
      published, so it has no publication date to claim.
    */
    const publishedAt = visibility === 'public' ? new Date() : null;

    const [created] = await this.db
      .insert(documents)
      .values({
        title: input.title,
        description: input.description ?? null,
        documentType: input.documentType,
        visibility,
        fileKey: key,
        fileUrl: visibility === 'public' ? this.storage.publicUrl(key) : null,
        fileName: this.safeFileName(file.originalname),
        mimeType: inspected.mimeType,
        sizeBytes: file.buffer.byteLength,
        financialYear: input.financialYear ?? null,
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
        uploadedBy: actor.id,
        publishedAt,
      })
      .returning({ id: documents.id });

    if (!created) throw new ConflictException('Could not record the upload.');

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: 'document.upload',
      entityType: 'document',
      entityId: created.id,
      newValues: {
        title: input.title,
        documentType: input.documentType,
        visibility,
        sizeBytes: file.buffer.byteLength,
        mimeType: inspected.mimeType,
      },
      // A public upload is a disclosure the moment it happens.
      severity: visibility === 'public' ? 'warning' : 'info',
      ...context,
    });

    return this.getById(created.id, actor);
  }

  /**
   * The original filename, kept for DISPLAY only.
   *
   * It is never part of the storage key (see `buildKey`) and never part of a
   * URL. It is shown in the admin list so an editor recognises what they
   * uploaded, so it is stripped of anything that would misbehave in that one
   * context — path separators, control characters — and truncated to the
   * column width rather than rejected, because a bad filename is not a reason
   * to refuse a valid annual report.
   */
  private safeFileName(original?: string): string {
    const cleaned = (original ?? 'document')
      // eslint-disable-next-line no-control-regex
      .replace(/[ -]/g, '')
      .replace(/[/\\]/g, '-')
      .trim();
    return (cleaned.length > 0 ? cleaned : 'document').slice(0, 255);
  }

  /**
   * A campaign attachment must name a campaign that exists.
   *
   * Without this an editor can attach a public document to a typo and it
   * simply never appears anywhere, with nothing to explain why. `related_id`
   * is polymorphic so the database cannot carry a foreign key; the check
   * belongs here instead of nowhere.
   */
  private async assertAttachment(input: {
    relatedType?: 'campaign';
    relatedId?: string;
  }): Promise<void> {
    if (!input.relatedType && !input.relatedId) return;

    if (!input.relatedType || !input.relatedId) {
      throw new ValidationException([
        {
          code: 'incomplete_attachment',
          field: 'relatedId',
          message: 'Choose a campaign to attach this to, or attach it to nothing.',
        },
      ]);
    }

    const [campaign] = await this.db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.id, input.relatedId), sql`${campaigns.deletedAt} IS NULL`))
      .limit(1);

    if (!campaign) {
      throw new ValidationException([
        { code: 'not_found', field: 'relatedId', message: 'That campaign does not exist.' },
      ]);
    }
  }

  // -------------------------------------------------------------------------
  // Metadata
  // -------------------------------------------------------------------------

  async update(id: string, input: UpdateInput, actor: AuthenticatedActor, context: AuditContext) {
    const existing = await this.requireRow(id, actor);

    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description || null;
    if (input.documentType !== undefined) patch.documentType = input.documentType;
    if (input.financialYear !== undefined) patch.financialYear = input.financialYear || null;

    if (Object.keys(patch).length === 0) return this.getById(id, actor);

    patch.updatedAt = new Date();

    await this.db.update(documents).set(patch).where(eq(documents.id, id));

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: 'document.update',
      entityType: 'document',
      entityId: id,
      oldValues: {
        title: existing.title,
        description: existing.description,
        documentType: existing.documentType,
        financialYear: existing.financialYear,
      },
      newValues: patch,
      ...context,
    });

    return this.getById(id, actor);
  }

  // -------------------------------------------------------------------------
  // Visibility — the one that moves bytes
  // -------------------------------------------------------------------------

  /**
   * Change a document's visibility.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * THIS MOVES THE OBJECT BETWEEN BUCKETS. IT IS NOT A COLUMN UPDATE.
   *
   * R2 exposes a whole bucket or none of it — public access is per-bucket, not
   * per-prefix — so "make this public" cannot be satisfied by flipping a flag.
   * The bytes have to end up in the public bucket, and the bytes of something
   * being withdrawn have to STOP being in it.
   *
   * The order is chosen so that no failure leaves a private document readable:
   *
   *   1. COPY to the destination bucket, under a NEW key.
   *   2. Update the row to point at the new key, inside a transaction.
   *   3. Delete the object from the old bucket.
   *
   * A failure at 1 changes nothing. A failure at 2 leaves an unreferenced copy
   * — which, when promoting, is a public object nobody has the URL of, and
   * when withdrawing, a private object nobody can reach. A failure at 3 leaves
   * the old object behind; for a withdrawal that is the one case that matters,
   * so it is retried and, if it still fails, the operation reports failure
   * rather than claiming a document is private while its public copy is still
   * being served.
   *
   * A NEW KEY, not the same one. Reusing the key would leave the old URL
   * pattern intact and, worse, would make step 3 delete the object step 1 had
   * just written if the two buckets were ever misconfigured to be one.
   * ══════════════════════════════════════════════════════════════════════════
   */
  async changeVisibility(
    id: string,
    input: { visibility: DocumentVisibility; reason: string },
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    this.assertStorageReady();

    const existing = await this.requireRow(id, actor);

    if (existing.visibility === input.visibility) {
      throw new ConflictException(`That document is already ${input.visibility}.`);
    }

    const fromBucket = this.bucketFor(existing.visibility);
    const toBucket = this.bucketFor(input.visibility);
    const becomingPublic = input.visibility === 'public';

    let newKey = existing.fileKey;

    if (fromBucket !== toBucket) {
      newKey = this.storage.buildKey({
        prefix: 'documents',
        mimeType: existing.mimeType,
      });

      const bytes = await this.storage.read(fromBucket, existing.fileKey);
      await this.storage.put(toBucket, newKey, bytes, existing.mimeType);
    }

    /*
      `published_at` is stamped the FIRST time a document becomes public and
      never cleared afterwards. Withdrawing something does not make it untrue
      that it was published, and the date is what an auditor asks for.
    */
    const publishedAt = becomingPublic
      ? (existing.publishedAt ?? new Date())
      : existing.publishedAt;

    await this.db.transaction(async (tx) => {
      await tx
        .update(documents)
        .set({
          visibility: input.visibility,
          fileKey: newKey,
          fileUrl: becomingPublic ? this.storage.publicUrl(newKey) : null,
          publishedAt,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id));
    });

    /*
      Only now is the old object removed, and only if the key actually moved.
      Withdrawing something from the public bucket is the case that must not be
      skipped: leaving it there means the document is private in the database
      and still downloadable by anyone holding the old URL.
    */
    if (fromBucket !== toBucket) {
      try {
        await this.storage.delete(fromBucket, existing.fileKey);
      } catch {
        if (fromBucket === 'public') {
          /*
            The row already says private, so nothing new can find it — but the
            old URL still works. That is a disclosure, so it is recorded at
            `critical` and reported, rather than swallowed.
          */
          await this.audit.record({
            actorType: 'user',
            userId: actor.id,
            action: 'document.withdraw_incomplete',
            entityType: 'document',
            entityId: id,
            reason:
              'The public copy could not be deleted. It may still be reachable by its old URL.',
            severity: 'critical',
            ...context,
          });

          throw new ServiceUnavailableException(
            'The document is now marked private, but its public copy could not be removed and ' +
              'may still be reachable by anyone holding the old link. This has been recorded. ' +
              'Tell an administrator before treating the document as withdrawn.',
          );
        }
        // Promoting: the leftover is a private object nobody references.
      }
    }

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: 'document.visibility_change',
      entityType: 'document',
      entityId: id,
      oldValues: { visibility: existing.visibility },
      newValues: { visibility: input.visibility },
      reason: input.reason,
      // Making something public is the disclosure; withdrawing is the correction.
      severity: becomingPublic ? 'warning' : 'info',
      ...context,
    });

    return this.getById(id, actor);
  }

  // -------------------------------------------------------------------------
  // Download
  // -------------------------------------------------------------------------

  /**
   * Issue a short-lived link to a document's bytes.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * THIS IS THE ACCEPTANCE CRITERION OF §4.20, SO IT IS WORTH BEING EXACT.
   *
   * "A private document is unreachable without an authorised signed URL."
   *
   * Three things make that true, and all three are needed:
   *
   *   • The private bucket has no public hostname, so there is no URL to
   *     guess. `publicUrl()` returns a URL only for the public base.
   *   • The row is fetched through `visibleTo`, so an actor without
   *     `document.read_private` cannot even name a private document — they get
   *     404, not 403.
   *   • The signature expires in five minutes
   *     (docs/security-architecture.md §6).
   *
   * EVERY ISSUE IS AUDITED, including for public documents. §6: "Every access
   * to a volunteer document or tax document is audited." A log that records
   * only the private ones cannot answer "who looked at the audited financials
   * before they were published", because the answer depends on what the
   * visibility was at the time.
   * ══════════════════════════════════════════════════════════════════════════
   */
  async issueDownload(id: string, actor: AuthenticatedActor, context: AuditContext) {
    const row = await this.requireRow(id, actor);

    if (PRIVATE_DOCUMENT_VISIBILITIES.includes(row.visibility)) {
      /*
        Belt and braces. `visibleTo` has already excluded this row for anyone
        without the permission, so this is unreachable — which is exactly why
        it is here: the day someone widens that filter, this still refuses.
      */
      if (!actor.permissions.includes('document.read_private')) {
        throw new ForbiddenException('You do not have access to private documents.');
      }
      this.assertStorageReady();
    }

    const url = PRIVATE_DOCUMENT_VISIBILITIES.includes(row.visibility)
      ? await this.storage.signedUrl(row.fileKey, DOCUMENT_SIGNED_URL_SECONDS)
      : row.fileUrl;

    if (!url) {
      throw new ServiceUnavailableException(
        'That document has no public address, because public storage is not configured on this ' +
          'server. Nothing was changed.',
      );
    }

    /*
      Counted with SQL rather than read-modify-write: two administrators
      opening the same report in the same second would otherwise both read the
      same number and both write it back plus one.
    */
    await this.db
      .update(documents)
      .set({ downloadCount: sql`${documents.downloadCount} + 1` })
      .where(eq(documents.id, id));

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: 'document.download',
      entityType: 'document',
      entityId: id,
      newValues: { visibility: row.visibility, fileName: row.fileName },
      ...context,
    });

    return {
      url,
      fileName: row.fileName,
      mimeType: row.mimeType,
      expiresInSeconds: PRIVATE_DOCUMENT_VISIBILITIES.includes(row.visibility)
        ? DOCUMENT_SIGNED_URL_SECONDS
        : null,
    };
  }
}
