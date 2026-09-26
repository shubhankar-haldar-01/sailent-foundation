# Phase 10.5 — Success Stories

The table has existed since Phase 3 and **nothing could write to it**.

`success_stories` carries a full narrative schema — challenge, intervention,
journey, outcome — a consent model, and a publish-time check constraint. The
public read API has been serving three seeded rows for seven phases. There was
no create, no update, no publish: the stories on the site were whatever the
seed wrote.

This phase is that missing half. It invents no new lifecycle and no new consent
rule; the existing `publish_status` enum is the lifecycle and the existing
check constraint is the rule.

---

## 1. Routes

### Admin API (`story.*` permissions, staff audience)

| Method | Path | Permission | Sensitive |
|---|---|---|---|
| GET | `/admin/stories` | `story.read` | no |
| GET | `/admin/stories/:id` | `story.read` | no |
| POST | `/admin/stories` | `story.create` | no |
| PATCH | `/admin/stories/:id` | `story.update` | no |
| PATCH | `/admin/stories/:id/status` | `story.publish` | **yes** |

**One route is `@Sensitive()`, and the choice is the point.** Publishing puts a
named person's account of their own life on a public website. Drafting and
editing are not: an editor writes a story over several sittings, and forcing a
password re-entry to fix a paragraph teaches them to keep the window open,
which is worse for security than not asking.

Archiving shares that route and that gate — taking a story down is as
consequential as putting it up, because somebody may have asked.

### Admin UI

`/admin/stories` · `/admin/stories/new` · `/admin/stories/[id]`

### Public (unchanged paths, completed behaviour)

`/stories` — now paginated · `/stories/[slug]`

---

## 2. Permissions

Three existed and had never been used. Two were added:

| Key | Status |
|---|---|
| `story.create`, `story.update`, `story.publish` | existed since Phase 3 |
| `story.read` | **added** |
| `story.archive` | **added** |

`story.read` is separate from the public listing for a real reason: the admin
list returns **drafts**, and a draft about a named beneficiary who has not yet
consented is precisely what the publish constraint exists to keep off the
public site.

**There is no `story.delete`, deliberately.** A story is somebody's account of
their own life and the organisation holds a consent record against it.
Destroying the row would destroy the evidence that consent was ever given, so
archiving is as far as this goes.

`ROLES` grants `'*'`, so both are granted to `SUPER_ADMIN` automatically. No
role was added.

---

## 3. Database changes

**No migration.** Every column the feature needs already existed, including the
consent model and the `publish_status` enum. The only database-side change is
two rows in `permissions`, applied by `db:seed --reference`.

> **Deployment step.** The new permissions are seeded to the local test and E2E
> databases. Production still has the original three; run
> `pnpm --filter @sailent/database db:seed --reference` against it (with the
> target guard, `--target=production --confirm-host=…`) before the admin
> screens will load there.

---

## 4. Consent behaviour

The database constraint is the authority and was not weakened:

```sql
status <> 'published' OR subject_name IS NULL
                      OR is_anonymised OR consent_obtained
```

`StoriesService.publishBlockers()` states the same rule **before** the
constraint fires, so an editor gets a sentence naming the field and the person
rather than a 500 quoting a constraint name. Read the two together: if they
ever disagree, the database wins and the bug is in the service.

In words: a story that names somebody must either anonymise them or record that
they agreed. A story that names nobody identifies nobody and needs neither.

**`consent_document_id` is deliberately not required.** The constraint does not
demand it, the schema leaves it nullable, and consent given verbally and
recorded by staff is still consent. Demanding a signed PDF would be inventing a
legal requirement this project never stated.

### The gap the constraint does not watch

The constraint fires on the `status` column. Publishing an anonymised story and
*then* adding a name to it arrives at exactly the forbidden state by a route
the constraint never sees. `update()` therefore re-runs the gate whenever the
story is already published, and refuses the edit.

---

## 5. Public and private fields

