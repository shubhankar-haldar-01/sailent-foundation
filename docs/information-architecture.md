# Information Architecture — Sailent Foundation

**Phase:** 0 · **Date:** 19 September 2026

Covers the public site structure, homepage composition, campaign experience, product-donation UX, donor and volunteer areas, and the admin dashboard. The brief asked for its proposed structure to be reviewed rather than followed; §1 records that review.

---

## 1. Review of the proposed structure

The proposed route list is sound. Five changes are recommended, with reasons.

### 1.1 Missing — must be added

| Route | Why it is required |
|---|---|
| `/campaigns/[slug]/donate` | Donation pre-filled with campaign context. Without it, a donor clicking "Donate" on a campaign lands on a generic form and has to re-select the campaign — the largest avoidable drop-off in the funnel. |
| `/donate/checkout` | Donor details and payment initiation. Distinct from product selection so the selection step stays fast and the checkout step stays focused. |
| `/donate/status/[reference]` | **Required by decision A3.** The client's payment callback cannot be trusted, so the post-payment page must poll for server-verified state. There is no honest static thank-you page. |
| `/account/*` | The donor dashboard the brief specifies has no route in the proposed list. |
| `/volunteer/apply` | `/volunteer` is the persuasion page; the application is a long multi-step form that needs its own route for resumability, analytics and direct linking. |
| `/search` | Once there are 40+ campaigns, stories and posts, browse-only navigation fails. |
| `/admin/*` | Not in the proposed list at all. |
| `/sitemap.xml`, `/robots.txt` | See `seo-strategy.md`. |

### 1.2 Removed — `/reports` and `/transparency`

Phase 0 recommended merging two pages of downloadable PDFs into one, and Phase 2
settled on `/reports` as the canonical URL.

**Both pages were removed entirely.** The platform does not publish documents to
the public at all: annual reports, audited statements and legal filings are
internal, and live in the admin under *Content → Reports & documents*. A single
small NGO does not have two pages of downloads to fill, and a half-empty
document library damages trust more than no library does.

What could not go with them is the **registration block** — registration number,
PAN, 12A, 80G, date of registration. A donor claiming relief under Section 80G
needs those, receipts reference them, and "verify us against the public register"
is the most useful thing an NGO site offers someone deciding whether to give.
They sit on `/about`, which is where a visitor already goes to ask who this
organisation is.

### 1.3 Sharpen — `/impact` versus `/stories`

These overlap by default, and the overlap is the most common failure of NGO websites: the impact page fills with anecdotes and the stories page fills with statistics, so the numbers feel soft and the stories feel like marketing.

**Recommendation — a hard editorial line:**

- **`/impact`** — verifiable numbers and dated updates. Aggregates, geography, programme breakdowns, methodology. No anecdote leads this page.
- **`/stories`** — one human narrative each, structured as Challenge → Intervention → Journey → Outcome. Numbers appear only as supporting context.

They cross-link heavily. They do not merge.

### 1.4 Dropped — `/gallery`

Phase 0 proposed demoting a standalone gallery to a footer-linked, media-library-fed page. **Phase 7 dropped it entirely.** It was never built, and it is not going to be.

Photography still appears throughout the site — attached to the campaign, event, story or impact update it actually documents, where it has context and a caption that means something. A gallery is the same photographs with the context stripped off, and an NGO gallery of unattributed stock is worse than no gallery at all.

`campaign_gallery`, the events and stories `gallery` columns, and the media library behind them all stay. What does not exist is a standalone `/gallery` route, a `galleries` table, or an admin screen for curating albums.

### 1.5 `/donation-policy` only — `/refund-policy` was removed in Phase 9

~~Keep both.~~ **Superseded.** Phase 9 §59 removed the refund policy page, its footer link, its sitemap entry and the FAQ that referenced it: the platform implements no refunds and must not display refund policy, links, information or terms.

