# Database Architecture — Sailent Foundation

**Phase:** 0 · **Date:** 19 September 2026
**Status:** Domain model only. **No migrations are written in this phase.**

PostgreSQL (Neon) accessed through Drizzle ORM from a long-lived NestJS process using a pooled TCP/WebSocket connection — *not* the HTTP serverless driver, which cannot run the multi-statement transactions this model depends on (decision A12).

---

## 1. Global conventions

| Convention | Rule |
|---|---|
| Primary keys | `uuid` v7 — time-ordered, so index locality is good and insert order is meaningful, without exposing a sequential count of donors. |
| Money | **`bigint` paise. Never `numeric`, never `float`** (A2). ₹900 = `90000`. Every money table carries `currency char(3)`, `'INR'` for v1. |
| Timestamps | `timestamptz`, always UTC. Application converts to IST for display. |
| Soft delete | `deleted_at timestamptz NULL` on content and catalogue entities. **Never on financial records** — donations, payments, receipts and audit logs are immutable history. |
| Audit columns | `created_at`, `updated_at`, `created_by`, `updated_by` on every operator-editable table. |
| Slugs | `citext UNIQUE` where publicly routable; slug history retained for redirects. |
| Enums | Postgres native enums for closed sets (statuses). Lookup tables for sets an operator may extend (categories, departments). |
| Naming | `snake_case`, plural tables, `{table}_id` foreign keys. |
| JSONB | Only for genuinely schemaless data — webhook payloads, audit diffs, section composer content, notification template variables. Never as a way to avoid designing a column. |

### 1.1 Why counters are denormalised

`campaigns.amount_raised`, `campaigns.donor_count` and `campaign_products.provided_quantity` duplicate information derivable from `donation_items`. This is deliberate (A6): they are written only inside the payment-capture transaction under row locks, and a nightly job recomputes and **alerts on** — never silently corrects — any drift. Silent correction hides the bug that caused the drift.

---

## 2. Data privacy classification

Every column carries one of four classifications. This table governs API serialisation, export permissions, and log redaction.

| Tier | Definition | Examples |
|---|---|---|
| **PUBLIC** | Safe on an unauthenticated page | Campaign title, goal, amount raised, programme description, published story, team member bio, public document |
| **PRIVATE** | The subject's own data; visible to them and to authorised staff | Donor name and email, donation history, volunteer profile, event registration |
| **SENSITIVE** | Restricted even within staff; access is logged | **PAN / tax ID**, postal address, phone number, volunteer ID documents, bank/settlement references, emergency contacts |
| **ADMIN-ONLY** | Never leaves the admin context under any configuration | Internal notes, audit logs, role assignments, reconciliation data, rejection reasons, raw webhook payloads |

**Hard rules.**

1. A donor's PAN, address and phone are **never** returned by any public endpoint, regardless of authentication. There is no configuration that exposes them.
2. An anonymous donation is anonymous **publicly only**. Finance can always identify the donor — that is a statutory requirement, not a choice, and the checkbox copy says so.
3. Volunteer ID documents live in a private R2 bucket reachable only through short-lived signed URLs issued after a permission check.
4. SENSITIVE fields are redacted in application logs and excluded from analytics payloads by a shared serialiser, not by per-endpoint discipline.
5. Every read of a SENSITIVE field in bulk (an export) is audited with the row count and filter used.

---

## 3. Identity and access

### `users`
Staff who operate the platform. **Not donors.**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `email` | citext unique | PRIVATE |
| `password_hash` | text | Argon2id. SENSITIVE, never serialised. |
| `full_name`, `avatar_url`, `phone` | | PRIVATE |
| `status` | enum | `invited, active, suspended, deactivated` |
| `totp_secret`, `totp_enabled` | text, bool | SENSITIVE. Mandatory for Super Admin, Admin, Finance Manager (A8). |
| `backup_codes` | text[] | Hashed. SENSITIVE. |
| `last_login_at`, `last_login_ip`, `failed_login_count`, `locked_until` | | |
| `must_change_password` | bool | |

Indexes: `email` unique, `status`.
Constraint: a database-level guard prevents deactivating the last active Super Admin.

### `roles`, `permissions`, `role_permissions`, `user_roles`