`getStoryBySlug` used to select the **whole row** and strip `consentDocumentId`.
Two things were wrong, and the second mattered:

- `authorId` and `deletedAt` went out on a public endpoint.
- **`subjectName` went out even when `isAnonymised` was true.** A story marked
  anonymised is one where somebody asked not to be named, or where naming them
  would put them at risk, and the flag was being recorded and then ignored.

It is now an **allowlist**, not a delete list — a delete list fails open, so the
next column added to the table would be public until somebody remembered to
strip it.

| Public | Never public |
|---|---|
| title, slug, excerpt, content | `consentDocumentId` |
| challenge, intervention, journey, outcome, impact | `authorId` |
| coverImage, gallery, category, location | `deletedAt` |
| publishedAt, meta fields | drafts and archived stories (404) |
| `consentObtained` (the flag) | `subjectName` **when anonymised** |

---

## 6. Audit logging

The existing `AuditService`. No separate story audit table.

| Action | Severity |
|---|---|
| `story.create`, `story.update` | info |
| `story.draft`, `story.archived` | info |
| `story.published` | **warning** |

Publishing is `warning` because it names a real person on a public website. The
audit row carries the title and slug, never the narrative — an audit log is not
a second copy of somebody's life story, held under a longer retention period
than the story itself.

---

## 7. Media

**No media library was built.** `cover_image` and `gallery` already exist as
plain references, so an editor can point at an image that is already hosted.
Keeping them as references means the story work did not wait for the media
library and will not need redoing when it arrives. No second storage system was
created.

---

## 8. SEO

The existing architecture, unchanged: `buildMetadata`, canonical URLs, and
`meta_title`/`meta_description` already on the table and now editable.

**No Article structured data was added.** The pattern exists but the honest
version needs an author, and `author_id` is the staff member who entered the
story rather than the person who lived it — asserting either as `author` would
be a claim the data does not support. Phase 10.1 removed exactly this kind of
markup from the blog for the same reason.

Unpublished stories are not reachable publicly at all, so there is nothing to
mark `noIndex`.

---

## 9. Tests

| Suite | Count |
|---|---|
| `apps/api/test/stories.spec.ts` | **27** |
| `apps/web/e2e/admin-stories.spec.ts` | **6** (desktop, serial) |

Covering create, update, publish, the consent refusal, the
publish-then-rename bypass, anonymised privacy, drafts excluded from the public
API, archive behaviour, unauthorised access, non-staff rejection, and audit
entries.

The e2e file is `mode: 'serial'`: every test creates stories through the UI and
the public assertions read the same listing back. In parallel they interleave —
it passed six times out of ten, which is the shape of a suite nobody can trust.

### Verification

| Gate | Result |
|---|---|
| `pnpm prettier --check .` | clean |
| `pnpm typecheck` | 13/13 |
| `pnpm lint` | 13/13 |
| `pnpm test` | **809** — API 517, validation 186, database 75, web 26, worker 5 |
| `pnpm test:e2e` | **488 passed**, 28 skipped, 0 failed |
| `pnpm build` | ✓ 56/56 |

---

## 10. Known limitations

1. **Unknown public slugs answer `200`, not `404`.** `/stories/nope` renders the
   not-found page — no draft content leaks, and the body is correct — but the
   status code is wrong. `/campaigns/nope` behaves identically and has since
   long before stories had an editor, so this is an app-wide routing question
   rather than a story one. Recorded rather than changed here.
2. **Programme and campaign are entered as UUIDs**, not chosen from a picker.
   Functional and unfriendly; a picker is a small follow-up.
3. **No image upload** — references only, until the media library.
4. **No featured flag.** `getFeaturedStory()` returns the most recent published
   story, which is a defensible rule rather than an arbitrary one and means the
   page always has a lead.
5. **The success banner is transient.** A save triggers `router.refresh()`,
   which clears it. The save is correct; the confirmation can vanish before it
   is read.
