import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm';

import {
  blogPostTags,
  blogPosts,
  blogTags,
  categories,
  media,
  users,
  type DatabaseClient,
} from '@sailent/database';
import type { AuthenticatedActor } from '@sailent/types';
import { slugify } from '@sailent/validation';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { SlugService } from '../catalog/slug.service.js';
import type { AuditContext } from '../catalog/programs.service.js';
import { ValidationException } from '../../common/exceptions.js';
import { offsetFor, paginate, resolveSort } from '../../common/dto/pagination.dto.js';
import type {
  BlogListQuery,
  BlogStatusInput,
  CreateBlogPostInput,
  PublicBlogQuery,
  UpdateBlogPostInput,
} from './dto/blog.dto.js';

/**
 * Blog posts.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO READ PATHS, AND THEY ARE NOT THE SAME CODE.
 *
 * Everything an administrator sees comes from `list`/`getById`, which return
 * drafts. Everything the public sees comes from `listPublished`/`getPublished`,
 * which filter on `status = 'published'` in SQL and select an explicit, much
 * smaller column list.
 *
 * They are deliberately separate rather than one function with a flag. A flag
 * defaulting the wrong way, or a caller forgetting to pass it, publishes
 * drafts — and the failure is silent, because a draft renders perfectly well.
 * Two functions cannot be confused by omission.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class BlogService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly slugs: SlugService,
    private readonly audit: AuditService,
  ) {}

  private get db() {
    return this.database.db;
  }

  /**
   * The author, as the public may see them.
   *
   * A NAME AND NOTHING ELSE. Not the id, not the email, not the avatar, not
   * the role. `users` holds the password hash and the TOTP secret, so
   * `select()` on a join to it is one careless line away from serialising
   * both — which is why every author read in this file names its columns.
   */
  private authorName() {
    return sql<
      string | null
    >`nullif(btrim(concat(${users.firstName}, ' ', coalesce(${users.lastName}, ''))), '')`;
  }

  // -------------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------------

  async list(query: BlogListQuery) {
    const filters: SQL[] = [isNull(blogPosts.deletedAt)];

    if (query.status !== 'all') filters.push(eq(blogPosts.status, query.status));
    if (query.categoryId) filters.push(eq(blogPosts.categoryId, query.categoryId));

    if (query.q) {
      const term = `%${query.q}%`;
      /*
        Title and excerpt. NOT the body: an article is thousands of words, and
        an unanchored `ILIKE` across all of them is a sequential scan of the
        table on every keystroke of the admin search box.
      */
      const search = or(ilike(blogPosts.title, term), ilike(blogPosts.excerpt, term));
      if (search) filters.push(search);
    }

    const where = and(...filters);
    const sortable = {
      createdAt: blogPosts.createdAt,
      updatedAt: blogPosts.updatedAt,
      publishedAt: blogPosts.publishedAt,
      title: blogPosts.title,
    };
    const { column } = resolveSort(query.sort, sortable, 'updatedAt');

    const [items, [count]] = await Promise.all([
      this.db
        .select({
          id: blogPosts.id,
          title: blogPosts.title,
          slug: blogPosts.slug,
          status: blogPosts.status,
          excerpt: blogPosts.excerpt,
          categoryId: blogPosts.categoryId,
          categoryName: categories.name,
          authorName: this.authorName(),
          featuredImageUrl: media.url,
          featuredImageAlt: media.altText,
          publishedAt: blogPosts.publishedAt,
          updatedAt: blogPosts.updatedAt,
        })
        .from(blogPosts)
        .leftJoin(categories, eq(categories.id, blogPosts.categoryId))
        .leftJoin(users, eq(users.id, blogPosts.authorId))
        .leftJoin(media, eq(media.id, blogPosts.featuredMediaId))
        .where(where)
        .orderBy(desc(column))
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(blogPosts)
        .where(where),
    ]);

    return paginate(items, query.page, query.limit, count?.value ?? 0);
  }

  async getById(id: string) {
    const [row] = await this.db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        excerpt: blogPosts.excerpt,
        content: blogPosts.content,
        status: blogPosts.status,
        featuredMediaId: blogPosts.featuredMediaId,
        featuredImageUrl: media.url,
        featuredImageAlt: media.altText,
        categoryId: blogPosts.categoryId,
        categoryName: categories.name,
        authorName: this.authorName(),
        metaTitle: blogPosts.metaTitle,
        metaDescription: blogPosts.metaDescription,
        canonicalUrl: blogPosts.canonicalUrl,
        publishedAt: blogPosts.publishedAt,
        createdAt: blogPosts.createdAt,
        updatedAt: blogPosts.updatedAt,
      })
      .from(blogPosts)
      .leftJoin(categories, eq(categories.id, blogPosts.categoryId))
      .leftJoin(users, eq(users.id, blogPosts.authorId))
      .leftJoin(media, eq(media.id, blogPosts.featuredMediaId))
      .where(and(eq(blogPosts.id, id), isNull(blogPosts.deletedAt)))
      .limit(1);

    if (!row) throw new NotFoundException('That post does not exist.');

    return { ...row, tags: await this.tagsFor(row.id), publishBlockers: this.publishBlockers(row) };
  }

  /**
   * Why this post cannot be published, computed before anybody tries.
   *
   * The same checks the publish call makes, offered to the editor while they
   * are still writing — a publish button that refuses without having said what
   * was missing is the thing this avoids.
   */
  private publishBlockers(post: { title: string; excerpt: string | null; content: string | null }) {
    const blockers: { field: string; code: string; message: string }[] = [];

    /*
      EMPTY, not "short".

      This read `length < 50`, an arbitrary minimum invented with this module
      and stated nowhere — not in the message, the hint, the API docs or the
      phase document. An editor who wrote

          ## Heading
          hey this is sailent foundation

      (41 characters) was told "An article needs a body before it can be
      published" while looking straight at the body they had just written, with
      the publish button disabled and nothing naming the real rule. The text
      was saved correctly the whole time; only the gate and its explanation
      disagreed with each other.

      HOW LONG AN ARTICLE SHOULD BE IS AN EDITORIAL JUDGEMENT, not a system
      invariant, and a short post — "the office is closed on Monday" — is a
      legitimate thing for an NGO to publish. The invariant worth enforcing is
      the one the message already claimed: do not publish an article with no
      body. So the check now matches the sentence beside it.
    */
    if (!post.content || post.content.trim().length === 0) {
      blockers.push({
        field: 'content',
        code: 'CONTENT_REQUIRED',
        message: 'An article needs a body before it can be published.',
      });
    }
    if (!post.excerpt || post.excerpt.trim().length === 0) {
      blockers.push({
        field: 'excerpt',
        code: 'EXCERPT_REQUIRED',
        /*
          Not pedantry: the excerpt is the meta description and the listing
          card. Without it the search result for this article is a truncated
          sentence chosen by a crawler.
        */
        message: 'A summary is required — it is what search results and the listing show.',
      });
    }

    return blockers;
  }

  async create(input: CreateBlogPostInput, actor: AuthenticatedActor, context: AuditContext) {
    await this.assertReferencesExist(input);

    const slug = await this.slugs.allocate('blog', { title: input.title, slug: input.slug });

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(blogPosts)
        .values({
          ...this.writableFields(input),
          title: input.title,
          slug,
          // Always a draft. Publishing is a separate decision with its own
          // permission, its own gate and its own audit row.
          status: 'draft',
          authorId: actor.id,
        })
        .returning({ id: blogPosts.id });

      if (!row) throw new ConflictException('Could not create the post.');
      if (input.tags) await this.syncTags(tx, row.id, input.tags);
      return row;
    });

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: 'blog.create',
      entityType: 'blog',
      entityId: created.id,
      // The title and slug, not the article. An audit log is not a second copy
      // of the content.
      newValues: { title: input.title, slug, status: 'draft' },
      ...context,
    });

    return this.getById(created.id);
  }

  async update(
    id: string,
    input: UpdateBlogPostInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const existing = await this.getById(id);
    await this.assertReferencesExist(input);

    /*
      A PUBLISHED post must not be edited into a state it could not have been
      published in — emptying the body of a live article, for instance. The
      status column does not change, so nothing else would notice.
    */
    if (existing.status === 'published') {
      const blockers = this.publishBlockers({
        title: input.title ?? existing.title,
        excerpt: 'excerpt' in input ? (input.excerpt ?? null) : existing.excerpt,
        content: 'content' in input ? (input.content ?? null) : existing.content,
      });
      if (blockers.length > 0) {
        throw new ValidationException(blockers, 'A published post cannot be left incomplete.');
      }
    }

    /*
      SLUG CHANGES GO THROUGH THE SLUG SERVICE, which records the old one in
      `slug_history` so the retired URL 301s to the new one. Writing the column
      directly is what silently breaks every existing link to the article.
    */
    let slug = existing.slug;
    if (input.slug && input.slug !== existing.slug) {
      slug = await this.slugs.allocate('blog', {
        title: input.title ?? existing.title,
        slug: input.slug,
        exceptId: id,
      });
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(blogPosts)
        .set({
          ...this.writableFields(input),
          ...(input.title ? { title: input.title } : {}),
          slug,
          updatedAt: new Date(),
        })
        .where(eq(blogPosts.id, id));

      if (slug !== existing.slug) {
        await this.slugs.retire('blog', id, existing.slug, actor.id, tx);
      }
      if (input.tags) await this.syncTags(tx, id, input.tags);
    });

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: 'blog.update',
      entityType: 'blog',
      entityId: id,
      oldValues: { title: existing.title, slug: existing.slug },
      newValues: { title: input.title ?? existing.title, slug },
      ...context,
    });

    return this.getById(id);
  }

  async setStatus(
    id: string,
    input: BlogStatusInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const existing = await this.getById(id);

    if (existing.status === input.status) {
      throw new ConflictException(`This post is already ${input.status}.`);
    }

    /*
      ARCHIVING NEEDS ITS OWN PERMISSION, checked here rather than on the route.

      All three transitions share one endpoint, and `@RequirePermission` is an
      AND over its arguments — listing both on the route would demand archive
      rights merely to unpublish. The route carries `blog.publish` as the floor,
      and this narrows it for the one transition that takes a live article down.

      (Stories do the same with `story.archive` since Phase 13.)
    */
    if (input.status === 'archived' && !actor.permissions.includes('blog.archive')) {
      throw new ForbiddenException('Archiving a post requires blog.archive.');
    }

    if (input.status === 'published' && existing.publishBlockers.length > 0) {
      throw new ValidationException(existing.publishBlockers, 'This post is not ready to publish.');
    }

    await this.db
      .update(blogPosts)
      .set({
        status: input.status,
        /*
          Stamped on FIRST publication and never moved. Unpublishing to fix a
          typo and republishing must not restate the date the article appeared:
          that date is what a reader, a citation and the sitemap rely on.
        */
        publishedAt:
          input.status === 'published'
            ? (existing.publishedAt ?? new Date())
            : existing.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(blogPosts.id, id));

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: `blog.${input.status}`,
      entityType: 'blog',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: input.status },
      reason: input.reason,
      // Both directions change what the public can read.
      severity: input.status === 'published' || input.status === 'archived' ? 'warning' : 'info',
      ...context,
    });

    return this.getById(id);
  }

  // -------------------------------------------------------------------------
  // Public
  // -------------------------------------------------------------------------

  /** The columns the public may see. Named once, used by every public read. */
  private get publicColumns() {
    return {
      title: blogPosts.title,
      slug: blogPosts.slug,
      excerpt: blogPosts.excerpt,
      categoryName: categories.name,
      categorySlug: categories.slug,
      authorName: this.authorName(),
      featuredImageUrl: media.url,
      featuredImageAlt: media.altText,
      publishedAt: blogPosts.publishedAt,
      updatedAt: blogPosts.updatedAt,
    };
  }

  /**
   * Published posts only.
   *
   * `status = 'published'` is not optional here and not a parameter. There is
   * no argument this function takes that can widen what it returns.
   */
  private publishedOnly(extra: SQL[] = []) {
    return and(eq(blogPosts.status, 'published'), isNull(blogPosts.deletedAt), ...extra);
  }

  async listPublished(query: PublicBlogQuery) {
    const filters: SQL[] = [];

    if (query.category) filters.push(eq(categories.slug, query.category));
    if (query.q) {
      const term = `%${query.q}%`;
      // Title, excerpt and body — a reader searching the blog means it.
      const search = or(
        ilike(blogPosts.title, term),
        ilike(blogPosts.excerpt, term),
        ilike(blogPosts.content, term),
      );
      if (search) filters.push(search);
    }
    if (query.tag) {
      filters.push(
        sql`EXISTS (
          SELECT 1 FROM ${blogPostTags}
            JOIN ${blogTags} ON ${blogTags.id} = ${blogPostTags.tagId}
           WHERE ${blogPostTags.postId} = ${blogPosts.id} AND ${blogTags.slug} = ${query.tag}
        )`,
      );
    }

    const where = this.publishedOnly(filters);

    const [items, [count]] = await Promise.all([
      this.db
        .select(this.publicColumns)
        .from(blogPosts)
        .leftJoin(categories, eq(categories.id, blogPosts.categoryId))
        .leftJoin(users, eq(users.id, blogPosts.authorId))
        .leftJoin(media, eq(media.id, blogPosts.featuredMediaId))
        .where(where)
        .orderBy(desc(blogPosts.publishedAt))
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(blogPosts)
        .leftJoin(categories, eq(categories.id, blogPosts.categoryId))
        .where(where),
    ]);

    return paginate(items, query.page, query.limit, count?.value ?? 0);
  }

  async getPublished(slug: string) {
    const [row] = await this.db
      .select({
        id: blogPosts.id,
        ...this.publicColumns,
        content: blogPosts.content,
        categoryId: blogPosts.categoryId,
        metaTitle: blogPosts.metaTitle,
        metaDescription: blogPosts.metaDescription,
        canonicalUrl: blogPosts.canonicalUrl,
      })
      .from(blogPosts)
      .leftJoin(categories, eq(categories.id, blogPosts.categoryId))
      .leftJoin(users, eq(users.id, blogPosts.authorId))
      .leftJoin(media, eq(media.id, blogPosts.featuredMediaId))
      .where(this.publishedOnly([eq(blogPosts.slug, slug)]))
      .limit(1);

    if (!row) {
      /*
        A retired slug 301s to the current one rather than 404ing. The id is
        stripped from the response below; it is only used to find the tags and
        the related posts.
      */
      const current = await this.slugs.resolveRedirect('blog', slug);
      if (current) return { redirectTo: current } as const;
      throw new NotFoundException('That post does not exist.');
    }

    const { id, categoryId, ...post } = row;
    return {
      ...post,
      tags: await this.tagsFor(id),
      related: await this.relatedTo(id, categoryId),
    };
  }

  /**
   * Related posts: same category first, then recent.
   *
   * Not a recommendation engine — Phase 0 does not ask for one and the corpus
   * is far too small for one to mean anything. Same category is a real signal;
   * "also recent" is an honest filler that never leaves the section empty.
   *
   * Published only, like every other public read.
   */
  private async relatedTo(id: string, categoryId: string | null) {
    const sameCategory = categoryId
      ? await this.db
          .select(this.publicColumns)
          .from(blogPosts)
          .leftJoin(categories, eq(categories.id, blogPosts.categoryId))
          .leftJoin(users, eq(users.id, blogPosts.authorId))
          .leftJoin(media, eq(media.id, blogPosts.featuredMediaId))
          .where(this.publishedOnly([eq(blogPosts.categoryId, categoryId), ne(blogPosts.id, id)]))
          .orderBy(desc(blogPosts.publishedAt))
          .limit(3)
      : [];

    if (sameCategory.length >= 3) return sameCategory;

    const seen = new Set(sameCategory.map((post) => post.slug));
    const recent = await this.db
      .select(this.publicColumns)
      .from(blogPosts)
      .leftJoin(categories, eq(categories.id, blogPosts.categoryId))
      .leftJoin(users, eq(users.id, blogPosts.authorId))
      .leftJoin(media, eq(media.id, blogPosts.featuredMediaId))
      .where(this.publishedOnly([ne(blogPosts.id, id)]))
      .orderBy(desc(blogPosts.publishedAt))
      .limit(6);

    return [...sameCategory, ...recent.filter((post) => !seen.has(post.slug))].slice(0, 3);
  }

  /** Published posts for the sitemap: slug and dates, nothing else. */
  async publishedForSitemap() {
    return this.db
      .select({
        slug: blogPosts.slug,
        publishedAt: blogPosts.publishedAt,
        updatedAt: blogPosts.updatedAt,
      })
      .from(blogPosts)
      .where(this.publishedOnly())
      .orderBy(desc(blogPosts.publishedAt));
  }

  /** Categories that actually carry a published post — no empty filter chips. */
  async publicCategories() {
    return this.db
      .selectDistinct({ name: categories.name, slug: categories.slug })
      .from(blogPosts)
      .innerJoin(categories, eq(categories.id, blogPosts.categoryId))
      .where(this.publishedOnly())
      .orderBy(categories.name);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async tagsFor(postId: string) {
    return this.db
      .select({ name: blogTags.name, slug: blogTags.slug })
      .from(blogPostTags)
      .innerJoin(blogTags, eq(blogTags.id, blogPostTags.tagId))
      .where(eq(blogPostTags.postId, postId))
      .orderBy(blogTags.name);
  }

  /**
   * Replace a post's tags, creating any that are new.
   *
   * Tags are matched on the NORMALISED slug, so "Field Notes", "field notes"
   * and "Field-Notes" all resolve to the one existing row instead of creating
   * three that render identically.
   */
  private async syncTags(tx: DatabaseClient['db'], postId: string, names: string[]) {
    const wanted = new Map<string, string>();
    for (const name of names) {
      const slug = slugify(name);
      // An empty slug means the name was punctuation only. Dropped, not stored.
      if (slug) wanted.set(slug, name.trim());
    }

    await tx.delete(blogPostTags).where(eq(blogPostTags.postId, postId));
    if (wanted.size === 0) return;

    const slugs = [...wanted.keys()];
    const existing = await tx
      .select({ id: blogTags.id, slug: blogTags.slug })
      .from(blogTags)
      .where(inArray(blogTags.slug, slugs));

    const byslug = new Map(existing.map((tag) => [tag.slug, tag.id]));
    const missing = slugs.filter((slug) => !byslug.has(slug));

    if (missing.length > 0) {
      const inserted = await tx
        .insert(blogTags)
        .values(missing.map((slug) => ({ slug, name: wanted.get(slug)! })))
        // Another request may have created the same tag between the select and
        // here; the unique index is the arbiter and this yields to it.
        .onConflictDoNothing()
        .returning({ id: blogTags.id, slug: blogTags.slug });

      for (const tag of inserted) byslug.set(tag.slug, tag.id);

      const stillMissing = missing.filter((slug) => !byslug.has(slug));
      if (stillMissing.length > 0) {
        const raced = await tx
          .select({ id: blogTags.id, slug: blogTags.slug })
          .from(blogTags)
          .where(inArray(blogTags.slug, stillMissing));
        for (const tag of raced) byslug.set(tag.slug, tag.id);
      }
    }

    await tx
      .insert(blogPostTags)
      .values(slugs.map((slug) => ({ postId, tagId: byslug.get(slug)! })))
      .onConflictDoNothing();
  }

  /**
   * Both reference columns are `ON DELETE SET NULL`, so a bad id would surface
   * as a 500 naming a foreign key. This turns it into a field error.
   */
  private async assertReferencesExist(input: Partial<CreateBlogPostInput>) {
    const problems: { field: string; code: string; message: string }[] = [];

    if (input.featuredMediaId) {
      const [row] = await this.db
        .select({ id: media.id, visibility: media.visibility })
        .from(media)
        .where(eq(media.id, input.featuredMediaId))
        .limit(1);

      if (!row) {
        problems.push({
          field: 'featuredMediaId',
          code: 'NOT_FOUND',
          message: 'That image is not in the media library.',
        });
      } else if (row.visibility !== 'public') {
        /*
          A private image has no public URL by database constraint, so it would
          render as a broken image for every visitor. Refused here rather than
          discovered by a reader.
        */
        problems.push({
          field: 'featuredMediaId',
          code: 'NOT_PUBLIC',
          message: 'That image is private. Make it public before using it on an article.',
        });
      }
    }

    if (input.categoryId) {
      const [row] = await this.db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.id, input.categoryId))
        .limit(1);
      if (!row) {
        problems.push({
          field: 'categoryId',
          code: 'NOT_FOUND',
          message: 'That category does not exist.',
        });
      }
    }

    if (problems.length > 0) throw new ValidationException(problems);
  }

  /** Everything an editor may write. `status`, `slug` and `authorId` are not here. */
  private writableFields(input: Partial<CreateBlogPostInput>) {
    const fields: Record<string, unknown> = {};
    for (const key of [
      'excerpt',
      'content',
      'featuredMediaId',
      'categoryId',
      'metaTitle',
      'metaDescription',
      'canonicalUrl',
    ] as const) {
      if (key in input) fields[key] = input[key] ?? null;
    }
    return fields;
  }
}