Roles are **bundles of permission strings**, editable by a Super Admin (A9).

- `roles` — `name`, `slug`, `description`, `is_system` (system roles cannot be deleted), `priority`.
- `permissions` — `slug` (`campaign.publish`), `resource`, `action`, `description`, `is_sensitive` (drives the re-authentication requirement).
- `role_permissions` — composite pk `(role_id, permission_id)`.
- `user_roles` — `(user_id, role_id)`, plus `granted_by`, `granted_at`. A user may hold multiple roles; effective permissions are the union.

Full catalogue in [`rbac.md`](rbac.md).

### `sessions`
Refresh-token family tracking. `user_id` *or* `donor_id` (exactly one, enforced by a `CHECK`), `token_family`, `token_hash`, `audience` (`donor` | `staff`), `expires_at`, `revoked_at`, `ip`, `user_agent`.

Reuse of a rotated token revokes the entire family and raises an alert — that is the standard detection for a stolen refresh token.

### `otp_codes`
`identifier` (phone), `code_hash`, `purpose`, `expires_at`, `attempts`, `consumed_at`, `ip`. Rate-limited per phone and per IP. Codes are hashed, never stored in plaintext.

---

## 4. Donors

### `donors`
Created by donations, not signups. A donor may exist having never logged in.

| Field | Type | Classification |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid null | Set when claimed via OTP |
| `donor_code` | text unique | `DNR-2026-00001`, for support reference |
| `full_name`, `email` | | PRIVATE |
| `phone` | text | **SENSITIVE** — the primary identity key |
| `donor_type` | enum | `individual, corporate, trust, anonymous_public` |
| `tax_id_type` | enum null | `pan, aadhaar, passport, driving_licence, voter_id, foreign_tin` |
| `tax_id_number` | text null | **SENSITIVE.** Encrypted at rest. Required for Form 10BD (A7). |
| `address_line1/2`, `city`, `state`, `postal_code`, `country` | | **SENSITIVE** |
| `total_donated`, `donation_count`, `first_donated_at`, `last_donated_at` | | Denormalised, maintained in the capture transaction |
| `is_recurring_donor` | bool | |
| `communication_consent`, `email_opt_in`, `sms_opt_in`, `whatsapp_opt_in` | bool | PRIVATE |
| `internal_notes` | text | **ADMIN-ONLY** |
| `source` | text | How they first arrived |

Indexes: `phone` unique (the deduplication key), `email`, `user_id`, `last_donated_at`, `(tax_id_number) WHERE tax_id_number IS NULL` — a partial index driving the "missing PAN before 31 May" compliance view.

Constraint: `tax_id_number` requires `tax_id_type`.

### `donor_preferences`
Per-donor communication and recognition settings: preferred programmes, contact frequency, `display_name_publicly`, `receipt_delivery` (email | post | both), preferred language.

---

## 5. Programmes and campaigns

### `programs`
Long-term initiatives. PUBLIC.

`name`, `slug`, `short_description`, `full_description` (rich text), `category`, `icon`, `cover_image_id`, `goals` (jsonb), `locations` (jsonb), `beneficiary_type`, `status` (`draft, published, archived`), `display_order`, `started_at`, SEO fields.

Denormalised rollups: `campaign_count`, `total_raised`, `beneficiaries_reached`.

### `campaigns`
Time-bound fundraising under a programme. Mostly PUBLIC; internal notes ADMIN-ONLY.

| Field | Type | Notes |
|---|---|---|
| `id`, `program_id`, `slug` | | Slug is `citext unique`; history retained |
| `title`, `short_description`, `full_description` | | PUBLIC |
| `category_id`, `location`, `state`, `city` | | PUBLIC |
| `starts_at`, `ends_at` | timestamptz | `ends_at` nullable — an open-ended campaign shows no countdown |
| `goal_amount` | bigint | Paise |
| `amount_raised` | bigint | **Derived-cached (A6)** |
| `donor_count` | integer | **Derived-cached** — distinct donors, not donations |
| `beneficiary_target`, `beneficiaries_reached` | integer | |
| `status` | enum | `draft, published, active, paused, completed, archived` |
| `pause_reason` | text | Shown publicly when paused — a pause without a reason reads as a problem |
| `stop_at_goal` | bool | Refuse donations once the goal is met |
| `allow_custom_amount`, `min_donation_amount` | bool, bigint | |
| `is_featured`, `featured_order`, `display_order` | | |
| `cover_image_id`, `video_url` | | |
| `internal_notes` | text | ADMIN-ONLY |
| `attributed_to` | uuid null | **Reserved for future P2P** — out of scope for v1, present so adding it later is not a migration of the donation table |
| SEO fields | | `meta_title`, `meta_description`, `og_image_id` |