The argument this section used to make was that Razorpay requires every merchant to publish a visible refund and cancellation policy, and that "donations are final" is one. **That requirement has not gone away** — it is simply no longer met by this site, and if Razorpay asks for the policy during onboarding or a review it will need hosting somewhere else. The same note sits in `site-config.ts` beside the footer row, so whoever is asked knows it is absent deliberately rather than forgotten.

`/donation-policy` remains, and answers the other question a donor has: what is accepted, restricted gifts, anonymity and how funds are allocated.

### 1.6 `/faq`

Keep as a thin aggregator. Most FAQ content belongs contextually — on the campaign it concerns, on `/donate`, on `/volunteer`. `/faq` collects them by category for people who arrive searching for a specific answer.

---

## 2. Public route map

```
/                               Homepage
/about                          Mission, history, governance, approach
/team                           Staff and trustees, grouped by department
/programs                       Programme index
/programs/[slug]                Programme detail + its campaigns, stories, impact
/campaigns                      Campaign index, filterable
/campaigns/[slug]               Campaign detail
/campaigns/[slug]/donate        Donation builder, campaign pre-selected
/donate                         General donation entry (no campaign chosen)
/donate/checkout                Donor details + payment initiation
/donate/status/[reference]      Server-verified payment status (A3)
/impact                         Verified numbers, dated updates, geography
/stories                        Success story index
/stories/[slug]                 Story detail
/volunteer                      Why and how to volunteer
/volunteer/apply                Multi-step application
/events                         Event index (upcoming + past)
/events/[slug]                  Event detail + registration
/blog                           Post index
/blog/[slug]                    Post detail
/blog/category/[slug]           Category archive
/contact                        Form, address, phone, map
/faq                            Aggregated FAQs by category
/search                         Site search

Donor account (authenticated, noindex)
/account                        Overview
/account/donations              History
/account/recurring              Manage subscriptions
/account/receipts               Download receipts
/account/campaigns              Campaigns supported
/account/impact                 Impact of supported campaigns
/account/profile                Personal details, tax ID
/account/notifications          Communication preferences

Volunteer portal (authenticated, noindex)
/volunteer/portal               Overview, volunteer ID
/volunteer/portal/assignments   Current and past assignments
/volunteer/portal/attendance    Attendance and hours
/volunteer/portal/certificates  Download certificates
/volunteer/portal/profile       Editable profile

Legal
/privacy-policy   /terms   /donation-policy

Utility
/sitemap.xml   /robots.txt   /404   /500
```

### 2.1 Primary navigation

Seven items is the practical ceiling before a nav becomes a menu nobody reads.

```
Logo   About   Programs   Campaigns   Impact   Volunteer   Blog        [ Donate ]
```

- **Login / Sign Up** is the header's filled button from tablet width up (owner request, 2026-10-08; it replaced Donate there). It goes to `/sign-in`: a donor account is created by the first donation, so there is no separate sign-up. A signed-in donor sees their initials instead. On a phone it is a row in the menu ("My account" when signed in), below the menu's **Donate Now** button, which stays.
- **Programs** and **Campaigns** open a dropdown on desktop listing the top-level programmes and featured campaigns respectively, each with a "View all" link.
- **Stories**, **Events**, **Team**, **Transparency**, **Gallery**, **Contact**, **FAQ** live in the footer and in contextual links — a nav of thirteen items serves nobody.
- On scroll the header condenses (reduced height, subtle border) and its button remains. It does not hide and re-appear.

### 2.2 Mobile navigation

- Logo, a compact **Donate** button, and a menu trigger in the bar.
- Full-screen drawer, focus-trapped, dismissible by Escape, backdrop tap and a visible close control.
- Drawer order: Donate (full-width, first), then About, Programs, Campaigns, Impact, Stories, Volunteer, Events, Blog, Transparency, Contact — then phone and email as tappable links.
- Body scroll is locked while the drawer is open, and the scroll position is restored on close.

### 2.3 Footer

Four columns on desktop, stacked accordions on mobile.

