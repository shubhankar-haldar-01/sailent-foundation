# PROJECT.md — Sailent Foundation platform

Product overview, verified against the code on 2026-10-06 and updated for Phase 13 on 2026-10-07 (a snapshot). Each section is labelled **CURRENT** (implemented), **PLANNED** (documented, not built), **REMOVED** (built or planned, then deliberately taken out) or **DEPRECATED**. Implementation status per feature lives in `DEVELOPMENT_STATUS.md` §4.

---

## 1. Identity and purpose

- **Name:** Sailent Foundation Platform (`sailent-foundation` monorepo, v0.1.0).
- **Organisation:** an Indian non-profit working across education, healthcare, food security, disaster relief, women's empowerment and livelihoods, animal welfare and the environment.
  - Registered under 12A and 80G. **Not FCRA**, so it takes no foreign contributions.
  - Statutory numbers in the code are placeholder **DEMO** values (`apps/web/src/lib/demo-org.ts`) until the organisation supplies real ones.
- **Purpose:**
  - Raise one-time donations for specific campaigns, priced from real items (a school kit, a meal) or as a custom amount.
  - Show where money goes and what it achieved.
  - Recruit and manage volunteers.
  - Give staff one admin system for content, donors, volunteers, events, reports and audit.

## 2. Users

| User type | How they authenticate | What they do |
|---|---|---|
| Visitor / guest donor | none | Browses; donates as a guest (donor record upserted by email) |
| Donor (account) | Email OTP → donor session (`sailent_donor_session`) | `/dashboard`: donations, receipts (print view), saved campaigns, profile, notification preferences, event registrations, volunteering record |
| Volunteer applicant / volunteer | Public form; volunteering visible in the donor dashboard by email | Applies (6-step form); gets an ID `VOL-YYYY-NNNNN` on approval; assignments, attendance, certificates |
| Staff | Email + password (Argon2id) → staff session (`sailent_staff_session`) | Admin dashboard `/admin` |

**CURRENT:** there is one staff role, `SUPER_ADMIN`, which holds all 118 permissions (migration `0014`; six added by `0023` in Phase 13). The documented multi-role model in `docs/rbac.md` (Admin, Campaign Manager, Finance Manager and others) is **REMOVED** in code. Separation of duties is an open review item.

## 3. Business rules (CURRENT)

- **Currency:** INR only. Amounts are integer paise.
- **Donations:**
  - **One-time only.** Every donation targets a campaign and has a type: `custom` (amount), `product` (items) or `hybrid` (both).
  - **The server sets prices.** The client sends campaign slug, product IDs and quantities, and an optional custom amount, which is capped at ₹10 lakh.
  - **Campaign must be accepting donations.** It must be `active`, not past its end date (`hasEnded`, IST end of day), and not stopped at its goal when `stop_at_goal` is set.
  - **Limited items are held for 30 minutes** while a donation is pending.
- **Campaigns** belong to a programme (required to publish or activate). Lifecycle: `draft → published → active ⇄ paused → completed → archived` (`packages/validation` `CAMPAIGN_TRANSITIONS`).
  - **Ongoing by default.** `end_date` is an optional deadline. When it passes, the campaign shows as Closed and stops taking donations. *(Committed in `dd64d41`, 2026-10-06.)*
  - **Featured.** Admin sets "Feature on the homepage" and an order. With live data, the API's `sort=featured` orders the homepage band: featured campaigns by featured order, then the rest by soonest deadline. The web keeps only campaigns that are taking donations, which drops paused and ended ones. *(Committed in `dd64d41`, 2026-10-06.)*
- **Receipts:** issued automatically on capture.
  - Gapless numbering per financial year (April–March): `SFL-<FY>-NNNNNN`.
  - Immutable: a receipt is superseded, never edited.
  - A receipt is **not** an 80G certificate. Form 10BE comes from the Income Tax Department; the platform offers only a Form 10BD readiness view.
- **Tax ID (PAN):** optional, requested after payment. Never exported raw. Encrypted at rest with AES-256-GCM since Phase 12; the donor sees only a masked value (see `SECURITY.md`).
- **Public statistics** are computed from the database only. If the database cannot produce a number, it is not shown (decision A14).
- **Events:** registration requires a donor session; capacity is locked with `FOR UPDATE`; there is no waitlist; there are no paid events.
- **Volunteers:** the ID is assigned at approval and never reused. Hours round down.

## 4. Public website (CURRENT) — `apps/web/src/app/(public)`

**Content pages:**
- Home, `/about`, `/programs` and `/programs/[slug]`.
- `/campaigns` (search, cause filter, status filter Active/Closed/Completed/All, View More pagination) and `/campaigns/[slug]` (donation builder or status card).
- `/stories` and `[slug]`, `/events` and `[slug]`, `/team` and `[slug]`, `/impact` and `/impact/[slug]`.
- `/blog` and `[slug]`, `/volunteer` (with the application form), `/donate`, `/contact`, `/faq`.

