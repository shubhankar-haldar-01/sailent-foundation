# Phase 4 — Programmes and campaigns management

**Status: complete.**

Phase 4 built the management system for programmes and campaigns, and closed the path the platform was missing: an administrator now edits content in a browser, it lands in Postgres, and the public site renders it.

```
ADMIN UI  →  NestJS API  →  PostgreSQL  →  NestJS API  →  Next.js  →  PUBLIC SITE
```

No payment processing. No Razorpay. No donation records. Those are Phase 5.

---

## 1. Database

**Three migrations** (`0005`–`0007`). 28 tables → **33**; 33 CHECKs → **36**; 40 FKs → **45**; 118 indexes → **134**. RLS on all 33.

### New tables

| Table | Why |
|---|---|
| `categories` | Phase 0 specifies a lookup table for sets an operator may extend, not an enum. `key` is stable; `name` is editable, so a rename breaks nothing. |
| `slug_history` | `docs/seo-strategy.md` requires slug history and permanent redirects. Unique on `(entity_type, slug)`, so a retired slug cannot be reclaimed by a different record. |
| `faqs` | The Phase 0 design: one table with `context_type`/`context_id`, serving campaign, event and site-wide questions. |
| `media` | Stores the **storage key**, not only a URL. A CHECK forbids a private object from carrying a public URL. |
| `campaign_gallery` | Ordered, individually publishable placement of media on a campaign. |

### Changed

- `programs` and `campaigns` gained `category_id` (FK), backfilled from the free-text column by matching on name. The old `category` string is kept as a **denormalised cache** of `categories.name`, written by the service — `category_id` is the source of truth, `category` is what gets read on every listing.
- `campaigns` **lost** `faqs`, `updates` and `gallery` (JSONB). Each entry needed a stable id, its own published flag, its own order, and — for images — a foreign key. The data is migrated before the columns are dropped.
- `campaigns_goal_positive` became `campaigns_goal_positive_when_public`: `status = 'draft' OR fundraising_goal > 0`. The old rule made it impossible to save a half-written campaign, which is the purpose of a draft. Nothing public can have a zero goal, enforced here and at the publish transition.

Campaign updates reuse `impact_updates`, which already carries title, description, date, location, media, statistics and a publication state. A second table would have duplicated all of it.

---

## 2. Shared domain logic

`packages/validation/src/domain/` — one implementation, read by the API that enforces it and the admin UI that renders from it.

| Module | Contents |
|---|---|
| `slug.ts` | `slugify`, `isValidSlug`, `uniqueSlug` |
| `lifecycle.ts` | Both transition tables, `PUBLIC_CAMPAIGN_STATUSES`, `acceptsDonations`, `donationAvailability` |
| `progress.ts` | `campaignProgress`, `quantityProgress`, `daysRemaining` |

`GET /admin/campaigns/transitions` serves the tables so the UI can offer only moves that will succeed. The API validates every transition independently regardless — that is a convenience, not the control.

---

## 3. API

**32 → 77 endpoints.** New: 11 public (sub-resources, categories, redirects) and 34 admin.

Two invariants govern `CampaignsService`:

**Derived counters are never written from a request.** `amountRaised`, `donorCount` and `beneficiariesReached` are absent from `writableFields()`, which is an allow-list — so there is no code path from a payload to them, not one that is checked and passes. Zod strips the keys first; the allow-list is the second barrier.

**Every status change goes through the transition table**, server-side, whatever the UI offered.

`fulfilledQuantity` gets the same treatment, with a deliberate narrow exception: `POST …/products/:id/fulfilment`, its own permission, `@Sensitive()`, a mandatory reason, audited as `critical`. An exception that can be made from the ordinary edit form stops being an exception.

---

## 4. Admin interface

Staff sign-in was missing entirely — the BFF's token attachment was still a Phase 3 TODO — so Phase 4 built it:

- `POST /admin/login` via a server action, so the password never reaches client-side JavaScript.
- An httpOnly, SameSite=Lax cookie holding both tokens, refreshed 60 seconds early rather than on a 401.
- The BFF attaches the bearer token server-side (decision A1): no access token ever reaches the browser.
- **Middleware** protects `/admin/*`.

Routes: `/admin/programs`, `/programs/new`, `/programs/[id]/edit`, `/admin/campaigns`, `/campaigns/new`, `/campaigns/[id]/edit` (overview, lifecycle, details, products, FAQs, slug history), and `/admin/preview/[entity]/[slug]`.

Every admin write revalidates the public cache before returning. A publish that stays invisible for five minutes looks like a broken button, and the operator's next move is to press it again.

---

## 5. Public site

Programmes, campaigns, FAQs, gallery, updates, documents, products and categories all render from the database. Progress and donation availability are computed by the API and passed straight through — the page never recalculates either.