| Column | Contents |
|---|---|
| Sailent Foundation | Logo, one-sentence mission, social links |
| Get involved | Donate, Volunteer, Events, Corporate partnership, Contact |
| Our work | Programs, Campaigns, Impact, Stories, Gallery |
| Accountability | About, Team, Transparency, Reports, Blog, FAQ |

Below: registration details (80G and 12A numbers, registered address), the legal links, copyright, and payment-method marks. The 80G line is displayed as a plain fact, not as a badge — a fact reads as more credible than a graphic.

---

## 3. Homepage

### 3.1 Recommendation: 12 sections, not 18

The proposed eighteen sections would produce a page most visitors never reach the end of, and would bury the sections that convert. Consolidations:

| Proposed | Recommendation |
|---|---|
| Impact statistics (full section) | Compress to a thin verified-stats band directly under the hero |
| Success stories + Testimonials | **Merge.** A beneficiary story is more persuasive than a donor testimonial; carry one donor quote inside the trust section |
| Impact updates + Blog | **Merge** into one "Latest from the field" band, mixing both by date |
| Product donation section + How donations work | **Merge.** The clearest way to explain how donations work is to show what ₹900 buys |
| Newsletter + Final donation CTA | **Merge** into one closing block, donation primary, newsletter secondary |

### 3.2 Final section order (desktop)

| # | Section | Purpose | Primary CTA |
|---|---|---|---|
| 1 | Header | Navigation, sign-in | Login / Sign Up |
| 2 | **Hero** | Who we are, what we do, one image that carries emotional weight | Donate Now / See our work |
| 3 | **Verified stats band** | Thin strip, 3–4 live figures with sources | — |
| 4 | **Mission** | What Sailent exists to do, in plain language | About us |
| 5 | **Programs** | The long-term work, as a grid | Explore programs |
| 6 | **Featured campaigns** | 2–3 active campaigns with progress | View campaign |
| 7 | **What your donation buys** | Product cards + the 4-step how-it-works | Donate |
| 8 | **Success story (featured)** | One story, full-bleed, human | Read the story |
| 9 | **Latest from the field** | Impact updates + blog, mixed by date | View all |
| 10 | **Get involved** | Volunteer + upcoming events, side by side | Become a volunteer |
| 11 | **Transparency & trust** | Registration, reports, one donor quote | See our reports |
| 12 | **Closing CTA** | Donation primary, newsletter secondary | Donate Now |
| 13 | Footer | — | — |

### 3.3 Above the fold

On a 1440×900 desktop and a 390×844 phone, a visitor must see, without scrolling:

1. The organisation's name and a one-line statement of what it does.
2. One photograph of real work — not an abstract illustration, not stock.
3. **One primary CTA: Donate Now.**
4. One secondary CTA: See our work.
5. A hint of content below the fold, so the page reads as scrollable.

The verified-stats band sits immediately below, catching the first scroll. Nothing else competes above the fold. Two equally-weighted CTAs halve the effect of both.

### 3.4 CTA hierarchy

| Level | CTA | Treatment | Where |
|---|---|---|---|
| Primary | **Donate Now** | Filled accent, largest target | Hero, campaign cards, closing block, mobile sticky bar, phone menu |
| Secondary | **Become a Volunteer** | Outline | Get-involved section, `/volunteer`, footer |
| Tertiary | Learn More · View Campaign · See Impact · Read Story · Join Event | Text link with arrow | Contextual, within cards and sections |

**One primary CTA per viewport.** If two sections with primary CTAs would be visible at once, the lower one is demoted to secondary. The mobile sticky donate bar suppresses itself while the hero or the closing CTA is on screen, so the donor never sees two Donate buttons simultaneously.

### 3.5 Mobile reordering

Mobile changes the order, because the first two screens carry almost all of the decision.