Indexes: `slug` unique, `(status, ends_at)` for the default listing sort, `program_id`, `category_id`, `(state, city)`, `(is_featured, featured_order) WHERE is_featured`, full-text GIN over title + description.

Constraints: `goal_amount > 0`; `ends_at > starts_at`; `amount_raised >= 0`; publishing requires a cover image, a description and a goal (enforced in the application's publish-time schema, which is stricter than the draft schema).

### `campaign_products`
The product-donation catalogue. PUBLIC.

| Field | Type | Notes |
|---|---|---|
| `campaign_id` | uuid | |
| `name` | text | "School Kit" |
| `description` | text | **What the donor is buying, concretely.** Conversion depends on this. |
| `unit_amount` | bigint | Paise. ₹900 = `90000` |
| `target_quantity` | integer null | Null = open-ended |
| `provided_quantity` | integer | **Derived-cached (A6)** |
| `image_id`, `display_order` | | |
| `status` | enum | `active, inactive, fulfilled` |
| `max_per_donation` | integer | Default 999 |
| `sku` | text null | Optional internal reference |

Indexes: `(campaign_id, display_order)`, `(campaign_id, status)`.
Constraints: `unit_amount > 0`; `provided_quantity >= 0`; `target_quantity IS NULL OR target_quantity > 0`.

Note there is **no** `CHECK (provided_quantity <= target_quantity)` — over-subscription is allowed and shown honestly, and lowering a target below what has already been provided must not break the row.

### `campaign_updates`
Dated progress posts on a campaign: `title`, `body`, `published_at`, `author_id`, media relation. PUBLIC once published.

### `campaign_media`
Join to `media` with `role` (`cover, gallery, banner`) and `display_order`.

### `campaign_faqs`, `campaign_documents`
Per-campaign FAQs and attached documents. Documents inherit the visibility rules of §11.

---

## 6. Donations and payments

The financial core. **Nothing here is ever hard-deleted.**

### `donations`
The header (A5).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `reference` | text unique | Human-usable, e.g. `SF-D-7K2M9P`. Used in URLs and support conversations — never the uuid. |
| `donor_id` | uuid | Always set; created for guests |
| `campaign_id` | uuid null | Null = general donation to the organisation |
| `program_id` | uuid null | Set when given to a programme rather than a campaign |
| `subscription_id` | uuid null | Set for a recurring charge |
| `total_amount` | bigint | Paise. **Server-computed, never client-supplied.** |
| `currency` | char(3) | `INR` |
| `donation_type` | enum | `one_time, recurring` |
| `status` | enum | `pending, processing, successful, failed, cancelled` — the two `refunded` values were removed in Phase 7 |
| `is_anonymous` | bool | **Public display only** — Finance always sees the donor |
| `donor_message` | text | PRIVATE |
| `dedication` | jsonb null | In honour/memory of |
| `tax_id_captured` | bool | Denormalised for the 10BD readiness view |
| `receipt_id` | uuid null | |
| `source`, `utm_*` | | Attribution, no PII |
| `ip_country` | char(2) | **FCRA guard** — identifies a foreign contribution received in error |
| `completed_at`, `failed_reason` | | |

Indexes: `reference` unique, `donor_id`, `(campaign_id, status)`, `(status, created_at)`, `subscription_id`, `completed_at`, partial index on `status = 'pending'` for the reconciliation sweep.

Constraints: `total_amount > 0`; a campaign-bound donation must reference a campaign whose programme matches `program_id` when both are set.

### `donation_items`
The line items. This table is what makes hybrid donations work.

| Field | Type | Notes |
|---|---|---|
| `donation_id` | uuid | |
| `item_type` | enum | `product, custom` |
| `campaign_product_id` | uuid null | Null for a custom line |
| `item_name` | text | **Snapshot** of the product name at donation time (A5) |
| `quantity` | integer | 1 for a custom line |
| `unit_amount` | bigint | **Snapshot** of the price at donation time |
| `line_total` | bigint | `quantity × unit_amount`, stored |
| `fulfilled_quantity` | integer | Fulfilment tracking. `refunded_quantity` was dropped in Phase 7 |

Indexes: `donation_id`, `campaign_product_id`.
Constraints: `quantity > 0`; `unit_amount > 0`; `line_total = quantity * unit_amount`; a `product` line requires `campaign_product_id`, a `custom` line requires it to be null.

**The application asserts `SUM(line_total) = donations.total_amount` before insert, and the reconciliation job asserts it nightly.** Price snapshotting is why a price change next quarter never rewrites a receipt issued today.

### `payments`
One row per payment attempt against a donation.

`donation_id`, `razorpay_order_id`, `razorpay_payment_id`, `amount`, `currency`, `method` (`upi, card, netbanking, wallet, emandate`), `status` (`created, pending, processing, successful, failed, cancelled`), `captured_at`, `error_code`, `error_description`, `bank`, `wallet`, `vpa` (SENSITIVE), `card_last4`, `card_network`, `international` (bool — the FCRA guard), `fee`, `tax`, `raw_response` (jsonb, ADMIN-ONLY).

Indexes: `razorpay_payment_id` unique, `razorpay_order_id`, `donation_id`, `(status, created_at)`.

**The status column moves forward only.** The state machine in the application is the only writer.

### `payment_transactions`
An append-only ledger of every state change on a payment: `from_status`, `to_status`, `source` (`webhook, api_fetch, reconciliation, manual`), `actor_id`, `webhook_id`, `occurred_at`, `notes`. This is how "what happened to this payment, in order" is answered during an incident.

### `payment_webhooks`
The idempotency ledger (A4). **The most important table for financial correctness.**

| Field | Type | Notes |
|---|---|---|
| `razorpay_event_id` | text | **UNIQUE** — from the `x-razorpay-event-id` header. This constraint *is* the deduplication. |
| `event_type` | text | `payment.captured`, `subscription.charged`, … |
| `raw_body` | text | **The exact bytes received.** Signature verification needs them; incident forensics need them. ADMIN-ONLY. |
| `signature`, `signature_valid` | text, bool | |
| `headers` | jsonb | ADMIN-ONLY |
| `received_at`, `processed_at`, `processing_status`, `error` | | `pending, processed, failed, ignored` |
| `related_payment_id`, `related_subscription_id` | uuid null | Resolved during processing |

Indexes: `razorpay_event_id` unique, `(processing_status, received_at)`, `event_type`.

Retention: 24 months minimum. These rows are the evidence when a donor disputes what happened.

### `refunds` — removed

Dropped in Phase 7 (migration `0010`). The platform does not offer refunds, and
the `refunded` / `partially_refunded` values were removed from `donation_status`
and `payment_status` in the same migration. See `phase-7.md`.

---

## 7. Subscriptions

### `subscriptions`
`donor_id`, `campaign_id` (nullable), `program_id` (nullable), `razorpay_subscription_id` (unique), `razorpay_plan_id`, `amount`, `currency`, `interval` (`monthly, quarterly, yearly`), `status` (`created, authenticated, active, pending, halted, paused, cancelled, completed, expired`), `method` (`upi_autopay, emandate, card`), `started_at`, `next_charge_at`, `paused_at`, `cancelled_at`, `cancellation_reason`, `total_charged`, `charge_count`, `failed_charge_count`, `replaces_subscription_id` (nullable — amount changes require a new Razorpay subscription, and this preserves donor continuity in the UI).

Indexes: `razorpay_subscription_id` unique, `donor_id`, `(status, next_charge_at)`, partial index on `status = 'halted'` for the recovery queue.

### `subscription_items`
The line template a recurring gift charges each cycle (e.g. "1 × School Kit monthly"), so each charge produces the same line items rather than an undifferentiated amount.

### `subscription_payments`
Join between a subscription cycle and the donation it produced: `subscription_id`, `donation_id`, `payment_id`, `cycle_number`, `charged_at`, `status`.

---

## 8. Receipts and tax compliance

### `receipts`
`donation_id` (unique), `receipt_number` (**unique, gapless per financial year**, `SF/2026-27/000001`), `financial_year`, `issued_at`, `amount`, `donor_name_snapshot`, `donor_address_snapshot` (SENSITIVE), `tax_id_snapshot` (SENSITIVE), `pdf_object_key` (R2), `pdf_generated_at`, `email_sent_at`, `status` (`issued, void, reissued`), `void_reason`, `voided_by`, `replaces_receipt_id`.

Numbering comes from a per-financial-year Postgres sequence allocated **inside** the capture transaction, so concurrent captures cannot collide or skip.

Donor identity is **snapshotted** onto the receipt: a donor who later corrects their address does not retroactively change a receipt already issued and possibly already filed.

A voided receipt is retained and its number is never reused (A7).

### `tax_documents`
Form 10BE certificates and related statutory documents: `donor_id`, `financial_year`, `document_type` (`form_10be, form_80g_certificate, other`), `object_key`, `issued_at`, `uploaded_by`, `delivered_at`. SENSITIVE.

### `form_10bd_exports`
Audit trail of every 10BD export: `financial_year`, `generated_by`, `generated_at`, `record_count`, `total_amount`, `excluded_count` (donations without a tax ID), `object_key`, `filed_at`, `acknowledgement_number`.

Retaining the export that was actually filed — not just the ability to regenerate it — is what makes a future query from the Department answerable.

---

## 9. Volunteers

### `volunteers`
| Field | Notes |
|---|---|
| `user_id` (nullable), `donor_id` (nullable) | A volunteer is often also a donor |
| `volunteer_id` | text unique null — `VOL-2026-00001`. **Null until approved** (A13). Never reused. |
| `full_name`, `email` | PRIVATE |
| `phone`, `date_of_birth`, `gender`, address fields | **SENSITIVE** |
| `status` | enum `applied, under_review, approved, active, inactive, suspended, rejected, archived` |
| `approved_at`, `approved_by`, `status_reason` | `status_reason` is ADMIN-ONLY |
| `total_hours`, `verified_hours`, `assignment_count` | Derived-cached. **Certificates count `verified_hours` only.** |
| `emergency_contact_name`, `emergency_contact_phone` | **SENSITIVE** |
| `internal_notes` | **ADMIN-ONLY** — invisible to the volunteer |
| `is_public`, `public_bio` | For optional volunteer spotlights, consent-gated |

Indexes: `volunteer_id` unique, `phone` unique, `status`, `(status, created_at)` for the review queue.

### `volunteer_profiles`
`skills` (text[]), `experience`, `education`, `occupation`, `interests` (programme ids), `preferred_locations`, `availability` (jsonb — days, hours, remote/field), `languages`, `motivation`, `has_vehicle`, `photo_id`.

### `volunteer_applications`
The application as submitted, preserved separately from the living profile: `volunteer_id`, `submitted_at`, `form_data` (jsonb snapshot), `status`, `reviewed_by`, `reviewed_at`, `review_notes` (ADMIN-ONLY), `rejection_reason`, `interview_notes`, `cooling_period_until`.

Keeping the submission immutable means "what did they actually tell us" is answerable after the profile has been edited.

### `volunteer_documents`
`volunteer_id`, `document_type` (`id_proof, address_proof, certificate, resume, police_verification, other`), `object_key` (**private R2 bucket**), `file_name`, `mime_type`, `size_bytes`, `verification_status` (`pending, verified, rejected`), `verified_by`, `verified_at`, `expires_at`.

**SENSITIVE throughout.** Reachable only through short-lived signed URLs issued after a permission check, never a public URL. Verification status is admin-writable only.

### `volunteer_assignments`
`volunteer_id`, `assignable_type` (`event, project, campaign, program`), `assignable_id`, `role`, `starts_at`, `ends_at`, `status` (`assigned, confirmed, completed, cancelled, no_show`), `assigned_by`, `expected_hours`, `notes`.

### `volunteer_attendance`
`assignment_id`, `volunteer_id`, `date`, `check_in_at`, `check_out_at`, `duration_minutes`, `recorded_by`, `recording_method` (`manual, qr, self_reported`), `sync_status` (`synced, pending_sync` — offline capture), `verified_by`, `verified_at`, `notes`.

Unique on `(assignment_id, date)` to deduplicate offline replays.
Constraint: `check_out_at > check_in_at`.
**Volunteers cannot write this table.**

### `volunteer_hours`
Periodic aggregation: `volunteer_id`, `period_start`, `period_end`, `total_minutes`, `verified_minutes`, `source` (`attendance, manual_adjustment`), `adjusted_by`, `adjustment_reason`.

### `volunteer_certificates`
`volunteer_id`, `certificate_number` (unique), `certificate_type` (`participation, appreciation, completion, service`), `title`, `hours_credited`, `period_start`, `period_end`, `issued_at`, `issued_by`, `object_key`, `verification_code` (unique — supports a public `/verify/[code]` check so an employer can confirm a certificate is genuine), `status` (`issued, revoked`).

Constraint: issuing requires `hours_credited > 0`.

---

## 10. Team, programmes support, events, impact, stories

### `team_departments`
`name`, `slug`, `description`, `display_order`.

### `team_members`
`user_id` (nullable — a trustee need not have a login), `department_id`, `full_name`, `designation`, `bio`, `photo_id`, `email_public`, `social_links` (jsonb), `display_order`, `is_public`, `joined_at`, `member_type` (`staff, trustee, advisor, board`).

Only `is_public = true` rows appear on `/team`. Hiding never deletes.

### `events`
`title`, `slug`, `description`, `event_type`, `program_id`, `campaign_id`, `starts_at`, `ends_at`, `timezone`, `venue_name`, `address`, `city`, `state`, `is_online`, `meeting_url` (PRIVATE, released only to registrants), `capacity`, `registered_count` (derived-cached), `waitlist_count`, `registration_opens_at`, `registration_closes_at`, `status` (`draft, published, registration_open, registration_closed, ongoing, completed, cancelled`), `cover_image_id`, `requires_volunteers`, `volunteer_slots`.

Indexes: `slug` unique, `(status, starts_at)`, `program_id`.

### `event_registrations`
`event_id`, `donor_id` (nullable), `volunteer_id` (nullable), `full_name`, `email`, `phone` (SENSITIVE), `attendee_count`, `status` (`registered, waitlisted, confirmed, attended, no_show, cancelled`), `custom_fields` (jsonb), `registered_at`, `confirmed_at`, `attended_at`, `cancellation_reason`.

Unique on `(event_id, email)` to prevent duplicate registration.
Capacity is enforced under a row lock on `events`, the same pattern as product quantity (A6).

### `impact_records`
The backbone of decision A14 — no public number without a record behind it.

`title`, `description`, `metric_type` (`beneficiaries, meals, kits, trees, hours, students, patients, other`), `metric_value`, `metric_unit`, `program_id`, `campaign_id`, `event_id`, `location`, `state`, `city`, `latitude`, `longitude`, `occurred_on` (**date — a claim without a date is not a claim**), `verification_method` (how this number was arrived at), `verified_by`, `evidence_document_id`, `is_public`, `published_at`.

Indexes: `(program_id, occurred_on)`, `(campaign_id, occurred_on)`, `(is_public, published_at)`, `metric_type`.

### `impact_updates`
Narrative updates with media: `title`, `body`, `campaign_id`, `program_id`, `occurred_on`, `location`, media relation, `is_public`, `published_at`, `author_id`. These are what a donor sees on `/account/impact` for campaigns they funded.

### `stories`
Success stories in the structured form the brief specifies: `title`, `slug`, `subject_name`, `subject_age`, `location`, `summary`, **`challenge`, `intervention`, `journey`, `outcome`, `impact`** (five rich-text sections), `program_id`, `campaign_id`, `cover_image_id`, `video_url`, `consent_obtained` (bool), `consent_document_id`, `is_anonymised`, `status`, `published_at`, `author_id`, SEO fields.

**Constraint: a story naming an identifiable person cannot be published without `consent_obtained = true`.** Publishing a beneficiary's story and photograph without recorded consent is the most serious reputational and ethical risk in this entire product, and it is cheap to prevent in the schema.

---

## 11. Content, media and documents

### `pages`
The section-composed pages (homepage and marketing pages only — the confirmed CMS model).

`slug`, `title`, `sections` (jsonb — an **ordered array of `{ type, props }` where `type` must be one of the approved section components**), `status`, `published_at`, `scheduled_at`, SEO fields, `version`, `updated_by`.

The jsonb is validated against a Zod schema in `packages/validation` at write time. An unknown section type is rejected. This is what keeps a composer from becoming an unconstrained page builder.

### `page_revisions`
Snapshot of `sections` and metadata per save, with `created_by`. Enables revert and answers "who changed the homepage".

### `blogs`, `blog_categories`, `blog_tags`, `blog_post_tags`
`title`, `slug`, `excerpt`, `content`, `author_id`, `category_id`, `cover_image_id`, `status`, `published_at`, `scheduled_at`, `reading_minutes`, `view_count`, SEO fields.

### `faqs`
`question`, `answer`, `category`, `context_type` (`general, donation, volunteer, campaign, event`), `context_id` (nullable — a campaign-specific FAQ), `display_order`, `is_published`.

### `media`
The single media library. `object_key` (R2), `file_name`, `mime_type`, `size_bytes`, `width`, `height`, `blurhash`, **`alt_text`**, `caption`, `credit`, `folder_id`, `uploaded_by`, `usage_count`.

**Publishing content whose images lack `alt_text` is blocked** — accessibility enforced at the data layer rather than left to reviewer diligence.

### `documents`
The public/private boundary, and it must be explicit.

`title`, `description`, `document_type` (`annual_report, audited_financial, impact_report, policy, registration, utilization_report, internal, other`), `object_key`, `file_name`, `mime_type`, `size_bytes`, **`visibility`** (`public, private, restricted`), `financial_year`, `published_at`, `uploaded_by`, `related_type`, `related_id`, `download_count`.

- `public` → served from a public R2 bucket. Reachable only where a document is explicitly attached to a campaign; there is no public document library (the `/transparency` and `/reports` pages were removed in Phase 7).
- `private` → private bucket, signed URLs only, permission-checked.
- `restricted` → private bucket, additionally limited to named roles.

**Changing visibility requires re-authentication and is audited** (A9). A private document promoted to public by accident is a data breach; a confirmation step is cheap.

### `galleries`, `gallery_items` — never built, and now dropped

Designed in Phase 0 as albums referencing `media`. Never implemented, and Phase 7 removed the standalone gallery from the product, so they will not be.

Campaign-attached media is `campaign_gallery` (a junction onto `media`); events and success stories carry their own `gallery` JSON column. Those stay.

---

## 12. Notifications, settings, audit

### `notification_templates`
`slug`, `name`, `channel` (`email, sms, whatsapp, in_app`), `subject`, `body_html`, `body_text`, `variables` (jsonb schema of expected variables), `brevo_template_id`, `is_active`, `version`.

### `notifications`
In-app and queued sends: `recipient_type` (`user, donor, volunteer`), `recipient_id`, `template_id`, `channel`, `subject`, `body`, `data` (jsonb), `status` (`queued, sent, delivered, failed, bounced, read`), `sent_at`, `delivered_at`, `read_at`, `error`, `provider_message_id`, `retry_count`.

Indexes: `(recipient_type, recipient_id, read_at)`, `(status, created_at)`.

### `newsletter_subscribers`
`email`, `name`, `status` (`pending, subscribed, unsubscribed, bounced`), `confirmed_at` (double opt-in), `unsubscribed_at`, `source`, `unsubscribe_token`.

### `settings`
`key`, `value` (jsonb), `category`, `description`, `is_public`, `updated_by`. Organisation identity, registration numbers, donation minimums, feature flags — including **`fcra_enabled: false`**, the documented gate from product-requirements §6.

### `audit_logs`
Append-only (A10). **`INSERT` and `SELECT` only; the application's DB role has no `UPDATE` or `DELETE` on this table.**

`actor_type` (`user, donor, volunteer, system, webhook`), `actor_id`, `actor_email_snapshot`, `action`, `resource_type`, `resource_id`, `changes` (jsonb — `{ before, after }`), `metadata` (jsonb), `ip_address`, `user_agent`, `request_id`, `severity` (`info, warning, critical`), `created_at`.

Indexes: `(resource_type, resource_id, created_at)`, `(actor_id, created_at)`, `(action, created_at)`, `(severity, created_at) WHERE severity = 'critical'`.

Partitioned by month once volume warrants it.

---

## 13. Relationship overview

```
programs ──< campaigns ──< campaign_products
                │                  │
                │                  └──< donation_items >── donations
                │                                             │
                ├──< campaign_updates                         ├── payments ──< payment_transactions
                ├──< campaign_media >── media                 │        │
                ├──< campaign_faqs                            │
                └──< campaign_documents >── documents         │
                                                              ├── receipts
donors ──< donations                                          │
   │   ──< subscriptions ──< subscription_payments ───────────┘
   │   ──< donor_preferences                        payment_webhooks (idempotency ledger)
   │   ──< tax_documents
   └─ (nullable) users

users ──< user_roles >── roles ──< role_permissions >── permissions
  │
  └──< sessions >── donors

volunteers ──< volunteer_profiles
           ──< volunteer_applications
           ──< volunteer_documents
           ──< volunteer_assignments ──< volunteer_attendance
           ──< volunteer_hours
           ──< volunteer_certificates

events ──< event_registrations
       ──< volunteer_assignments

impact_records / impact_updates ── program / campaign / event
stories ── program / campaign

pages ──< page_revisions        blogs >── blog_categories, blog_tags
media ──< galleries             documents (public | private | restricted)

audit_logs ── everything
```

---

## 14. Indexing summary

Beyond primary and foreign keys, the indexes that matter for the queries this product actually runs:

| Purpose | Index |
|---|---|
| Campaign listing (default sort) | `campaigns (status, ends_at) WHERE deleted_at IS NULL` |
| Featured campaigns | `campaigns (is_featured, featured_order) WHERE is_featured` |
| Campaign search | GIN full-text on `title || short_description || full_description` |
| Donor deduplication | `donors (phone) UNIQUE` |
| 10BD readiness | `donors (id) WHERE tax_id_number IS NULL` (partial) |
| Donation reconciliation | `donations (status, created_at) WHERE status IN ('pending','processing')` |
| Webhook idempotency | `payment_webhooks (razorpay_event_id) UNIQUE` |
| Webhook processing queue | `payment_webhooks (processing_status, received_at)` |
| Subscription charge scheduling | `subscriptions (status, next_charge_at)` |
| Subscription recovery | `subscriptions (id) WHERE status = 'halted'` (partial) |
| Volunteer review queue | `volunteers (status, created_at) WHERE status IN ('applied','under_review')` |
| Attendance deduplication | `volunteer_attendance (assignment_id, date) UNIQUE` |
| Event capacity | `event_registrations (event_id, status)` |
| Public impact | `impact_records (is_public, published_at)` |
| Audit lookup | `audit_logs (resource_type, resource_id, created_at)` |

---

## 15. Constraints that encode product rules

Rules worth enforcing in the database rather than only in application code, because the database is the last line of defence:

1. `donation_items.line_total = quantity * unit_amount` — arithmetic cannot drift.
2. `quantity > 0` on `donation_items` — negative quantities are structurally impossible, not merely validated.
3. `unit_amount > 0`, `total_amount > 0` — no zero or negative donations.
4. `receipts.receipt_number UNIQUE` per financial year — gapless numbering.
5. `payment_webhooks.razorpay_event_id UNIQUE` — idempotency (A4).
6. `volunteers.volunteer_id UNIQUE` — permanent identity (A13).
7. `volunteer_attendance (assignment_id, date) UNIQUE` — offline replays deduplicate.
8. `event_registrations (event_id, email) UNIQUE` — no duplicate registration.
9. `stories`: publish blocked without `consent_obtained` — ethical guard.
10. `sessions`: exactly one of `user_id` / `donor_id` — audiences cannot merge (A8).
11. At least one active Super Admin at all times.
12. ~~`refunds.approved_by <> initiated_by`~~ — the `refunds` table was dropped in Phase 7.

---

*Related: [`phase-0-decisions.md`](phase-0-decisions.md) · [`api-architecture.md`](api-architecture.md) · [`security-architecture.md`](security-architecture.md)*
