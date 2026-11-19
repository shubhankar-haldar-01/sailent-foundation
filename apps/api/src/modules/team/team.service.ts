import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';

import { slugHistory, teamMembers, users, type DatabaseClient } from '@sailent/database';
import { canTransitionProgram, type ProgramStatus } from '@sailent/validation';
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
  CreateTeamMemberInput,
  TeamListQuery,
  UpdateTeamMemberInput,
} from './dto/team.dto.js';

const SORTABLE = {
  displayOrder: teamMembers.displayOrder,
  name: teamMembers.name,
  createdAt: teamMembers.createdAt,
  updatedAt: teamMembers.updatedAt,
  status: teamMembers.status,
} as const;

/**
 * The public team directory.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A TEAM MEMBER IS NOT A LOGIN ACCOUNT AND NOT A VOLUNTEER.
 *
 * `team_members`, `users` and `volunteers` are three tables because they are
 * three different things: a trustee appears on `/team` without ever signing
 * in, an administrator signs in without appearing anywhere public, and a
 * volunteer is neither. `userId` links the first two WHERE THEY HAPPEN TO
 * COINCIDE, and it is nullable because usually they do not.
 *
 * That link is deliberately not editable through this service. Attaching a
 * directory entry to a login account changes nothing about permissions today,
 * but it is the kind of field that acquires meaning later, and a bio form is
 * the wrong place for it to be sitting when that happens.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `status` and `isPublic` are BOTH required for a member to appear publicly,
 * which is the contract `ContentService.listTeam()` already enforces. They are
 * moved together, here, so the two can never disagree.
 */
@Injectable()
export class TeamService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly slugs: SlugService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async list(query: TeamListQuery) {
    const filters: SQL[] = [isNull(teamMembers.deletedAt)];

    if (query.status && query.status !== 'all') {
      filters.push(eq(teamMembers.status, query.status));
    }
    if (query.memberType) filters.push(eq(teamMembers.memberType, query.memberType));
    if (query.department) filters.push(eq(teamMembers.department, query.department));
    if (query.q) {
      const term = `%${query.q}%`;
      const search = or(
        ilike(teamMembers.name, term),
        ilike(teamMembers.designation, term),
        ilike(teamMembers.department, term),
        ilike(teamMembers.slug, term),
      );
      if (search) filters.push(search);
    }

    const where = and(...filters);
    const { column, direction } = resolveSort(query.sort ?? '-createdAt', SORTABLE, 'createdAt');

    const [items, [count]] = await Promise.all([
      this.database.db
        .select({
          id: teamMembers.id,
          name: teamMembers.name,
          slug: teamMembers.slug,
          photoUrl: teamMembers.photoUrl,
          designation: teamMembers.designation,
          department: teamMembers.department,
          memberType: teamMembers.memberType,
          contactNumber: teamMembers.contactNumber,
          aadharNumber: teamMembers.aadharNumber,
          address: teamMembers.address,
          status: teamMembers.status,
          isPublic: teamMembers.isPublic,
          displayOrder: teamMembers.displayOrder,
          createdAt: teamMembers.createdAt,
          updatedAt: teamMembers.updatedAt,
          linkedAccountEmail: users.email,
        })
        .from(teamMembers)
        .leftJoin(users, eq(users.id, teamMembers.userId))
        .where(where)
        // The id tiebreaker: `display_order` defaults to 100 for everybody, so
        // an unordered directory is one large tie and pagination without it is
        // undefined — a row can appear on two pages, or on neither.
        .orderBy(direction === 'desc' ? desc(column) : asc(column), teamMembers.id)
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.database.db
        .select({ value: sql<number>`count(*)::int` })
        .from(teamMembers)
        .where(where),
    ]);

