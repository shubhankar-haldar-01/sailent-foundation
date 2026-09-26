# Product Requirements — Sailent Foundation Platform

**Phase:** 0 · **Date:** 19 September 2026 · **Status:** Defined, not implemented

---

## 1. What this is

One digital platform for **one NGO**, Sailent Foundation. It is the organisation's website, its fundraising engine, its donor and volunteer system of record, its content management system, and its internal operations dashboard — as a single product with a single database and a single design system.

It is **not** a multi-NGO marketplace, not a donation aggregator, not a white-label template, and not a SaaS product. There is exactly one organisation in the database, and its identity is configuration rather than a tenancy dimension.

### The test we are building against

A donor lands from a WhatsApp forward, reads a campaign, chooses to fund two school kits and adds ₹500, pays on their phone, receives a receipt that names what they funded, and three months later sees a dated update showing that the kits reached a named school. A programme manager entered that update in the same system that issued the receipt.

If all of that works, the platform works. Every requirement below serves that sentence.

---

## 2. Scope

### In scope for v1

Public website · Campaign management · Product-based donations · Custom-amount donations · Hybrid donations · Recurring donations · Donation receipts and Form 10BD export · Donor accounts and dashboard · Volunteer lifecycle from application to certificate · Team/staff directory · Programmes · Events with registration · Impact tracking · Success stories · Transparency and public documents · Blog and CMS · Gallery · Notifications and transactional email · Reports and analytics · Admin dashboard · RBAC · Audit logs

### Explicitly out of scope

| Excluded | Why |
|---|---|
| Peer-to-peer fundraising | Client decision. Supporters cannot create their own fundraisers. Adding it later is a new module, not a migration — campaigns carry a nullable attribution column. |
| Multi-NGO / marketplace | Single-organisation product by definition. |
| Foreign contributions | No FCRA registration. Accepting them would be illegal, not merely unbuilt. See §6. |
| Full CSR workflow | Corporate donors can be recorded; CSR-1 tracking, MoUs and utilisation reports are deferred. |
| Multi-language | Content is structured to allow it later; no translation layer in v1. |
| Mobile application | The API would support one; none is planned. |
| Grant disbursal / payouts | Money flows in, not out. Refunds were withdrawn in Phase 7, so there is no outward path at all. |
| Crypto, in-kind logistics, e-commerce merchandise | Not requested; each is a separate product. |

### Non-goals of a different kind

Things we could build but choose not to, because they would damage the product:

- **A homepage that is a donation form.** Donation must be one tap away everywhere without the site feeling like a checkout.
- **Vanity statistics.** No number is displayed that the database cannot produce (decision A14).
- **A general-purpose page builder.** Editors compose from approved sections; they do not get arbitrary layout control, because off-brand pages are worse than no pages.
- **Gamified giving.** No leaderboards, badges or urgency timers that manufacture pressure. Real deadlines only.

---

## 3. People this serves

### Priya — first-time donor, mobile, arrived from a share

Sees the campaign on a 5-year-old Android over patchy 4G. Has never heard of Sailent. Decides in under ninety seconds whether this is real. Wants to know: is this organisation legitimate, what exactly does my money buy, and will I find out what happened.

*Requires:* fast mobile pages, visible trust signals, concrete product pricing, guest checkout with no account, UPI, an immediate receipt, and a later impact update.

### Rajesh — recurring donor, gives ₹1,000 monthly

Set up a monthly gift eighteen months ago. Needs to update a card, pause during a difficult month, download receipts at tax time, and see cumulative impact.

*Requires:* donor dashboard, self-service subscription management including pause and cancel, receipt history, tax-ID capture, and campaign-level impact for what he funded.

### Anita — volunteer coordinator (Volunteer Manager role)

Processes applications, approves volunteers, assigns them to events and projects, records attendance, and issues certificates. Works in the admin dashboard daily and lives in list views and bulk actions.

*Requires:* an application review queue, bulk approval, assignment tools, attendance capture that works on a phone at an event, hour accumulation, and certificate generation.

### Vikram — finance manager

Reconciles Razorpay settlements against donations, handles refunds, and owns the 31 May Form 10BD deadline.

*Requires:* donation ledger with payment state, reconciliation reporting, refund workflow with approval, receipt management, tax-ID completeness tracking, and the Form 10BD export.

### Meera — content and campaign manager

Writes campaigns, publishes stories and blog posts, curates the homepage, and posts impact updates.

