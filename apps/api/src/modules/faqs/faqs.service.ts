import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { faqs, type DatabaseClient } from '@sailent/database';
import { FAQ_CATEGORIES, type FaqCategoryId } from '@sailent/validation';
import type { AuthenticatedActor } from '@sailent/types';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditContext } from '../catalog/programs.service.js';
import { NotFoundException } from '../../common/exceptions.js';

export interface FaqWriteInput {
  question: string;
  answer: string;
  category: FaqCategoryId;
  displayOrder?: number;
  isPublished?: boolean;
}

/** Only general FAQs: campaign FAQs belong to their campaign (`/admin/campaigns/:id/faqs`). */
const GENERAL = and(eq(faqs.contextType, 'general'), isNull(faqs.contextId));

/**
 * General FAQs — the `/faq` page (Phase 13).
 *
 * The `faqs` table has held these since Phase 4; the page read fixtures
 * instead. Staff now write them here, and the public endpoint returns
 * published ones only — a draft is filtered in the query, never after it.
 */
@Injectable()
export class FaqsService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly audit: AuditService,
  ) {}

  /** Published general FAQs, grouped in the page's category order. */
  async listPublic() {
    const rows = await this.database.db
      .select({
        id: faqs.id,
        question: faqs.question,
        answer: faqs.answer,
        category: faqs.category,
      })
      .from(faqs)
      .where(and(GENERAL, eq(faqs.isPublished, true)))
      .orderBy(asc(faqs.displayOrder), asc(faqs.createdAt));

    return FAQ_CATEGORIES.map((category) => ({
      ...category,
      items: rows
        .filter((row) => (row.category ?? 'general') === category.id)
        .map(({ category: _category, ...item }) => item),
    })).filter((group) => group.items.length > 0);
  }

  async listAdmin() {
    return this.database.db
      .select()
      .from(faqs)
      .where(GENERAL)
      .orderBy(asc(faqs.category), asc(faqs.displayOrder), asc(faqs.createdAt));
  }

  async get(id: string) {
    const [row] = await this.database.db
      .select()
      .from(faqs)
      .where(and(GENERAL, eq(faqs.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException('FAQ');
    return row;
  }

  async create(input: FaqWriteInput, actor: AuthenticatedActor, context: AuditContext) {
    const [row] = await this.database.db
      .insert(faqs)
      .values({
        question: input.question,
        answer: input.answer,
        category: input.category,
        contextType: 'general',
        contextId: null,
        displayOrder: input.displayOrder ?? 100,
        isPublished: input.isPublished ?? false,
      })
      .returning();
    await this.audit.record({
      action: 'faq.create',
      entityType: 'faq',
      entityId: row!.id,
      userId: actor.id,
      newValues: { category: input.category, isPublished: row!.isPublished },
      ...context,
    });
    return row!;
  }

  async update(
    id: string,
    input: Partial<FaqWriteInput>,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.get(id);
    const [row] = await this.database.db
      .update(faqs)
      .set({ ...input, updatedAt: new Date() })
      .where(and(GENERAL, eq(faqs.id, id)))
      .returning();
    await this.audit.record({
      action:
        input.isPublished !== undefined && input.isPublished !== before.isPublished
          ? input.isPublished
            ? 'faq.publish'
            : 'faq.unpublish'
          : 'faq.update',
      entityType: 'faq',
      entityId: id,
      userId: actor.id,
      oldValues: { isPublished: before.isPublished, category: before.category },
      newValues: { isPublished: row!.isPublished, category: row!.category },
      ...context,
    });
    return row!;
  }

  async remove(id: string, actor: AuthenticatedActor, context: AuditContext) {
    const before = await this.get(id);
    await this.database.db.delete(faqs).where(and(GENERAL, eq(faqs.id, id)));
    await this.audit.record({
      action: 'faq.delete',
      entityType: 'faq',
      entityId: id,
      userId: actor.id,
      oldValues: { question: before.question, category: before.category },
      ...context,
    });
    return { deleted: true as const };
  }
}