    return paginate(items, query.page, query.limit, count?.value ?? 0);
  }

  async getById(id: string) {
    const [row] = await this.database.db
      .select({ member: teamMembers, linkedAccountEmail: users.email })
      .from(teamMembers)
      .leftJoin(users, eq(users.id, teamMembers.userId))
      .where(and(eq(teamMembers.id, id), isNull(teamMembers.deletedAt)))
      .limit(1);

    if (!row) throw new NotFoundException('Team member');

    return {
      ...row.member,
      linkedAccountEmail: row.linkedAccountEmail,
      slugHistory: await this.slugs.history('team', id),
    };
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  private async validateUniqueness(
    input: {
      aadharNumber?: string | null;
      contactNumber?: string | null;
      emailPublic?: string | null;
    },
    exceptId?: string,
  ) {
    // 1. Aadhaar
    if (input.aadharNumber) {
      const cleanAadhar = input.aadharNumber.replace(/\D/g, '');
      if (cleanAadhar.length > 0) {
        const conditions = [
          isNull(teamMembers.deletedAt),
          sql`regexp_replace(${teamMembers.aadharNumber}, '[^0-9]', '', 'g') = ${cleanAadhar}`,
        ];
        if (exceptId) conditions.push(sql`${teamMembers.id} != ${exceptId}`);
        const [existing] = await this.database.db
          .select({ id: teamMembers.id })
          .from(teamMembers)
          .where(and(...conditions))
          .limit(1);
        if (existing) {
          throw new ConflictException(
            'This Adhar number is already assigned to another team member.',
            [
              {
                field: 'aadharNumber',
                code: 'CONFLICT',
                message: 'This Adhar number is already assigned to another team member.',
              },
            ],
          );
        }
      }
    }

    // 2. Contact Number (Phone)
    if (input.contactNumber) {
      const digits = input.contactNumber.replace(/\D/g, '');
      const last10 = digits.slice(-10);
      if (last10.length === 10) {
        const conditions = [
          isNull(teamMembers.deletedAt),
          sql`right(regexp_replace(${teamMembers.contactNumber}, '[^0-9]', '', 'g'), 10) = ${last10}`,
        ];
        if (exceptId) conditions.push(sql`${teamMembers.id} != ${exceptId}`);
        const [existing] = await this.database.db
          .select({ id: teamMembers.id })
          .from(teamMembers)
          .where(and(...conditions))
          .limit(1);
        if (existing) {
          throw new ConflictException(
            'This contact number is already assigned to another team member.',
            [
              {
                field: 'contactNumber',
                code: 'CONFLICT',
                message: 'This contact number is already assigned to another team member.',
              },
            ],
          );
        }
      }
    }

    // 3. Email Public
    if (input.emailPublic) {
      const cleanEmail = input.emailPublic.trim().toLowerCase();
      if (cleanEmail.length > 0) {
        const conditions = [
          isNull(teamMembers.deletedAt),
          sql`lower(btrim(${teamMembers.emailPublic})) = ${cleanEmail}`,
        ];
        if (exceptId) conditions.push(sql`${teamMembers.id} != ${exceptId}`);
        const [existing] = await this.database.db
          .select({ id: teamMembers.id })
          .from(teamMembers)
          .where(and(...conditions))
          .limit(1);
        if (existing) {
          throw new ConflictException(
            'This email address is already assigned to another team member.',
            [
              {
                field: 'emailPublic',
                code: 'CONFLICT',
                message: 'This email address is already assigned to another team member.',
              },
            ],
          );
        }
      }
    }
  }

  private handleUniqueViolation(error: unknown): never {
    const err = error as { code?: string; constraint?: string };
    if (err.code === '23505') {
      if (err.constraint === 'team_members_aadhar_unique') {
        throw new ConflictException(
          'This Adhar number is already assigned to another team member.',
          [
            {
              field: 'aadharNumber',
              code: 'CONFLICT',
              message: 'This Adhar number is already assigned to another team member.',
            },
          ],
        );
      }
      if (err.constraint === 'team_members_contact_number_unique') {
        throw new ConflictException(
          'This contact number is already assigned to another team member.',
          [
            {
              field: 'contactNumber',
              code: 'CONFLICT',
              message: 'This contact number is already assigned to another team member.',
            },
          ],
        );
      }
      if (err.constraint === 'team_members_email_public_unique') {
        throw new ConflictException(
          'This email address is already assigned to another team member.',
          [
            {
              field: 'emailPublic',
              code: 'CONFLICT',
              message: 'This email address is already assigned to another team member.',
            },
          ],
        );
      }
      throw new ConflictException('A team member with this information already exists.');
    }
    throw error;
  }

  async create(input: CreateTeamMemberInput, actor: AuthenticatedActor, context: AuditContext) {
    await this.validateUniqueness(input);

    const slug = await this.slugs.allocate('team', { title: input.name, slug: input.slug });

    const bio =
      input.bio !== undefined
        ? input.bio
        : `${input.name} is a dedicated team member at Sailent Foundation.`;

    let created: { id: string } | undefined;
    try {
      const [row] = await this.database.db
        .insert(teamMembers)
        .values({
          ...this.writableFields(input),
          name: input.name,
          designation: input.designation,
          bio,
          slug,
          // Draft and not public. A person's name, photograph and biography going
          // live the instant somebody saves a half-typed form is the one mistake
          // on this table that cannot be taken back — it is a real person, and
          // the page is indexed within the hour.
          status: 'draft',
          isPublic: false,
        })
        .returning({ id: teamMembers.id });
      created = row;
    } catch (error) {
      this.handleUniqueViolation(error);
    }

    if (!created) throw new ConflictException('Could not create the team member.');

    await this.audit.record({
      action: 'team.create',
      entityType: 'team_member',
      entityId: created.id,
      userId: actor.id,
      newValues: { name: input.name, slug, designation: input.designation },
      ...context,
    });

    return this.getById(created.id);
  }

  async update(
    id: string,
    input: UpdateTeamMemberInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getById(id);

    await this.validateUniqueness(input, id);

    let slug = before.slug;
    if (input.slug !== undefined && input.slug !== before.slug) {
      slug = await this.slugs.allocate('team', {
        title: input.name ?? before.name,
        slug: input.slug,
        exceptId: id,
      });
    }

    try {
      await this.database.db.transaction(async (tx) => {
        // Retired inside the same transaction as the rename, so a committed slug
        // change cannot exist without its redirect.
        if (slug !== before.slug) {
          await this.slugs.retire('team', id, before.slug, actor.id, tx);
        }

        await tx
          .update(teamMembers)
          .set({ ...this.writableFields(input), slug, updatedAt: new Date() })
          .where(eq(teamMembers.id, id));
      });
    } catch (error) {
      this.handleUniqueViolation(error);
    }

    await this.audit.record({
      action: 'team.update',
      entityType: 'team_member',
      entityId: id,
      userId: actor.id,
      oldValues: { name: before.name, slug: before.slug, designation: before.designation },
      newValues: { ...input, slug },
      ...context,
    });

    return this.getById(id);
  }

  /**
   * Publish, unpublish or archive.
   *
   * `status` and `isPublic` move TOGETHER. Two flags that both have to be true
   * for a member to appear is two chances to leave someone invisible after
   * publishing them, or — worse — visible after taking them down. Nothing but
   * this method writes either.
   *
   * The programme transition table is reused rather than copied: the states are
   * the same three, and the rules are the same rules. A second table saying the
   * same thing is a second table to forget to update.
   */
  async setStatus(
    id: string,
    status: ProgramStatus,
    reason: string | undefined,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const before = await this.getById(id);
    const from = before.status as ProgramStatus;

    if (from === status) return before;
    if (!canTransitionProgram(from, status)) {
      throw new ConflictException(`A team member cannot go from ${from} to ${status}.`);
    }
    if (status === 'published') this.assertPublishable(before);

    await this.database.db
      .update(teamMembers)
      .set({ status, isPublic: status === 'published', updatedAt: new Date() })
      .where(eq(teamMembers.id, id));

    await this.audit.record({
      action: `team.${status === 'published' ? 'publish' : status === 'archived' ? 'archive' : 'unpublish'}`,
      entityType: 'team_member',
      entityId: id,
      userId: actor.id,
      oldValues: { status: from, isPublic: before.isPublic },
      newValues: { status, isPublic: status === 'published' },
      reason,
      severity: 'warning',
      ...context,
    });

    return this.getById(id);
  }

  /**
   * Permanently delete a team member.
   *
   * Irreversibly removes the team member from the database, releases
   * any associated slug history, and records a critical audit entry.
   */
  async delete(id: string, actor: AuthenticatedActor, context: AuditContext) {
    const before = await this.getById(id);

    await this.database.db.transaction(async (tx) => {
      await tx
        .delete(slugHistory)
        .where(and(eq(slugHistory.entityType, 'team'), eq(slugHistory.entityId, id)));
      await tx.delete(teamMembers).where(eq(teamMembers.id, id));
    });

    await this.audit.record({
      action: 'team.delete',
      entityType: 'team_member',
      entityId: id,
      userId: actor.id,
      oldValues: {
        name: before.name,
        slug: before.slug,
        designation: before.designation,
        status: before.status,
      },
      severity: 'critical',
      ...context,
    });

    return { deleted: true, id };
  }

  /**
   * Reorder the directory in one transaction.
   *
   * All-or-nothing on purpose: a partially applied reorder leaves two people
   * claiming the same position, and the order on `/team` then depends on which
   * row the planner happens to return first — which is to say it changes
   * between page loads.
   */
  async reorder(
    order: { id: string; displayOrder: number }[],
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    await this.database.db.transaction(async (tx) => {
      for (const entry of order) {
        await tx
          .update(teamMembers)
          .set({ displayOrder: entry.displayOrder, updatedAt: new Date() })
          .where(and(eq(teamMembers.id, entry.id), isNull(teamMembers.deletedAt)));
      }
    });

    await this.audit.record({
      action: 'team.reorder',
      entityType: 'team_member',
      userId: actor.id,
      newValues: { order },
      ...context,
    });

    return this.list({ page: 1, limit: 200, status: 'all' });
  }

  /**
   * What a team member needs before their page goes live.
   *
   * A photograph is NOT on this list. Requiring one would keep a trustee who
   * declines to be photographed off the site entirely, and the directory is
   * more useful complete than it is uniform.
   */
  private assertPublishable(member: { name: string; designation: string; bio: string | null }) {
    const missing: { field: string; code: string; message: string }[] = [];

    if (!member.designation?.trim()) {
      missing.push({
        field: 'designation',
        code: 'required',
        message: 'A designation is required — a name with no role tells a visitor nothing.',
      });
    }
    if (!member.bio?.trim()) {
      missing.push({
        field: 'bio',
        code: 'required',
        message: 'A short biography is required before this page goes live.',
      });
    }

    if (missing.length > 0) {
      throw new ValidationException(missing, 'This team member is not ready to publish.');
    }
  }

  /**
   * The fields a client may write.
   *
   * An explicit allow-list. `status`, `isPublic` and `userId` are
   * system-controlled: the first two move only through `setStatus`, and the
   * third is not editable through this API at all.
   */
  private writableFields(input: Partial<CreateTeamMemberInput>) {
    const allowed = [
      'name',
      'photoUrl',
      'designation',
      'department',
      'memberType',
      'contactNumber',
      'aadharNumber',
      'address',
      'bio',
      'experience',
      'socialLinks',
      'emailPublic',
      'displayOrder',
    ] as const;

    const output: Record<string, unknown> = {};
    for (const key of allowed) {
      if (input[key] !== undefined) output[key] = input[key];
    }
    return output;
  }
}
