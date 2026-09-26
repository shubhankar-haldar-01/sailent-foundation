import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';

import { categories, type DatabaseClient } from '@sailent/database';

import { DATABASE } from '../database/database.module.js';
import { NotFoundException, ValidationException } from '../../common/exceptions.js';

/**
 * The category catalogue.
 *
 * A lookup table, not an enum (docs/database-architecture.md §1): an operator
 * adds a category without a deployment. `key` is the stable identifier code
 * refers to; `name` is what they edit, so renaming a category breaks nothing.
 */
@Injectable()
export class CategoriesService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  /**
   * Categories available for a kind of record.
   *
   * `activeOnly` is the default: a deactivated category must not be offered on
   * a new record, but records already using it keep rendering — which is why
   * it is deactivated rather than deleted.
   */
  async list(options: { kind?: 'program' | 'campaign'; activeOnly?: boolean } = {}) {
    const filters = [];

    if (options.kind) {
      filters.push(or(eq(categories.kind, options.kind), eq(categories.kind, 'both')));
    }
    if (options.activeOnly !== false) {
      filters.push(eq(categories.isActive, true));
    }

    const rows = await this.database.db
      .select({
        id: categories.id,
        key: categories.key,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
        icon: categories.icon,
        kind: categories.kind,
        displayOrder: categories.displayOrder,
        isActive: categories.isActive,
        /**
         * Counts of PUBLIC records only. A category listing on the public site
         * that advertises "Healthcare (7)" when six of those are drafts sends
         * people to a page with one thing on it.
         */
        /**
         * Written as RAW SQL with an explicit alias, deliberately.
         *
         * Interpolating drizzle column references into a `sql` template
         * renders them UNQUALIFIED — `WHERE "category_id" = "id"` — and
         * inside the subquery both names resolve to the inner table, which
         * has an `id` of its own. The correlation silently becomes
         * `programs.category_id = programs.id`: always false, always zero,
         * and no error anywhere. An alias plus qualified names removes the
         * ambiguity entirely.
         */
        programCount: sql<number>`(
          SELECT count(*)::int FROM programs p
          WHERE p.category_id = categories.id
            AND p.status = 'published' AND p.deleted_at IS NULL
        )`,
        campaignCount: sql<number>`(
          SELECT count(*)::int FROM campaigns ca
          WHERE ca.category_id = categories.id
            AND ca.status IN ('published','active','paused','completed')
            AND ca.deleted_at IS NULL
        )`,
      })
      .from(categories)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(asc(categories.displayOrder), asc(categories.name));

    return { items: rows };
  }

  async getById(id: string) {
    const [row] = await this.database.db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (!row) throw new NotFoundException('Category');
    return row;
  }

  /**
   * Resolve a category id supplied by a client, checking it exists, is active,
   * and applies to this kind of record.
   *
   * Returns both the id and the NAME, because callers write the name into the
   * record's denormalised `category` column in the same statement — keeping
   * the cache and its source in one place is what stops them drifting.
   */
  async resolveForWrite(
    categoryId: string | null | undefined,
    kind: 'program' | 'campaign',
  ): Promise<{ id: string; name: string } | null> {
    if (!categoryId) return null;

    const [row] = await this.database.db
      .select({
        id: categories.id,
        name: categories.name,
        kind: categories.kind,
        isActive: categories.isActive,
      })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (!row) {
      throw new ValidationException([
        { field: 'categoryId', code: 'not_found', message: 'That category does not exist.' },
      ]);
    }

    if (!row.isActive) {
      throw new ValidationException([
        {
          field: 'categoryId',
          code: 'inactive',
          message: `“${row.name}” has been deactivated and cannot be assigned to new records.`,
        },
      ]);
    }

    if (row.kind !== 'both' && row.kind !== kind) {
      throw new ValidationException([
        {
          field: 'categoryId',
          code: 'wrong_kind',
          message: `“${row.name}” does not apply to ${kind}s.`,
        },
      ]);
    }

    return { id: row.id, name: row.name };
  }

  /** Map category slugs to ids, for translating a public filter into a query. */
  async idsForSlugs(slugs: string[]): Promise<string[]> {
    if (slugs.length === 0) return [];

    const rows = await this.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.slug, slugs));

    return rows.map((row) => row.id);
  }
}
