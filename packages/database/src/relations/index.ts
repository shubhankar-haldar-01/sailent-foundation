import { relations } from 'drizzle-orm';

import {
  campaignProducts,
  campaigns,
  donationItems,
  donations,
  donors,
  eventRegistrations,
  events,
  impactUpdates,
  paymentTransactions,
  payments,
  permissions,
  products,
  programs,
  rolePermissions,
  roles,
  receipts,
  savedCampaigns,
  sessions,
  successStories,
  teamMembers,
  userRoles,
  users,
  volunteers,
} from '../schema/index.js';

/**
 * Drizzle relations.
 *
 * Kept beside the tables rather than inline, so a table file stays readable as
 * a description of one entity.
 *
 * NOTE ON DELETE BEHAVIOUR (set on the foreign keys themselves):
 *   restrict  — financial and content records. A programme with campaigns
 *               cannot be deleted out from under them, and nothing deletes a
 *               donation. Financial history is preserved, always.
 *   set null  — optional associations. Removing a programme should not destroy
 *               the story that referenced it.
 *   cascade   — used only for rows that have no meaning without their parent:
 *               a session without its user, a role_permission without its role.
 *
 * Cascade is never applied to anything a finance team or an auditor would
 * expect to still be there.
 */

export const usersRelations = relations(users, ({ many }) => ({
  roles: many(userRoles),
  sessions: many(sessions),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  permissions: many(rolePermissions),
  users: many(userRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  roles: many(rolePermissions),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
  donor: one(donors, { fields: [sessions.donorId], references: [donors.id] }),
}));

// ---------------------------------------------------------------------------

export const donorsRelations = relations(donors, ({ one, many }) => ({
  user: one(users, { fields: [donors.userId], references: [users.id] }),
  donations: many(donations),
}));

export const volunteersRelations = relations(volunteers, ({ one }) => ({
  user: one(users, { fields: [volunteers.userId], references: [users.id] }),
  approver: one(users, { fields: [volunteers.approvedBy], references: [users.id] }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));

// ---------------------------------------------------------------------------

export const programsRelations = relations(programs, ({ many }) => ({
  campaigns: many(campaigns),
  impactUpdates: many(impactUpdates),
  events: many(events),
  stories: many(successStories),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  program: one(programs, { fields: [campaigns.programId], references: [programs.id] }),
  products: many(campaignProducts),
  donations: many(donations),
  impactUpdates: many(impactUpdates),
  events: many(events),
  stories: many(successStories),
}));

export const campaignProductsRelations = relations(campaignProducts, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [campaignProducts.campaignId], references: [campaigns.id] }),
  donationItems: many(donationItems),
}));

// ---------------------------------------------------------------------------

export const donationsRelations = relations(donations, ({ one, many }) => ({
  donor: one(donors, { fields: [donations.donorId], references: [donors.id] }),
  campaign: one(campaigns, { fields: [donations.campaignId], references: [campaigns.id] }),
  program: one(programs, { fields: [donations.programId], references: [programs.id] }),
  items: many(donationItems),
  payments: many(payments),
  /**
   * `one`, not `many` — a unique index on `receipts.donation_id` enforces it.
   * A second receipt for the same donation is a correction, and a correction
   * supersedes rather than adds.
   */
  receipt: one(receipts, { fields: [donations.receiptId], references: [receipts.id] }),
}));

export const donationItemsRelations = relations(donationItems, ({ one }) => ({
  donation: one(donations, { fields: [donationItems.donationId], references: [donations.id] }),
  /** The campaign's offering — which appeal this line was bought from. */
  campaignProduct: one(campaignProducts, {
    fields: [donationItems.campaignProductId],
    references: [campaignProducts.id],
  }),
  /** The catalogue entry, which survives the offering being withdrawn. */
  product: one(products, { fields: [donationItems.productId], references: [products.id] }),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  donation: one(donations, { fields: [payments.donationId], references: [donations.id] }),
  transactions: many(paymentTransactions),
}));

export const paymentTransactionsRelations = relations(paymentTransactions, ({ one }) => ({
  payment: one(payments, { fields: [paymentTransactions.paymentId], references: [payments.id] }),
}));

export const savedCampaignsRelations = relations(savedCampaigns, ({ one }) => ({
  donor: one(donors, { fields: [savedCampaigns.donorId], references: [donors.id] }),
  campaign: one(campaigns, { fields: [savedCampaigns.campaignId], references: [campaigns.id] }),
}));

export const receiptsRelations = relations(receipts, ({ one }) => ({
  donation: one(donations, { fields: [receipts.donationId], references: [donations.id] }),
  donor: one(donors, { fields: [receipts.donorId], references: [donors.id] }),
}));

// ---------------------------------------------------------------------------

export const eventsRelations = relations(events, ({ one, many }) => ({
  program: one(programs, { fields: [events.programId], references: [programs.id] }),
  campaign: one(campaigns, { fields: [events.campaignId], references: [campaigns.id] }),
  registrations: many(eventRegistrations),
}));

export const eventRegistrationsRelations = relations(eventRegistrations, ({ one }) => ({
  event: one(events, { fields: [eventRegistrations.eventId], references: [events.id] }),
  volunteer: one(volunteers, {
    fields: [eventRegistrations.volunteerId],
    references: [volunteers.id],
  }),
}));

export const successStoriesRelations = relations(successStories, ({ one }) => ({
  program: one(programs, { fields: [successStories.programId], references: [programs.id] }),
  campaign: one(campaigns, { fields: [successStories.campaignId], references: [campaigns.id] }),
}));

export const impactUpdatesRelations = relations(impactUpdates, ({ one }) => ({
  program: one(programs, { fields: [impactUpdates.programId], references: [programs.id] }),
  campaign: one(campaigns, { fields: [impactUpdates.campaignId], references: [campaigns.id] }),
}));
