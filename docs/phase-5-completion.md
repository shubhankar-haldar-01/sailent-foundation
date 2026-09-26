# Phase 5 — The product donation system

**Status: complete.** No payment processing; that is Phase 6.

Phase 4 kept products *inside* campaigns. A "School Kit" offered by three appeals was three rows, each with its own name, description, image and price — written months apart by different people, drifting. Nothing linked them, so nothing could keep them in step.

Phase 5 lifts that content into a **product master** and reduces `campaign_products` to what genuinely differs between campaigns: the price, the target, and whether this appeal is currently asking for it.

```
products                     campaign_products                donation_items
(what a School Kit IS)  ←──  (what THIS campaign      ←────   (what THIS donor
 name, description,           charges for one)                 actually paid)
 image, defaultPrice          price, target, provided          snapshot, immutable
```

The three layers answer three different questions and are deliberately not the same number.

---

## 1. The rule this phase exists to enforce

> **A price is copied, never referenced.**

`products.default_price` seeds the price field when an operator adds a product to a campaign. It is never read again. `campaign_products.price` is that campaign's own. `donation_items.unit_price` is what one donor was actually charged, snapshotted at the moment of giving (decision A5).

So:

| Change | Affects existing campaign prices | Affects donations already taken |
|---|---|---|
| Edit `products.default_price` | **No** | **No** |
| Edit `campaign_products.price` | Only that campaign | **No** |

A relief kit at ₹1,500 in the monsoon appeal and ₹1,200 in the winter one is **correct**, not a bug, and the admin interface says so in those words rather than flagging it.

This claim is asserted three ways, because a comment does not fail a build:

- a unit test on `ProductsService.update` (`products.service.spec.ts`)
- an end-to-end test that changes the default and reads both campaign prices back (`catalog.spec.ts`)
- the audit row itself, which carries `affectsExistingCampaignPrices: false` and `affectsHistoricalDonations: false` **as data**, so nobody has to take a comment's word for it a year later

---

## 2. Database

**One migration, `0008_phase5_product_catalogue.sql`.** 33 tables → **34**; 36 CHECKs → **38**; 45 FKs → **47**; 134 indexes → **139**. RLS on all 34.

### The migration is a refactor with a backfill, not a greenfield create

Order matters, and the file says so at the top. Content is copied out **before** the columns holding it are dropped, and `product_id` is *proved* non-null before it is declared so:

1. create the `product_status` enum and the `products` table
2. **backfill**: `INSERT … SELECT DISTINCT ON (slug)` from `campaign_products`, earliest row per slug wins
3. add `campaign_products.product_id` as **nullable**
4. populate it by slug join
5. **verify** — a `DO $$ … RAISE EXCEPTION` block that fails the migration if any row is still null
6. `SET NOT NULL`, add the FK `ON DELETE RESTRICT`
7. swap the unique index: `(campaign_id, slug)` → `(campaign_id, product_id)`
8. rename `fulfilled_quantity` → `provided_quantity` and its CHECK
9. **only now** drop `name`, `slug`, `description`, `image` from `campaign_products`
10. add `donation_items.product_id`, backfill it, tighten the type CHECK
11. revoke PostgREST access and enable RLS on `products`, matching Phase 4's lockdown

A drop that runs before its backfill is not recoverable. Step 5 is what makes steps 9–10 safe to run unattended.

### New table

| Table | Why |
|---|---|
| `products` | The master catalogue. `slug` unique **across the catalogue**, not per campaign — that is the change. `status` is `active` / `inactive` / `archived`, distinct from `campaign_product_status` so a product can be live in the catalogue and rested on one appeal. |

### Changed

- **`campaign_products`** became a junction. Gained `product_id` (NOT NULL, `ON DELETE RESTRICT`); lost `name`, `slug`, `description`, `image`; `fulfilled_quantity` renamed to `provided_quantity` — "fulfilled" described a warehouse, "provided" describes what a donor was told.
- **`donation_items`** gained `product_id`, so a donation resolves even after the offering is removed from the campaign. Its `donation_items_type_consistent` CHECK now requires **both** `campaign_product_id` and `product_id` on a product line, and **neither** on a custom line. A malformed line cannot be stored.

