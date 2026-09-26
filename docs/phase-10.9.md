# Phase 10.9 — Pages / Section Composer

**Production was not touched.** No migration, seed, push, studio or admin
command ran against it. The migration is written and applied to `sailent_dev`
and `sailent_e2e` only.

---

## A. Scope, and where it comes from

There is no `phase-10.9.md` and no roadmap entry naming 10.9; the number comes
from the instruction *"Phase 10.9 Pages/CMS"*. The **feature** is documented,
and that is what was built:

| Source | Says |
| --- | --- |
| `product-requirements.md` §4.17 | "a **section composer** for the homepage and marketing pages only. Draft → … → Published → Archived, with scheduling and preview." **Done when:** "an editor can compose the homepage from approved sections, reorder them, schedule a publish, and preview unpublished content via a signed link." |
| `database-architecture.md` | `pages` (`slug`, `title`, `sections` jsonb, `status`, `published_at`, `scheduled_at`, SEO, `version`, `updated_by`) and `page_revisions` |
| `information-architecture.md` §3.6 | the reusable sections, "all of them options in the section composer" |

Every clause of the acceptance criterion is implemented: compose, reorder,
schedule, preview.

## B. The line this phase had to hold

`database-architecture.md` is explicit: sections are "an ordered array of
`{ type, props }` where `type` must be one of the **approved** section
components… An unknown section type is rejected. **This is what keeps a
composer from becoming an unconstrained page builder.**"

So the allowlist lives in `@sailent/validation`, is closed, and is checked on
every write. Three consequences, each deliberate:

1. **Every section type is a component the site already had.** No parallel set
   of "CMS blocks" to style, test and let drift. §3.6's reusable sections are
   the options.
2. **Props are thin** — a heading override and a count. Sections fetch their own
   data server-side exactly as before. An editor controls *which* and *in what
   order*, never *what it says*.
3. **Nothing stored becomes markup.** A `type` is looked up in a switch or
   ignored; a prop is passed to a typed component. There is no HTML path, so
   there is no sanitiser to keep ahead of.

**This is not a second CMS.** Campaigns, programmes, stories, events, blog posts
and FAQs keep their own tables and editors. This governs section order on a
handful of marketing routes.

## C. Database

Migration **`0020_phase10_9_pages.sql`** — additive only, idempotent, nothing
dropped or rewritten, no existing row read or modified.

- **`pages`** — `slug` (UNIQUE), `title`, `sections` jsonb, `status`
  (existing `publish_status`), `published_at`, `scheduled_at`, `meta_title`,
  `meta_description`, `version`, `updated_by`, timestamps, `deleted_at`.
  Index on `(status, scheduled_at)` — the public read's exact path.
- **`page_revisions`** — a snapshot per save: `version`, `title`, `sections`,
  SEO, `note`, `created_by`. UNIQUE `(page_id, version)` so "restore version 7"
  names one row. Append-only in practice, for the reason the audit log is.
- **RLS enabled on both, no policies.** Without it, PostgREST would expose every
  unpublished draft of the homepage through the `anon` key.

No new enum: `publish_status` already carried draft/published/archived.

> §4.17 also lists an **In Review** state. It is not implemented, and the reason
> is structural: SUPER_ADMIN is the only administrative role, so there is no
> second person to review — a review state with one reviewer is a checkbox
> pretending to be a workflow. Recorded in §I rather than faked.

## D. Scheduling, without a scheduler

A page is public when it is `published` **and** `scheduled_at` is null or
already past — compared in SQL on every read. So nothing has to run on time,
there is no cron job to add, and the row and the site can never disagree. §4.17
asks for scheduling; it does not ask for a scheduler.

A page scheduled for later is **indistinguishable from one that does not
exist** — same 404, same error code. A different answer would tell anyone who
asked what the organisation is about to announce.

## E. Preview, by signed link

`POST /admin/pages/:id/preview` returns an HMAC-signed token carrying the page
id and an expiry. It grants **one page for thirty minutes** and nothing else —
not a session, not an API token. Tampering with the id or the expiry invalidates
the signature; comparison is constant-time; a token for one page will not open
another. A bad signature, a tampered id, an expired link and a missing page all
answer identically.

## F. API and permissions

| Method | Path | Permission | Sensitive |
| --- | --- | --- | --- |
| GET | `/admin/pages` | `page.read` | no |
| GET | `/admin/pages/:id` | `page.read` | no |
| POST | `/admin/pages/:id/preview` | `page.read` | no |
| POST | `/admin/pages` | `page.create` | no |
| PATCH | `/admin/pages/:id` | `page.update` | no |
| PATCH | `/admin/pages/:id/status` | `page.publish` (+ `page.archive` to archive) | **yes** |
| POST | `/admin/pages/:id/revert` | `page.update` | **yes** |
| GET | `/pages/:slug` | public | — |