| Mobile # | Section | Change |
|---|---|---|
| 1 | Hero | Single CTA — Donate Now. Secondary becomes a text link. |
| 2 | Verified stats | 2×2 grid rather than a row |
| 3 | **Featured campaigns** | **Promoted above Mission and Programs.** A mobile visitor arriving from a share wants the concrete ask, not the institutional statement. |
| 4 | What your donation buys | Horizontal scroll carousel with visible edge-peek |
| 5 | Mission | Condensed |
| 6 | Programs | 2-column compact grid |
| 7 | Success story | Full-bleed |
| 8 | Latest from the field | 3 items, then "View all" |
| 9 | Get involved | Stacked |
| 10 | Transparency | Condensed |
| 11 | Closing CTA | — |

A sticky bottom donate bar appears after the hero leaves the viewport and hides over the closing CTA.

### 3.6 Reusable sections

Every homepage section is a component consumed elsewhere, and all of them are options in the section composer (decision: structured content + section composer).

| Component | Also used on |
|---|---|
| `SectionHero` | All top-level pages, with variants |
| `StatBand` | `/impact`, programme pages, campaign detail |
| `ProgramGrid` | `/programs`, `/about` |
| `CampaignGrid` | `/campaigns`, programme detail, `/donate` |
| `ProductShowcase` | Campaign detail, `/donate` |
| `HowItWorks` | `/donate`, `/volunteer` (step-adapted) |
| `StoryFeature` / `StoryGrid` | `/stories`, programme and campaign detail |
| `LatestFeed` | `/blog`, `/impact` |
| `GetInvolved` | `/volunteer`, `/events` |
| `TrustPanel` | `/about`, `/donate`, checkout |
| `ClosingCTA` | Every public page except checkout |
| `EventList` | `/events`, programme detail |
| `FAQAccordion` | `/faq`, campaign detail, `/donate`, `/volunteer` |

---

## 4. Key page structures

### `/about`
Hero · Mission and vision · Origin story · How we work (approach, not claims) · Where we work (map + locations) · Governance and registration · Team preview → `/team` · Transparency panel · Closing CTA

### `/programs/[slug]`
Hero (programme name, one-line purpose, hero image) · What the problem is · What we do · Goals and approach · Where · Live rollups — campaigns, funds raised, beneficiaries · Active campaigns · Stories from this programme · Impact updates · Related events · Donate to this programme

### `/impact`
Hero · Live aggregate band (lives reached, beneficiaries, projects, volunteers, volunteer hours, funds raised, programmes, locations) · Methodology note — *how we count, and what we do not claim* · Impact by programme · Geography · Dated impact updates, filterable · Closing CTA

The methodology note is unusual and deliberate. It is the single strongest trust signal on the page, because it is the thing no template site has.

### `/volunteer`
Hero · Why volunteer · Ways to contribute (skills-based, field, event, remote) · What we ask (time commitment, stated honestly) · The process (6 steps, application to certificate) · Volunteer stories · Upcoming opportunities · FAQ · Apply → `/volunteer/apply`

---

## 5. Campaign experience

### 5.1 `/campaigns` — listing

**Layout.** Filter bar (sticky on desktop, a bottom sheet on mobile) · Result count · Campaign grid — 3 columns desktop, 2 tablet, 1 mobile · Load-more pagination (not infinite scroll; infinite scroll makes the footer unreachable and breaks back-navigation).

**Filters** — all reflected in the URL via query params so a filtered view is shareable and indexable-decidable:

| Filter | Type | Notes |
|---|---|---|
| Programme | Multi-select | From `programs` |
| Category | Multi-select | Education, Healthcare, Child Welfare, Women, Livelihood, Environment, Animal Welfare, Disaster Relief |
| Location | Multi-select | State / city |
| Status | Single | Active (default), Completed, All |
| Has products | Toggle | Campaigns offering product-based giving |
| Urgency | Toggle | Ending within 30 days — only shown when real deadlines exist |

**Sorting:** Most urgent (default, by real end date) · Newest · Closest to goal · Furthest from goal · Most supporters · Highest goal.