### Why nothing cascades

Both new foreign keys are `ON DELETE RESTRICT`. A product cited by a donation from two years ago must still resolve, or that donation's receipt has a hole in it. There is no hard-delete path anywhere in the product code: `DELETE /admin/products/:id` exists and **always answers 409**, naming the campaigns, the donation-line count and the alternative. A missing route reads as broken; a route that explains itself does not.

### Live data

8 campaign products backfilled into 8 catalogue entries, 0 orphans, 0 donations affected (there are none yet — which is what made the destructive half of this migration safe to run now rather than later).

---

## 3. The subscriptions retirement plan

`subscriptions` and `subscription_payments` were created in migration `0000` for a recurring-donation feature that **was never built and is now out of scope**. Phase 5 marks them deprecated rather than dropping them.

**Current state.** Both tables exist. Both are empty. No code reads or writes either one: no service, no controller, no seed, no worker job. `packages/database/src/schema/subscriptions.ts` carries a `DEPRECATED` banner at the top stating this. `subscription.read` and `subscription.manage` remain in the permission catalogue and remain assigned to Finance Manager, granting access to nothing.

**Why the drop migration is not written.** Dropping a table is irreversible, and the decision belongs to whoever owns the data — not to a migration written months in advance by someone who cannot see the row count on the day it runs. On a production database this file has never seen, "it's empty" is an assumption, not a fact.

**The retirement steps, when the decision is made:**

1. Confirm `SELECT count(*) FROM subscriptions` and `subscription_payments` are both zero **on the target database**. If not, stop: the rows are financial records and this becomes an export-and-archive task, not a drop.
2. Remove `subscription.read` and `subscription.manage` from `PERMISSIONS` in `packages/database/src/seed/permissions.ts` and from the Finance Manager bundle. The seed's prune step deletes withdrawn keys and `role_permissions` cascades, so no separate migration is needed for the grants.
3. Write the drop migration: `DROP TABLE subscription_payments; DROP TABLE subscriptions; DROP TYPE subscription_status; DROP TYPE subscription_frequency;` — children first.
4. Delete `packages/database/src/schema/subscriptions.ts` and its export from `schema/index.ts`.
5. Update the expected-table list in `apps/api/test/database.spec.ts` (34 → 32).

**Until then**, the banner in the schema file is the control. It is load-bearing: it is what stops the next person building on a table that is not part of the architecture.

---

## 4. Donation composition

`packages/validation/src/domain/donation.ts` — **one implementation, shared by the API that charges the donor and the page that shows them the figure before they agree to it.**

Two implementations of a total is not duplication. It is two answers to "what am I paying", and the donor only ever sees one of them. Whichever is wrong, the wrong one is what they consented to.

| Export | Purpose |
|---|---|
| `donationType(lineCount, customAmount)` | `custom` / `product` / `hybrid`, **derived** from the basket. Never sent by the client: a request declaring itself `custom` while carrying product lines describes itself incorrectly, and trusting it stores a donation whose type contradicts its own contents. |
| `summariseDonation(lines, customAmount)` | Line totals, product total, grand total, item count. Integer paise throughout. |
| `validateDonationComposition(…)` | Per-field sentences for the donor. Not the enforcement point — the service and the CHECK constraints are. |
| `PRODUCT_TRANSITIONS`, `canTransitionProduct` | The product lifecycle, as data, read by the API and the admin UI. |
| `isProductOfferable(productStatus, campaignActive)` | **Both** flags. The catalogue answers "do we do this at all"; the junction answers "are we asking for it here". |

### The edge case that matters

A **negative quantity subtracts from a donation total**. Unguarded, it is how a ₹9,000 clinic day becomes a ₹1 donation: one line at +1 and one at −1, with arithmetic in between. Three independent layers:

1. `ProductQuantitySelector` clamps to `[0, max]`, including on direct keyboard entry
2. `summariseDonation` floors and truncates, so it can never *return* a wrong total; `validateDonationComposition` rejects it with a message naming the line
3. `donation_items_quantity_positive` CHECK in Postgres

None is trusted alone. The duplicate-line check is separate from the per-line ceiling for the same reason: two lines of 6 each pass a ceiling of 10 while together exceeding it.

