/**
 * Schema barrel.
 *
 * Phase 3 implements the full domain model from
 * docs/database-architecture.md. Tables marked "foundation only" have their
 * schema, constraints and indexes in place but no business logic behind them
 * yet — that arrives with the phase that owns the workflow.
 *
 * Implemented:
 *   identity      users, sessions, otp_codes
 *   rbac          roles, permissions, role_permissions, user_roles
 *   people        donors, volunteers, team_members, saved_campaigns
 *   content       programs, campaigns, campaign_products, success_stories,
 *                 impact_updates, events, event_registrations, documents
 *   financial     donations, donation_items, payments, payment_transactions,
 *                 payment_webhooks, receipts
 *   platform      notifications (foundation only), audit_logs, settings
 *
 * Not yet created — their phase owns them:
 *   tax_documents, form_10bd_exports                (a later phase)
 *   volunteer_* lifecycle tables, certificates      (Phase 6)
 *   blog_posts, blog_tags, blog_post_tags           (Phase 10.7 blog)
 *   pages, page_revisions                           (Phase 10.9 composer)
 *
 * Phase 6 adds:
 *   financial     receipts, receipt_sequences
 *
 * Phase 4 adds:
 *   taxonomy      categories, slug_history
 *   content       faqs, media, campaign_gallery
 */
export * from './_shared.js';
export * from './enums.js';

export * from './users.js';
export * from './rbac.js';

export * from './donors.js';
export * from './volunteers.js';
export * from './team.js';

export * from './taxonomy.js';
export * from './products.js';
export * from './programs.js';
export * from './campaigns.js';
export * from './saved-campaigns.js';
export * from './stories.js';
export * from './blog.js';
export * from './pages.js';
export * from './impact.js';
export * from './events.js';
export * from './documents.js';
export * from './faqs.js';
export * from './media.js';

export * from './donations.js';
export * from './payments.js';
export * from './receipts.js';

export * from './notifications.js';
export * from './audit-logs.js';
export * from './settings.js';

// Relations, so the Drizzle query API can traverse them.
export * from '../relations/index.js';
