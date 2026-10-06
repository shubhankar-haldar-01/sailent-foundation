# PROJECT.md — Sailent Foundation platform

Product overview, verified against the code on 2026-10-06 (a snapshot). Each section is labelled **CURRENT** (implemented), **PLANNED** (documented, not built), **REMOVED** (built or planned, then deliberately taken out) or **DEPRECATED**. Implementation status per feature lives in `DEVELOPMENT_STATUS.md` §4.

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

**CURRENT:** there is one staff role, `SUPER_ADMIN`, which holds all 112 permissions (migration `0014`). The documented multi-role model in `docs/rbac.md` (Admin, Campaign Manager, Finance Manager and others) is **REMOVED** in code. Separation of duties is an open review item.

## 3. Business rules (CURRENT)

- **Currency:** INR only. Amounts are integer paise.
- **Donations:**
  - **One-time only.** Every donation targets a campaign and has a type: `custom` (amount), `product` (items) or `hybrid` (both).
  - **The server sets prices.** The client sends campaign slug, product IDs and quantities, and an optional custom amount, which is capped at ₹10 lakh.
  - **Campaign must be accepting donations.** It must be `active`, not past its end date (`hasEnded`, IST end of day), and not stopped at its goal when `stop_at_goal` is set.
  - **Limited items are held for 30 minutes** while a donation is pending.
- **Campaigns** belong to a programme (required to publish or activate). Lifecycle: `draft → published → active ⇄ paused → completed → archived` (`packages/validation` `CAMPAIGN_TRANSITIONS`).
  - **Ongoing by default.** `end_date` is an optional deadline. When it passes, the campaign shows as Closed and stops taking donations. *(As of 2026-10-06 this is implemented but uncommitted.)*
  - **Featured.** Admin sets "Feature on the homepage" and an order. With live data, the API's `sort=featured` orders the homepage band: featured campaigns by featured order, then the rest by soonest deadline. The web keeps only campaigns that are taking donations, which drops paused and ended ones. *(As of 2026-10-06 this is implemented but uncommitted.)*
- **Receipts:** issued automatically on capture.
  - Gapless numbering per financial year (April–March): `SFL-<FY>-NNNNNN`.
  - Immutable: a receipt is superseded, never edited.
  - A receipt is **not** an 80G certificate. Form 10BE comes from the Income Tax Department; the platform offers only a Form 10BD readiness view.
- **Tax ID (PAN):** optional, requested after payment. Never exported raw. *Docs say it is encrypted at rest; in code it is NOT (see `SECURITY.md`).*
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

**Fixture-backed content (CURRENT, should be replaced):** the `/faq` entries, testimonials, search index, donation-widget presets, and the organisation contact and registration details (DEMO).

**REMOVED:**
- `/refund-policy`, `/reports`, `/transparency` and `/gallery`.
- "Impact" from the header nav and the footer, at the owner's request.
- The homepage focus-area strip, at the owner's request.
- The homepage visual refinement of 2026-10-06 (reverted by the owner).

## 5. Admin platform (CURRENT) — `apps/web/src/app/admin`

**Content and fundraising:**
- Programmes and campaigns: CRUD, lifecycle, FAQs, gallery, products, featured. Preview at `/admin/preview/[entity]/[slug]`.
- Products catalogue.

**People and money:**
- Donations and donors (search, detail, correction).
- Volunteers (review, assign, attendance, certificates).
- Events (registrations, attendance), team, impact updates.

**Content management:**
- Stories (with consent gate) and blog.
- Pages (section composer, revisions, preview).
- Media library (R2) and documents (public, private or admin-only; signed downloads).

**Communication:**
- Notifications: inbox, send log, retry. **Retry is currently a no-op.**
- Notification templates (versioned).

**Reports and administration:**
- Reports (donations, campaigns, volunteers, impact, CSV export), reconciliation (read-only), tax readiness.
- Users, roles (read-only, single role), audit logs, settings.

**Dashboard home:** NOT STARTED (`PhasePlaceholder` cards).

## 6. Authentication (CURRENT)

**Staff**
- Signs in with email and password.
- Accounts lock for 15 minutes after 5 failures.
- Sessions use a 15-minute JWT access token and a rotating refresh token.
- Sensitive actions require re-entering the password, which is valid for 5 minutes.
- **No 2FA in effect.**
- **No invite acceptance or password reset.** Admins are created only by the CLI scripts (`db:create-admin`, `db:rotate-admin-password`).

**Donors**
- Sign in with an email OTP: 6 digits, valid for 10 minutes, 5 attempts per code, 3 codes per 15 minutes.
- A verified mailbox gets an account automatically.

**PLANNED:** staff TOTP enrolment, invite emails, password reset, session-management UI.

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

**PLANNED, not built:**
- A reconciliation job and expiry of stuck pending donations.
- An idempotency key on create.
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

**Missing:**
- Admin retry: its queue has no consumer.
- Newsletter: the form is UI-only.
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
| Vercel (web), Render/Railway (api, worker) | Hosting | Documented intent only. **No deployment configuration exists.** Cloud Run is not referenced anywhere. |
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
