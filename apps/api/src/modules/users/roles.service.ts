import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';

import {
  permissions as permissionsTable,
  rolePermissions,
  roles as rolesTable,
  type DatabaseClient,
} from '@sailent/database';

import { DATABASE } from '../database/database.module.js';

/**
 * Roles and the permission catalogue — read-only in Phase 3.
 *
 * Editing a role changes what every holder may do, so it is a Phase 5 feature
 * with its own re-auth, diff preview and audit trail. Exposing the catalogue
 * now is what lets the admin UI render an honest "this role can do X" screen
 * instead of a hard-coded list that drifts from the database.
 */
@Injectable()
export class RolesService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  async listRoles() {
    const rows = await this.database.db
      .select({
        id: rolesTable.id,
        key: rolesTable.key,
        name: rolesTable.name,
        description: rolesTable.description,
        isSystem: rolesTable.isSystem,
        priority: rolesTable.priority,
        /*
         * LITERAL SQL. These two were CORRECT BY ACCIDENT in the interpolated
         * form: Drizzle rendered `WHERE "role_id" = "id"`, and because neither
         * `role_permissions` nor `user_roles` has an `id` column, the bare name
         * fell through to the outer `roles.id` and the counts came out right.
         *
         * Adding a surrogate `id` to either table — an ordinary thing to do —
         * would have silently turned both counts to zero with no error and no
         * failing test. Written qualified, they cannot.
         */
        permissionCount: sql<number>`(
          SELECT count(*)::int FROM role_permissions rp
          WHERE rp.role_id = roles.id
        )`,
        userCount: sql<number>`(
          SELECT count(*)::int FROM user_roles ur
          WHERE ur.role_id = roles.id
        )`,
      })
      .from(rolesTable)
      .orderBy(asc(rolesTable.priority));

    return { items: rows };
  }

  async getRole(key: string) {
    const [role] = await this.database.db
      .select()
      .from(rolesTable)
      .where(eq(rolesTable.key, key))
      .limit(1);

    if (!role) return null;

    const granted = await this.database.db
      .select({
        key: permissionsTable.key,
        resource: permissionsTable.resource,
        action: permissionsTable.action,
        description: permissionsTable.description,
        isSensitive: permissionsTable.isSensitive,
      })
      .from(rolePermissions)
      .innerJoin(permissionsTable, eq(permissionsTable.id, rolePermissions.permissionId))
      .where(eq(rolePermissions.roleId, role.id))
      .orderBy(asc(permissionsTable.key));

    return { ...role, permissions: granted };
  }

  /** The whole catalogue, grouped by resource — the shape a permissions matrix needs. */
  async listPermissions() {
    const rows = await this.database.db
      .select({
        key: permissionsTable.key,
        resource: permissionsTable.resource,
        action: permissionsTable.action,
        description: permissionsTable.description,
        isSensitive: permissionsTable.isSensitive,
      })
      .from(permissionsTable)
      .orderBy(asc(permissionsTable.resource), asc(permissionsTable.action));

    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = grouped.get(row.resource) ?? [];
      list.push(row);
      grouped.set(row.resource, list);
    }

    return {
      items: rows,
      groups: [...grouped.entries()].map(([resource, permissions]) => ({ resource, permissions })),
    };
  }
}