**Utility routes:**
- `/donation/[reference]`: a status page that polls.
- `/verify/[code]`: certificate verification.
- `/sign-in`: donor OTP.
- `/search`.

**Legal and SEO:**
- Legal: `/privacy-policy`, `/terms`, `/donation-policy`.
- SEO: `robots.txt`, a sitemap index plus 6 segment sitemaps, JSON-LD (Organization, BreadcrumbList, BlogPosting, Article, FAQPage).

**The homepage (committed design at `ae1520b`)**, in order:
1. Hero (full-bleed photo)
2. Featured Campaigns autoplay rail
3. Impact statistics
4. "Browse by cause" campaign grid
5. Who We Are / What We Do
6. Stories & Events
7. Testimonials autoplay rail
8. Join Our Community
9. Partners (renders nothing while the list is empty)
10. Newsletter

**Homepage composition:** a published `home` page from the page composer can reorder the sections. Otherwise the order above is used.

**Database-backed since Phase 13:** the `/faq` questions (Admin → FAQs), site search (published content only), and the organisation's contact and registration details (Admin → Settings; footer, `/contact`, `/about`). The contact form stores and emails each message; the newsletter sign-up is double opt-in.

**Still static, by design (Phase 13 boundary):** the homepage and `/volunteer` testimonials are fixtures in `src/lib/mock` — there is no testimonial table or admin screen, and Phase 13 did not invent one (their "monthly donor" wording was corrected). The dead "Once / Monthly" donation widget was deleted: donations are one-time only.

**REMOVED:**
- `/refund-policy`, `/reports`, `/transparency` and `/gallery`.
- "Impact" from the header nav and the footer, at the owner's request.
- The homepage focus-area strip, at the owner's request.
- The homepage visual refinement of 2026-10-06 (reverted by the owner).

## 5. Admin platform (CURRENT) — `apps/web/src/app/admin`

**Content and fundraising:**
- Programmes and campaigns: CRUD, lifecycle, FAQs, products, featured; since Phase 13 the cover image (campaign and programme) from the media library, the Campaign Gallery (add from the library, remove, reorder, public/private) and progress updates (draft, publish, archive). Preview at `/admin/preview/[entity]/[slug]`.
- Products catalogue.

**People and money:**
- Donations and donors (search, detail, correction).
- Volunteers (review, assign, attendance, certificates).
- Events (registrations, attendance), team, impact updates.

**Content management:**
- Stories (with consent gate) and blog.
- Pages (section composer, revisions, preview).
- Media library (R2; EXIF/GPS removed from new uploads since Phase 13) and documents (public, private or admin-only; signed downloads; deletion with re-authentication and a reason since Phase 13).
- General FAQs for `/faq` (Phase 13).

**Communication:**
- Notifications: inbox, send log, retry (sends again through the email queue since Phase 13).
- Notification templates (versioned).
- Messages: the contact-form inbox (new / handled / archived), and the newsletter subscriber list (Phase 13).

**Reports and administration:**
- Reports (donations, campaigns, volunteers, impact, CSV export), reconciliation (read-only), tax readiness.
- Users, roles (read-only, single role), audit logs, settings.

**Dashboard home (Phase 13):** live counts — open campaigns, programmes, donations this month, donors, volunteer applications, upcoming events, new messages, newsletter subscribers — a "needs attention" list, recent donations and recent staff activity, each shown only with its read permission.

## 6. Authentication (CURRENT)

**Staff**
- Signs in with email and password.
- Accounts lock for 15 minutes after 5 failures.
- Sessions use a 15-minute JWT access token (HS256 only) and a refresh token rotated atomically; reusing one revokes the session family.
- Sensitive actions require re-entering the password, which is valid for 5 minutes.
- **Staff TOTP/2FA is not required** (owner decision, 2026-10-07).
- Sign-ins, failures, lockouts and re-authentication are audited.
- **Invitations and password reset (Phase 13):** an invited staff member gets a single-use emailed link (7 days) to set their own password; "Forgot your password?" emails a 1-hour link, and a reset signs out every session. The CLI scripts remain for the first administrator.

**Donors and volunteers**
- Sign in with an email OTP: 6 digits, valid for 10 minutes, 5 attempts per code, 3 codes per 15 minutes.
- Codes go to an address held by a donor account or a live volunteer record; the first sign-in creates the account.
- The email address changes only through a code sent to the new address.

**PLANNED:** a session-management UI.

## 7. Donation and payment model (CURRENT)

```
POST /donations
  → pending donation + items + payment row (one transaction)
  → Razorpay order
  → checkout in the browser
  → POST /donations/:id/verify-payment (HMAC + re-fetch + amount check)
    and/or POST /payments/razorpay/webhook (HMAC over raw body, event-id dedupe)
  → DonationCaptureService (row locks; counters; receipt)
  → confirmation email via the worker
```

