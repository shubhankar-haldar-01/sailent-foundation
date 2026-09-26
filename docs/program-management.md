# Programme management

How programmes are created, published, ordered and retired.

Lifecycle rules: [`campaign-status-transitions.md`](campaign-status-transitions.md). Entity reference: [`database-architecture.md`](database-architecture.md).

---

## 1. What a programme is

Long-term work, measured over years. Campaigns fund specific pieces of one, so a programme is where the structure starts — and decision A5 requires every published campaign to have one, because a campaign without a programme cannot be attributed, reported on or rolled up.

---

## 2. Fields

| Field | Notes |
|---|---|
| `title`, `slug` | Slug generated from the title when omitted. Changing it leaves a redirect — see §5. |
| `tagline`, `shortDescription` | The short description appears on every card and in search results. Required to publish. |
| `description`, `problem`, `approach` | The editorial body. `problem` and `approach` are separate because a page that cannot distinguish "here is what is wrong" from "here is our response" reads as a brochure. |
| `beneficiaries`, `impactSummary` | Who it serves, and what it has achieved. |
| `categoryId` | FK to `categories`. `category` holds the name as a denormalised cache — see §3. |
| `goals`, `activities`, `metrics`, `locations` | JSONB. Editorial lists the CMS will own. |
| `coverImage`, `accentIcon` | Presentation. |
| `status` | `draft` · `published` · `archived`. System-controlled — set only through the lifecycle endpoints. |
| `displayOrder` | Lower sorts first. |
| `campaignCount`, `totalRaised`, `beneficiariesReached` | **Derived counters.** Never writable from a request. |

`locations` drives the computed geographic reach on `/impact` — "we work in four states" is counted from these records, so nobody types that number in.

---

## 3. Categories

A **lookup table**, not an enum (`docs/database-architecture.md` §1: "Lookup tables for sets an operator may extend"). Twelve are seeded; an operator adds more without a deployment.

`key` is the stable machine identifier (`CHILD_WELFARE`). `name` is what an operator edits. Renaming "Child Welfare" to "Children" is a data change that breaks nothing — which is the entire reason the two are separate columns.

Programmes and campaigns also keep a denormalised `category` string, written by the service whenever `categoryId` changes. Every public listing renders the category name, and a join for one short string on every row of every page is a cost paid constantly for a value that changes about once a year. **`category_id` is the source of truth; `category` is what gets read.**

A category is **deactivated, never deleted**: it cannot be assigned to new records, while existing ones keep rendering.

---

## 4. Lifecycle

```
POST /admin/programs                 → always created as a draft
POST /admin/programs/:id/publish     → live
POST /admin/programs/:id/unpublish   → back to draft
POST /admin/programs/:id/archive     → out of listings   (sensitive)
```

Created as a draft whatever the payload says: a record that goes live the instant it is saved leaves no moment to read it back before the public does.

**Archive, do not delete.** Campaigns reference programmes with `ON DELETE RESTRICT`, and donations reference campaigns. Deleting a programme with financial history beneath it would either fail or destroy the attribution for money that actually moved. There is no delete endpoint, and that is deliberate.

Archiving is `@Sensitive()` — it needs a re-authentication within the last five minutes.

---

## 5. Slugs and redirects

`docs/seo-strategy.md`: *"Slugs never change silently. A change 301-redirects permanently from the old slug, and slug history is retained in the database."*

Both halves are implemented:

- A new slug is checked against live slugs **and retired ones**. A slug released by one programme cannot be claimed by another while its redirect still exists, or the redirect starts pointing at the wrong thing.
- Changing a slug writes the old one to `slug_history` **inside the same transaction** as the update. A rename that committed without its redirect is exactly the silent breakage the rule exists to prevent.

`GET /redirects/program/:slug` resolves a retired slug to the current one. The web app issues a 301. Null means the slug never existed — a real 404.

The admin edit page lists every previous address, so an operator can see what still points here.

---

## 6. Ordering

`POST /admin/programs/reorder` applies the whole order **in one transaction**. A partially applied reorder leaves two programmes claiming the same position, and the listing order then depends on which row the planner happens to return first.

---

## 7. Public visibility

Only `published`, non-deleted programmes reach the public API. Drafts and archived programmes are **404** — indistinguishable from never having existed. The admin read path is a separate service from the public one, deliberately: a single service with an `includeUnpublished` flag is one forgotten argument away from publishing a draft.

Drafts are previewable at `/admin/preview/program/:slug`, which sits behind the staff session and reads through the permission-checked admin API. Deliberately **not** a shareable token in a public URL: a token that renders unpublished content is a credential that leaks by being pasted into a group chat, with no audit trail and no revocation.

---

## 8. Permissions

| Permission | Allows |
|---|---|
| `program.read` | View programmes, including drafts |
| `program.create` | Create |
| `program.update` | Edit, reorder |
| `program.publish` | Publish and unpublish |
| `program.archive` | Archive (sensitive) |

Held by SUPER_ADMIN, ADMIN and CAMPAIGN_MANAGER. CONTENT_MANAGER has none of them — it owns stories and site content, not the programme structure.

---

## 9. Audit

`program.create`, `program.update`, `program.publish`, `program.unpublish`, `program.archive`, `program.reorder` — each with the actor, before/after values, reason where given, IP, user agent and timestamp.
