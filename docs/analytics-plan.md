# Analytics Plan — Sailent Foundation

**Phase:** 0 · **Date:** 19 September 2026

Two separate concerns, deliberately kept apart:

- **Public analytics (GA4)** — how people find and move through the site. Anonymous, aggregate, consent-governed.
- **Operational analytics (our database)** — what actually happened. Donations, donors, campaigns, volunteers. Authoritative, complete, permission-controlled.

**GA4 is never the source of truth for money.** Ad blockers, consent refusals and dropped beacons mean GA4 systematically undercounts — typically 10–30% in this market. Every financial figure comes from the database. GA4 answers "where did they come from and where did they hesitate"; the database answers "how much was raised".

---

## 1. PII rules

Non-negotiable, and enforced by a shared wrapper rather than by per-call-site discipline.

**Never sent to any analytics service:**

Names · email addresses · phone numbers · **PAN or any tax ID** · postal addresses · donor ids, volunteer ids or user ids · donation reference numbers · IP addresses (GA4 anonymisation on) · any free-text a user typed · exact donation amounts tied to an identifiable session.

**Safe to send:** page paths, campaign and programme slugs, product names, **bucketed** amounts, counts, statuses, and UTM parameters.

Amounts are bucketed rather than exact:

```
0–499 · 500–999 · 1000–2499 · 2500–4999 · 5000–9999 · 10000–24999 · 25000+
```

Bucketing keeps funnel analysis useful while making a single donation impossible to identify. An exact ₹47,300 donation on a given evening identifies a person to anyone who knows them; `25000+` does not.

Implementation: a single `track()` wrapper in `packages/analytics` accepts only typed, whitelisted parameters. **There is no raw `gtag()` call anywhere in the application**, so a PII leak requires editing the wrapper — a visible, reviewable change — rather than a moment's inattention in a component.

---

## 2. Consent

- Analytics load **only after consent**. A single banner, plainly worded, with Accept and Decline given equal visual weight. No dark patterns, no cookie wall.
- Declining is remembered and honoured; nothing beyond strictly necessary cookies loads.
- Google Consent Mode v2 with `analytics_storage` and `ad_storage` denied by default.
- **The donation flow works identically with analytics declined.** Analytics never gates functionality.
- The privacy policy states plainly what is collected and what is not.

DPDP compliance requires meaningful consent. A banner engineered to make declining difficult is not consent.

---

## 3. Public event taxonomy

`snake_case` names, typed parameters, `sf_` prefix on custom parameters to keep them distinct from GA4's reserved set.

### Browsing

| Event | Parameters | Fired when |
|---|---|---|
| `page_view` | `page_path`, `page_title`, `page_type` | Automatic |
| `campaign_view` | `sf_campaign_slug`, `sf_program_slug`, `sf_campaign_status`, `sf_has_products` | Campaign detail loads |
| `program_view` | `sf_program_slug` | Programme detail loads |
| `story_view` | `sf_story_slug`, `sf_program_slug` | Story detail loads |
| `campaign_filter_applied` | `sf_filter_type`, `sf_filter_value`, `sf_result_count` | Filter changed on `/campaigns` |
| `campaign_sort_changed` | `sf_sort_value` | Sort changed |
| `search` | `search_term`, `sf_result_count` | Site search |

### Donation funnel — the funnel that matters

| Event | Parameters | Fired when |
|---|---|---|
| `donate_click` | `sf_source` (header, hero, card, sticky_bar, closing_cta), `sf_campaign_slug` | Any donate CTA clicked |
| `donation_builder_view` | `sf_campaign_slug`, `sf_product_count` | Builder opens |
| `product_selected` | `sf_product_name`, `sf_product_price_bucket`, `sf_campaign_slug` | Quantity goes 0 → 1 |
| `product_quantity_changed` | `sf_product_name`, `sf_new_quantity`, `sf_direction` | Stepper used |
| `product_removed` | `sf_product_name` | Quantity returns to 0 |
| `custom_amount_selected` | `sf_amount_bucket`, `sf_input_method` (preset \| manual) | Custom amount entered |
| `recurring_toggled` | `sf_enabled`, `sf_amount_bucket` | Monthly toggle |
| `checkout_started` | `sf_campaign_slug`, `sf_total_bucket`, `sf_item_count`, `sf_donation_shape` (product \| custom \| hybrid) | Continue pressed |
| `donor_details_completed` | `sf_is_returning`, `sf_tax_id_provided` | Details submitted |
| `payment_started` | `sf_total_bucket`, `sf_donation_type` | Razorpay opens |
| `payment_method_selected` | `sf_method` (upi, card, netbanking, wallet) | Instrument chosen |
| `donation_success` | `sf_total_bucket`, `sf_item_count`, `sf_donation_shape`, `sf_campaign_slug`, `sf_is_recurring` | **Server-confirmed** |
| `donation_failed` | `sf_failure_stage`, `sf_error_category`, `sf_total_bucket` | Payment failed |
| `donation_abandoned` | `sf_last_step`, `sf_total_bucket` | Builder or checkout left without paying |

**`donation_shape` is the parameter this platform exists to measure.** Whether donors choose products, custom amounts, or the hybrid is the question the product-donation architecture was built to answer, and it should drive how campaigns are configured.

