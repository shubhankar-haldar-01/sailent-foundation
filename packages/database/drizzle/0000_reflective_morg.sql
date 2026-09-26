CREATE TYPE "public"."audit_actor_type" AS ENUM('user', 'donor', 'volunteer', 'system', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."audit_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."campaign_product_status" AS ENUM('active', 'inactive', 'fulfilled');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'published', 'active', 'paused', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('annual_report', 'financial', 'impact_report', 'utilisation', 'policy', 'registration', 'internal', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_visibility" AS ENUM('public', 'private', 'admin_only');--> statement-breakpoint
CREATE TYPE "public"."donation_status" AS ENUM('pending', 'processing', 'successful', 'failed', 'refunded', 'partially_refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."donation_type" AS ENUM('one_time', 'monthly', 'product', 'hybrid', 'custom');--> statement-breakpoint
CREATE TYPE "public"."donor_type" AS ENUM('individual', 'corporate', 'trust');--> statement-breakpoint
CREATE TYPE "public"."event_registration_status" AS ENUM('open', 'closed', 'full', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms', 'whatsapp', 'push', 'in_app');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed', 'read');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('upi', 'card', 'netbanking', 'wallet', 'emandate');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('razorpay');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'pending', 'processing', 'successful', 'failed', 'cancelled', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."publish_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."subscription_frequency" AS ENUM('monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('created', 'authenticated', 'active', 'paused', 'pending', 'halted', 'cancelled', 'completed', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tax_id_type" AS ENUM('pan', 'aadhaar', 'passport', 'driving_licence', 'voter_id', 'foreign_tin');--> statement-breakpoint
CREATE TYPE "public"."team_member_type" AS ENUM('staff', 'trustee', 'advisor', 'board');--> statement-breakpoint
CREATE TYPE "public"."token_audience" AS ENUM('donor', 'staff');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('invited', 'active', 'inactive', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."volunteer_status" AS ENUM('applied', 'under_review', 'approved', 'active', 'inactive', 'suspended', 'rejected', 'archived');--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"purpose" varchar(40) NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"donor_id" uuid,
	"audience" "token_audience" NOT NULL,
	"token_family" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" varchar(64),
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_one_subject" CHECK ((user_id IS NOT NULL AND donor_id IS NULL) OR (user_id IS NULL AND donor_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text,
	"first_name" varchar(120) NOT NULL,
	"last_name" varchar(120),
	"phone" varchar(20),
	"avatar_url" text,
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"backup_codes" text[],
	"last_login_at" timestamp with time zone,
	"last_login_ip" varchar(45),
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(96) NOT NULL,
	"resource" varchar(48) NOT NULL,
	"action" varchar(48) NOT NULL,
	"description" text,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "donors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"donor_code" varchar(24) NOT NULL,
	"first_name" varchar(120) NOT NULL,
	"last_name" varchar(120),
	"email" varchar(255),
	"phone" varchar(20) NOT NULL,
	"donor_type" "donor_type" DEFAULT 'individual' NOT NULL,
	"tax_id_type" "tax_id_type",
	"tax_id_number" text,
	"address_line1" varchar(255),
	"address_line2" varchar(255),
	"city" varchar(120),
	"state" varchar(120),
	"postal_code" varchar(16),
	"country" varchar(2) DEFAULT 'IN' NOT NULL,
	"total_donated" bigint DEFAULT 0 NOT NULL,
	"donation_count" integer DEFAULT 0 NOT NULL,
	"first_donated_at" timestamp with time zone,
	"last_donated_at" timestamp with time zone,
	"is_recurring_donor" boolean DEFAULT false NOT NULL,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"communication_consent" boolean DEFAULT false NOT NULL,
	"email_opt_in" boolean DEFAULT false NOT NULL,
	"sms_opt_in" boolean DEFAULT false NOT NULL,
	"whatsapp_opt_in" boolean DEFAULT false NOT NULL,
	"internal_notes" text,
	"source" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donors_tax_id_type_required" CHECK (tax_id_number IS NULL OR tax_id_type IS NOT NULL),
	CONSTRAINT "donors_total_donated_non_negative" CHECK (total_donated >= 0)
);
--> statement-breakpoint
CREATE TABLE "volunteers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"donor_id" uuid,
	"volunteer_id" varchar(24),
	"first_name" varchar(120) NOT NULL,
	"last_name" varchar(120),
	"email" varchar(255),
	"phone" varchar(20) NOT NULL,
	"photo_url" text,
	"date_of_birth" date,
	"address_line1" varchar(255),
	"city" varchar(120),
	"state" varchar(120),
	"postal_code" varchar(16),
	"education" varchar(255),
	"occupation" varchar(255),
	"experience" text,
	"languages" text[],
	"skills" text[],
	"interests" text[],
	"availability" jsonb,
	"emergency_contact_name" varchar(160),
	"emergency_contact_phone" varchar(20),
	"status" "volunteer_status" DEFAULT 'applied' NOT NULL,
	"status_reason" text,
	"internal_notes" text,
	"joining_date" date,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"total_hours" integer DEFAULT 0 NOT NULL,
	"verified_hours" integer DEFAULT 0 NOT NULL,
	"assignment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "volunteers_hours_non_negative" CHECK (total_hours >= 0 AND verified_hours >= 0 AND verified_hours <= total_hours),
	CONSTRAINT "volunteers_id_requires_approval" CHECK ((volunteer_id IS NULL AND status IN ('applied','under_review','rejected')) OR (volunteer_id IS NOT NULL AND status NOT IN ('applied','under_review','rejected')))
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" varchar(160) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"photo_url" text,
	"designation" varchar(160) NOT NULL,
	"department" varchar(120),
	"member_type" "team_member_type" DEFAULT 'staff' NOT NULL,
	"bio" text,
	"experience" text,
	"social_links" jsonb,
	"email_public" varchar(255),
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"display_order" integer DEFAULT 100 NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"tagline" varchar(255),
	"short_description" text,
	"description" text,
	"cover_image" text,
	"category" varchar(80),
	"goals" jsonb,
	"beneficiaries" text,
	"locations" jsonb,
	"impact_summary" text,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"display_order" integer DEFAULT 100 NOT NULL,
	"published_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"campaign_count" integer DEFAULT 0 NOT NULL,
	"total_raised" bigint DEFAULT 0 NOT NULL,
	"beneficiaries_reached" integer DEFAULT 0 NOT NULL,
	"meta_title" varchar(200),
	"meta_description" varchar(400),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "campaign_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"description" text NOT NULL,
	"image" text,
	"price" bigint NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"target_quantity" integer,
	"fulfilled_quantity" integer DEFAULT 0 NOT NULL,
	"max_per_donation" integer DEFAULT 999 NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"status" "campaign_product_status" DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sku" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "campaign_products_price_positive" CHECK (price > 0),
	CONSTRAINT "campaign_products_fulfilled_non_negative" CHECK (fulfilled_quantity >= 0),
	CONSTRAINT "campaign_products_target_non_negative" CHECK (target_quantity IS NULL OR target_quantity >= 0),
	CONSTRAINT "campaign_products_max_per_donation_positive" CHECK (max_per_donation > 0)
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid,
	"title" varchar(240) NOT NULL,
	"slug" varchar(240) NOT NULL,
	"short_description" text,
	"description" text,
	"beneficiary_context" text,
	"cover_image" text,
	"gallery" jsonb,
	"category" varchar(80),
	"location" varchar(160),
	"state" varchar(120),
	"city" varchar(120),
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"fundraising_goal" bigint NOT NULL,
	"amount_raised" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"donor_count" integer DEFAULT 0 NOT NULL,
	"beneficiary_target" integer,
	"beneficiaries_reached" integer DEFAULT 0 NOT NULL,
	"fund_utilization" jsonb,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"pause_reason" text,
	"stop_at_goal" boolean DEFAULT false NOT NULL,
	"allow_custom_amount" boolean DEFAULT true NOT NULL,
	"min_donation_amount" bigint DEFAULT 1000 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"featured_order" integer,
	"attributed_to" uuid,
	"internal_notes" text,
	"meta_title" varchar(240),
	"meta_description" varchar(400),
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "campaigns_goal_positive" CHECK (fundraising_goal > 0),
	CONSTRAINT "campaigns_raised_non_negative" CHECK (amount_raised >= 0),
	CONSTRAINT "campaigns_donor_count_non_negative" CHECK (donor_count >= 0),
	CONSTRAINT "campaigns_dates_ordered" CHECK (end_date IS NULL OR start_date IS NULL OR end_date > start_date)
);
--> statement-breakpoint
CREATE TABLE "success_stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(240) NOT NULL,
	"slug" varchar(240) NOT NULL,
	"excerpt" text,
	"content" text,
	"cover_image" text,
	"gallery" jsonb,
	"category" varchar(80),
	"subject_name" varchar(160),
	"location" varchar(160),
	"challenge" text,
	"intervention" text,
	"journey" text,
	"outcome" text,
	"impact" text,
	"program_id" uuid,
	"campaign_id" uuid,
	"consent_obtained" boolean DEFAULT false NOT NULL,
	"consent_document_id" uuid,
	"is_anonymised" boolean DEFAULT false NOT NULL,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"author_id" uuid,
	"meta_title" varchar(240),
	"meta_description" varchar(400),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "success_stories_consent_before_publish" CHECK (status <> 'published' OR subject_name IS NULL OR is_anonymised = true OR consent_obtained = true)
);
--> statement-breakpoint
CREATE TABLE "impact_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid,
	"program_id" uuid,
	"title" varchar(240) NOT NULL,
	"description" text NOT NULL,
	"images" jsonb,
	"videos" jsonb,
	"documents" jsonb,
	"location" varchar(160),
	"state" varchar(120),
	"impact_date" date NOT NULL,
	"statistics" jsonb,
	"metric_type" varchar(48),
	"metric_value" integer,
	"metric_unit" varchar(32),
	"verification_method" text,
	"verified_by" uuid,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "impact_updates_metric_non_negative" CHECK (metric_value IS NULL OR metric_value >= 0),
	CONSTRAINT "impact_updates_has_parent" CHECK (campaign_id IS NOT NULL OR program_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"donor_id" uuid,
	"volunteer_id" uuid,
	"full_name" varchar(200) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"attendee_count" integer DEFAULT 1 NOT NULL,
	"status" varchar(16) DEFAULT 'registered' NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attended_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_registrations_attendees_positive" CHECK (attendee_count > 0)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(240) NOT NULL,
	"slug" varchar(240) NOT NULL,
	"summary" text,
	"description" text,
	"cover_image" text,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"timezone" varchar(64) DEFAULT 'Asia/Kolkata' NOT NULL,
	"venue_name" varchar(200),
	"location" varchar(255),
	"address" text,
	"city" varchar(120),
	"state" varchar(120),
	"is_online" boolean DEFAULT false NOT NULL,
	"meeting_url" text,
	"capacity" integer,
	"registered_count" integer DEFAULT 0 NOT NULL,
	"waitlist_count" integer DEFAULT 0 NOT NULL,
	"registration_status" "event_registration_status" DEFAULT 'open' NOT NULL,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"program_id" uuid,
	"campaign_id" uuid,
	"requires_volunteers" boolean DEFAULT false NOT NULL,
	"volunteer_slots" integer,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "events_capacity_non_negative" CHECK (capacity IS NULL OR capacity >= 0),
	CONSTRAINT "events_counts_non_negative" CHECK (registered_count >= 0 AND waitlist_count >= 0),
	CONSTRAINT "events_dates_ordered" CHECK (end_date IS NULL OR end_date >= start_date)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(240) NOT NULL,
	"description" text,
	"file_url" text,
	"file_key" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(127) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"document_type" "document_type" DEFAULT 'other' NOT NULL,
	"visibility" "document_visibility" DEFAULT 'private' NOT NULL,
	"financial_year" varchar(9),
	"related_type" varchar(48),
	"related_id" uuid,
	"uploaded_by" uuid,
	"published_at" timestamp with time zone,
	"download_count" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_size_positive" CHECK (size_bytes > 0),
	CONSTRAINT "documents_url_only_when_public" CHECK (file_url IS NULL OR visibility = 'public')
);
--> statement-breakpoint
CREATE TABLE "donation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donation_id" uuid NOT NULL,
	"campaign_product_id" uuid,
	"item_type" varchar(16) DEFAULT 'product' NOT NULL,
	"item_name" varchar(160) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" bigint NOT NULL,
	"total_price" bigint NOT NULL,
	"fulfilled_quantity" integer DEFAULT 0 NOT NULL,
	"refunded_quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donation_items_quantity_positive" CHECK (quantity > 0),
	CONSTRAINT "donation_items_unit_price_positive" CHECK (unit_price > 0),
	CONSTRAINT "donation_items_total_matches" CHECK (total_price = quantity * unit_price),
	CONSTRAINT "donation_items_refunded_within_quantity" CHECK (refunded_quantity >= 0 AND refunded_quantity <= quantity),
	CONSTRAINT "donation_items_type_consistent" CHECK ((item_type = 'product' AND campaign_product_id IS NOT NULL) OR (item_type = 'custom' AND campaign_product_id IS NULL))
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(24) NOT NULL,
	"donor_id" uuid,
	"campaign_id" uuid,
	"program_id" uuid,
	"subscription_id" uuid,
	"donation_type" "donation_type" DEFAULT 'one_time' NOT NULL,
	"amount" bigint NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"status" "donation_status" DEFAULT 'pending' NOT NULL,
	"provider" varchar(32),
	"provider_transaction_id" varchar(128),
	"anonymous" boolean DEFAULT false NOT NULL,
	"donor_message" text,
	"dedication" jsonb,
	"tax_id_captured" boolean DEFAULT false NOT NULL,
	"receipt_id" uuid,
	"ip_country" varchar(2),
	"source" varchar(64),
	"utm_source" varchar(120),
	"utm_medium" varchar(120),
	"utm_campaign" varchar(120),
	"donation_date" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"failed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donations_amount_positive" CHECK (amount > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"from_status" "payment_status",
	"to_status" "payment_status" NOT NULL,
	"source" varchar(24) NOT NULL,
	"actor_id" uuid,
	"notes" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "payment_provider" DEFAULT 'razorpay' NOT NULL,
	"provider_event_id" varchar(128) NOT NULL,
	"event_type" varchar(96) NOT NULL,
	"raw_body" text NOT NULL,
	"signature" varchar(256),
	"signature_valid" boolean DEFAULT false NOT NULL,
	"headers" jsonb,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_status" varchar(16) DEFAULT 'pending' NOT NULL,
	"error" text,
	"related_payment_id" uuid,
	"related_subscription_id" uuid
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donation_id" uuid NOT NULL,
	"provider" "payment_provider" DEFAULT 'razorpay' NOT NULL,
	"provider_order_id" varchar(128),
	"provider_payment_id" varchar(128),
	"provider_signature" varchar(256),
	"amount" bigint NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"method" "payment_method",
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"paid_at" timestamp with time zone,
	"failure_reason" text,
	"error_code" varchar(64),
	"bank" varchar(64),
	"wallet" varchar(64),
	"card_last4" varchar(4),
	"card_network" varchar(32),
	"is_international" boolean DEFAULT false NOT NULL,
	"fee" bigint,
	"tax" bigint,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK (amount > 0)
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"donation_id" uuid NOT NULL,
	"provider_refund_id" varchar(128),
	"amount" bigint NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"initiated_by" uuid,
	"approved_by" uuid,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_amount_positive" CHECK (amount > 0),
	CONSTRAINT "refunds_separation_of_duties" CHECK (approved_by IS NULL OR initiated_by IS NULL OR approved_by <> initiated_by)
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donor_id" uuid NOT NULL,
	"campaign_id" uuid,
	"program_id" uuid,
	"provider" "payment_provider" DEFAULT 'razorpay' NOT NULL,
	"provider_subscription_id" varchar(128),
	"provider_plan_id" varchar(128),
	"amount" bigint NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"frequency" "subscription_frequency" DEFAULT 'monthly' NOT NULL,
	"method" "payment_method",
	"status" "subscription_status" DEFAULT 'created' NOT NULL,
	"started_at" timestamp with time zone,
	"next_billing_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"total_charged" bigint DEFAULT 0 NOT NULL,
	"charge_count" integer DEFAULT 0 NOT NULL,
	"failed_charge_count" integer DEFAULT 0 NOT NULL,
	"replaces_subscription_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_amount_positive" CHECK (amount > 0),
	CONSTRAINT "subscriptions_counts_non_negative" CHECK (charge_count >= 0 AND failed_charge_count >= 0 AND total_charged >= 0)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"recipient_type" varchar(16) DEFAULT 'user' NOT NULL,
	"recipient_id" uuid,
	"type" varchar(64) NOT NULL,
	"title" varchar(240) NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"channel" "notification_channel" DEFAULT 'in_app' NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"error" text,
	"provider_message_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" "audit_actor_type" DEFAULT 'user' NOT NULL,
	"user_id" uuid,
	"actor_email_snapshot" varchar(255),
	"action" varchar(96) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" uuid,
	"old_values" jsonb,
	"new_values" jsonb,
	"reason" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"request_id" varchar(64),
	"severity" "audit_severity" DEFAULT 'info' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(128) NOT NULL,
	"value" jsonb NOT NULL,
	"category" varchar(64) DEFAULT 'general' NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donors" ADD CONSTRAINT "donors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_products" ADD CONSTRAINT "campaign_products_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "success_stories" ADD CONSTRAINT "success_stories_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "success_stories" ADD CONSTRAINT "success_stories_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "success_stories" ADD CONSTRAINT "success_stories_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_updates" ADD CONSTRAINT "impact_updates_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_updates" ADD CONSTRAINT "impact_updates_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_updates" ADD CONSTRAINT "impact_updates_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_volunteer_id_volunteers_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "public"."volunteers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation_items" ADD CONSTRAINT "donation_items_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation_items" ADD CONSTRAINT "donation_items_campaign_product_id_campaign_products_id_fk" FOREIGN KEY ("campaign_product_id") REFERENCES "public"."campaign_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhooks" ADD CONSTRAINT "payment_webhooks_related_payment_id_payments_id_fk" FOREIGN KEY ("related_payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "otp_identifier_purpose_idx" ON "otp_codes" USING btree ("identifier","purpose");--> statement-breakpoint
CREATE INDEX "otp_expires_idx" ON "otp_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_family_idx" ON "sessions" USING btree ("token_family");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_donor_idx" ON "sessions" USING btree ("donor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_key_unique" ON "permissions" USING btree ("key");--> statement-breakpoint
CREATE INDEX "permissions_resource_idx" ON "permissions" USING btree ("resource");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_key_unique" ON "roles" USING btree ("key");--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "donors_phone_unique" ON "donors" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "donors_code_unique" ON "donors" USING btree ("donor_code");--> statement-breakpoint
CREATE INDEX "donors_email_idx" ON "donors" USING btree ("email");--> statement-breakpoint
CREATE INDEX "donors_user_idx" ON "donors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "donors_last_donated_idx" ON "donors" USING btree ("last_donated_at");--> statement-breakpoint
CREATE INDEX "donors_created_idx" ON "donors" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "donors_missing_tax_id_idx" ON "donors" USING btree ("id") WHERE tax_id_number IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "volunteers_volunteer_id_unique" ON "volunteers" USING btree ("volunteer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "volunteers_phone_unique" ON "volunteers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "volunteers_status_idx" ON "volunteers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "volunteers_review_queue_idx" ON "volunteers" USING btree ("status","created_at") WHERE status IN ('applied', 'under_review');--> statement-breakpoint
CREATE INDEX "team_members_slug_idx" ON "team_members" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "team_members_public_idx" ON "team_members" USING btree ("is_public","display_order");--> statement-breakpoint
CREATE INDEX "team_members_department_idx" ON "team_members" USING btree ("department");--> statement-breakpoint
CREATE UNIQUE INDEX "programs_slug_unique" ON "programs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "programs_status_idx" ON "programs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "programs_category_idx" ON "programs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "programs_created_idx" ON "programs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "programs_display_order_idx" ON "programs" USING btree ("display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_products_slug_unique" ON "campaign_products" USING btree ("campaign_id","slug");--> statement-breakpoint
CREATE INDEX "campaign_products_campaign_idx" ON "campaign_products" USING btree ("campaign_id","sort_order");--> statement-breakpoint
CREATE INDEX "campaign_products_active_idx" ON "campaign_products" USING btree ("campaign_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_slug_unique" ON "campaigns" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "campaigns_status_end_date_idx" ON "campaigns" USING btree ("status","end_date");--> statement-breakpoint
CREATE INDEX "campaigns_program_idx" ON "campaigns" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "campaigns_category_idx" ON "campaigns" USING btree ("category");--> statement-breakpoint
CREATE INDEX "campaigns_location_idx" ON "campaigns" USING btree ("state","city");--> statement-breakpoint
CREATE INDEX "campaigns_featured_idx" ON "campaigns" USING btree ("featured_order") WHERE is_featured = true;--> statement-breakpoint
CREATE INDEX "campaigns_created_idx" ON "campaigns" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "success_stories_slug_unique" ON "success_stories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "success_stories_status_idx" ON "success_stories" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "success_stories_program_idx" ON "success_stories" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "success_stories_campaign_idx" ON "success_stories" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "impact_updates_program_date_idx" ON "impact_updates" USING btree ("program_id","impact_date");--> statement-breakpoint
CREATE INDEX "impact_updates_campaign_date_idx" ON "impact_updates" USING btree ("campaign_id","impact_date");--> statement-breakpoint
CREATE INDEX "impact_updates_public_idx" ON "impact_updates" USING btree ("is_public","published_at");--> statement-breakpoint
CREATE INDEX "impact_updates_metric_idx" ON "impact_updates" USING btree ("metric_type");--> statement-breakpoint
CREATE UNIQUE INDEX "event_registrations_unique" ON "event_registrations" USING btree ("event_id","email");--> statement-breakpoint
CREATE INDEX "event_registrations_event_status_idx" ON "event_registrations" USING btree ("event_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_unique" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "events_status_start_idx" ON "events" USING btree ("status","start_date");--> statement-breakpoint
CREATE INDEX "events_program_idx" ON "events" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "events_campaign_idx" ON "events" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "documents_visibility_type_idx" ON "documents" USING btree ("visibility","document_type");--> statement-breakpoint
CREATE INDEX "documents_financial_year_idx" ON "documents" USING btree ("financial_year");--> statement-breakpoint
CREATE INDEX "documents_related_idx" ON "documents" USING btree ("related_type","related_id");--> statement-breakpoint
CREATE INDEX "donation_items_donation_idx" ON "donation_items" USING btree ("donation_id");--> statement-breakpoint
CREATE INDEX "donation_items_product_idx" ON "donation_items" USING btree ("campaign_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "donations_reference_unique" ON "donations" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "donations_donor_idx" ON "donations" USING btree ("donor_id");--> statement-breakpoint
CREATE INDEX "donations_campaign_status_idx" ON "donations" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "donations_status_created_idx" ON "donations" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "donations_subscription_idx" ON "donations" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "donations_completed_idx" ON "donations" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "donations_pending_idx" ON "donations" USING btree ("created_at") WHERE status IN ('pending', 'processing');--> statement-breakpoint
CREATE INDEX "payment_transactions_payment_idx" ON "payment_transactions" USING btree ("payment_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhooks_event_id_unique" ON "payment_webhooks" USING btree ("provider_event_id");--> statement-breakpoint
CREATE INDEX "payment_webhooks_queue_idx" ON "payment_webhooks" USING btree ("processing_status","received_at");--> statement-breakpoint
CREATE INDEX "payment_webhooks_type_idx" ON "payment_webhooks" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_payment_id_unique" ON "payments" USING btree ("provider_payment_id");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("provider_order_id");--> statement-breakpoint
CREATE INDEX "payments_donation_idx" ON "payments" USING btree ("donation_id");--> statement-breakpoint
CREATE INDEX "payments_status_created_idx" ON "payments" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_provider_refund_id_unique" ON "refunds" USING btree ("provider_refund_id");--> statement-breakpoint
CREATE INDEX "refunds_donation_idx" ON "refunds" USING btree ("donation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_provider_id_unique" ON "subscriptions" USING btree ("provider_subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_donor_idx" ON "subscriptions" USING btree ("donor_id");--> statement-breakpoint
CREATE INDEX "subscriptions_billing_idx" ON "subscriptions" USING btree ("status","next_billing_at");--> statement-breakpoint
CREATE INDEX "subscriptions_halted_idx" ON "subscriptions" USING btree ("donor_id") WHERE status = 'halted';--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_type","recipient_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_critical_idx" ON "audit_logs" USING btree ("created_at") WHERE severity = 'critical';--> statement-breakpoint
CREATE INDEX "settings_category_idx" ON "settings" USING btree ("category");