The Donate CTA now reads the server's verdict: open, not yet open, paused, or completed, each with the server's own wording. **No payment is processed.**

---

## 6. Verification

```
lint         13/13 packages, zero warnings
typecheck    13/13 packages
test         357 passed
               ├── api         233  (unit + integration, real Postgres and Redis)
               ├── validation   99  (76 new: slugs, lifecycles, progress)
               ├── web          20
               └── worker        5
e2e          231 passed  (4 viewports × 2 engines, every page axe-checked)
build        8/8 packages
format       clean
migrations   7 applied to a database created from nothing
```

All 29 acceptance checks pass, including the eight security ones. Highlights, each exercised against the running system:

```
draft programme / campaign publicly           404
draft → active (skipping published)           409 CONFLICT
completed → active                            409 CONFLICT
pause without a reason                        422 VALIDATION_FAILED
publish with no goal or programme             422, naming both fields
PATCH amountRaised: 99999999                  200, value unchanged at 0
PATCH fulfilledQuantity: 500                   200, value unchanged at 0
fulfilment correction without re-auth         403 REAUTH_REQUIRED
content manager → any write                   403 FORBIDDEN
campaign manager → archive                    403 FORBIDDEN
unauthenticated → admin API                   401 UNAUTHENTICATED
unpublished FAQ on the public endpoint        absent (3 admin, 2 public)
private gallery image publicly                absent (3 admin, 2 public)
publish an update reporting a figure
  with no stated basis                        422  (decision A14)
internalNotes in a public response            absent
sitemap                                       37 entries, no drafts
```

Slug history verified end to end: rename → old slug 404s → `/redirects/program/:slug` resolves to the new one → reusing the retired slug on another record is a 409.

---

## 7. Bugs found and fixed

**Correlated subqueries silently returned zero.** Interpolating drizzle column references into a `sql` template renders them *unqualified* — `WHERE "category_id" = "id"` — and inside the subquery both names resolved to the inner table, which has an `id` of its own. The correlation became `programs.category_id = programs.id`: always false, always zero, no error anywhere. Every category and campaign count read 0. Fixed with explicit aliases and qualified names in raw SQL.

Phase 3's `roles.service.ts` has the same construction and works *by accident*: `role_permissions` has no `id` column, so the name falls through to the outer query. It was left as-is with a note; the pattern to avoid is now documented at the fix site.

**A draft campaign could not be saved without a goal.** The `fundraising_goal > 0` CHECK rejected it, which defeated the draft workflow the phase requires.

**The seed never pruned withdrawn permissions.** Two keys dropped from the catalogue lingered in the table — still grantable, still counted — so the table held 86 rows against a catalogue of 84.

**A layout guard does not stop a page from running.** Next renders layouts and their children in parallel, so `/admin` fetched data and failed with a 401 before the layout's `redirect()` landed. Moved to middleware, which runs before any rendering.

**Seeded content had no category on a fresh database.** The migration's backfill runs before the seed inserts anything, so a brand-new install had uncategorised demo content and an empty public category filter.

---

## 8. Known limitations

**Uploads are metadata-only.** `media` rows and the gallery API are complete, but there is no upload endpoint or storage client — an operator supplies a storage key. The R2 integration is Phase 5, alongside the signed-URL path for private documents.

**Gallery, updates and documents have no admin UI.** Their APIs, permissions, audit and public rendering are complete and tested; the campaign edit page covers details, lifecycle, products and FAQs. The remaining three are list-and-reorder screens against endpoints that already work.

**Campaign updates are `impact_updates` rows.** Correct reuse, but it means a campaign update also appears in programme-level impact reporting. That is arguably right and worth confirming with the organisation.

**Slug redirects need the web route handler.** The API resolves a retired slug; issuing the 301 is a small change to the dynamic route, not yet wired — currently the old slug 404s. Tracked with the pre-existing soft-404 noted in Phase 3.

**Rich text is plain text.** `description` is a textarea split on blank lines. The editor is Phase 7 CMS work.

**No preview for unsaved changes.** Preview renders the saved draft.

---

## 9. Deliberately not built

Razorpay, payment checkout, webhooks, donation processing, donor dashboard, receipts, Form 10BD export. (Recurring payments were withdrawn in Phase 6 and refunds in Phase 7.)

Nothing writes `amountRaised`, `donorCount`, `beneficiariesReached` or `fulfilledQuantity`. They are all zero, honestly.

---

## 10. Phase 5

Razorpay and the donation flow end to end: order creation, checkout, webhook verification against the raw body, the idempotency ledger, the payment state machine, receipt numbering, and the derived-counter update inside the capture transaction (decisions A3–A7).

The transaction strategy those counters need is documented at the top of `campaigns.service.ts` and in [`campaign-management.md`](campaign-management.md) §10 — the increment expressed in SQL under a `SELECT … FOR UPDATE`, in the same transaction that writes the donation.
