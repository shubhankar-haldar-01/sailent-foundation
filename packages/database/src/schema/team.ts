import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { primaryId, softDelete, timestamps } from './_shared.js';
import { publishStatusEnum, teamMemberTypeEnum } from './enums.js';
import { users } from './users.js';

/**
 * Public team directory.
 *
 * Separate from BOTH volunteers and login accounts: a trustee appears on /team
 * without ever logging in, and a volunteer is not staff. Conflating the three
 * is how NGO systems end up unable to answer "who works here".
 */
export const teamMembers = pgTable(
  'team_members',
  {
    id: primaryId(),
    /** Set only when the person also administers the platform. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

    name: varchar('name', { length: 160 }).notNull(),
    slug: varchar('slug', { length: 160 }).notNull(),
    photoUrl: text('photo_url'),
    designation: varchar('designation', { length: 160 }).notNull(),
    department: varchar('department', { length: 120 }),
    memberType: teamMemberTypeEnum('member_type').notNull().default('staff'),
    bio: text('bio'),
    experience: text('experience'),
    /** [{ label, url }] */
    socialLinks: jsonb('social_links'),
    emailPublic: varchar('email_public', { length: 255 }),

    status: publishStatusEnum('status').notNull().default('draft'),
    displayOrder: integer('display_order').notNull().default(100),
    /** Hiding never deletes — the record and its history stay. */
    isPublic: boolean('is_public').notNull().default(false),

    ...timestamps,
    ...softDelete,
  },
  (table) => [
    /**
     * UNIQUE, not merely indexed.
     *
     * The slug is a public URL segment identifying one person, so two rows
     * sharing one is already wrong. It also gives the seed a conflict target:
     * without it `onConflictDoNothing()` has nothing to conflict ON, and every
     * re-seed silently duplicates the whole team.
     */
    uniqueIndex('team_members_slug_unique').on(table.slug),
    index('team_members_public_idx').on(table.isPublic, table.displayOrder),
    index('team_members_department_idx').on(table.department),
  ],
);

export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