"Closest to goal" is the strongest converting sort in this category and is offered honestly; "Furthest from goal" exists because some donors deliberately seek under-funded work.

**Empty state:** when filters match nothing, name the filters that excluded results, offer to clear them individually, and show three active campaigns below rather than a blank page.

### 5.2 Campaign card

```
┌──────────────────────────────────┐
│  [ image 16:9, lazy, alt ]       │
│  ◦ Programme · Location          │
│                                  │
│  Campaign title, up to 2 lines   │
│  One-line description            │
│                                  │
│  ████████████░░░░░░  42%         │
│  ₹4,20,000 raised of ₹10,00,000  │
│  312 supporters · 18 days left   │
│                                  │
│  [ Donate ]        View campaign │
└──────────────────────────────────┘
```

Rules:
- Progress bar shows a percentage and both absolute figures. A percentage alone hides whether the goal is ₹50,000 or ₹50,00,000.
- "Days left" appears only when there is a real end date. No manufactured urgency.
- Supporter count is suppressed below 5 — "3 supporters" on a new campaign reads as failure.
- A products badge appears when the campaign offers product giving, because that is the differentiator.
- Completed campaigns show a full bar, a "Goal reached" state, and the CTA changes to "See what happened".
- The whole card is clickable to the detail page; the Donate button stops propagation and goes straight to the donation builder.

### 5.3 `/campaigns/[slug]` — detail

Desktop is a two-column layout with a sticky donation panel; mobile is a single column with a sticky bottom bar.

```
Breadcrumb: Home › Campaigns › [Programme] › [Campaign]

┌─────────────────────────────┬──────────────────┐
│ Media gallery               │  ███████░░  42%  │
│ Title                       │  ₹4,20,000       │
│ Programme · Location · Dates│  of ₹10,00,000   │
│ Short description           │  312 supporters  │
│                             │  18 days left    │
│ [tabs]                      │                  │
│  Story  Impact  Updates     │  [ Donate Now ]  │
│  Products  FAQs  Documents  │                  │
│                             │  Ways to give:   │
│ ── Story ──                 │  School Kit ₹900 │
│ Full description            │  Textbook  ₹600  │
│ Beneficiary context         │  Medicine ₹1,200 │
│ What your support does      │  or any amount   │
│                             │                  │
│ ── Products ──              │  ✓ 80G eligible  │
│ [product cards]             │  ✓ Receipt by    │
│                             │    email         │
│ ── Updates ──               │                  │
│ Dated timeline              │  Share: ⧉ ⧉ ⧉    │
│                             │                  │
│ ── Impact ──                └──────────────────┘
│ Beneficiaries reached / target
│ Linked impact records
│
│ ── FAQs ──   ── Documents ──
│
│ Related campaigns · Stories from this campaign
└─────────────────────────────────────────────────┘
```

Status affects the panel, not the page — the story stays readable in every state:

| Status | Donation panel |
|---|---|
| Active | Full donation panel |
| Paused | "Donations temporarily paused" with a reason; panel disabled, story intact |
| Completed | Outcome summary, "See the impact", donate-to-programme offered instead |
| Archived | Read-only, `noindex`, no donation path |
| Draft | 404 to the public; staff see it via a signed preview link |

---

## 6. Product donation architecture

The core differentiator, and the part most likely to be got wrong.

### 6.1 Product card

```
┌─────────────────────────────────┐
│ [ image 4:3 ]                   │
│ School Kit                      │
│ ₹900                            │
│                                 │
│ Notebooks, stationery, bag      │
│ and uniform for one child for   │
│ a full school year.             │
│                                 │
│ ██████████░░░░  340 of 500      │
│                                 │
│  [ − ]   2   [ + ]   ₹1,800     │
└─────────────────────────────────┘
```