*Requires:* a structured editor, draft/review/publish workflow, media library, section composer for the homepage, scheduling, and preview.

### Sailent's trustees and grant-makers

Read `/about` before a conversation about funding. Registration details and governance are published there; annual reports and audited statements are not published at all — they are shared on request, because the platform keeps documents internal.

*Requires:* a credible, complete, current transparency page with real documents.

---

## 4. Module requirements

Twenty-three modules. Each states its purpose, its v1 boundary, and how we know it is done.

### 4.1 AUTH

Donor authentication by email OTP — no donor password exists, and none will (A8, revised in Phase 7). Staff by email, password and mandatory TOTP for privileged roles. No self-registration for staff. Donation never requires authentication.

**Done when:** a donor can claim an account created by their donation using the phone number from checkout; a staff member cannot reach any admin route without a valid staff-audience token; a donor token is rejected at admin endpoints on audience alone.

### 4.2 USERS

Staff accounts, invitations, profile, session management, forced logout, role assignment. Distinct from `donors` — a user is someone who logs in to *operate* the platform.

**Done when:** a Super Admin can invite, suspend and reassign roles for a staff user, and every such action is audited.

### 4.3 DONORS

Donor records created by donations, not signups. Deduplicated by phone, secondarily by email. Holds giving history, preferences, communication consent, tax ID, and address. A donor may exist without ever logging in.

**Done when:** two donations from the same phone number attach to one donor record; a donor can claim, view and correct their own record; unsubscribing is honoured within one send cycle.

### 4.4 VOLUNTEERS

Full lifecycle: Applied → Under Review → Approved → Active → Inactive / Suspended / Rejected / Archived. Permanent volunteer ID at approval (A13). Profile, skills, availability, assignments, attendance, hours, certificates, documents.

**Done when:** an application can be reviewed and approved, produces `VOL-2026-00001`, can be assigned to an event, have attendance recorded, accumulate hours, and generate a certificate naming those hours.

### 4.5 TEAM / STAFF

Public-facing directory of people: name, designation, department, bio, photo, social links, display order, visibility. Separate from both volunteers and login accounts — a trustee may appear on `/team` without ever logging in.

**Done when:** `/team` renders departments in a controlled order, and hiding a member removes them from the public page without deleting the record.

### 4.6 PROGRAMS

Long-term initiatives (Education, Healthcare, Child Welfare, Women Empowerment, Livelihood, Environment, Animal Welfare). Goals, beneficiaries, locations, related campaigns, stories and impact.

**Done when:** a programme page shows its own content plus live rollups of its campaigns, stories and impact, and every campaign belongs to exactly one programme.

### 4.7 CAMPAIGNS

Time-bound fundraising efforts under a programme. Statuses: Draft, Published, Active, Paused, Completed, Archived. Goal, raised, donor count, beneficiary target and reached, media, products, updates, FAQs, documents.

**Done when:** the full status lifecycle is enforced server-side, a paused campaign refuses new donations, and listing pages filter and sort correctly.

### 4.8 CAMPAIGN PRODUCTS

The core differentiator. Named, priced units of impact — School Kit ₹900, Textbook Set ₹600, Medicine Kit ₹1,200 — each optionally with a target quantity and a provided count.

**Done when:** a donor can add multiple products with quantities, combine them with a custom amount in one donation, and the provided count increments only on captured payment under the locking rules of A6.

### 4.9 DONATIONS

Header plus line items (A5), snapshotted prices, one-time and recurring, guest and authenticated, anonymous option.

**Done when:** the ₹2,900 hybrid example from the brief produces one donation, three line items, one payment, one receipt, and correct increments on two products and one campaign.

### 4.10 PAYMENTS

Razorpay integration with server-side verification, webhook ledger, signature verification, idempotency, state machine, refunds and partial refunds, reconciliation (A3, A4).

**Done when:** duplicate webhooks are no-ops, out-of-order webhooks do not corrupt state, a donation completes even if the donor closes the browser, and the nightly reconciliation finds zero discrepancies.

### 4.11 SUBSCRIPTIONS

Recurring donations via Razorpay Subscriptions. Full lifecycle including `pending` and `halted` recovery. UPI Autopay is capped at ₹15,000 per cycle; above that, eNACH.

**Done when:** a donor can create, pause, resume and cancel a monthly gift; each successful charge creates a donation and a receipt; a halted subscription triggers donor recovery messaging rather than silence.

### 4.12 RECEIPTS

