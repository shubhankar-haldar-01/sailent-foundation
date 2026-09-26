import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { and, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';

import { roles as rolesTable, userRoles, users, type DatabaseClient } from '@sailent/database';
import type { AuthenticatedActor } from '@sailent/types';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { PasswordService } from '../auth/password.service.js';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions.js';
import {
  offsetFor,
  paginate,
  resolveSort,
  type PaginationQuery,
} from '../../common/dto/pagination.dto.js';

/**
 * Columns that may be selected for a staff account.
 *
 * DEFINED ONCE, and it does not include `passwordHash`, `totpSecret` or
 * `backupCodes`. Every query in this service projects through this constant, so
 * a secret cannot reach a response by someone adding a `select()` that forgets
 * to strip it — the column is simply not in the shape.
 */
const PUBLIC_USER_COLUMNS = {
  id: users.id,
  email: users.email,
  firstName: users.firstName,
  lastName: users.lastName,
  phone: users.phone,
  status: users.status,
  totpEnabled: users.totpEnabled,
  lastLoginAt: users.lastLoginAt,
  emailVerifiedAt: users.emailVerifiedAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const;

/** Sortable fields, as an allow-list. A caller cannot name an arbitrary column. */
const USER_SORT_COLUMNS = {
  createdAt: users.createdAt,
  email: users.email,
  firstName: users.firstName,
  lastLoginAt: users.lastLoginAt,
  status: users.status,
} as const;

export interface UserListQuery extends PaginationQuery {
  status?: 'invited' | 'active' | 'inactive' | 'suspended';
  role?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async list(query: UserListQuery) {
    const filters: SQL[] = [];

    if (query.status) filters.push(eq(users.status, query.status));

    if (query.q) {
      const term = `%${query.q}%`;
      const search = or(
        ilike(users.email, term),
        ilike(users.firstName, term),
        ilike(users.lastName, term),
      );
      if (search) filters.push(search);
    }

    if (query.role) {
      // A correlated EXISTS rather than a join, so that holding two roles does
      // not duplicate the row and quietly corrupt the pagination total.
      filters.push(
        /*
         * LITERAL identifiers. Drizzle emits column references inside a `sql`
         * template unqualified, so the interpolated form of this rendered as
         * `WHERE "user_id" = "id"` — and because `user_roles` has no `id`
         * column while `roles` (joined in) does, the comparison bound to the
         * wrong table and matched nothing. Filtering the user list by role
         * returned an empty list for every role.
         *
         * `${query.role}` stays interpolated: it is a BOUND PARAMETER, which
         * Drizzle handles correctly and which must not be inlined.
         */
        sql`EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = users.id AND r.key = ${query.role}
        )`,
      );
    }

    const where = filters.length > 0 ? and(...filters) : undefined;
    const { column, direction } = resolveSort(query.sort, USER_SORT_COLUMNS, 'createdAt');

    const [rows, [count]] = await Promise.all([
      this.database.db
        .select(PUBLIC_USER_COLUMNS)
        .from(users)
        .where(where)
        /*
          A DETERMINISTIC TIEBREAKER.

          Rows seeded or written in one statement share a `created_at` to the
          microsecond, and Postgres gives no defined order among ties — so two
          identical queries can return them in different orders. On a paginated
          list that is not cosmetic: a row can appear on page one AND page two,
          or on neither. It surfaced as a cross-suite test failure that passed
          in isolation, which is what an unstable sort looks like from outside.
        */
        .orderBy(direction === 'desc' ? sql`${column} DESC` : sql`${column} ASC`, users.id)
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.database.db
        .select({ value: sql<number>`count(*)::int` })
        .from(users)
        .where(where),
    ]);

    const rolesByUser = await this.rolesFor(rows.map((row) => row.id));

    return paginate(
      rows.map((row) => ({ ...row, roles: rolesByUser.get(row.id) ?? [] })),
      query.page,
      query.limit,
      count?.value ?? 0,
    );
  }

  async getById(id: string) {
    const [user] = await this.database.db
      .select(PUBLIC_USER_COLUMNS)
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) throw new NotFoundException('Staff account');

    const rolesByUser = await this.rolesFor([user.id]);
    return { ...user, roles: rolesByUser.get(user.id) ?? [] };
  }

  /** Roles for many users in one query, to keep a list page off the N+1 path. */
  private async rolesFor(userIds: string[]): Promise<Map<string, { key: string; name: string }[]>> {
    const result = new Map<string, { key: string; name: string }[]>();
    if (userIds.length === 0) return result;

    const rows = await this.database.db
      .select({
        userId: userRoles.userId,
        key: rolesTable.key,
        name: rolesTable.name,
        priority: rolesTable.priority,
      })
      .from(userRoles)
      .innerJoin(rolesTable, eq(rolesTable.id, userRoles.roleId))
      .where(inArray(userRoles.userId, userIds))
      .orderBy(rolesTable.priority);

    for (const row of rows) {
      const list = result.get(row.userId) ?? [];
      list.push({ key: row.key, name: row.name });
      result.set(row.userId, list);
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  /**
   * Invite a staff member.
   *
   * No password is set here. The account is created `invited` with a
   * `mustChangePassword` flag and an unguessable placeholder hash, so it cannot
   * be signed into until the invitee sets their own credential — a
   * administrator-chosen password is one the administrator also knows.
   *
   * (Delivering the invitation email is Phase 4. Until then an account sits in
   * `invited` and a Super Admin activates it deliberately.)
   */
  async invite(
    input: {
      email: string;
      firstName: string;
      lastName?: string;
      phone?: string;
      roleKeys: string[];
    },
    actor: AuthenticatedActor,
    context: { ip?: string; userAgent?: string; requestId?: string },
  ) {
    const [existing] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = lower(${input.email})`)
      .limit(1);

    if (existing) {
      throw new ConflictException('An account already exists for that email address.');
    }

    const roleRows = await this.resolveRoles(input.roleKeys);

    const created = await this.database.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName ?? null,
          phone: input.phone ?? null,
          status: 'invited',
          // Unusable by construction: a random 64-byte secret nobody holds.
          // `verify` fails against it, so the account cannot be signed into
          // before the invitee sets a password of their own.
          passwordHash: await this.passwords.hash(randomBytes(64).toString('base64url')),
          mustChangePassword: true,
        })
        .returning({ id: users.id });

      if (!user) throw new ConflictException('Could not create the account.');

      await tx.insert(userRoles).values(
        roleRows.map((role) => ({
          userId: user.id,
          roleId: role.id,
          grantedBy: actor.id,
        })),
      );

      return user;
    });

    await this.audit.record({
      action: 'user.invite',
      entityType: 'user',
      entityId: created.id,
      userId: actor.id,
      // The email is the subject of the record, not a secret — an audit trail
      // that cannot say WHO was invited records nothing useful.
      newValues: { email: input.email, roles: roleRows.map((role) => role.key) },
      severity: 'warning',
      ipAddress: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });

    return this.getById(created.id);
  }

  async update(
    id: string,
    input: { firstName?: string; lastName?: string; phone?: string },
    actor: AuthenticatedActor,
    context: { ip?: string; userAgent?: string; requestId?: string },
  ) {
    const before = await this.getById(id);

    await this.database.db
      .update(users)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(users.id, id));

    await this.audit.record({
      action: 'user.update',
      entityType: 'user',
      entityId: id,
      userId: actor.id,
      oldValues: { firstName: before.firstName, lastName: before.lastName, phone: before.phone },
      newValues: input,
      ipAddress: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });

    return this.getById(id);
  }

  /**
   * Replace a user's role set.
   *
   * SEPARATION OF DUTIES (docs/rbac.md §6): nobody may change their own roles,
   * whatever permissions they hold. Self-elevation is the single change that
   * defeats every other control in the system, so it is refused at the service
   * layer rather than left to the guard — a service is harder to route around
   * than a decorator.
   */
  async assignRoles(
    id: string,
    input: { roleKeys: string[]; reason?: string },
    actor: AuthenticatedActor,
    context: { ip?: string; userAgent?: string; requestId?: string },
  ) {
    if (id === actor.id) {
      throw new ForbiddenException(
        'You cannot change your own roles. Ask another Super Admin to make this change.',
      );
    }

    const before = await this.getById(id);
    const roleRows = await this.resolveRoles(input.roleKeys);

    await this.database.db.transaction(async (tx) => {
      await tx.delete(userRoles).where(eq(userRoles.userId, id));
      await tx
        .insert(userRoles)
        .values(roleRows.map((role) => ({ userId: id, roleId: role.id, grantedBy: actor.id })));
    });

    await this.audit.record({
      action: 'user.assign_role',
      entityType: 'user',
      entityId: id,
      userId: actor.id,
      oldValues: { roles: before.roles.map((role) => role.key) },
      newValues: { roles: roleRows.map((role) => role.key) },
      reason: input.reason,
      // A permission change is always worth a second look in the log.
      severity: 'critical',
      ipAddress: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });

    return this.getById(id);
  }

  /**
   * Suspend or reactivate an account.
   *
   * Suspension REVOKES EVERY LIVE SESSION. An account that keeps working until
   * its access token expires is not suspended, it is scheduled for suspension —
   * and the fifteen minutes in between are exactly when it matters.
   */
  async setStatus(
    id: string,
    status: 'active' | 'suspended' | 'inactive',
    reason: string,
    actor: AuthenticatedActor,
    context: { ip?: string; userAgent?: string; requestId?: string },
  ) {
    if (id === actor.id) {
      throw new ForbiddenException('You cannot change the status of your own account.');
    }

    const before = await this.getById(id);

    if (before.status === status) {
      throw new ConflictException(`That account is already ${status}.`);
    }

    await this.database.db.transaction(async (tx) => {
      await tx.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, id));

      if (status !== 'active') {
        await tx.execute(
          sql`UPDATE sessions SET revoked_at = now(), revoked_reason = 'account_suspended'
              WHERE user_id = ${id} AND revoked_at IS NULL`,
        );
      }
    });

    await this.audit.record({
      action: status === 'active' ? 'user.reactivate' : 'user.suspend',
      entityType: 'user',
      entityId: id,
      userId: actor.id,
      oldValues: { status: before.status },
      newValues: { status },
      reason,
      severity: 'critical',
      ipAddress: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });

    return this.getById(id);
  }

  /** Resolve role keys, refusing the whole request if any one is unknown. */
  private async resolveRoles(keys: string[]) {
    const unique = [...new Set(keys)];
    const rows = await this.database.db
      .select({ id: rolesTable.id, key: rolesTable.key })
      .from(rolesTable)
      .where(inArray(rolesTable.key, unique));

    if (rows.length !== unique.length) {
      const found = new Set(rows.map((row) => row.key));
      const missing = unique.filter((key) => !found.has(key));
      throw new ValidationException(
        missing.map((key) => ({
          field: 'roleKeys',
          code: 'unknown_role',
          message: `Unknown role: ${key}`,
        })),
      );
    }

    return rows;
  }
}