**REMOVED:**
- Recurring and monthly donations, subscriptions and mandates (migration `0009`).
- Refunds (migration `0010`). The webhook marks refund events `needs_review`.

**Local development without Razorpay keys:** creating a donation returns HTTP 503 and leaves a `pending` donation. No payment occurs. Details are in `DEPLOYMENT.md` §6.

**Built in Phase 11 (2026-10-07):** reconciliation of pending donations against Razorpay and expiry (`cancelled`) after 24 hours, run by the worker; an `Idempotency-Key` on create; checkout retries on the same order; per-client rate limits; a read-only admin Payment exceptions page. See `DEPLOYMENT.md` §6a.

**PLANNED, not built:**
- Receipt PDF.
- Form 10BD export.

## 8. Campaign, programme and product model (CURRENT)

- **Programme** (`programs`): editorial content, category, status `draft/published/archived`.
  - The rollup columns are not maintained.
- **Campaign** (`campaigns`): belongs to a programme (required to publish), has a fundraising goal, an optional start and end date, a category, a location, featured flags, `stop_at_goal`, and a minimum donation.
- **Product** (`products`): a master catalogue item with a default price.
- **Campaign product** (`campaign_products`): a product offered by one campaign, with its own price, `target_quantity`, `provided_quantity` and `max_per_donation`.
- **Donation item** (`donation_items`): a snapshot of name and price; type `product` or `custom`.

## 9. Volunteer model (CURRENT)

- **Application lifecycle:** `applied → under_review → approved/active → inactive/suspended`, or `rejected`/`archived`.
- **Approval** issues the volunteer ID `VOL-YYYY-NNNNN` from the gapless `volunteer_sequences` counter.
- **Activity records:** assignments (polymorphic target), attendance (minutes, verified by staff), certificates (issued or revoked, verified publicly).

**PLANNED, not built:** certificate PDF, document upload, self-service attendance, shift swap, messaging.

## 10. Blog and content (CURRENT)

- **Blog:** markdown rendered to React with no raw HTML; categories (kind `blog`); tags; BlogPosting JSON-LD.
- **Stories:** a consent gate before publishing; an anonymised display option.
- **Pages:** a typed section composer with revisions and HMAC preview links. It composes only the home page.
- **Fixtures:** `apps/web/src/lib/content` falls back to fixtures when `FEATURE_MOCK_DATA` permits.

## 11. Notifications (CURRENT / PARTIAL)

**Email** goes through the worker (BullMQ queue `email`) to Brevo. Messages sent:
- donation confirmation
- donor login code
- event registered or cancelled
- volunteer application received, approved, rejected or assigned, and certificate issued

**Templates** are editable and versioned in the admin. Placeholders are HTML-escaped.

**Since Phase 13:** contact messages to the organisation, newsletter confirmation, staff invitations and password-reset links; admin retry works for retryable types.

**Missing:**
- Sending newsletters (only consent is recorded).
- SMS, WhatsApp and push.
- Campaign and impact update emails, although the opt-in flags are stored.

## 12. Reports (CURRENT)

**Report sets:** donations, campaigns, volunteers, impact, reconciliation (read-only) and tax readiness.

**CSV export:**
- Requires re-authentication.
- Capped at 50,000 rows and 731 days.
- Formula-injection-safe.
- Never includes raw tax IDs.

**PLANNED:** charts, Form 10BD export, scheduled reconciliation.

## 13. Deployment and external services

| Service | Role | Status |
|---|---|---|
| Supabase Postgres | **Production** database (session pooler, TLS verified) | The project exists (owner, 2026-10-06); its schema and data are unverified. **Agents must not access it.** There is no staging environment. The code has no Supabase SDK. |
| Upstash Redis | Throttling, queues | Documented; local Redis is used today |
| Cloudflare R2 | Media and documents (public and private buckets) | Implemented in the API; a live round-trip test exists |
| Razorpay | Payments | Implemented; no keys configured locally |
| Brevo | Email | Implemented in the worker; optional |
| Google Cloud Run (web, api, worker) | Hosting | Owner's intended choice (earlier documents said Vercel and Render/Railway). **No deployment configuration exists yet** — Phase 14. |
| Sentry, GA4 | Monitoring, analytics | PLANNED; variables declared, no SDK |

## 14. Permanent exclusions (REMOVED or out of scope by decision)

- Recurring giving, subscriptions, mandates
- Refunds
- Peer-to-peer or user-created fundraising
- A second payment provider
- Foreign contributions (FCRA)
- A CSR workflow
- Multi-language
- A mobile app
- Payouts and grants
- Crypto, in-kind donations and merchandise
- Gamification
- An arbitrary page builder
- Paid events