- The **description says what the donor is buying**, concretely. "School Kit ₹900" alone converts far worse than a sentence naming its contents and its duration.
- Progress appears only when a `target_quantity` exists. An open-ended product shows the count provided instead.
- The quantity stepper is the interaction. The line total updates live beside it.
- Touch targets are at least 44×44px; the `−` control is disabled at 0 rather than hidden, so the layout does not shift.
- Quantity is also directly editable for donors giving at scale, with the same clamping as the stepper.

### 6.2 Selection states

| State | Presentation |
|---|---|
| Available | Full card, stepper active |
| Selected | Accent border, quantity and line total visible |
| Nearly fulfilled (< 10% remaining) | "Only 12 remaining" — factual, from real data |
| Fulfilled | Greyed, stepper replaced by "Fully funded — thank you", card moves to the end of the list |
| Inactive | Not rendered at all |
| Campaign paused | All steppers disabled with one explanation above the list, not repeated per card |

### 6.3 Donation builder — `/campaigns/[slug]/donate`

Three zones on one screen. No wizard for selection; a wizard here adds steps without adding clarity.

```
┌────────────────────────────┬───────────────────┐
│ 1 · Choose what to fund    │  Your donation    │
│                            │                   │
│ [product] [product]        │  School Kit × 2   │
│ [product] [product]        │           ₹1,800  │
│                            │  Textbook  × 1    │
│ 2 · Add any amount         │             ₹600  │
│  ₹500  ₹1000  ₹2500  [__]  │  Additional ₹500  │
│                            │  ─────────────    │
│ 3 · Make it monthly?       │  Total    ₹2,900  │
│  [ ] Give this every month │                   │
│                            │  [ Continue ]     │
│                            │  80G eligible     │
└────────────────────────────┴───────────────────┘
```

- **Either path alone is complete.** A donor who wants to give ₹500 and nothing else can do so without touching a product; a donor who wants two kits and nothing else can proceed without entering an amount. The hybrid is a natural consequence, not a mode to select.
- The summary is sticky on desktop and a collapsed bottom sheet on mobile showing the total, expanding on tap.
- Continue is disabled at a total of zero, with the reason stated rather than left to inference.
- A minimum donation (₹10, to be confirmed) is enforced and stated before the donor tries.
- The monthly toggle sits here, not at checkout, because it changes the payment instrument options (UPI Autopay caps at ₹15,000 per cycle — above that the donor is told eNACH is used, before they reach payment).
- Selection is persisted in `sessionStorage` keyed by campaign, so a back-navigation or an accidental refresh does not lose the work. It is re-validated server-side on submit; the stored state is a convenience, never a source of truth.

### 6.4 Mobile donation flow

Same three zones, stacked, with the summary as a bottom sheet:

1. Product list, vertically stacked, full-width cards.
2. Custom amount chips, wrapping to two rows.
3. Monthly toggle.
4. Persistent bottom bar: `₹2,900 · 3 items ▲` with `Continue`. Tapping the bar expands the itemised summary; every line is editable there without scrolling back up.

---

## 7. Donor and volunteer areas

### `/account`
Overview (total given, campaigns supported, active monthly gift, next charge date) · Donations · Recurring · Receipts · Supported campaigns · Impact · Profile · Notifications.

Visible to the donor: their own donations with full line-item detail, receipts, subscription state, and impact updates for campaigns they funded.
Never visible to the donor: other donors' information, aggregate campaign finances beyond what is public, internal notes on their record, or any admin data.

### `/volunteer/portal`
Volunteer ID and status · Assignments · Attendance and hours · Certificates · Profile.

**Volunteer-editable:** contact details, skills, interests, availability, emergency contact, profile photo, and uploading their own documents.
**Admin-only:** status, volunteer ID, assignments, attendance records, verified hours, certificates, internal notes, and document verification state.

That split matters: a volunteer who can edit their own attendance can inflate the hours printed on a certificate.

---

## 8. Admin information architecture

### 8.1 Review of the proposed sidebar

The proposed structure is good. Four refinements:

