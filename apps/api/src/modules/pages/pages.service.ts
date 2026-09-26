import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, isNull, or, sql, type SQL } from 'drizzle-orm';

import { pageRevisions, pages, type DatabaseClient } from '@sailent/database';
import type { AuthenticatedActor } from '@sailent/types';
import { pageSectionsSchema, type PageSection } from '@sailent/validation';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { AppConfig } from '../../config/app.config.js';
import type { AuditContext } from '../catalog/programs.service.js';
import { ValidationException } from '../../common/exceptions.js';
import { offsetFor, paginate, resolveSort } from '../../common/dto/pagination.dto.js';
import type {
  CreatePageInput,
  PageListQuery,
  PageStatusInput,
  RevertPageInput,
  UpdatePageInput,
} from './dto/pages.dto.js';

/**
 * Section-composed pages.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THREE THINGS THIS FILE IS CAREFUL ABOUT.
 *
 * 1. WHAT THE PUBLIC MAY SEE. `publishedFilter()` is the only expression that
 *    decides it, and it takes no argument that can widen it: published, not
 *    deleted, and not scheduled for later. Every public read uses it.
 *
 * 2. SCHEDULING WITHOUT A SCHEDULER. A page published with a future
 *    `scheduled_at` is invisible until that moment, because the comparison
 *    happens in SQL on each read. Nothing has to run on time, and the row and
 *    the site can never disagree.
 *
 * 3. EVERY SAVE LEAVES A SNAPSHOT. `page_revisions` is what answers "who
 *    changed the homepage, and to what" — and it is what revert reads. The
 *    snapshot is taken of the state BEING SAVED, in the same transaction, so a
 *    revision can never describe a page that never existed.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class PagesService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
  ) {}

  private get db() {
    return this.database.db;
  }

  /**
   * Live to the public: published, not deleted, and not scheduled for later.
   *
   * Deliberately a private expression with no parameters. A flag here — even
   * one defaulting safely — is how an unpublished homepage eventually reaches
   * the internet.
   */
  private publishedFilter(extra: SQL[] = []): SQL {
    return and(
      eq(pages.status, 'published'),
      isNull(pages.deletedAt),
      or(isNull(pages.scheduledAt), sql`${pages.scheduledAt} <= now()`)!,
      ...extra,
    )!;
  }

  // -------------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------------

  async list(query: PageListQuery) {
    const filters: SQL[] = [isNull(pages.deletedAt)];
    if (query.status !== 'all') filters.push(eq(pages.status, query.status));

    const where = and(...filters);
    const { column } = resolveSort(
      query.sort,
      { updatedAt: pages.updatedAt, slug: pages.slug },
      'updatedAt',
    );

    const [items, [count]] = await Promise.all([
      this.db
        .select({
          id: pages.id,
          slug: pages.slug,
          title: pages.title,
          status: pages.status,
          sectionCount: sql<number>`jsonb_array_length(${pages.sections})::int`,
          version: pages.version,
          publishedAt: pages.publishedAt,
          scheduledAt: pages.scheduledAt,
          updatedAt: pages.updatedAt,
        })
        .from(pages)
        .where(where)
        .orderBy(desc(column))
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(pages)
        .where(where),
    ]);

    return paginate(items, query.page, query.limit, count?.value ?? 0);
  }

  async getById(id: string) {
    const [row] = await this.db
      .select()
      .from(pages)
      .where(and(eq(pages.id, id), isNull(pages.deletedAt)))
      .limit(1);

    if (!row) throw new NotFoundException('That page does not exist.');

    const revisions = await this.db
      .select({
        version: pageRevisions.version,
        note: pageRevisions.note,
        createdAt: pageRevisions.createdAt,
      })
      .from(pageRevisions)
      .where(eq(pageRevisions.pageId, id))
      .orderBy(desc(pageRevisions.version))
      .limit(20);

    return { ...row, revisions, isLive: this.isLive(row) };
  }

  /** Whether this row would be served publicly right now. */
  private isLive(row: { status: string; scheduledAt: Date | null; deletedAt: Date | null }) {
    if (row.status !== 'published' || row.deletedAt) return false;
    return !row.scheduledAt || row.scheduledAt.getTime() <= Date.now();
  }

  async create(input: CreatePageInput, actor: AuthenticatedActor, context: AuditContext) {
    const [existing] = await this.db
      .select({ id: pages.id })
      .from(pages)
      .where(eq(pages.slug, input.slug))
      .limit(1);

    if (existing) {
      throw new ConflictException(`A page for "${input.slug}" already exists.`);
    }

    const sections = input.sections ?? [];

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(pages)
        .values({
          slug: input.slug,
          title: input.title,
          sections,
          metaTitle: input.metaTitle ?? null,
          metaDescription: input.metaDescription ?? null,
          // Always a draft. Publishing the homepage is a separate decision
          // with its own permission and its own re-authentication.
          status: 'draft',
          version: 1,
          updatedBy: actor.id,
        })
        .returning({ id: pages.id });

      if (!row) throw new ConflictException('Could not create the page.');

      await tx.insert(pageRevisions).values({
        pageId: row.id,
        version: 1,
        title: input.title,
        sections,
        metaTitle: input.metaTitle ?? null,
        metaDescription: input.metaDescription ?? null,
        note: input.note ?? 'Created',
        createdBy: actor.id,
      });

      return row;
    });

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: 'page.create',
      entityType: 'page',
      entityId: created.id,
      newValues: { slug: input.slug, title: input.title, sections: sections.length },
      ...context,
    });

    return this.getById(created.id);
  }

  async update(
    id: string,
    input: UpdatePageInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const existing = await this.getById(id);

    const sections = input.sections ?? (existing.sections as PageSection[]);
    const title = input.title ?? existing.title;
    const metaTitle = 'metaTitle' in input ? (input.metaTitle ?? null) : existing.metaTitle;
    const metaDescription =
      'metaDescription' in input ? (input.metaDescription ?? null) : existing.metaDescription;

    const version = existing.version + 1;

    /*
      THE SAVE AND ITS SNAPSHOT ARE ONE TRANSACTION.

      A revision written outside the update could describe a page state that
      was never stored — which makes revert a way to restore something that
      never existed. Together they cannot disagree.
    */
    await this.db.transaction(async (tx) => {
      await tx
        .update(pages)
        .set({
          title,
          sections,
          metaTitle,
          metaDescription,
          version,
          updatedBy: actor.id,
          updatedAt: new Date(),
        })
        .where(eq(pages.id, id));

      await tx.insert(pageRevisions).values({
        pageId: id,
        version,
        title,
        sections,
        metaTitle,
        metaDescription,
        note: input.note ?? null,
        createdBy: actor.id,
      });
    });

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: 'page.update',
      entityType: 'page',
      entityId: id,
      // The shape of the change, not a second copy of the page.
      oldValues: { version: existing.version, sections: (existing.sections as unknown[]).length },
      newValues: { version, sections: sections.length, title },
      reason: input.note ?? undefined,
      ...context,
    });

    return this.getById(id);
  }

  async setStatus(
    id: string,
    input: PageStatusInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const existing = await this.getById(id);

    if (input.status === 'archived' && !actor.permissions.includes('page.archive')) {
      throw new ForbiddenException('Archiving a page requires page.archive.');
    }

    if (existing.status === input.status && !input.scheduledAt) {
      throw new ConflictException(`This page is already ${input.status}.`);
    }

    if (input.status === 'published' && (existing.sections as unknown[]).length === 0) {
      throw new ValidationException(
        [
          {
            field: 'sections',
            code: 'SECTIONS_REQUIRED',
            message: 'A page needs at least one section before it can be published.',
          },
        ],
        'This page is not ready to publish.',
      );
    }

    await this.db
      .update(pages)
      .set({
        status: input.status,
        /*
          Stamped on FIRST publication and never moved — the date the page went
          live is what a reader and any citation rely on. A later schedule
          changes when it is VISIBLE, not when it was first published.
        */
        publishedAt:
          input.status === 'published'
            ? (existing.publishedAt ?? new Date())
            : existing.publishedAt,
        scheduledAt: input.status === 'published' ? (input.scheduledAt ?? null) : null,
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(pages.id, id));

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: `page.${input.status}`,
      entityType: 'page',
      entityId: id,
      oldValues: { status: existing.status, scheduledAt: existing.scheduledAt },
      newValues: { status: input.status, scheduledAt: input.scheduledAt ?? null },
      reason: input.reason,
      // Both directions change the most-read surface the organisation has.
      severity: input.status === 'draft' ? 'info' : 'warning',
      ...context,
    });

    return this.getById(id);
  }

  /**
   * Restore an earlier snapshot.
   *
   * A revert is a NEW SAVE of old content, not a rewind: it takes the next
   * version number and leaves its own revision. The history of the homepage
   * stays append-only, so "we went back to version 4 on Tuesday" is itself
   * recorded rather than erasing what happened in between.
   */
  async revert(
    id: string,
    input: RevertPageInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const existing = await this.getById(id);

    const [snapshot] = await this.db
      .select()
      .from(pageRevisions)
      .where(and(eq(pageRevisions.pageId, id), eq(pageRevisions.version, input.version)))
      .limit(1);

    if (!snapshot) throw new NotFoundException(`This page has no version ${input.version}.`);

    /*
      Re-validated on the way back in. A snapshot was valid when it was taken,
      and a section type can be retired between then and now — restoring one
      the site can no longer render would put a broken page live.
    */
    const parsed = pageSectionsSchema.safeParse(snapshot.sections);
    if (!parsed.success) {
      throw new ValidationException(
        [
          {
            field: 'version',
            code: 'SECTION_RETIRED',
            message:
              `Version ${input.version} uses a section this site no longer has. ` +
              'Rebuild the page from the sections available now.',
          },
        ],
        'That version cannot be restored.',
      );
    }

    const version = existing.version + 1;

    await this.db.transaction(async (tx) => {
      await tx
        .update(pages)
        .set({
          title: snapshot.title,
          sections: parsed.data,
          metaTitle: snapshot.metaTitle,
          metaDescription: snapshot.metaDescription,
          version,
          updatedBy: actor.id,
          updatedAt: new Date(),
        })
        .where(eq(pages.id, id));

      await tx.insert(pageRevisions).values({
        pageId: id,
        version,
        title: snapshot.title,
        sections: parsed.data,
        metaTitle: snapshot.metaTitle,
        metaDescription: snapshot.metaDescription,
        note: `Reverted to version ${input.version}`,
        createdBy: actor.id,
      });
    });

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: 'page.revert',
      entityType: 'page',
      entityId: id,
      oldValues: { version: existing.version },
      newValues: { version, restoredFrom: input.version },
      reason: input.reason,
      severity: 'warning',
      ...context,
    });

    return this.getById(id);
  }

  // -------------------------------------------------------------------------
  // Preview
  // -------------------------------------------------------------------------

  /**
   * A signed link that shows one unpublished page, for a short while.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * docs/product-requirements.md §4.17 asks for "preview unpublished content
   * via a signed link". Signed rather than secret-by-obscurity: the token
   * carries the page id and an expiry and is HMAC'd, so it cannot be edited to
   * point at a different page or to last longer.
   *
   * It grants ONE page for THIRTY MINUTES and nothing else — not a session,
   * not an API token. A link forwarded to a colleague works; the same link
   * next week does not.
   * ══════════════════════════════════════════════════════════════════════════
   */
  private static readonly PREVIEW_TTL_MS = 30 * 60 * 1000;

  /**
   * The signing key, with the same development fallback `token.service.ts` uses.
   *
   * `JWT_ACCESS_SECRET` is optional in development and REQUIRED in production —
   * the config refuses to boot without it there — so the fallback can only ever
   * be reached on a developer's machine. Mirroring the existing convention
   * rather than inventing a second one, and rather than making preview the one
   * feature that cannot be used locally.
   */
  private previewSecret(): string {
    return this.config.env.JWT_ACCESS_SECRET ?? 'development-only-access-secret-change-me-32';
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.previewSecret()).update(payload).digest('base64url');
  }

  createPreviewToken(id: string): { token: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + PagesService.PREVIEW_TTL_MS);
    const payload = `${id}.${expiresAt.getTime()}`;
    return { token: `${payload}.${this.sign(payload)}`, expiresAt };
  }

  /**
   * The page a preview token names, whatever its status.
   *
   * Returns null for anything that does not verify — a bad signature, a
   * tampered id, an expired link and a missing page are all the same answer,
   * because distinguishing them tells an attacker which guesses were close.
   */
  async resolvePreview(token: string) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [id, expiry, signature] = parts as [string, string, string];
    const expected = this.sign(`${id}.${expiry}`);

    // Constant-time, so the comparison cannot be used to discover a signature
    // one byte at a time.
    const given = Buffer.from(signature);
    const want = Buffer.from(expected);
    if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

    if (!Number.isFinite(Number(expiry)) || Number(expiry) < Date.now()) return null;

    const [row] = await this.db
      .select()
      .from(pages)
      .where(and(eq(pages.id, id), isNull(pages.deletedAt)))
      .limit(1);

    return row ? this.toPublic(row) : null;
  }

  // -------------------------------------------------------------------------
  // Public
  // -------------------------------------------------------------------------

  /** Exactly what a visitor may see. No ids, no schedule, no editor trail. */
  private toPublic(row: typeof pages.$inferSelect) {
    return {
      slug: row.slug,
      title: row.title,
      sections: row.sections as PageSection[],
      metaTitle: row.metaTitle,
      metaDescription: row.metaDescription,
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
    };
  }

  /** One published page, or null. Scheduling is enforced here. */
  async getPublished(slug: string) {
    const [row] = await this.db
      .select()
      .from(pages)
      .where(this.publishedFilter([eq(pages.slug, slug)]))
      .limit(1);

    return row ? this.toPublic(row) : null;
  }
}