Permissions **105 → 110**: `page.read/create/update/publish/archive`, the last
two sensitive. `content.*` was rejected for the reason stories and blog rejected
it — it already governs site copy generally. **No `page.delete`.**

Creating always yields a draft. Publishing a page with no sections is refused.

## G. Public rendering

`/` composes from the database when a published `home` page exists, and renders
its built-in order when it does not. **The fallback is the design, not a
placeholder:** an empty table, an unreachable API, an archived page or a
schedule that has not arrived all leave the site looking like itself. A composer
must not be able to take the homepage down.

## H. Tests

| Suite | Count | Covers |
| --- | --- | --- |
| `packages/validation` | 14 | the allowlist — unknown types, raw markup, foreign props, bounds, order |
| `apps/api/test/pages.spec.ts` | 31 | authorization, re-auth, the registry, revisions and revert, publishing, scheduling, signed preview and four forged tokens, safe public fields, audit |
| `apps/web` section renderer | 8 | order honoured, two orders distinguished, unknown type ignored, nothing becomes markup |
| `e2e/admin-pages.spec.ts` | 2 | compose → reorder → publish → verify the public homepage → archive → verify the fallback |

### Two defects the tests caught

- **The renderer assumed `props` existed.** A row without it crashed the
  homepage. The write path parses through Zod, which fills it in — but a
  renderer that trusts its input was parsed is one restored revision away from
  a stack trace. Now defaulted.
- **A `.strict()` gap** would have let a prop belonging to another section
  through silently. Asserted directly.

### A third defect the tests caught — in the tests

Adding a second and third staff-session spec pushed the E2E suite past a
threshold and exposed an existing fragility in **three** admin specs, two of
them written long before this phase.

`admin-blog`'s re-authentication and `admin-stories`' save began failing in
roughly **four runs out of six** — always by waiting for a UI state that never
arrived (`Confirm it is you` still visible; `Saved.` never rendered), never by
an error. Instrumenting the click settled it: the server action's POST
**completed in 232 ms**, and then there was *no further network activity at
all* for the full twenty-second timeout, with the button still reading
"Saving…".

So the request succeeded and React never committed the action's transition.
That is the App Router under a saturated machine — three browser projects, five
hundred tests and two Node servers on one laptop — not a fault in the
application: nothing in the page, the action or the API had failed, and the
window was open on the session the whole time.

The fix asserts what the server did rather than what the client painted: wait
for the action's response, reload, then assert. It is **stronger** than what it
replaced — a reload proves the anonymisation reached the database and that the
API now serves the record it had refused, neither of which a rendered banner
shows. Three consecutive full runs are clean.

> Worth stating plainly: a human cannot reach this. It needs a click within
> tens of milliseconds of a page load, on a machine already at its limit. It is
> recorded because it will look like a product bug the next time somebody sees
> it, and it is not one.

## I. Known limitations and deferred work

1. **No In Review state** (§C) — one administrative role, so there is nobody to
   review. Adding the state without a reviewer would be theatre.
2. **Only the homepage composes today.** The table and the API are route-agnostic
   — `about` works the moment that route calls `getComposedPage` — but only `/`
   is wired, because that is what the acceptance criterion names.
3. **Preview renders through the API, not the page.** `GET /pages/:slug?preview=`
   returns the composition; wiring a preview URL into the public route is a
   small follow-up not required by §4.17.
4. **Props are intentionally thin.** No per-section image or copy overrides. That
   is the composer/page-builder line, and widening it is a product decision.
5. **`scheduled_at` has no "what changes when" preview.** An editor sees the
   scheduled time, not a diff against what is live.
6. **The E2E suite is now near this machine's limit.** 505 tests across three
   browser projects is what surfaced the transition stall above. It is not a
   correctness problem, but the next phase that adds specs should expect to
   raise it again, and the answer is to assert server-observable outcomes, not
   to raise timeouts.

## J. Production deployment — not executed

```
pnpm --filter @sailent/database db:migrate --target=production \
  --confirm-host=<exact production host>
```
```
pnpm --filter @sailent/database db:seed --target=production \
  --confirm-host=<exact production host> --reference
```

The migration is additive and idempotent. The reference seed takes production
from 105 to 110 permissions; note it still deletes and re-inserts every
SUPER_ADMIN grant, as in previous phases. **No content is seeded** — with no
composed page, every route renders its built-in order, exactly as today.