**There is no recurring donation type, and its absence is deliberate rather than pending.** The monthly toggle and the UPI Autopay disclosure were removed from `donation-builder.tsx`. Nothing should reacquire a recurring option without the tables, the cancellation path and the mandate handling a real one needs.

---

## 5. API

New module `apps/api/src/modules/products/` — its own module, not part of `CatalogModule`, because a product is not a child of a campaign. It outlives every campaign that offers it and carries its own permission family.

### The catalogue

| Method | Path | Permission |
|---|---|---|
| GET | `/admin/products` | `product.view` |
| GET | `/admin/products/:id` | `product.view` |
| POST | `/admin/products` | `product.create` |
| PATCH | `/admin/products/:id` | `product.update` |
| POST | `/admin/products/:id/status` | `product.activate` |
| POST | `/admin/products/:id/archive` | `product.archive` · **sensitive** |
| DELETE | `/admin/products/:id` | `product.archive` · **sensitive** · always 409 |

`GET /admin/products` takes `notInCampaignId`, which is what the campaign picker uses. A duplicate is not merely refused — it is **not on screen**. The unique index would reject the insert anyway; this makes the rejection unnecessary rather than merely survivable.

`GET /admin/products/:id` returns every campaign offering the product, with that campaign's own price. It is the answer to "what will I affect if I change this", and the reason the detail view is more than an edit form.

### Campaign offerings

| Method | Path | Permission |
|---|---|---|
| GET | `/admin/campaigns/:campaignId/products` | `campaign_product.view` |
| POST | `/admin/campaigns/:campaignId/products` | `campaign_product.add` |
| PATCH | `/admin/campaigns/:campaignId/products/:productId` | `campaign_product.update` |
| POST | `…/products/:productId/active` | `campaign_product.activate` + `.deactivate` |
| POST | `…/products/reorder` | `campaign_product.update` |
| PATCH | `…/products/:productId/provided` | `campaign_product.adjust_provided` · **sensitive** |
| DELETE | `…/products/:productId` | `campaign_product.remove` |

Paths are unchanged from Phase 4; only the payloads and the module they live in moved. `POST` now takes a `productId` and **has no name or description field** — that absence is the design. This endpoint cannot create a product, so it cannot create a duplicate one.

### Public

`GET /campaigns/:slug/products` — an inner join onto the catalogue, filtered on **both** statuses. A product withdrawn centrally disappears from every campaign at once, without anyone visiting each one. `default_price` is not sent: the public has no use for a number that is not what they will pay.

### Two routes are sensitive, and two are deliberately not

Archiving withdraws a product from every future campaign; correcting a provided quantity edits a number meant to follow from money received. Both require a re-authentication within five minutes.

Adding a product to a campaign is **not** sensitive. It is the routine act of this phase, done many times a week, and a password prompt on every one would train operators to keep a re-auth window permanently open — which defeats the control everywhere it does matter.

### `providedQuantity` moves in exactly two places

The payment-capture transaction (Phase 6), and `adjustProvided` — separate endpoint, separate sensitive permission, mandatory reason, `severity: critical`. It is absent from every write schema **by construction**, so Zod strips it before a handler sees it and the service allow-lists never name it. Verified end to end: a `PATCH` carrying `providedQuantity: 9999` alongside a valid price change applies the price and leaves the quantity at 0.

Per the brief, a **pending, failed, cancelled or timed-out** payment moves nothing. Nothing in this phase can move it at all, because payment capture does not exist yet.

---

## 6. RBAC

90 permissions (was 87). Two new families; three Phase 4 keys renamed for consistency with the brief's vocabulary and pruned automatically by the seed.

| New | Renamed from |
|---|---|
| `product.view` · `product.create` · `product.update` · `product.activate` · `product.archive` *(sensitive)* | — |
| `campaign_product.view` | `campaign_product.read` |
| `campaign_product.add` | `campaign_product.create` |
| `campaign_product.remove` | *(new)* |
| `campaign_product.adjust_provided` *(sensitive)* | `campaign_product.adjust_fulfilment` |

