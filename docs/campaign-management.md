# Campaign management

Creating, publishing and running campaigns, and the rules that protect the money.

Lifecycle: [`campaign-status-transitions.md`](campaign-status-transitions.md). Products: [`campaign-products.md`](campaign-products.md).

---

## 1. The two invariants

Everything in `CampaignsService` follows from these.

### Derived counters are never written from a request

`amountRaised`, `donorCount` and `beneficiariesReached` are caches of what the donation records say (decision A6). They move only inside the transaction that records a captured payment.

The protection is **structural, not a check**. `writableFields()` is an allow-list and those columns are not on it, so there is no code path from a request body to them — not one that is checked and passes, one that does not exist. Zod strips the keys before the handler sees them; the allow-list is the second barrier behind that.

Verified: a `PATCH` carrying `amountRaised: 99999999` returns 200 and changes nothing.

### Status changes go through the transition table

Validated server-side on every call, whatever the UI offered. An invalid transition is a 409 naming both states.

---

## 2. Fields

| Group | Fields |
|---|---|
| Identity | `title`, `slug`, `programId`, `categoryId` |
| Copy | `shortDescription`, `description`, `beneficiaryContext`, `fundUtilization`, `internalNotes` |
| Place | `location`, `state`, `city` |
| Dates | `startDate`, `endDate` |
| Money | `fundraisingGoal`, `currency`, `minDonationAmount`, `stopAtGoal`, `allowCustomAmount` |
| People | `beneficiaryTarget` |
| Display | `coverImage`, `isFeatured`, `featuredOrder`, `impactNotes` |
| System | `status`, `publishedAt`, `amountRaised`, `donorCount`, `beneficiariesReached` |

`internalNotes` is operational commentary. The public content service strips it, and an integration test asserts it never appears in a public response.

---

## 3. Money

**Integer paise, everywhere** (decision A2). `45000000` is ₹4,50,000. Validated as `z.number().int().positive()`, so a decimal is a validation error rather than a silently truncated amount.

Rupees are converted to paise at exactly one boundary — the admin form's server action — and nothing past that point divides, rounds or reformats until a value is displayed.

Two guards on the goal:

- **Above zero to publish.** The database check is `status = 'draft' OR fundraising_goal > 0`, so a draft may be saved before the number is known while nothing public can have a goal of zero.
- **Never below what has been raised.** Lowering it would make the campaign instantly over-funded and the progress bar meaningless, and it is almost always a typo.

---

## 4. Progress

One implementation, in `packages/validation/src/domain/progress.ts`, computed server-side and shared with the client. A percentage that differs between the API and the page is the kind of discrepancy a donor screenshots.

```ts
campaignProgress(goal, raised) → {
  goal, raised, remaining, percent, rawPercent, goalReached, surplus
}
```

**`percent` is capped at 100; `rawPercent` is not.** A bar past its own end is a rendering bug — but the money raised is what it is. `raised` is passed through untouched, and `surplus` reports the overshoot. Trimming a real total so a bar looks tidy is falsifying a financial record.

A campaign with no goal reports 0% and the UI shows the amount raised without a bar, rather than dividing by zero. `daysRemaining` counts whole days from the start of today, so the figure does not tick down mid-session, and returns null when there is no deadline — no manufactured urgency.

---

## 5. Sub-resources

Each was a JSON array on `campaigns` until Phase 4. Each moved to a table because its entries needed a stable id to edit or delete by, their own published flag, their own order, and — for images — a foreign key to the media record holding the storage key.

| Content | Stored in | Public filter |
|---|---|---|
| FAQs | `faqs` where `context_type = 'campaign'` | `is_published` |
| Gallery | `campaign_gallery` → `media` | `visibility = 'public'` |
| Updates | `impact_updates` where `campaign_id = …` | `status = 'published' AND is_public` |
| Documents | `documents` where `related_type = 'campaign'` | `visibility = 'public'` |
| Products | `campaign_products` | `is_active` |

