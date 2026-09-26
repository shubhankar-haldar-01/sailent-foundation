import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Status enums.
 *
 * Native Postgres enums for CLOSED sets — a status the application knows about
 * by name. Sets an operator may extend (categories, departments) stay as
 * lookup tables or plain text, because adding a value to a pg enum needs a
 * migration and that is the wrong cost for editorial data.
 *
 * Naming follows docs/database-architecture.md §1: snake_case values, so the
 * database reads the same as the SQL a person writes by hand at 2am.
 */

export const userStatusEnum = pgEnum('user_status', ['invited', 'active', 'inactive', 'suspended']);

export const tokenAudienceEnum = pgEnum('token_audience', ['donor', 'staff']);

export const donorTypeEnum = pgEnum('donor_type', ['individual', 'corporate', 'trust']);

export const taxIdTypeEnum = pgEnum('tax_id_type', [
  'pan',
  'aadhaar',
  'passport',
  'driving_licence',
  'voter_id',
  'foreign_tin',
]);

/** Full lifecycle from docs/user-flows.md §6. */
export const volunteerStatusEnum = pgEnum('volunteer_status', [
  'applied',
  'under_review',
  'approved',
  'active',
  'inactive',
  'suspended',
  'rejected',
  'archived',
]);

/**
 * An assignment's lifecycle.
 *
 * `no_show` is distinct from `cancelled`: cancelling is something the
 * organisation or the volunteer decides in advance, not turning up is a fact
 * recorded afterwards. Collapsing them would lose the only signal there is
 * about reliability.
 */
export const volunteerAssignmentStatusEnum = pgEnum('volunteer_assignment_status', [
  'assigned',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]);

export const volunteerCertificateTypeEnum = pgEnum('volunteer_certificate_type', [
  'participation',
  'appreciation',
  'completion',
  'service',
]);

/** Revocation is a status, never a delete — the document was seen. */
export const volunteerCertificateStatusEnum = pgEnum('volunteer_certificate_status', [
  'issued',
  'revoked',
]);

export const teamMemberTypeEnum = pgEnum('team_member_type', [
  'staff',
  'trustee',
  'advisor',
  'board',
]);

export const publishStatusEnum = pgEnum('publish_status', ['draft', 'published', 'archived']);

export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft',
  'published',
  'active',
  'paused',
  'completed',
  'archived',
]);

export const campaignProductStatusEnum = pgEnum('campaign_product_status', [
  'active',
  'inactive',
  'fulfilled',
]);

/**
 * Master product lifecycle (Phase 5).
 *
 * Distinct from `campaign_product_status`, and the distinction is the point: a
 * product can be ACTIVE in the catalogue while switched off in one campaign and
 * on in two others. Collapsing the two would make "withdraw this from the
 * Bihar appeal" mean "withdraw it everywhere".
 *
 * `archived` is retirement, not deletion. Donations reference products through
 * `donation_items`, so a product that has ever been given to can never be
 * removed — only taken out of circulation.
 */
export const productStatusEnum = pgEnum('product_status', ['active', 'inactive', 'archived']);

/**
 * What a donation is MADE OF. Not how often it recurs — nothing here recurs.
 *
 *   custom   an amount, no products
 *   product  products only
 *   hybrid   products plus an amount on top
 *
 * Phase 6 removed `one_time` and `monthly`. The first answered a question this
 * column does not ask (every donation is one-time), and the second described a
 * feature that was designed in Phase 3, never built, and is now gone from the
 * schema so it cannot be reached for by accident.
 */
export const donationTypeEnum = pgEnum('donation_type', ['custom', 'product', 'hybrid']);

/**
 * Donation status.
 *
 * Forward-only in application code (decision A4). `pending` is the ONLY status
 * a client action can produce; everything beyond it is set by a
 * signature-verified webhook or by reconciliation.
 */
export const donationStatusEnum = pgEnum('donation_status', [
  'pending',
  'processing',
  'successful',
  'failed',
  'cancelled',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'created',
  'pending',
  'processing',
  'successful',
  'failed',
  'cancelled',
]);

export const paymentProviderEnum = pgEnum('payment_provider', ['razorpay']);

export const paymentMethodEnum = pgEnum('payment_method', [
  'upi',
  'card',
  'netbanking',
  'wallet',
  'emandate',
]);

export const eventRegistrationStatusEnum = pgEnum('event_registration_status', [
  'open',
  'closed',
  'full',
  'cancelled',
  'completed',
]);

export const documentVisibilityEnum = pgEnum('document_visibility', [
  'public',
  'private',
  'admin_only',
]);

export const documentTypeEnum = pgEnum('document_type', [
  'annual_report',
  'financial',
  'impact_report',
  'utilisation',
  'policy',
  'registration',
  'internal',
  'other',
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'email',
  'sms',
  'whatsapp',
  'push',
  'in_app',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
  'pending',
  'sent',
  'failed',
  'read',
]);

export const auditActorTypeEnum = pgEnum('audit_actor_type', [
  'user',
  'donor',
  'volunteer',
  'system',
  'webhook',
]);

export const auditSeverityEnum = pgEnum('audit_severity', ['info', 'warning', 'critical']);

/**
 * Which entities a category may be applied to.
 *
 * One lookup table serves programmes and campaigns because the sets overlap
 * almost entirely — "Disaster Relief" is both — and two tables would mean two
 * places to add a category and two chances to spell it differently.
 *
 * `blog` joined them in Phase 10.7 for the same reason, and only after asking
 * whether the blog needed a taxonomy of its own. It does not: an article about
 * the education programme belongs under the education the site already names.
 * A second `blog_categories` table would have meant two spellings of
 * "Child Welfare" and a public URL for each.
 *
 * `both` continues to mean "programme AND campaign", NOT "every kind". It
 * predates this value and widening it would silently re-file every existing
 * category as a blog category too; a category that should appear on articles
 * as well is filed as `blog` explicitly.
 */
export const categoryKindEnum = pgEnum('category_kind', ['program', 'campaign', 'both', 'blog']);

/**
 * What an FAQ is attached to (docs/database-architecture.md).
 *
 * `general` FAQs have a null context_id and appear on /faq; the rest hang off
 * one record — a campaign-specific question belongs with its campaign, not in
 * a site-wide list nobody reading that campaign will find.
 */
export const faqContextEnum = pgEnum('faq_context', [
  'general',
  'donation',
  'volunteer',
  'campaign',
  'event',
]);

/** Whether a piece of media may be served to anyone. */
export const mediaVisibilityEnum = pgEnum('media_visibility', ['public', 'private']);
