import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';

import {
  campaignGallery,
  campaigns,
  documents,
  faqs,
  impactUpdates,
  media,
  type DatabaseClient,
} from '@sailent/database';
import type { AuthenticatedActor } from '@sailent/types';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { SlugService } from './slug.service.js';
import type { AuditContext } from './programs.service.js';
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions.js';

/**
 * Everything that hangs off a campaign: FAQs, gallery, progress
 * updates and documents.
 *
 * One service because every operation starts the same way — prove the campaign
 * exists, then act on a child of it. Five services would repeat that check five
 * times, and the one that forgot it would let a caller write a FAQ onto a
 * campaign id they made up.
 */
@Injectable()
export class CampaignContentService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly audit: AuditService,
    private readonly slugs: SlugService,
  ) {}

  /**
   * Every method routes through this.
   *
   * It is the authorization boundary for child records: without it, a caller
   * with permission over their own campaign could edit another campaign's FAQs
   * by passing a different id.
   */
  private async assertCampaign(campaignId: string) {
    const [row] = await this.database.db
      .select({ id: campaigns.id, title: campaigns.title, programId: campaigns.programId })
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), isNull(campaigns.deletedAt)))
      .limit(1);

    if (!row) throw new NotFoundException('Campaign');
    return row;
  }

  // =========================================================================
  // Products — MOVED to CampaignProductsService (Phase 5)
  //
  // A campaign's products stopped being a child of the campaign when `products`
  // became a master entity. What a School Kit IS belongs to the catalogue; what
  // THIS campaign charges for one belongs to a junction row. Neither is content
  // hanging off a campaign the way a FAQ is, so neither is managed here.
  //
  // See modules/products/campaign-products.service.ts.
  // =========================================================================

  // =========================================================================
  // FAQs
  // =========================================================================

  async listFaqs(campaignId: string, options: { publishedOnly?: boolean } = {}) {
    await this.assertCampaign(campaignId);

    const filters = [eq(faqs.contextType, 'campaign'), eq(faqs.contextId, campaignId)];
    if (options.publishedOnly) filters.push(eq(faqs.isPublished, true));

    const items = await this.database.db
      .select()
      .from(faqs)
      .where(and(...filters))
      .orderBy(asc(faqs.displayOrder), asc(faqs.createdAt));

    return { items };
  }

  async createFaq(
    campaignId: string,
    input: { question: string; answer: string; displayOrder?: number; isPublished?: boolean },
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    await this.assertCampaign(campaignId);

    const [created] = await this.database.db
      .insert(faqs)
      .values({
        question: input.question,
        answer: input.answer,
        contextType: 'campaign',
        contextId: campaignId,
        displayOrder: input.displayOrder ?? 100,
        isPublished: input.isPublished ?? false,
      })
      .returning({ id: faqs.id });

    if (!created) throw new ConflictException('Could not create the FAQ.');

    await this.audit.record({
      action: 'campaign_faq.create',
      entityType: 'faq',
      entityId: created.id,
      userId: actor.id,
      newValues: { campaignId, question: input.question },
      ...context,
    });

    return this.getFaq(campaignId, created.id);
  }

  async getFaq(campaignId: string, faqId: string) {
    const [row] = await this.database.db
      .select()
      .from(faqs)
      .where(and(eq(faqs.id, faqId), eq(faqs.contextId, campaignId)))
      .limit(1);

    if (!row) throw new NotFoundException('FAQ');
    return row;
  }

  async updateFaq(
    campaignId: string,
    faqId: string,
    input: { question?: string; answer?: string; displayOrder?: number; isPublished?: boolean },
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getFaq(campaignId, faqId);

    await this.database.db
      .update(faqs)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(faqs.id, faqId));

    await this.audit.record({
      action: 'campaign_faq.update',
      entityType: 'faq',
      entityId: faqId,
      userId: actor.id,
      oldValues: { question: before.question, isPublished: before.isPublished },
      newValues: input,
      ...context,
    });

    return this.getFaq(campaignId, faqId);
  }

  async deleteFaq(
    campaignId: string,
    faqId: string,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getFaq(campaignId, faqId);

    // A hard delete, unlike campaigns and programmes: an FAQ is editorial text
    // with nothing referencing it and no financial history attached, so
    // keeping a tombstone would clutter the table for no benefit. The audit
    // row below is what preserves the record of it having existed.
    await this.database.db.delete(faqs).where(eq(faqs.id, faqId));

    await this.audit.record({
      action: 'campaign_faq.delete',
      entityType: 'faq',
      entityId: faqId,
      userId: actor.id,
      oldValues: { question: before.question, answer: before.answer },
      severity: 'warning',
      ...context,
    });
  }

  // =========================================================================
  // Gallery
  // =========================================================================

  async listGallery(campaignId: string, options: { publicOnly?: boolean } = {}) {
    await this.assertCampaign(campaignId);

    const filters = [eq(campaignGallery.campaignId, campaignId)];
    if (options.publicOnly) filters.push(eq(campaignGallery.visibility, 'public'));

    const items = await this.database.db
      .select({
        id: campaignGallery.id,
        displayOrder: campaignGallery.displayOrder,
        visibility: campaignGallery.visibility,
        mediaId: media.id,
        storageKey: media.storageKey,
        url: media.url,
        altText: media.altText,
        caption: media.caption,
        width: media.width,
        height: media.height,
      })
      .from(campaignGallery)
      .innerJoin(media, eq(media.id, campaignGallery.mediaId))
      .where(and(...filters))
      .orderBy(asc(campaignGallery.displayOrder));

    return { items };
  }

  async addGalleryItem(
    campaignId: string,
    input: { mediaId: string; displayOrder?: number; visibility?: 'public' | 'private' },
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    await this.assertCampaign(campaignId);

    const visibility = input.visibility ?? 'public';

    const [image] = await this.database.db
      .select({ id: media.id, visibility: media.visibility, storageKey: media.storageKey })
      .from(media)
      .where(eq(media.id, input.mediaId))
      .limit(1);
    if (!image) {
      throw new ValidationException([
        { field: 'mediaId', code: 'not_found', message: 'That image is not in the media library.' },
      ]);
    }
    // A public gallery item is shown on the public page, so its image must have
    // a public URL. A private image can only be a private gallery item.
    if (visibility === 'public' && image.visibility !== 'public') {
      throw new ValidationException([
        {
          field: 'mediaId',
          code: 'private_image',
          message: 'That image is private. Make it public in the media library first.',
        },
      ]);
    }

    // After the existing images unless an order is given.
    const [last] = await this.database.db
      .select({ value: sql<number>`coalesce(max(${campaignGallery.displayOrder}), 0)` })
      .from(campaignGallery)
      .where(eq(campaignGallery.campaignId, campaignId));

    const [row] = await this.database.db
      .insert(campaignGallery)
      .values({
        campaignId,
        mediaId: image.id,
        displayOrder: input.displayOrder ?? Math.min(Number(last?.value ?? 0) + 10, 9999),
        visibility,
      })
      .onConflictDoNothing()
      .returning({ id: campaignGallery.id });

    if (!row) throw new ConflictException('That image is already in this gallery.');

    await this.audit.record({
      action: 'campaign_gallery.add',
      entityType: 'campaign_gallery',
      entityId: row.id,
      userId: actor.id,
      newValues: { campaignId, mediaId: image.id, visibility },
      ...context,
    });

    return this.listGallery(campaignId);
  }

  /**
   * Put the gallery in the given order (Phase 13). `ids` must be exactly this
   * campaign's gallery items — an id from another campaign is refused, never
   * silently reordered.
   */
  async reorderGallery(
    campaignId: string,
    ids: string[],
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    await this.assertCampaign(campaignId);

    const current = await this.database.db
      .select({ id: campaignGallery.id })
      .from(campaignGallery)
      .where(eq(campaignGallery.campaignId, campaignId));
    const known = new Set(current.map((row) => row.id));
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
      throw new ValidationException([
        {
          field: 'ids',
          code: 'mismatch',
          message: 'List every image in this gallery exactly once, and no others.',
        },
      ]);
    }

    await this.database.db.transaction(async (tx) => {
      for (const [index, id] of ids.entries()) {
        await tx
          .update(campaignGallery)
          .set({ displayOrder: (index + 1) * 10, updatedAt: new Date() })
          .where(and(eq(campaignGallery.id, id), eq(campaignGallery.campaignId, campaignId)));
      }
    });

    await this.audit.record({
      action: 'campaign_gallery.reorder',
      entityType: 'campaign',
      entityId: campaignId,
      userId: actor.id,
      newValues: { order: ids },
      ...context,
    });

    return this.listGallery(campaignId);
  }

  async updateGalleryItem(
    campaignId: string,
    itemId: string,
    input: {
      altText?: string;
      caption?: string | null;
      displayOrder?: number;
      visibility?: 'public' | 'private';
    },
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const [existing] = await this.database.db
      .select({ id: campaignGallery.id, mediaId: campaignGallery.mediaId })
      .from(campaignGallery)
      .where(and(eq(campaignGallery.id, itemId), eq(campaignGallery.campaignId, campaignId)))
      .limit(1);

    if (!existing) throw new NotFoundException('Gallery image');

    await this.database.db.transaction(async (tx) => {
      if (input.displayOrder !== undefined || input.visibility !== undefined) {
        await tx
          .update(campaignGallery)
          .set({
            ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
            ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
            updatedAt: new Date(),
          })
          .where(eq(campaignGallery.id, itemId));
      }

      if (input.altText !== undefined || input.caption !== undefined || input.visibility) {
        await tx
          .update(media)
          .set({
            ...(input.altText !== undefined ? { altText: input.altText } : {}),
            ...(input.caption !== undefined ? { caption: input.caption } : {}),
            // Making an image private drops its public URL, so nothing can go
            // on rendering it from a cached response.
            ...(input.visibility === 'private'
              ? { visibility: 'private' as const, url: null }
              : {}),
            ...(input.visibility === 'public' ? { visibility: 'public' as const } : {}),
            updatedAt: new Date(),
          })
          .where(eq(media.id, existing.mediaId));
      }
    });

    await this.audit.record({
      action: 'campaign_gallery.update',
      entityType: 'campaign_gallery',
      entityId: itemId,
      userId: actor.id,
      newValues: input,
      ...context,
    });

    return this.listGallery(campaignId);
  }

  async removeGalleryItem(
    campaignId: string,
    itemId: string,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const [existing] = await this.database.db
      .select({ id: campaignGallery.id })
      .from(campaignGallery)
      .where(and(eq(campaignGallery.id, itemId), eq(campaignGallery.campaignId, campaignId)))
      .limit(1);

    if (!existing) throw new NotFoundException('Gallery image');

    // Removes the image from THIS gallery. The media row survives, because it
    // may be used by another campaign and because deleting the stored object
    // is a storage operation with its own lifecycle.
    await this.database.db.delete(campaignGallery).where(eq(campaignGallery.id, itemId));

    await this.audit.record({
      action: 'campaign_gallery.remove',
      entityType: 'campaign_gallery',
      entityId: itemId,
      userId: actor.id,
      ...context,
    });

    return this.listGallery(campaignId);
  }

  // =========================================================================
  // Progress updates  (stored in `impact_updates`)
  // =========================================================================

  async listUpdates(campaignId: string, options: { publishedOnly?: boolean } = {}) {
    await this.assertCampaign(campaignId);

    const filters = [eq(impactUpdates.campaignId, campaignId)];
    if (options.publishedOnly) {
      filters.push(eq(impactUpdates.status, 'published'), eq(impactUpdates.isPublic, true));
    }

    const items = await this.database.db
      .select()
      .from(impactUpdates)
      .where(and(...filters))
      .orderBy(desc(impactUpdates.impactDate));

    return { items };
  }

  async createUpdate(
    campaignId: string,
    input: {
      title: string;
      description: string;
      impactDate: string;
      location?: string | null;
      state?: string | null;
      metricType?: string | null;
      metricValue?: number | null;
      metricUnit?: string | null;
      verificationMethod?: string | null;
      statistics?: Record<string, unknown> | null;
    },
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const campaign = await this.assertCampaign(campaignId);

    /**
     * An impact update now has a URL of its own, `/impact/[slug]`.
     *
     * Added in Phase 9. Allocated here rather than left to the caller because
     * this endpoint takes no slug: a campaign update is written in the
     * campaign's own editor, where nobody is thinking about an address. The
     * allocator de-duplicates, so two campaigns both reporting "October
     * progress" get distinct URLs rather than a constraint violation.
     */
    const slug = await this.slugs.allocate('impact', { title: input.title });

    const [created] = await this.database.db
      .insert(impactUpdates)
      .values({
        campaignId,
        slug,
        // Inherited so the update rolls up to the programme as well without
        // anyone having to remember to set it.
        programId: campaign.programId,
        title: input.title,
        description: input.description,
        impactDate: input.impactDate,
        location: input.location ?? null,
        state: input.state ?? null,
        metricType: input.metricType ?? null,
        metricValue: input.metricValue ?? null,
        metricUnit: input.metricUnit ?? null,
        verificationMethod: input.verificationMethod ?? null,
        statistics: input.statistics ?? null,
        status: 'draft',
        isPublic: false,
      })
      .returning({ id: impactUpdates.id });

    if (!created) throw new ConflictException('Could not create the update.');

    await this.audit.record({
      action: 'campaign_update.create',
      entityType: 'impact_update',
      entityId: created.id,
      userId: actor.id,
      newValues: { campaignId, title: input.title },
      ...context,
    });

    return this.getUpdate(campaignId, created.id);
  }

  async getUpdate(campaignId: string, updateId: string) {
    const [row] = await this.database.db
      .select()
      .from(impactUpdates)
      .where(and(eq(impactUpdates.id, updateId), eq(impactUpdates.campaignId, campaignId)))
      .limit(1);

    if (!row) throw new NotFoundException('Update');
    return row;
  }

  async updateUpdate(
    campaignId: string,
    updateId: string,
    input: Record<string, unknown>,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getUpdate(campaignId, updateId);

    // Allow-list: `status` and `isPublic` move only through `publishUpdate`.
    const allowed = [
      'title',
      'description',
      'impactDate',
      'location',
      'state',
      'metricType',
      'metricValue',
      'metricUnit',
      'verificationMethod',
      'statistics',
    ];
    const fields: Record<string, unknown> = {};
    for (const key of allowed) {
      if (input[key] !== undefined) fields[key] = input[key];
    }

    await this.database.db
      .update(impactUpdates)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(impactUpdates.id, updateId));

    await this.audit.record({
      action: 'campaign_update.update',
      entityType: 'impact_update',
      entityId: updateId,
      userId: actor.id,
      oldValues: { title: before.title },
      newValues: fields,
      ...context,
    });

    return this.getUpdate(campaignId, updateId);
  }

  async setUpdatePublished(
    campaignId: string,
    updateId: string,
    published: boolean,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    return this.setUpdateStatus(
      campaignId,
      updateId,
      published ? 'published' : 'draft',
      actor,
      context,
    );
  }

  /** Draft, published or archived (Phase 13 adds archived). */
  async setUpdateStatus(
    campaignId: string,
    updateId: string,
    status: 'draft' | 'published' | 'archived',
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getUpdate(campaignId, updateId);
    const published = status === 'published';

    /**
     * Decision A14 in its narrowest form: an update carrying a figure must say
     * how the figure was established before it is published. A number on a
     * public page with no stated basis is exactly what the rule exists to stop.
     */
    if (published && before.metricValue !== null && !before.verificationMethod?.trim()) {
      throw new ValidationException(
        [
          {
            field: 'verificationMethod',
            code: 'required',
            message:
              'This update reports a figure, so it needs a line saying how that figure was counted.',
          },
        ],
        'Explain how the number was established before publishing.',
      );
    }

    await this.database.db
      .update(impactUpdates)
      .set({
        status,
        // Only a published update is public; draft and archived are not.
        isPublic: published,
        publishedAt: published ? (before.publishedAt ?? new Date()) : before.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(impactUpdates.id, updateId));

    const verb =
      status === 'published' ? 'publish' : status === 'archived' ? 'archive' : 'unpublish';
    await this.audit.record({
      action: `campaign_update.${verb}`,
      entityType: 'impact_update',
      entityId: updateId,
      userId: actor.id,
      oldValues: { status: before.status },
      newValues: { status },
      severity: 'warning',
      ...context,
    });

    return this.getUpdate(campaignId, updateId);
  }

  // =========================================================================
  // Documents
  // =========================================================================

  /**
   * Documents attached to a campaign.
   *
   * `publicOnly` is what the public endpoint passes. Private and restricted
   * documents are filtered IN THE QUERY rather than after it — a private
   * document that is fetched and then dropped has still been read into a
   * response object that something might serialise.
   */
  async listDocuments(campaignId: string, options: { publicOnly?: boolean } = {}) {
    await this.assertCampaign(campaignId);

    const filters = [eq(documents.relatedType, 'campaign'), eq(documents.relatedId, campaignId)];
    if (options.publicOnly) {
      filters.push(eq(documents.visibility, 'public'), sql`${documents.publishedAt} IS NOT NULL`);
    }

    const items = await this.database.db
      .select({
        id: documents.id,
        title: documents.title,
        description: documents.description,
        documentType: documents.documentType,
        fileName: documents.fileName,
        mimeType: documents.mimeType,
        sizeBytes: documents.sizeBytes,
        financialYear: documents.financialYear,
        visibility: documents.visibility,
        publishedAt: documents.publishedAt,
        // `fileUrl` is returned ONLY for public documents. A private document's
        // location is released through a signed URL by the download endpoint,
        // which checks permission at the moment of access.
        fileUrl: sql<
          string | null
        >`CASE WHEN ${documents.visibility} = 'public' THEN ${documents.fileUrl} ELSE NULL END`,
      })
      .from(documents)
      .where(and(...filters))
      .orderBy(desc(documents.publishedAt));

    return { items };
  }
}
