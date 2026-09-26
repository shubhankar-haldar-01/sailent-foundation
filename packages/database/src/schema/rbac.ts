import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { primaryId, timestamps } from './_shared.js';
import { users } from './users.js';

/**
 * RBAC (decision A9).
 *
 * Guards check PERMISSION STRINGS, never role names. Roles are named bundles of
 * permissions stored as data and editable by a Super Admin, so adding a seventh
 * role is configuration rather than an audit of every guard.
 */

export const roles = pgTable(
  'roles',
  {
    id: primaryId(),
    /** Machine key: SUPER_ADMIN, FINANCE_MANAGER … */
    key: varchar('key', { length: 64 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    /** System roles cannot be deleted, only edited. */
    isSystem: boolean('is_system').notNull().default(false),
    /** Lower sorts first in the admin UI. */
    priority: integer('priority').notNull().default(100),
    ...timestamps,
  },
  (table) => [uniqueIndex('roles_key_unique').on(table.key)],
);

export const permissions = pgTable(
  'permissions',
  {
    id: primaryId(),
    /** `resource.action` — campaign.publish, donation.export. */
    key: varchar('key', { length: 96 }).notNull(),
    resource: varchar('resource', { length: 48 }).notNull(),
    action: varchar('action', { length: 48 }).notNull(),
    description: text('description'),
    /**
     * Drives the re-authentication requirement. A sensitive permission needs a
     * successful re-auth within the last five minutes AND always writes an
     * audit row.
     */
    isSensitive: boolean('is_sensitive').notNull().default(false),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex('permissions_key_unique').on(table.key),
    index('permissions_resource_idx').on(table.resource),
  ],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    createdAt: timestamps.createdAt,
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    /** Who granted it, for the audit trail. */
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.roleId] }),
    index('user_roles_role_idx').on(table.roleId),
  ],
);

export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type NewPermission = typeof permissions.$inferInsert;