Gapless numbering per financial year, PDF in R2, emailed on capture, downloadable from the donor dashboard. Void-and-reissue, never delete-and-renumber (A7).

**Done when:** every captured donation has exactly one receipt, numbering has no gaps, and a voided receipt remains retrievable.

### 4.13 TAX DOCUMENTS (Form 10BD / 10BE)

Donor tax-ID capture with type, Form 10BD export for a financial year, storage of Form 10BE certificates for issue to donors, and deadline tracking (A7).

**Done when:** Finance can export a 10BD-shaped file for FY 2026-27 and see the count of captured donations still missing a tax ID.

### 4.14 EVENTS

Listing, detail, registration with capacity, waitlist, date/time and location, programme/campaign relation, volunteer participation, attendance.

**Done when:** an event can be published, reach capacity, waitlist further registrants, and have attendance recorded against both registrants and assigned volunteers.

### 4.15 IMPACT

The chain from Donation → Campaign → Project → Activity → Impact. Public aggregate metrics, dated impact records with location and evidence, and eventually donor-visible impact for campaigns they supported.

**Done when:** every public impact number resolves to a database aggregate or a dated record (A14), and a donor can see updates for campaigns they funded.

### 4.16 SUCCESS STORIES

Structured human narrative: Challenge → Intervention → Journey → Outcome → Impact, with media, consent, and relations to campaign and programme.

**Done when:** a story renders in the structured template, links to its campaign and programme, and cannot be published without a recorded consent flag for identifiable subjects.

### 4.17 CONTENT (CMS)

Structured typed content for campaigns, programmes, stories, events, blog and FAQs, plus a **section composer** for the homepage and marketing pages only. Draft → In Review → Published → Archived, with scheduling and preview.

**Done when:** an editor can compose the homepage from approved sections, reorder them, schedule a publish, and preview unpublished content via a signed link.

### 4.18 BLOG

Posts, categories, tags, authors, featured images, related content, RSS.

**Done when:** posts publish on schedule, list with pagination, and carry correct Article structured data.

### 4.19 GALLERY — dropped

**Not in scope, and not deferred.** Phase 7 removed a standalone gallery from the product. Photography lives attached to the campaign, event, story or impact update it documents — where it has context, a caption and a reason to exist — rather than in an album of its own.

The media library, `campaign_gallery` and the per-entity gallery columns remain. What is out is the album-curation feature and the `/gallery` route.

### 4.20 DOCUMENTS

**No public document library.** Annual reports, audited statements and policies are ADMIN-ONLY, under *Content → Reports & documents*; volunteer ID proofs and internal financials likewise. Nothing in this module is publicly reachable — the only documents a visitor sees are ones explicitly attached to a campaign and marked public.

**Done when:** a private document is unreachable without an authorised signed URL, and changing a document's visibility requires re-authentication and writes an audit row.

### 4.21 NOTIFICATIONS

Transactional email via Brevo (receipts, confirmations, volunteer status, event reminders), in-app admin notifications, templates with versioning, and a send log.

**Done when:** every transactional email has a template, a log entry and a delivery status, and a failed send is retried and visible to admins.

### 4.22 REPORTS & ANALYTICS

Donations, campaigns, volunteers and impact. Date ranges, CSV export, and the reconciliation and 10BD readiness views.

**Done when:** Finance can export donations for an arbitrary range with payment state, and every export is audited.

### 4.23 ADMIN, RBAC, AUDIT LOGS & SETTINGS

Six roles, permission-string enforcement, deny-by-default, re-authentication for sensitive operations, append-only audit log, and organisation settings (A9, A10).

**Done when:** a Content Manager cannot reach donation data through any route, the sidebar reflects the same permissions the API enforces, and every sensitive mutation appears in the audit log with a before/after diff.

---

## 5. Cross-cutting requirements

**Performance.** Public pages target LCP under 2.5s on a mid-range Android on 4G. The donation flow must work on a slow connection — no step may depend on a large client bundle.

**Availability.** Payment capture and webhook intake are the critical path. The webhook endpoint must stay available and fast (single insert) even when the rest of the API is degraded.

**Accessibility.** WCAG 2.2 AA where practical, with the donation and volunteer-application flows as hard requirements rather than best-effort. Detail in `design-system.md`.

**Data protection.** Four-tier classification (PUBLIC / PRIVATE / SENSITIVE / ADMIN-ONLY) applied per column, in `database-architecture.md`. PAN, addresses and volunteer documents are never public under any configuration.

