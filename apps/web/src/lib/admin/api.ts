import 'server-only';

import { API_PREFIX } from '@sailent/config';

import { getAccessToken } from '@/lib/auth/session';

/**
 * Server-side admin API client.
 *
 * Calls the Nest API directly from the server component, attaching the token
 * from the httpOnly cookie. Admin responses are NEVER cached — they are
 * per-user, permission-filtered and frequently include unpublished work.
 */

const API_BASE = process.env.API_URL ?? 'http://localhost:4000';

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: { field?: string; message?: string }[],
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export async function adminFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new AdminApiError(401, 'UNAUTHENTICATED', 'Your session has expired.');

  const url = new URL(`${API_PREFIX}/${path.replace(/^\//, '')}`, ensureTrailingSlash(API_BASE));
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    // Admin data is per-user and often unpublished. Never cached, anywhere.
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: { code?: string; message?: string; details?: { field?: string; message?: string }[] };
  };

  if (!response.ok || payload.success === false) {
    throw new AdminApiError(
      response.status,
      payload.error?.code ?? 'INTERNAL_ERROR',
      payload.error?.message ?? 'Something went wrong.',
      payload.error?.details,
    );
  }

  return payload.data as T;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

// --- Shapes the admin pages read ------------------------------------------

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean };
}

