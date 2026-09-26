/**
 * The permission catalogue and role bundles (docs/rbac.md).
 *
 * This is the single source of truth. The seed writes it to the database, the
 * API guard reads permission strings from the database, and the admin UI
 * filters its sidebar from the same list the API enforces — so a menu item can
 * never lead to a 403.
 *
 * `sensitive: true` means the operation additionally requires a successful
 * re-authentication within the last five minutes AND always writes an audit row.
 */

export interface PermissionDefinition {
  key: string;
  description: string;
  sensitive?: boolean;
}

export const PERMISSIONS: PermissionDefinition[] = [
  // Campaigns
  { key: 'campaign.read', description: 'View campaigns, including drafts' },
  { key: 'campaign.create', description: 'Create a campaign' },
  { key: 'campaign.update', description: 'Edit a campaign' },
  { key: 'campaign.publish', description: 'Publish a campaign' },
  { key: 'campaign.pause', description: 'Pause donations to a campaign' },
  { key: 'campaign.activate', description: 'Open a campaign for donations' },
  { key: 'campaign.complete', description: 'Mark a campaign complete' },
  { key: 'campaign.archive', description: 'Archive a campaign', sensitive: true },
  { key: 'campaign.delete', description: 'Delete a campaign', sensitive: true },

  // Campaign sub-resources. Separated from `campaign.update` because the
  // people who write FAQs and post progress updates are usually not the people
  // trusted to change a fundraising goal.
  // The PRODUCT CATALOGUE — the master list, owned independently of any
  // campaign. Separate from `campaign_product.*` because the two are genuinely
  // different jobs: writing what a School Kit contains is editorial work, and
  // deciding what this appeal charges for one is a fundraising decision. A
  // Campaign Manager does the second without being able to rewrite the first.
  { key: 'product.view', description: 'View the product catalogue' },
  { key: 'product.create', description: 'Add a product to the catalogue' },
  { key: 'product.update', description: 'Edit a catalogue product and its default price' },
  {
    key: 'product.activate',
    description: 'Make a catalogue product available, or withdraw it',
  },
  {
    key: 'product.archive',
    description: 'Archive a catalogue product, removing it from every future campaign',
    sensitive: true,
  },

  // Which products a campaign offers, at what price. Separated from
  // `campaign.update` because the people who write FAQs and post progress
  // updates are usually not the people trusted to change a price.
  { key: 'campaign_product.view', description: 'View the products a campaign offers' },
  { key: 'campaign_product.add', description: 'Offer a catalogue product on a campaign' },
  {
    key: 'campaign_product.update',
    description: 'Change a campaign’s price or target for a product',
  },
  { key: 'campaign_product.remove', description: 'Stop offering a product on a campaign' },
  { key: 'campaign_product.activate', description: 'Make a product available' },
  { key: 'campaign_product.deactivate', description: 'Withdraw a product' },
  {
    key: 'campaign_product.adjust_provided',
    description: 'Correct a product’s provided quantity by hand',
    sensitive: true,
  },
  { key: 'campaign_update.create', description: 'Draft a campaign progress update' },
  { key: 'campaign_update.update', description: 'Edit a campaign progress update' },
  { key: 'campaign_update.publish', description: 'Publish a campaign progress update' },
  { key: 'campaign_faq.create', description: 'Add a campaign FAQ' },
  { key: 'campaign_faq.update', description: 'Edit or reorder a campaign FAQ' },
  { key: 'campaign_faq.delete', description: 'Remove a campaign FAQ' },
  { key: 'campaign_gallery.manage', description: 'Manage a campaign’s gallery' },
  { key: 'campaign_document.manage', description: 'Attach and manage campaign documents' },

  // Programs
  { key: 'program.read', description: 'View programs, including drafts' },
  { key: 'program.create', description: 'Create a program' },
  { key: 'program.update', description: 'Edit a program' },
  { key: 'program.publish', description: 'Publish or unpublish a program' },
  { key: 'program.archive', description: 'Archive a program', sensitive: true },

  // Categories — a lookup table an operator may extend.
  { key: 'category.read', description: 'View the category catalogue' },
  { key: 'category.manage', description: 'Create, edit and deactivate categories' },

  // Donations and payments
  { key: 'donation.read', description: 'View donations and aggregates' },
  {
    key: 'donation.reconcile',
    description: 'Reconcile a donation against the provider by re-fetching the payment',
    sensitive: true,
  },
  { key: 'donation.read_pii', description: 'View donor identity on a donation', sensitive: true },
  { key: 'donation.export', description: 'Export donation data', sensitive: true },
  { key: 'payment.read', description: 'View payment records' },
  { key: 'payment.manage', description: 'Reconcile and replay payment events', sensitive: true },
  /*
    RECEIPTS. Separate from `donation.read` because a receipt is a document
    that can be re-sent to a donor, which is a different act from looking at a
    donation row — and because reissuing one supersedes a financial record.

    There is no `receipt.delete`. A receipt is immutable; a wrong one is
    superseded by a corrected one that cites it.
  */
  { key: 'receipt.read', description: 'View issued receipts' },
  {
    key: 'receipt.resend',
    description: 'Send a receipt to the donor again',
    sensitive: true,
  },
  {
    key: 'receipt.reissue',
    description: 'Supersede a receipt with a corrected one',
    sensitive: true,
  },

  // Donors
  { key: 'donor.read', description: 'View donor records' },
  { key: 'donor.read_sensitive', description: 'View donor PAN and address', sensitive: true },
  { key: 'donor.update', description: 'Correct a donor record' },
  { key: 'donor.export', description: 'Export donor data', sensitive: true },
  { key: 'donor.delete', description: 'Redact a donor record', sensitive: true },

  // Volunteers
  { key: 'volunteer.read', description: 'View volunteers and applications' },
  { key: 'volunteer.read_documents', description: 'View volunteer ID documents', sensitive: true },
  { key: 'volunteer.update', description: 'Edit a volunteer record' },
  { key: 'volunteer.approve', description: 'Approve or reject an application', sensitive: true },
  { key: 'volunteer.suspend', description: 'Suspend a volunteer', sensitive: true },
  { key: 'volunteer.assign', description: 'Assign a volunteer to work' },
  { key: 'volunteer.attendance', description: 'Record and verify attendance' },
  { key: 'volunteer.export', description: 'Export volunteer data', sensitive: true },

  // Events
  { key: 'event.read', description: 'View events' },
  { key: 'event.manage', description: 'Create and edit events' },
  { key: 'event.registration.read', description: 'View attendee details', sensitive: true },
  { key: 'event.attendance', description: 'Record event attendance' },

  /*
    Team.

    TWO permissions, following `event.*` rather than the five the Phase 9 brief
    suggested. Publishing and archiving a team member are status changes on a
    record you are already allowed to edit — exactly as publishing an event is —
    and splitting them out would give an administrator four extra rows to reason
    about for one small CRUD screen.

    `content.*` was the other candidate, and it is too broad: it already governs
    pages and blog posts, and "can edit content" should not silently mean "can
    change who the organisation says its trustees are".
  */
  { key: 'team.read', description: 'View team members, including unpublished' },
  { key: 'team.manage', description: 'Create, edit, publish and archive team members' },

  // Impact and stories
  { key: 'impact.read', description: 'View impact records' },
  { key: 'impact.create', description: 'Create impact records' },
  /*
    Added in Phase 9, alongside `story.update`, which it mirrors.

    `impact.create` covering edits as well was the alternative, and it makes the
    wrong thing easy: these rows are the evidence behind published figures, and
    "may write a new draft" and "may rewrite a number that is already on the
    site" are not the same authority. Granted wherever `impact.create` is.
  */
  { key: 'impact.update', description: 'Edit impact records' },
  { key: 'impact.publish', description: 'Publish impact records' },
  /*
    `story.read` and `story.archive` were added in Phase 10.5, when the admin
    surface was actually built. The other three were catalogued in Phase 3 and
    sat unused for seven phases because nothing could write a story.

    `story.read` is separate from the public listing for a real reason: the
    admin list returns DRAFTS, and a draft about a named beneficiary who has
    not yet consented is precisely the thing the publish constraint exists to
    keep off the public site.

    ARCHIVE, NOT DELETE. `success_stories` has `deleted_at` and the status enum
    already carries `archived`; a story is somebody's account of their own life
    and the organisation holds a consent record against it. Destroying the row
    would destroy the evidence that consent was given, so there is deliberately
    no hard delete and no `story.delete` permission to imply one.
  */
  { key: 'story.read', description: 'View success stories, including drafts' },
  { key: 'story.create', description: 'Draft a success story' },
  { key: 'story.update', description: 'Edit a success story' },
  { key: 'story.publish', description: 'Publish a success story', sensitive: true },
  { key: 'story.archive', description: 'Archive a success story', sensitive: true },

  /*
    MEDIA, added in Phase 10.6 when the library was built. The table has
    existed since Phase 3 with no API and no permissions — media rows were
    created as a side effect of adding a campaign gallery image, by storage
    key, with nothing ever uploaded anywhere.

    `media.delete` is a HARD delete: `media` has no `deleted_at` column, so
    there is no archive state to move a row into. That is why deletion is
    reference-checked in the service rather than merely permissioned — the
    permission says who may try, and the reference check decides whether it is
    safe.
  */
  /*
    BLOG — the same five verbs as `story.*`, and for the same reasons.

    `content.*` exists and was rejected here exactly as it was rejected for
    stories: it already governs pages and site copy, so granting it to let
    somebody write an article would grant them the homepage as well.

    `blog.publish` and `blog.archive` are SENSITIVE because both change what
    the public sees. Publishing puts the organisation's name behind a claim;
    archiving removes an article that may already be linked from elsewhere.
    There is no `blog.delete`: archiving preserves the row, its audit trail and
    its slug, so a URL that was live never becomes a lie.
  */
  { key: 'blog.read', description: 'View blog posts, including drafts' },
  { key: 'blog.create', description: 'Draft a blog post' },
  { key: 'blog.update', description: 'Edit a blog post' },
  { key: 'blog.publish', description: 'Publish a blog post', sensitive: true },
  { key: 'blog.archive', description: 'Archive a blog post', sensitive: true },

  /*
    PAGES — the section composer, and the same five verbs again.

    `content.*` exists and is again the wrong tool: it already governs site
    copy generally, so granting it to let somebody reorder the homepage would
    grant them everything else content-shaped too.

    `page.publish` is SENSITIVE because the homepage is the most-read surface
    the organisation has, and a scheduled publish goes live without anybody
    present. `page.archive` is sensitive for the same reason in reverse.

    There is no `page.delete`. A page is soft-deleted at most; its revisions
    are the record of who changed the homepage and to what, and that record is
    worth more than a tidy table.
  */
  { key: 'page.read', description: 'View composed pages, including drafts' },
  { key: 'page.create', description: 'Create a composed page' },
  { key: 'page.update', description: 'Edit a page’s sections and order' },
  { key: 'page.publish', description: 'Publish or schedule a page', sensitive: true },
  { key: 'page.archive', description: 'Archive a page', sensitive: true },

  { key: 'media.read', description: 'View the media library' },
  { key: 'media.create', description: 'Upload media' },
  { key: 'media.update', description: 'Edit media metadata, including alt text and visibility' },
  { key: 'media.delete', description: 'Delete media', sensitive: true },

  // Content and documents
  { key: 'content.read', description: 'View content' },
  { key: 'content.create', description: 'Create content' },
  { key: 'content.update', description: 'Edit content' },
  { key: 'content.publish', description: 'Publish content' },
  { key: 'content.delete', description: 'Delete content', sensitive: true },
  { key: 'document.read', description: 'View public documents' },
  { key: 'document.read_private', description: 'View private documents', sensitive: true },
  { key: 'document.manage', description: 'Upload and edit documents' },
  { key: 'document.change_visibility', description: 'Change document visibility', sensitive: true },

  // Reports
  { key: 'reports.read', description: 'View reports and dashboards' },
  { key: 'reports.export', description: 'Export reports', sensitive: true },

  // System
  { key: 'user.read', description: 'View staff accounts' },
  { key: 'user.invite', description: 'Invite a staff member', sensitive: true },
  { key: 'user.update', description: 'Edit a staff account profile' },
  { key: 'user.suspend', description: 'Suspend a staff account', sensitive: true },
  { key: 'user.assign_role', description: 'Assign roles to a user', sensitive: true },
  { key: 'role.read', description: 'View roles and permissions' },
  { key: 'role.manage', description: 'Create and edit roles', sensitive: true },
  { key: 'settings.read', description: 'View settings' },
  { key: 'settings.update', description: 'Change settings', sensitive: true },
  { key: 'audit.read', description: 'View the audit log' },
  { key: 'audit.export', description: 'Export the audit log', sensitive: true },
  { key: 'notification.send', description: 'Send notifications', sensitive: true },

  /*
    Phase 10.11. `notification.send` already existed and stays SENSITIVE — it
    now governs re-sending a failed email, which puts a message in a real
    person's inbox and is the one action here with an outward effect.

    Reading the send log is separate because it is not: an administrator
    checking whether a receipt went out should not need a password prompt, or
    they will stop checking.
  */
  { key: 'notification.read', description: 'View notifications and the send log' },
  {
    key: 'notification.template.manage',
    description: 'Edit the wording of transactional emails',
  },
];