**Auditability.** Any financial or permission-changing action is reconstructible from the audit log.

**Honesty.** No fabricated statistics, no placeholder content in production, no claimed certifications the NGO does not hold, and no structured data asserting things we cannot substantiate.

---

## 6. Compliance requirements

Sailent Foundation is **12A and 80G registered** and **not FCRA registered**.

### 80G — donor tax deduction

- Receipts carry the organisation's 80G registration details and are issued immediately (A7).
- Donor tax ID (PAN preferred; Aadhaar, Passport, Driving Licence, Voter ID or foreign Tax ID accepted) is captured with its type — **after** payment, never as a blocker before it.
- **Form 10BD** statement of donations must be filed by **31 May** following the end of the financial year; the platform produces the export. Late filing attracts ₹200 per day under §234G plus a §271K penalty of ₹10,000 to ₹1,00,000, so the Finance dashboard surfaces the deadline and the tax-ID completeness gap as standing items.
- **Form 10BE** certificates are issued by the Income Tax Department, not by us. The platform stores and distributes them; it never generates them or calls a receipt one.

### FCRA — foreign contributions

No FCRA registration means **no foreign contribution may be accepted, in any amount**. Therefore:

- Currency is INR only.
- International cards and foreign payment instruments are disabled in the Razorpay configuration.
- Public copy does not solicit donations from outside India; the donation page states the restriction plainly rather than letting a foreign donor discover it at failure.
- Any foreign contribution received in error must be identifiable and returnable — the payment record retains the instrument's country where Razorpay provides it.
- This is a **feature gate**, documented as such, that opens only on FCRA registration (which itself requires the designated SBI Sansad Marg account and brings the 20% administrative-expense cap and annual FC-4 filing).

### Payment-gateway requirements

A reachable refund policy is required by Razorpay; hence `/refund-policy` is mandatory, not optional. Terms, privacy policy and contact details must be reachable from the footer of every page.

---

## 7. Assumptions

1. Indian financial year (1 April – 31 March) governs receipt numbering and 10BD. *To confirm — open question 8 in the decision log.*
2. Razorpay is the sole payment provider for v1; no second gateway and no fallback.
3. Donation volume at launch is in the hundreds per month, not thousands per second. The architecture scales well past that, but nothing is pre-optimised for a load that does not exist.
4. Content — real programmes, campaigns, photography and stories — is produced by the client in parallel and is likely the launch critical path, not the code.
5. English only at launch.

---

## 8. Acceptance criteria for Phase 0

From the brief, mapped to where each is satisfied.

| # | Criterion | Where |
|---|---|---|
| 1 | Product scope clearly defined | This document, §2–§4 |
| 2 | Public website structure defined | `information-architecture.md` §2–§4 |
| 3 | Admin structure defined | `information-architecture.md` §8 |
| 4 | Donor journey defined | `user-flows.md` §2–§4 |
| 5 | Volunteer journey defined | `user-flows.md` §6 |
| 6 | Team/staff structure defined | This document §4.5; `database-architecture.md` |
| 7 | Campaign architecture defined | `information-architecture.md` §5 |
| 8 | Product donation architecture defined | `information-architecture.md` §6; `user-flows.md` §2 |
| 9 | Payment flow documented | `user-flows.md` §3 |
| 10 | Recurring donation flow documented | `user-flows.md` §5 |
| 11 | Database domain model documented | `database-architecture.md` |
| 12 | API architecture documented | `api-architecture.md` |
| 13 | RBAC documented | `rbac.md` |
| 14 | Design system direction documented | `design-system.md` |
| 15 | Responsive behaviour documented | `design-system.md` §9 |
| 16 | Accessibility requirements documented | `design-system.md` §10 |
| 17 | SEO architecture documented | `seo-strategy.md` |
| 18 | Analytics events documented | `analytics-plan.md` |
| 19 | Security architecture documented | `security-architecture.md` |
| 20 | Edge cases documented | `user-flows.md` §9 |
| 21 | Repository architecture documented | `architecture.md` §5 |
| 22 | No unnecessary architecture complexity | This document §2 non-goals; `architecture.md` §7 |
| 23 | No application implementation started | `docs/` only; no code, no dependencies, no migrations |

---

*Related: [`phase-0-decisions.md`](phase-0-decisions.md) · [`information-architecture.md`](information-architecture.md) · [`user-flows.md`](user-flows.md)*