| Role | Catalogue | Offerings |
|---|---|---|
| Super Admin | all | all |
| Admin | view, create, update, activate, **archive** | all |
| Campaign Manager | view, create, update — **not archive** | all |
| Finance Manager | view only | view only |
| Volunteer / Content Manager | none | none |

A Campaign Manager may add a product the catalogue is missing, because otherwise they are blocked on someone else to do their own job. They may **not** archive one: archiving withdraws it from every *other* manager's campaigns too, which is not their decision to make.

Finance reads both, because a refund and a reconciliation each need to show what the donor was told they were buying.

---

## 7. Frontend

`apps/web/src/components/products/`

| Component | Note |
|---|---|
| `ProductQuantitySelector` | Extracted from the donation card so one implementation serves every surface. 44px targets (WCAG 2.5.8); `−` disabled at zero rather than hidden, so nothing shifts under the pointer. |
| `ProductSelector` | **Cannot create a product.** The form has no name field. Its empty state routes to the catalogue, where the next person will find what you added. |
| `CampaignProductManager` | Shows the catalogue default beside the campaign price, **neutrally**. An interface that flags every difference trains people to ignore the flag by the third campaign. |
| `CampaignProductList` | Read-only, for surfaces where editing is not the job. |
| `ProductForm` | One form, two actions. The `defaultPrice` hint explains the copy-not-reference rule *at the field where the assumption is formed*. |
| `ProductTable` | The "Campaigns" column is the point. No delete control at any count. |
| `ArchiveProductPanel` | Lists blocking campaigns **before** the button, not as a 409 after the click. |
| `ProductDonationCard`, `DonationSummary` | Existing, in `@sailent/ui`. Now fed by the shared `summariseDonation`. |

New pages: `/admin/products`, `/admin/products/new`, `/admin/products/[id]`. The sidebar entry is **top level**, not nested under campaigns — filing it under one would reproduce in the navigation the confusion the schema change removed from the database.

Removal is offered only while nothing has been funded. Once a donor has given, the control that would break their receipt is **not rendered**, and the reason appears where it would have been. The API refuses it as well; this is the half of the pair that explains itself.

---

## 8. Bugs found and fixed

### Drizzle strips table qualifiers inside `sql` templates — four broken queries

Inside a `sql` template used as a select field or filter, Drizzle emits column references **unqualified**: `${campaignProducts.productId}` renders as `"product_id"`, not `"campaign_products"."product_id"`.

In a correlated subquery this is silently catastrophic. The bare name binds to the **inner** table whenever it has a column of that name, so `WHERE "product_id" = "id"` compares `campaign_products.product_id` to `campaign_products.id` — false for every row. No error, no warning.

It is worse than an outright failure because it *sometimes works*: where the inner table lacks the column, the name falls through to the outer scope and the query is correct by accident. Two subqueries written identically, one right and one wrong.

| Site | Was | Now |
|---|---|---|
| `content.service.ts` — `hasProducts` | **Broken since Phase 4.** Every campaign reported `false`; the product badge never appeared on any card. | Fixed |
| `users.service.ts` — role filter | **Broken.** Filtering the user list by role returned an empty list for every role. | Fixed |
| `products.service.ts` — `campaignCount` | Broken on arrival. | Fixed |
| `products.service.ts` — `notInCampaignId` | Broken on arrival, and worse than useless: the picker would have shown products the campaign already had, which is the exact duplicate this design prevents. | Fixed |
| `roles.service.ts` — two counts | **Correct by accident.** `role_permissions` and `user_roles` have no `id` column, so the bare name fell through. Adding a surrogate key — an ordinary thing to do — would have turned both counts to zero with no error and no failing test. | Hardened |

All six are now written as qualified literal SQL with table aliases. Bound parameters stay interpolated; Drizzle handles those correctly, and inlining them would be an injection.

### The e2e image warm-up ignored device pixel ratio

Next optimises images on first request, and the homepage carries about twenty. A cold cache made whichever test ran first exceed the 30-second timeout — the shape of a flake, and twice mistaken for one.

The first fix warmed one width. The second warmed four (320 / 393 / 768 / 1440) and **still failed on tablet only**. The reason: the browser asks for `viewport × devicePixelRatio`, not the viewport. iPad Mini is 768 CSS pixels at a ratio of 2 and requests **1536**; Pixel 5 is 393 at 2.75 and requests ~1080. The two projects that passed, desktop and mobile-xs, are the two whose ratio is 1.