1. **Add a Finance group.** The brief places Receipts under Fundraising, but reconciliation, settlements and the Form 10BD export are a distinct job done by a distinct role. Burying the 31 May statutory deadline inside a fundraising menu is how deadlines get missed.
2. **Rename "Programs" to "Programmes & Work".** The group contains events, impact and stories, not just programmes, and the current name under-describes it.
3. **Add Moderation under People.** Volunteer applications need a queue with a visible count, not a filtered list view someone remembers to check.
4. **Surface pending counts as badges** on Donations (failed/pending), Volunteers (applications), Content (awaiting review) and Finance (reconciliation mismatches). The sidebar should tell an operator where the work is.

### 8.2 Final admin sidebar

```
Dashboard

Fundraising
  Donations                    ⦿ 3 failed
  Campaigns
  Campaign Products
  Recurring Donations          ⦿ 2 halted
  Donation Sources

Finance
  Reconciliation               ⦿ 1 mismatch
  Receipts
  Tax Compliance (10BD/10BE)   ⦿ 41 missing PAN
  Settlements

People
  Donors
  Volunteers
  Volunteer Applications       ⦿ 7 pending
  Team / Staff
  Departments

Programmes & Work
  Programmes
  Events
  Event Registrations
  Impact Records
  Success Stories

Content
  Pages
  Blog
  FAQs
  Documents
  Media Library

Reports
  Donations
  Campaigns
  Volunteers
  Impact
  Exports

Communication
  Notifications
  Email Templates
  Send Log
  Newsletter Subscribers

System
  Users
  Roles & Permissions
  Settings
  Audit Logs
```

The sidebar filters itself by the viewer's permissions (A9) — a Content Manager sees Content, Programmes & Work and a reduced Reports, and nothing else. Filtering is cosmetic; the API enforces independently.

### 8.3 Dashboard

Role-aware. A Finance Manager and a Content Manager should not see the same home screen.

- **Top band:** donations today / this month, active campaigns, pending volunteer applications, upcoming events — each linking to its filtered list.
- **Primary chart:** donations over time, switchable between amount and count, with a comparison period.
- **Attention panel:** the things that are wrong — failed payments, halted subscriptions, reconciliation mismatches, content awaiting review, donations missing a tax ID as the 10BD deadline approaches. This panel is the most valuable element on the page and sits above the fold.
- **Recent activity:** from the audit log, filtered to what the viewer may see.

### 8.4 Admin list-view conventions

One pattern, applied everywhere, so that learning one screen teaches all of them:

- Page header with title, record count and primary action.
- Filter bar with search, entity-specific filters and a date range. **All filter state lives in the URL**, so any view is shareable and bookmarkable.
- Table with sortable columns, row selection, bulk actions, and a per-row overflow menu.
- Server-side pagination with a page-size control; page size persists per user per table.
- Column visibility control, persisted per user.
- Export respecting the current filters, permission-gated, and audited.
- Empty states distinguish *no records exist yet* (offer the create action) from *no records match these filters* (offer to clear them).

### 8.5 Admin detail-view conventions

- Breadcrumb, title, status badge, primary action, overflow menu.
- Tabbed sections for related data.
- A right rail for metadata: created/updated, owner, status history.
- An activity timeline from the audit log on every significant entity.
- Destructive actions live in the overflow menu, are typed-confirmation gated, and require re-authentication (A9).

---

## 9. Breadcrumbs

On every page except the homepage and checkout.

```
Home › Campaigns › Education › Building a Library in Kanke
Home › Programmes › Education
Home › Stories › How Sunita finished school
```

Rendered visibly and emitted as `BreadcrumbList` structured data (`seo-strategy.md`). Campaign breadcrumbs route through the programme, which reinforces that campaigns are part of long-term work rather than isolated appeals.

---

*Related: [`user-flows.md`](user-flows.md) · [`design-system.md`](design-system.md) · [`seo-strategy.md`](seo-strategy.md)*