export interface RoleDefinition {
  key: string;
  name: string;
  description: string;
  priority: number;
  /** '*' grants every permission. */
  permissions: string[] | '*';
}

/**
 * Role bundles.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE ADMINISTRATIVE ROLE. THIS IS A DELIBERATE SIMPLIFICATION, NOT A GAP.
 *
 * There were six: SUPER_ADMIN, ADMIN, FINANCE_MANAGER, CAMPAIGN_MANAGER,
 * VOLUNTEER_MANAGER and CONTENT_MANAGER, each a curated bundle. They were
 * designed for an organisation with separate finance, programme and content
 * teams. Sailent Foundation is not that organisation — the same one or two
 * people do all of it — and five roles nobody occupies is five sets of grants
 * to keep correct, five ways for a permission to be missing from the role that
 * needed it, and a permissions matrix that has to be read before anybody can
 * be given access to anything.
 *
 * The three user types that actually exist are SUPER_ADMIN, DONOR and
 * VOLUNTEER. The last two are not roles in this table at all: a donor is a row
 * in `donors`, a volunteer is a row in `volunteers`, and neither authenticates
 * against `user_roles`.
 *
 * WHAT IS NOT LOST. The permission CATALOGUE is untouched — all 94 strings,
 * including the `sensitive` flags that drive re-authentication. Every guard
 * still resolves a permission string rather than a role name, so reintroducing
 * a narrower role later is a seed change and nothing else. Separation of duties
 * is available the moment it is wanted; it is simply not pretended at today.
 *
 * Migration `0014` reassigns existing staff to SUPER_ADMIN before removing the
 * others, so no user and no audit row is lost.
 * ══════════════════════════════════════════════════════════════════════════
 */
export const ROLES: RoleDefinition[] = [
  {
    key: 'SUPER_ADMIN',
    name: 'Super Admin',
    description:
      'Full administrative access. The only staff role — see the note above for why, and for what it would take to add a narrower one.',
    priority: 10,
    permissions: '*',
  },
];

/**
 * Roles this platform used to have, removed in Phase 8.
 *
 * Named here rather than only in a migration so that the seed can clean up a
 * database that predates the change, and so that a reader who finds
 * `CAMPAIGN_MANAGER` in an old audit row or an old document can see where it
 * went without excavating the migration history.
 */
export const RETIRED_ROLE_KEYS = [
  'ADMIN',
  'FINANCE_MANAGER',
  'CAMPAIGN_MANAGER',
  'VOLUNTEER_MANAGER',
  'CONTENT_MANAGER',
] as const;