The warm-up now runs **the projects' own descriptors, read from `playwright.config.ts`** rather than a list restated in the setup file. A viewport added to the config is warmed automatically, and the two lists cannot drift apart — which is how this survived two attempts at fixing it. Verified from a deleted `.next`: 231 passed, 0 failed.

### Seed upserts on campaign products did nothing

`onConflictDoNothing()` against a conflict target that no longer existed. Now `onConflictDoUpdate` on `(campaign_id, product_id)`, so re-seeding corrects an existing offer instead of silently skipping it.

---

## 9. Verification

| Check | Result |
|---|---|
| `pnpm typecheck` | clean, 13 packages |
| `pnpm lint` | clean, 0 warnings |
| `pnpm test` | **438 passed**, 0 failed |
| `pnpm build` | clean |
| `pnpm exec playwright test` | **231 passed**, 0 failed, from a cold image cache |
| Migration applied | 8 products backfilled, 0 orphans |

**New tests: 67.** 37 in `packages/validation` (composition, clamping, lifecycle, the offerable matrix), 30 in `apps/api` unit specs. `test/catalog.spec.ts` rewritten for the new model — 43 integration cases including the central price-independence assertion end to end.

Manually exercised against the running API: catalogue CRUD, duplicate-slug refusal, picker exclusion, price copy, cross-campaign independence under a default-price change, restore-not-duplicate on re-add, the archive guard, the delete refusal, the re-auth requirement, and the audit trail (`product.create` info → `product.default_price_changed` warning → `product.archive` critical).

---

## 10. Known limitations

- **`products.image` is a plain text column**, not a foreign key to `media`. Campaign covers have the same shape. A product image is therefore not managed by the media library and gets no alt text of its own; the card falls back to the product name. Worth unifying when the media library grows an admin UI.
- **No catalogue-wide search endpoint.** `ProductSelector` filters client-side over an already-fetched page of 100. A catalogue is tens of rows today; when it outgrows one page, the selector's empty state is where that will first show.
- **Reordering issues one UPDATE per row** inside a transaction. Fine at the scale of a campaign's product list; not a bulk operation.
- **`campaign_products.sku` and `max_per_donation`** are carried through from Phase 4 but have no admin UI beyond the inline edit. `sku` is unused entirely.
- **The `donation_items` column names predate the brief**: `item_name` and `total_price` are the brief's `productName` and `totalAmount`. They are semantically identical and renaming them would churn a table Phase 6 is about to write to heavily.

---

## 11. Deliberately not built

Recurring and monthly donations, subscriptions, auto-debit, billing schedules, next-billing-date, a recurring dashboard — **removed from the UI where they existed, out of scope, and not a gap**.

Payment processing, Razorpay, order creation, webhooks, receipts — Phase 6. (Refunds shipped in Phase 6 and were withdrawn in Phase 7.)

A second database. Users or donors creating their own fundraising campaigns. Any redesign of the homepage.

---

## 12. Phase 6

What Phase 6 inherits, and what it must respect:

1. **Payment capture**, and with it the only sanctioned write to `provided_quantity` and `amount_raised`. Both inside the transaction that marks a payment captured, under `SELECT … FOR UPDATE` on the row, with the increment expressed **in SQL**. Read-modify-write in application code loses concurrent donations silently, and the ones it loses are real money.
2. **Donation creation** from `summariseDonation` — the request carries campaign-product ids and quantities only. Never a price, never a total. The server recomputes from the database.
3. **`DonationItem` snapshots** on write: `product_id`, `campaign_product_id`, `item_name`, `unit_price`, `quantity`, `total_price`. Never re-read from the product afterwards.
4. **Webhook idempotency** (decision A4) — raw body persisted before parsing, `razorpay_event_id` unique, forward-only state machine.
5. **Receipts**, numbered from a gapless yearly sequence, and the Form 10BD export. A receipt is not an 80G certificate and the copy must never say it is (decision A7).
6. **The concurrency case Phase 5 could not test**: two donors racing the last unit of a product with a target. The row lock in (1) is the answer; it needs a test that actually races.