Every public filter is applied **in the query**, not after it. A private image fetched and then dropped has still been read into an object something might serialise.

FAQs use the Phase 0 `faqs` design — one table with `context_type`/`context_id` — rather than a `campaign_faqs` table. The shape is identical for campaign, event and site-wide questions, and three tables would mean three sets of CRUD endpoints doing the same thing.

Updates reuse `impact_updates`, which already carries title, description, date, location, media, statistics and a publication state. A second table would have duplicated all of it.

### Publishing an update that reports a figure

Decision A14 at its narrowest: an update carrying `metricValue` cannot be published without `verificationMethod`. A number on a public page with no stated basis is exactly what the rule exists to stop.

---

## 6. Documents and private media

`documents.visibility` is `public` · `private` · `restricted`. The public endpoint filters to `public` **and** returns `fileUrl` only for those — a `CASE` in the projection, so a private document's location cannot leave even if the row were selected by mistake.

`media` stores the **storage key**, not only a URL. A public URL is a property of the bucket and the CDN in front of it, both of which change; the key is what identifies the object. A private media row is forbidden from carrying a URL at all, by a CHECK constraint.

Alt text is **required** at upload. An image without it is invisible to anyone using a screen reader, and the moment to write it is upload — not "later", which never comes.

---

## 7. Public visibility

See [`campaign-status-transitions.md`](campaign-status-transitions.md) §4. In short: `published`, `active`, `paused` and `completed` are reachable; `draft` and `archived` are 404, and the public query schema does not accept those values so one cannot be requested.

The default listing shows `active` and `paused` — what someone can act on today. `?status=completed` and `?status=all` widen it, still never past the public set.

---

## 8. Filtering

Server-side, always. Public: `programSlug`, `category`, `categorySlug`, `state`, `status`, `q`, `sort`, pagination. Admin adds `programId`, `categoryId`, `startsAfter`, `endsBefore` and the unpublished statuses.

`categorySlug` exists alongside `category` because the slug is stable across a rename, so a filtered link does not break when somebody edits a category name.

Sorting goes through an allow-list. `?sort=-passwordHash` and `?sort=-notacolumn` return byte-identical responses, so a caller cannot probe the schema by guessing.

---

## 9. Caching

Public reads: `revalidate: 300` with a cache tag. Long enough that a burst of traffic to a campaign page does not become a burst of queries; short enough that publishing shows up while the person who published it is still looking.

Admin reads: **never cached.** Per-user, permission-filtered, frequently unpublished.

Every admin write revalidates the public cache before returning. A publish that stays invisible for five minutes looks like a broken button, and the operator's next move is to press it again.

---

## 10. Concurrency, for Phase 5

Nothing in this phase writes the derived counters, so nothing here takes a lock. When payment capture lands it must update them as:

```sql
BEGIN;
SELECT amount_raised FROM campaigns WHERE id = $1 FOR UPDATE;
UPDATE campaigns
   SET amount_raised = amount_raised + $2,
       donor_count   = donor_count + 1
 WHERE id = $1;
COMMIT;
```

The increment expressed **in SQL**, under a row lock taken in the same transaction that writes the donation. Read-modify-write in application code loses concurrent donations silently, and the ones it loses are real money.

The same applies to `campaign_products.fulfilled_quantity`.

---

## 11. Permissions

| Permission | Allows |
|---|---|
| `campaign.read` | View, including drafts |
| `campaign.create` / `campaign.update` | Create / edit |
| `campaign.publish` | Publish, unpublish, general status change |
| `campaign.activate` / `campaign.pause` / `campaign.complete` | The named transitions |
| `campaign.archive` | Archive (sensitive) |
| `campaign_product.*` | Products — including `adjust_fulfilment` (sensitive) |
| `campaign_faq.*`, `campaign_update.*`, `campaign_gallery.manage`, `campaign_document.manage` | Sub-resources |

Separated from `campaign.update` on purpose: the people who write FAQs and post progress updates are usually not the people trusted to change a fundraising goal.
