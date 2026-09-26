import { index, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { primaryId, timestamps } from './_shared.js';
import { campaigns } from './campaigns.js';
import { donors } from './donors.js';

/**
 * Campaigns a donor has saved to come back to.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * KEYED ON `donors`, NOT ON `users`, BECAUSE THAT IS WHO IS SIGNED IN.
 *
 * `users` are staff — people who administer the organisation. A donor never has
 * a user row. A donor session carries `sessions.donorId` and a `donor` token
 * audience, so `donors.id` is the only identity a donor request actually has,
 * and keying a donor's own data on anything else would mean inventing a second
 * identity for them.
 *
 * NOTHING IS SNAPSHOTTED. Unlike a donation line, a saved campaign is a pointer
 * and should follow the campaign: a donor who saved an appeal wants its
 * progress today, not its progress on the day they saved it.
 *
 * `ON DELETE CASCADE` on both sides, which would be wrong on a financial row
 * and is right here. A bookmark is not a record of anything that happened; if
 * the donor record goes, their bookmarks go with it, and nothing is lost that
 * anyone would need to reconstruct.
 * ══════════════════════════════════════════════════════════════════════════
 */
export const savedCampaigns = pgTable(
  'saved_campaigns',
  {
    id: primaryId(),
    donorId: uuid('donor_id')
      .notNull()
      .references(() => donors.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    /**
     * Saving twice is the same as saving once.
     *
     * Enforced here rather than by a check-then-insert in the service, because
     * a double-tapped bookmark sends two requests that both read "not saved"
     * before either writes. The service turns the resulting conflict into a
     * success, which is the honest answer: the campaign is saved.
     */
    uniqueIndex('saved_campaigns_donor_campaign_unique').on(table.donorId, table.campaignId),
    /** The listing query: one donor's saves, newest first. */
    index('saved_campaigns_donor_idx').on(table.donorId, table.createdAt),
    /** Answers "is this one saved?" on a campaign page without a scan. */
    index('saved_campaigns_campaign_idx').on(table.campaignId),
  ],
);

export type SavedCampaign = typeof savedCampaigns.$inferSelect;
export type NewSavedCampaign = typeof savedCampaigns.$inferInsert;