**`donation_success` fires only on server-confirmed completion** (A3). Firing it on the client callback would inflate the conversion rate with payments that never captured — and would make the analytics disagree with the finance report in a way nobody could reconcile.

### Volunteering and events

| Event | Parameters |
|---|---|
| `volunteer_page_view` | `sf_source` |
| `volunteer_registration_started` | `sf_source` |
| `volunteer_step_completed` | `sf_step_number`, `sf_step_name` |
| `volunteer_registration_completed` | `sf_skills_count`, `sf_availability_type` |
| `volunteer_registration_abandoned` | `sf_last_step` |
| `event_view` | `sf_event_slug`, `sf_event_type` |
| `event_registration_started` / `_completed` | `sf_event_slug`, `sf_attendee_count` |
| `event_waitlisted` | `sf_event_slug` |

The step-level events matter: a multi-step application that loses 60% of applicants at step 4 is a fixable problem, but only if the drop-off is visible.

### Engagement

`newsletter_signup` · `document_download` (`sf_document_type`, `sf_financial_year`) · `share_click` (`sf_channel`, `sf_content_type`) · `outbound_click` · `scroll_depth` (25/50/75/100 on long-form only) · `video_play`.

~~`document_download` on `/transparency`~~ — removed. The platform publishes no documents publicly, so there is no public download to instrument. Institutional interest now shows up as contact-form submissions instead.

---

## 4. Conversions and funnels

**Primary conversions:** `donation_success`, `volunteer_registration_completed`, `event_registration_completed`, `newsletter_signup` (secondary).

### Funnels monitored

**Donation (the one that matters)**
```
campaign_view → donate_click → donation_builder_view → checkout_started
              → payment_started → donation_success
```
Segmented by device, source, campaign, and donation shape. Expect the largest drops between `donation_builder_view → checkout_started` (indecision or friction in the builder) and `payment_started → donation_success` (payment failure or hesitation at the gateway). These two transitions get the most design attention.

**Volunteer**
```
volunteer_page_view → registration_started → step 1…7 → completed
```

**Product selection**
```
donation_builder_view → product_selected → quantity_changed → checkout_started
```
Reveals which products convert, which are priced wrong, and whether the hybrid path is used at all.

---

## 5. Attribution

UTM parameters captured on landing, persisted in the session, and **stored on the donation record** (`donations.utm_*`) — so attribution survives in the database, independent of GA4's model, consent state or lookback window. That is what makes "which channel produced this ₹40,000" answerable a year later.

`utm_source` · `utm_medium` · `utm_campaign` · `utm_content` · `utm_term`, plus `sf_source` for internal placements (which CTA), so it is possible to tell whether the header button or the sticky mobile bar does the work.

WhatsApp shares carry a campaign-specific parameter, because WhatsApp traffic otherwise arrives as direct and becomes invisible — and in this market it is likely the largest single channel.

---

## 6. Operational analytics

Separate from GA4, sourced from the database, permission-controlled per `rbac.md`, and **never sent to a third party**.

### Dashboard KPIs

**Fundraising** — donations today / week / month / year · total raised · average donation · median donation (more honest than the mean, which one large gift distorts) · donor count · new vs returning · recurring revenue and its share · retention · campaign progress · **donation shape distribution**.

**Payments** — success rate by method, failure reasons, pending over 30 minutes, reconciliation mismatches, refund rate.

**Compliance** — donations missing a tax ID, days to the 31 May Form 10BD deadline, receipts issued vs donations captured.

**Volunteers** — applications pending, approval rate, time-to-approval, active volunteers, hours logged, attendance rate, certificates issued.

**Content** — top campaigns by conversion (not by views), stories read, documents downloaded, content awaiting review.

### Deliberately not measured

Per-donor behavioural profiling. Individual page-level tracking tied to identity. Anything requiring a cross-site identifier. None of it would change a decision this organisation makes, and all of it increases exposure.

---

## 7. Tooling

| Tool | Purpose | Data |
|---|---|---|
| GA4 | Public behaviour, acquisition, funnels | Anonymous, consent-gated |
| Search Console | Search performance | Aggregate |
| Sentry | Errors and performance | **PII scrubbed before the first deploy, not after the first leak** |
| Our database | All operational and financial reporting | Full, permission-controlled |

Admin routes are **excluded from GA4 entirely** — staff behaviour would pollute the public funnel and there is no reason to send internal usage to Google. Admin usage insight, where needed, comes from the audit log.

No session recording, no heatmaps, no third-party personalisation. A tool that records a donor typing their PAN into a form is a liability, whatever its masking claims.

---

## 8. Reporting rhythm

| Cadence | Audience | Contents |
|---|---|---|
| Daily | Operations | Donations, failures, pending applications, alerts |
| Weekly | Management | Fundraising vs target, campaign performance, volunteer pipeline, content |
| Monthly | Leadership | Full fundraising report, donor retention, channel performance, impact delivered |
| Quarterly | Board | Financial summary, programme impact, governance |
| Annual | Internal | Impact report and audited statements — produced from the admin, shared on request, not published |

The annual public report is generated from the same data as the board report. **The public and private numbers are the same numbers** — which is the entire point of building impact tracking into the platform rather than assembling it in a spreadsheet each year.

---

*Related: [`seo-strategy.md`](seo-strategy.md) · [`security-architecture.md`](security-architecture.md) · [`database-architecture.md`](database-architecture.md)*