export interface AdminProgram {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  category: string | null;
  categoryId: string | null;
  status: 'draft' | 'published' | 'archived';
  displayOrder: number;
  campaignCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCampaign {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  status: 'draft' | 'published' | 'active' | 'paused' | 'completed' | 'archived';
  category: string | null;
  categoryId: string | null;
  location: string | null;
  fundraisingGoal: number;
  amountRaised: number;
  donorCount: number;
  beneficiaryTarget: number | null;
  beneficiariesReached: number;
  startDate: string | null;
  endDate: string | null;
  programId: string | null;
  programTitle: string | null;
  productCount?: number;
  /** Leads the homepage's Featured Campaigns band. */
  isFeatured: boolean;
  /** Its place in that band, lowest first; null goes after the numbered ones. */
  featuredOrder: number | null;
  progress: {
    goal: number;
    raised: number;
    remaining: number;
    percent: number;
    rawPercent: number;
    goalReached: boolean;
    surplus: number;
  };
  daysRemaining: number | null;
  updatedAt: string;
}

export interface AdminCategory {
  id: string;
  key: string;
  name: string;
  slug: string;
  kind: 'program' | 'campaign' | 'both' | 'blog';
  isActive: boolean;
  programCount: number;
  campaignCount: number;
}

// ---------------------------------------------------------------------------
// Phase 9 — team, events and impact
// ---------------------------------------------------------------------------

export interface AdminTeamMember {
  id: string;
  name: string;
  slug: string;
  photoUrl: string | null;
  designation: string;
  department: string | null;
  memberType: 'staff' | 'trustee' | 'advisor' | 'board';
  bio: string | null;
  experience: string | null;
  socialLinks: { label: string; url: string }[] | null;
  emailPublic: string | null;
  status: 'draft' | 'published' | 'archived';
  isPublic: boolean;
  displayOrder: number;
  linkedAccountEmail?: string | null;
  createdAt: string;
  updatedAt: string;
  slugHistory?: { slug: string; createdAt: string }[];
}

/**
 * An event, as the admin sees it.
 *
 * TWO STATE FIELDS, because an event has two states that answer different
 * questions: `status` is whether anyone can see it, `registrationStatus` is
 * what is happening to it. A cancelled event stays published — otherwise the
 * people holding a registration cannot reach the page that tells them.
 */
export interface AdminEvent {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  coverImage: string | null;
  startDate: string;
  endDate: string | null;
  timezone: string;
  venueName: string | null;
  location: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  isOnline: boolean;
  meetingUrl: string | null;
  capacity: number | null;
  registeredCount: number;
  registrationStatus: 'open' | 'closed' | 'full' | 'cancelled' | 'completed';
  registrationDeadline: string | null;
  organizer: string | null;
  status: 'draft' | 'published' | 'archived';
  programId: string | null;
  campaignId: string | null;
  programTitle?: string | null;
  campaignTitle?: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on the list; recomputed from the rows, so it can expose drift. */
  seatsHeld?: number;
  counts?: { seatsHeld: number; registrations: number; attended: number; cancelled: number };
  slugHistory?: { slug: string; createdAt: string }[];
}

export interface AdminEventRegistration {
  id: string;
  fullName: string;
  /** SENSITIVE — this endpoint is `@Sensitive()` and needs a fresh re-auth. */
  email: string;
  phone: string;
  attendeeCount: number;
  status: 'registered' | 'waitlisted' | 'confirmed' | 'attended' | 'no_show' | 'cancelled';
  registeredAt: string;
  attendedAt: string | null;
  cancellationReason: string | null;
}

export interface AdminImpactRecord {
  id: string;
  title: string;
  slug: string;
  description: string;
  coverImage: string | null;
  impactDate: string;
  location: string | null;
  state: string | null;
  statistics: { label: string; value: number; unit?: string }[] | null;
  metricType: string | null;
  metricValue: number | null;
  metricUnit: string | null;
  /** Required before publication whenever a figure is claimed (decision A14). */
  verificationMethod: string | null;
  verifiedBy: string | null;
  status: 'draft' | 'published' | 'archived';
  isPublic: boolean;
  publishedAt: string | null;
  campaignId: string | null;
  programId: string | null;
  eventId: string | null;
  campaignTitle?: string | null;
  programTitle?: string | null;
  eventTitle?: string | null;
  createdAt: string;
  slugHistory?: { slug: string; createdAt: string }[];
}

/** The transition tables, served by the API so the UI cannot drift from it. */
export interface EventTransitions {
  status: Record<string, string[]>;
  lifecycle: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Phase 8 — volunteers
// ---------------------------------------------------------------------------

export interface AdminVolunteerSummary {
  id: string;
  /** NULL until approved — a row without one has not been approved (A13). */
  volunteerId: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  city: string | null;
  skills: string[] | null;
  status:
    | 'applied'
    | 'under_review'
    | 'approved'
    | 'active'
    | 'inactive'
    | 'suspended'
    | 'rejected'
    | 'archived';
  totalHours: number;
  verifiedHours: number;
  assignmentCount: number;
  createdAt: string;
  approvedAt: string | null;
}

/**
 * The full record — only from the detail route, which is `@Sensitive()`.
 *
 * The list deliberately omits phone, address, emergency contact and internal
 * notes: finding somebody is a different act from reading their record.
 */
export interface AdminVolunteer extends AdminVolunteerSummary {
  phone: string;
  addressLine1: string | null;
  state: string | null;
  postalCode: string | null;
  dateOfBirth: string | null;
  education: string | null;
  occupation: string | null;
  experience: string | null;
  languages: string[] | null;
  interests: string[] | null;
  availability: { days?: string; hours?: string; mode?: string } | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  /** ADMIN-ONLY, both of them. Never shown to the volunteer. */
  statusReason: string | null;
  internalNotes: string | null;
  joiningDate: string | null;
  applications: {
    id: string;
    formData: Record<string, unknown>;
    submittedAt: string;
    status: string;
    reviewedAt: string | null;
    reviewNotes: string | null;
    rejectionReason: string | null;
    coolingPeriodUntil: string | null;
  }[];
}

export interface AdminVolunteerAssignment {
  id: string;
  volunteerId: string;
  assignableType: string;
  assignableId: string | null;
  role: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  expectedHours: number | null;
  status: 'assigned' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
}

export interface AdminVolunteerAttendance {
  id: string;
  assignmentId: string;
  date: string;
  durationMinutes: number;
  /** Only verified minutes reach `verifiedHours`, and only those a certificate. */
  verifiedAt: string | null;
  notes: string | null;
}

export interface AdminVolunteerCertificate {
  id: string;
  certificateNumber: string;
  verificationCode: string;
  certificateType: string;
  title: string;
  hoursCredited: number;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  status: 'issued' | 'revoked';
  revokedAt: string | null;
  revokedReason: string | null;
}

/** Served by the API so the UI cannot offer a move the server will refuse. */
export interface VolunteerTransitions {
  volunteer: Record<string, string[]>;
  assignment: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Staff administration — users, roles, audit
// ---------------------------------------------------------------------------

/**
 * A staff account.
 *
 * `passwordHash`, `totpSecret` and `backupCodes` are absent because the API
 * selects columns explicitly rather than deleting fields from a row — see
 * `UserResponseDto`. Nothing here needs to strip them again, and nothing here
 * should ever add a field that would carry them.
 */
export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  status: 'invited' | 'active' | 'inactive' | 'suspended';
  /** Whether a second factor is enrolled. The secret itself is never returned. */
  totpEnabled: boolean;
  lastLoginAt?: string | null;
  roles: { key: string; name: string }[];
  createdAt: string;
}

export interface AdminRole {
  key: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
  permissionCount?: number;
  userCount?: number;
}

export interface AdminRoleDetail extends AdminRole {
  permissions: { key: string; description?: string | null; isSensitive?: boolean }[];
}

/**
 * One audit entry.
 *
 * `oldValues`/`newValues` are already redacted at WRITE time by the API's
 * `redact()` — passwords, tokens, OTP hashes, PAN and card data never reach
 * the column. What survives is safe to show, which is the whole point of an
 * audit log.
 *
 * `actorEmailSnapshot` is the address as it was when the action happened, not
 * a join. A user who is later renamed or removed does not rewrite history.
 */
export interface AdminAuditEntry {
  id: string;
  createdAt: string;
  actorType: string;
  userId?: string | null;
  actorEmailSnapshot?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  severity: string;
  reason?: string | null;
  ipAddress?: string | null;
  requestId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}

export function listUsers(query: {
  status?: string;
  q?: string;
  page?: string | number;
  limit?: number;
}) {
  return adminFetch<Paginated<AdminUser>>('admin/users', {
    query: {
      status: query.status && query.status !== 'all' ? query.status : undefined,
      q: query.q,
      page: query.page,
      limit: query.limit ?? 50,
    },
  });
}

export function getUser(id: string) {
  return adminFetch<AdminUser>(`admin/users/${id}`);
}

/**
 * The roles that exist — one, since Phase 8.
 *
 * Returns `{ items }` rather than a bare array, like every other list on this
 * API. Typing it as an array compiled fine and produced an empty screen.
 */
export async function listRoles() {
  const response = await adminFetch<{ items: AdminRole[] }>('admin/roles');
  return response.items ?? [];
}

export function getRole(key: string) {
  return adminFetch<AdminRoleDetail>(`admin/roles/${key}`);
}

export function listAuditEntries(query: {
  entityType?: string;
  entityId?: string;
  action?: string;
  page?: string | number;
  limit?: number;
}) {
  return adminFetch<Paginated<AdminAuditEntry>>('admin/audit-logs', {
    query: {
      entityType: query.entityType || undefined,
      entityId: query.entityId || undefined,
      action: query.action || undefined,
      page: query.page,
      limit: query.limit ?? 50,
    },
  });
}

/** The four organisation settings. Not to be confused with `/me/settings`. */
export interface AdminSettings {
  organization_name: string;
  registration_details: {
    registrationNumber: string | null;
    pan: string | null;
    section12A: string | null;
    section80G: string | null;
  };
  donation_minimum_paise: number;
  fcra_enabled: boolean;
}

export function getSettings() {
  return adminFetch<AdminSettings>('admin/settings');
}

// ---------------------------------------------------------------------------
// Success stories
// ---------------------------------------------------------------------------

export interface AdminStorySummary {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  category: string | null;
  location: string | null;
  subjectName: string | null;
  isAnonymised: boolean;
  consentObtained: boolean;
  coverImage: string | null;
  publishedAt: string | null;
  updatedAt: string;
  programTitle: string | null;
  campaignTitle: string | null;
}

/** Why this story cannot be published, computed by the API before it is tried. */
export interface PublishBlocker {
  field: string;
  code: string;
  message: string;
}

export interface AdminStory extends AdminStorySummary {
  excerpt: string | null;
  content: string | null;
  challenge: string | null;
  intervention: string | null;
  journey: string | null;
  outcome: string | null;
  impact: string | null;
  gallery: string[] | null;
  programId: string | null;
  campaignId: string | null;
  /** Admin-only. The public API never returns this. */
  consentDocumentId: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  publishBlockers: PublishBlocker[];
}

export function listStories(query: {
  status?: string;
  q?: string;
  page?: string | number;
  limit?: number;
}) {
  return adminFetch<Paginated<AdminStorySummary>>('admin/stories', {
    query: {
      status: query.status ?? 'all',
      q: query.q,
      page: query.page,
      limit: query.limit ?? 25,
    },
  });
}

export function getStory(id: string) {
  return adminFetch<AdminStory>(`admin/stories/${id}`);
}

// ---------------------------------------------------------------------------
// Blog (Phase 10.7)
// ---------------------------------------------------------------------------

export interface AdminBlogSummary {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  excerpt: string | null;
  categoryId: string | null;
  categoryName: string | null;
  /** A display name. The API never sends the author's id or email. */
  authorName: string | null;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

export interface AdminBlogPost extends AdminBlogSummary {
  content: string | null;
  featuredMediaId: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  createdAt: string;
  tags: { name: string; slug: string }[];
  /** Why this post cannot be published yet, computed by the API. */
  publishBlockers: PublishBlocker[];
}

export function listBlogPosts(query: {
  status?: string;
  q?: string;
  categoryId?: string;
  page?: string | number;
  limit?: number;
}) {
  return adminFetch<Paginated<AdminBlogSummary>>('admin/blog', {
    query: {
      status: query.status ?? 'all',
      q: query.q,
      categoryId: query.categoryId,
      page: query.page,
      limit: query.limit ?? 25,
    },
  });
}

export function getBlogPost(id: string) {
  return adminFetch<AdminBlogPost>(`admin/blog/${id}`);
}

// ---------------------------------------------------------------------------
// Pages — the section composer (Phase 10.9)
// ---------------------------------------------------------------------------

/** One approved section, as stored. `props` are per-type and deliberately thin. */
export interface PageSectionValue {
  type: string;
  props: Record<string, unknown>;
}

export interface AdminPageSummary {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  sectionCount: number;
  version: number;
  publishedAt: string | null;
  scheduledAt: string | null;
  updatedAt: string;
}

export interface AdminPage extends Omit<AdminPageSummary, 'sectionCount'> {
  sections: PageSectionValue[];
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: string;
  /** Whether this composition is being served right now. */
  isLive: boolean;
  revisions: { version: number; note: string | null; createdAt: string }[];
}

export function listPages(query: { status?: string; page?: string | number; limit?: number }) {
  return adminFetch<Paginated<AdminPageSummary>>('admin/pages', {
    query: { status: query.status ?? 'all', page: query.page, limit: query.limit ?? 25 },
  });
}

export function getPage(id: string) {
  return adminFetch<AdminPage>(`admin/pages/${id}`);
}

// ---------------------------------------------------------------------------
// Media library
// ---------------------------------------------------------------------------

export interface AdminMedia {
  id: string;
  storageKey: string;
  /** Present only for PUBLIC media. Null for private, enforced by the database. */
  url: string | null;
  /** Present only for PRIVATE media. Expires — never store or share it. */
  signedUrl?: string | null;
  altText: string;
  caption: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  visibility: 'public' | 'private';
  createdAt: string;
  updatedAt: string;
}

export interface AdminMediaDetail extends AdminMedia {
  /** Where this image is used. Non-empty means deletion is refused. */
  references: { kind: string; count: number }[];
}

export function listMedia(query: {
  visibility?: string;
  q?: string;
  page?: string | number;
  limit?: number;
}) {
  return adminFetch<Paginated<AdminMedia>>('admin/media', {
    query: {
      visibility: query.visibility ?? 'all',
      q: query.q,
      page: query.page,
      limit: query.limit ?? 24,
    },
  });
}

export function getMedia(id: string) {
  return adminFetch<AdminMediaDetail>(`admin/media/${id}`);
}

/**
 * Forward a multipart upload to the API.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE BROWSER NEVER TALKS TO R2, AND NEVER SEES A CREDENTIAL.
 *
 * The file goes browser → this server action → the API → R2. A presigned
 * direct-to-bucket upload would be fewer hops and would put the validation on
 * the wrong side of the trust boundary: the magic-byte check, the size limit
 * and the storage key would all become things the client could skip.
 *
 * `adminFetch` is not reused because it sets a JSON content type and
 * serialises the body. `fetch` must be left to set the multipart boundary
 * itself — supplying `Content-Type` by hand here produces a request the API
 * cannot parse.
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function adminUpload<T>(path: string, form: FormData): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new AdminApiError(401, 'UNAUTHENTICATED', 'Your session has expired.');

  const response = await fetch(
    new URL(`${API_PREFIX}/${path.replace(/^\//, '')}`, `${API_BASE.replace(/\/+$/, '')}/`),
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: 'no-store',
    },
  );

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: { code?: string; message?: string; details?: { field?: string; message?: string }[] };
  };

  if (!response.ok || payload.success === false) {
    throw new AdminApiError(
      response.status,
      payload.error?.code ?? 'INTERNAL_ERROR',
      payload.error?.message ?? 'The upload failed.',
      payload.error?.details,
    );
  }

  return payload.data as T;
}

// ---------------------------------------------------------------------------
// Documents (Phase 10.10)
// ---------------------------------------------------------------------------

export interface AdminDocument {
  id: string;
  title: string;
  description: string | null;
  documentType: string;
  visibility: 'public' | 'private' | 'admin_only';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  financialYear: string | null;
  relatedType: string | null;
  relatedId: string | null;
  publishedAt: string | null;
  downloadCount: number;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present only for public documents; the database enforces that too. */
  fileUrl: string | null;
}

export function listDocuments(query: {
  page?: string | number;
  pageSize?: number;
  visibility?: string;
  documentType?: string;
  financialYear?: string;
  search?: string;
}) {
  return adminFetch<Paginated<AdminDocument>>('admin/documents', {
    query: {
      page: query.page,
      pageSize: query.pageSize ?? 20,
      visibility: query.visibility,
      documentType: query.documentType,
      financialYear: query.financialYear,
      search: query.search,
    },
  });
}

export function getDocument(id: string) {
  return adminFetch<AdminDocument>(`admin/documents/${id}`);
}

/**
 * Ask the API for a link to a document's bytes.
 *
 * A POST, because issuing one has effects: it mints a credential, counts a
 * download and writes an audit row. The URL it returns is short-lived for
 * anything private, so it is fetched at the moment somebody clicks rather than
 * embedded in the page when it renders — a five-minute signature baked into
 * server-rendered HTML is expired before a slow reader reaches it.
 */
export function requestDocumentLink(id: string) {
  return adminFetch<{
    url: string;
    fileName: string;
    mimeType: string;
    expiresInSeconds: number | null;
  }>(`admin/documents/${id}/download`, { method: 'POST' });
}

// ---------------------------------------------------------------------------
// Notifications (Phase 10.11)
// ---------------------------------------------------------------------------

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface AdminSendLogEntry {
  id: string;
  type: string;
  title: string;
  message: string;
  channel: string;
  status: 'pending' | 'sent' | 'failed' | 'read';
  recipientType: string;
  recipientId: string | null;
  templateId: string | null;
  templateVersion: number | null;
  retryCount: number;
  sentAt: string | null;
  error: string | null;
  providerMessageId: string | null;
  createdAt: string;
}

export interface AdminTemplateSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  channel: string;
  subject: string;
  isActive: boolean;
  version: number;
  updatedAt: string;
}

export interface AdminTemplate extends AdminTemplateSummary {
  bodyHtml: string;
  bodyText: string;
  expectedVariables: Record<string, string>;
  revisions: { version: number; note: string | null; createdAt: string }[];
}

export function listNotifications(query: { page?: string | number; unreadOnly?: boolean }) {
  return adminFetch<Paginated<AdminNotification>>('admin/notifications', {
    query: { page: query.page, unreadOnly: query.unreadOnly ? 'true' : undefined },
  });
}

export function unreadNotificationCount() {
  return adminFetch<{ unread: number }>('admin/notifications/unread-count');
}

export function sendLog(query: {
  page?: string | number;
  status?: string;
  channel?: string;
  type?: string;
}) {
  return adminFetch<Paginated<AdminSendLogEntry>>('admin/notifications/log', { query });
}

export function sendFailureCount() {
  return adminFetch<{ failed: number }>('admin/notifications/failures');
}

export function listNotificationTemplates() {
  return adminFetch<{ items: AdminTemplateSummary[] }>('admin/notification-templates');
}

export function getNotificationTemplate(id: string) {
  return adminFetch<AdminTemplate>(`admin/notification-templates/${id}`);
}

export function previewNotificationTemplate(
  id: string,
  body: { subject: string; bodyHtml: string; bodyText: string },
) {
  return adminFetch<{
    subject: string;
    html: string;
    text: string;
    missing: string[];
  }>(`admin/notification-templates/${id}/preview`, { method: 'POST', body });
}

// ---------------------------------------------------------------------------
// Reports (Phase 10.12)
// ---------------------------------------------------------------------------

export interface ReportRangeQuery {
  from: string;
  to: string;
}

export interface DonationReport {
  range: ReportRangeQuery;
  totals: { donations: number; capturedPaise: number; distinctDonors: number };
  byStatus: { status: string; count: number; amountPaise: number }[];
  byCampaign: { campaignId: string | null; title: string; count: number; capturedPaise: number }[];
  byDay: { day: string; count: number; capturedPaise: number }[];
}

export interface CampaignReport {
  range: ReportRangeQuery;
  items: {
    id: string;
    title: string;
    status: string;
    goalPaise: number;
    lifetimePaise: number;
    inRangePaise: number;
    inRangeDonations: number;
    inRangeDonors: number;
  }[];
}

export interface VolunteerReport {
  range: ReportRangeQuery;
  appliedInRange: { status: string; count: number }[];
  standing: { activeVolunteers: number; allVolunteers: number; verifiedHours: number };
}

export interface ImpactReport {
  range: ReportRangeQuery;
  items: { metricType: string; records: number; total: number; published: number }[];
}

export interface ReconciliationReport {
  range: ReportRangeQuery;
  summary: {
    pending: number;
    pendingPaise: number;
    stuckOverAnHour: number;
    failed: number;
    capturedWithoutReceipt: number;
  };
  oldestUnresolved: {
    id: string;
    reference: string;
    status: string;
    amountPaise: number;
    provider: string | null;
    donationDate: string;
  }[];
}

export interface TaxReadinessReport {
  financialYear: string;
  range: ReportRangeQuery;
  filingDeadline: string;
  eligible: number;
  eligiblePaise: number;
  ready: number;
  readyPaise: number;
  missing: number;
  missingPaise: number;
  donorsMissingTaxId: number;
}

export function donationReport(range: ReportRangeQuery) {
  return adminFetch<DonationReport>('admin/reports/donations', {
    query: { from: range.from, to: range.to },
  });
}

export function campaignReport(range: ReportRangeQuery) {
  return adminFetch<CampaignReport>('admin/reports/campaigns', {
    query: { from: range.from, to: range.to },
  });
}

export function volunteerReport(range: ReportRangeQuery) {
  return adminFetch<VolunteerReport>('admin/reports/volunteers', {
    query: { from: range.from, to: range.to },
  });
}

export function impactReport(range: ReportRangeQuery) {
  return adminFetch<ImpactReport>('admin/reports/impact', {
    query: { from: range.from, to: range.to },
  });
}

export function reconciliationReport(range: ReportRangeQuery) {
  return adminFetch<ReconciliationReport>('admin/reports/reconciliation', {
    query: { from: range.from, to: range.to },
  });
}

export function taxReadinessReport(financialYear?: number) {
  return adminFetch<TaxReadinessReport>('admin/reports/tax-readiness', {
    query: financialYear ? { financialYear } : {},
  });
}
