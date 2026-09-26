import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';

import { campaigns, programs, successStories, type DatabaseClient } from '@sailent/database';
import type { AuthenticatedActor } from '@sailent/types';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { SlugService } from '../catalog/slug.service.js';
import type { AuditContext } from '../catalog/programs.service.js';
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions.js';
import { offsetFor, paginate, resolveSort } from '../../common/dto/pagination.dto.js';
import type {
  CreateStoryInput,
  StoryListQuery,
  StoryStatusInput,
  UpdateStoryInput,
} from './dto/stories.dto.js';

/**
 * Success stories, from the administrator's side.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE TABLE HAS EXISTED SINCE PHASE 3 AND NOTHING COULD WRITE TO IT.
 *
 * `success_stories` carries a full narrative schema — challenge, intervention,
 * journey, outcome — a consent model, and a publish-time check constraint. The
 * public read API has been serving three seeded rows for seven phases. There
 * was no create, no update, no publish: the stories on the site were whatever
 * the seed wrote.
 *
 * This is that missing half. It invents no new lifecycle (the existing
 * `publish_status` enum is the lifecycle) and no new consent rule (the
 * existing check constraint is the rule).
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class StoriesService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly slugs: SlugService,
    private readonly audit: AuditService,
  ) {}

  private get db() {
    return this.database.db;
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async list(query: StoryListQuery) {
    const filters: SQL[] = [isNull(successStories.deletedAt)];

    if (query.status !== 'all') filters.push(eq(successStories.status, query.status));
    if (query.programId) filters.push(eq(successStories.programId, query.programId));
    if (query.campaignId) filters.push(eq(successStories.campaignId, query.campaignId));

    if (query.q) {
      const term = `%${query.q}%`;
      /*
        Title, subject and location. NOT the body: a story is thousands of
        words and a substring scan across all of them turns the admin list into
        a sequential read of the table every keystroke.
      */
      const search = or(
        ilike(successStories.title, term),
        ilike(successStories.subjectName, term),
        ilike(successStories.location, term),
      );
      if (search) filters.push(search);
    }

    const where = and(...filters);
    const sortable = {
      createdAt: successStories.createdAt,
      updatedAt: successStories.updatedAt,
      publishedAt: successStories.publishedAt,
      title: successStories.title,
    };
    const { column } = resolveSort(query.sort, sortable, 'updatedAt');

    const [items, [count]] = await Promise.all([
      this.db
        .select({
          id: successStories.id,
          title: successStories.title,
          slug: successStories.slug,
          status: successStories.status,
          category: successStories.category,
          location: successStories.location,
          subjectName: successStories.subjectName,
          isAnonymised: successStories.isAnonymised,
          consentObtained: successStories.consentObtained,
          coverImage: successStories.coverImage,
          publishedAt: successStories.publishedAt,
          updatedAt: successStories.updatedAt,
          programTitle: programs.title,
          campaignTitle: campaigns.title,
        })
        .from(successStories)
        .leftJoin(programs, eq(programs.id, successStories.programId))
        .leftJoin(campaigns, eq(campaigns.id, successStories.campaignId))
        .where(where)
        .orderBy(desc(column))
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(successStories)
        .where(where),
    ]);

    return paginate(items, query.page, query.limit, count?.value ?? 0);
  }

  async getById(id: string) {
    const [row] = await this.db
      .select()
      .from(successStories)
      .where(and(eq(successStories.id, id), isNull(successStories.deletedAt)))
      .limit(1);

    if (!row) throw new NotFoundException('Story');

    /*
      The admin view returns `consentDocumentId`, which the public one never
      does. An administrator deciding whether a story may be published needs to
      know whether a signed form is on file; that is the question this screen
      exists to answer.
    */
    return { ...row, publishBlockers: this.publishBlockers(row) };
  }

  // -------------------------------------------------------------------------
  // Consent
  // -------------------------------------------------------------------------

  /**
   * Why this story cannot be published, if it cannot.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * THE SAME RULE THE DATABASE ENFORCES, STATED IN ADVANCE.
   *
   * `success_stories_consent_before_publish` is:
   *
   *     status <> 'published' OR subject_name IS NULL
   *                           OR is_anonymised OR consent_obtained
   *
   * That constraint is the authority and is not weakened here — this runs
   * BEFORE it, so an administrator gets a sentence naming the field instead of
   * a 500 quoting a constraint name. Read the two together: if they ever
   * disagree, the database wins and the bug is in this method.
   *
   * The rule in words: a story that names somebody must either anonymise them
   * or record that they agreed. A story that names nobody identifies nobody
   * and needs neither.
   *
   * `consent_document_id` is deliberately NOT required. The constraint does not
   * demand it, the schema leaves it nullable, and consent given verbally and
   * recorded by staff is still consent — inventing a paperwork requirement the
   * project never stated would be inventing a legal rule.
   * ══════════════════════════════════════════════════════════════════════════
   */
  private publishBlockers(story: {
    title: string | null;
    excerpt: string | null;
    content: string | null;
    subjectName: string | null;
    isAnonymised: boolean;
    consentObtained: boolean;
  }): { field: string; code: string; message: string }[] {
    const blockers: { field: string; code: string; message: string }[] = [];

    if (!story.title?.trim()) {
      blockers.push({ field: 'title', code: 'required', message: 'A title is required.' });
    }

    // Something for a reader to read. A published story with neither is an
    // empty page carrying somebody's name.
    if (!story.excerpt?.trim() && !story.content?.trim()) {
      blockers.push({
        field: 'content',
        code: 'required',
        message: 'Add a summary or the story itself before publishing.',
      });
    }

    const namesSomebody = Boolean(story.subjectName?.trim());
    if (namesSomebody && !story.isAnonymised && !story.consentObtained) {
      blockers.push({
        field: 'consentObtained',
        code: 'consent_required',
        message:
          `This story names ${story.subjectName!.trim()}. Record that they agreed to appear, ` +
          'or mark the story anonymised. Publishing somebody’s account of their own life ' +
          'without either is not something this system will do.',
      });
    }

    return blockers;
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  async create(input: CreateStoryInput, actor: AuthenticatedActor, context: AuditContext) {
    await this.assertParentsExist(input);

    const slug = await this.slugs.allocate('story', { title: input.title, slug: input.slug });

    const [created] = await this.db
      .insert(successStories)
      .values({
        ...this.writableFields(input),
        title: input.title,
        slug,
        // Always a draft. There is no create-and-publish in one call: publishing
        // is a separate decision with a separate permission and its own gate.
        status: 'draft',
        authorId: actor.id,
      })
      .returning({ id: successStories.id });

    if (!created) throw new ConflictException('Could not create the story.');

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: 'story.create',
      entityType: 'story',
      entityId: created.id,
      // The title and slug, not the narrative. An audit log is not a second
      // copy of somebody's life story.
      newValues: { title: input.title, slug, status: 'draft' },
      ...context,
    });

    return this.getById(created.id);
  }

  async update(
    id: string,
    input: UpdateStoryInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const existing = await this.getById(id);
    await this.assertParentsExist(input);

    const fields = this.writableFields(input);

    /*
      A PUBLISHED story must not be edited into a state it could not have been
      published in. Without this, an editor could publish an anonymised story
      and then add a name to it — arriving at exactly what the constraint
      forbids, by a route the constraint does not watch, because it only fires
      on the status column.
    */
    if (existing.status === 'published') {
      const blockers = this.publishBlockers({
        title: input.title ?? existing.title,
        excerpt: 'excerpt' in input ? (input.excerpt ?? null) : existing.excerpt,
        content: 'content' in input ? (input.content ?? null) : existing.content,
        subjectName: 'subjectName' in input ? (input.subjectName ?? null) : existing.subjectName,
        isAnonymised: input.isAnonymised ?? existing.isAnonymised,
        consentObtained: input.consentObtained ?? existing.consentObtained,
      });

      if (blockers.length > 0) {
        throw new ValidationException(
          blockers,
          'This change would leave a published story in a state it could not be published in.',
        );
      }
    }

    /*
      A renamed slug RETIRES the old one, in the same transaction as the
      update. `slug_history` is what makes the old URL 301 instead of 404 —
      docs/seo-strategy.md: "slugs never change silently" — and a story that
      has been shared or cited is exactly the page where a dead link matters.
    */
    let slug = existing.slug;
    if (input.slug !== undefined && input.slug !== existing.slug) {
      slug = await this.slugs.allocate('story', {
        title: input.title ?? existing.title,
        slug: input.slug,
        exceptId: id,
      });
    }

    await this.db.transaction(async (tx) => {
      if (slug !== existing.slug) {
        await this.slugs.retire('story', id, existing.slug, actor.id, tx);
      }

      await tx
        .update(successStories)
        .set({ ...fields, slug, updatedAt: new Date() })
        .where(eq(successStories.id, id));
    });

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: 'story.update',
      entityType: 'story',
      entityId: id,
      oldValues: { title: existing.title, slug: existing.slug },
      newValues: { title: input.title ?? existing.title, slug },
      ...context,
    });

    return this.getById(id);
  }

  /**
   * Move a story between draft, published and archived.
   *
   * Archiving is as far as this goes. `success_stories` has `deleted_at`, but
   * nothing here sets it: a story is somebody's account of their own life and
   * the organisation holds a consent record against it. Destroying the row
   * would destroy the evidence that consent was given, which is the one thing
   * that must outlive the story itself.
   */
  async setStatus(
    id: string,
    input: StoryStatusInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const existing = await this.getById(id);

    if (existing.status === input.status) {
      throw new ConflictException(`This story is already ${input.status}.`);
    }

    if (input.status === 'published') {
      const blockers = this.publishBlockers(existing);
      if (blockers.length > 0) {
        throw new ValidationException(blockers, 'This story is not ready to publish.');
      }
    }

    await this.db
      .update(successStories)
      .set({
        status: input.status,
        /*
          Stamped on FIRST publication and never moved afterwards. Unpublishing
          to fix a typo and republishing must not silently restate the date the
          story was first told — that date is what a reader, and any citation,
          relies on.
        */
        publishedAt:
          input.status === 'published'
            ? (existing.publishedAt ?? new Date())
            : existing.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(successStories.id, id));

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: `story.${input.status}`,
      entityType: 'story',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: input.status },
      reason: input.reason,
      // Publishing names a real person on a public website.
      severity: input.status === 'published' ? 'warning' : 'info',
      ...context,
    });

    return this.getById(id);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Both parent columns are `ON DELETE SET NULL`, so a bad id would surface as
   * a 500 naming a foreign key. This turns it into a field error.
   */
  private async assertParentsExist(input: Partial<CreateStoryInput>) {
    const problems: { field: string; code: string; message: string }[] = [];

    if (input.programId) {
      const [row] = await this.db
        .select({ id: programs.id })
        .from(programs)
        .where(eq(programs.id, input.programId))
        .limit(1);
      if (!row) {
        problems.push({ field: 'programId', code: 'not_found', message: 'No such programme.' });
      }
    }

    if (input.campaignId) {
      const [row] = await this.db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.id, input.campaignId))
        .limit(1);
      if (!row) {
        problems.push({ field: 'campaignId', code: 'not_found', message: 'No such campaign.' });
      }
    }

    if (problems.length > 0) throw new ValidationException(problems);
  }

  /** The columns a caller may set. `status`, `slug` and `authorId` are not among them. */
  private writableFields(input: Partial<CreateStoryInput>) {
    const fields: Record<string, unknown> = {};
    const columns = [
      'title',
      'excerpt',
      'content',
      'challenge',
      'intervention',
      'journey',
      'outcome',
      'impact',
      'category',
      'location',
      'subjectName',
      'coverImage',
      'gallery',
      'programId',
      'campaignId',
      'consentObtained',
      'consentDocumentId',
      'isAnonymised',
      'metaTitle',
      'metaDescription',
    ] as const;

    for (const column of columns) {
      if (column in input) fields[column] = input[column] ?? null;
    }

    return fields;
  }
}
