# Phase 10.7 — Blog / Content Management

**Production was not touched by this phase.** No migration, seed, push or any
other command ran against the production database. The migration and the
permission seed are written, applied locally, and listed in §Deployment for
somebody to run deliberately.

---

## A. What was already there, and what it was

`/blog` and `/blog/[slug]` existed and rendered **eight fabricated articles**
from `apps/web/src/lib/mock/blog.ts` — invented titles, invented authors,
invented dates. There was no table, no API and no way for an editor to write
one.

Because of that, three deliberate exclusions were in place, each carrying a
comment saying it comes off when a real blog lands:

| Where | What it did |
| --- | --- |
| `app/(public)/blog/page.tsx` | `noIndex: true` on the listing and the article pages |
| `app/sitemap.ts` | `/blog` and every `/blog/[slug]` omitted |
| `e2e/shell.spec.ts` | asserted `noindex`, and that no `Article` schema was emitted |

They existed for decision **A14**: no public claim without a real record behind
it. A sitemap entry and a `schema.org/Article` are among the strongest claims a
site can make.

All three are now reversed, together, because the condition they were waiting
on is met. **The mock file is deleted**, along with its entries in the mock
search index and the `BlogPost` type.

### What was reused rather than rebuilt

The audit found working machinery for almost everything this phase needed:

- **`publish_status`** already carried `draft | published | archived`.
- **`categories`** is a lookup table with a `kind` discriminator.
- **`slug_history`** already gives every sluggable entity a 301 on rename.
- **`media`** (Phase 10.6) owns uploads, validation and delete-safety.
- **`story.*`** is an exact precedent for a five-verb content permission set,
  a controller shape, an admin form and an admin API client.

So there is **no second CMS**. The blog is the stories vertical applied to
articles.

---

## B. Database

One migration, `drizzle/0019_phase10_7_blog.sql`, **additive only**: three new
tables, one new enum value, and row-level security on all three tables. Nothing is dropped, renamed or rewritten, no
existing row is read or modified, and it is safe to apply twice.

### `blog_posts`

| Column | Notes |
| --- | --- |
| `id`, `title`, `slug`, `excerpt`, `content` | `slug` is **UNIQUE** in the database, not only in the service |
| `featured_media_id` | FK → `media(id)` `ON DELETE SET NULL` |
| `category_id` | FK → `categories(id)` `ON DELETE SET NULL` |
| `author_id` | FK → `users(id)` `ON DELETE SET NULL` |
| `status` | the existing `publish_status` enum |
| `published_at` | stamped on **first** publication and never moved |
| `meta_title`, `meta_description`, `canonical_url` | |
| `created_at`, `updated_at`, `deleted_at` | the shared helpers |

`content` is **Markdown, never HTML** — see §Security.

The featured image is a **real foreign key**, unlike `success_stories.cover_image`,
which is a plain text URL because it predates the media library. `SET NULL`
rather than `CASCADE`: losing an image must not delete the article written
around it.

### `blog_tags` and `blog_post_tags`

`blog_tags` is separate from `categories` because they answer different
questions: a category is the one shelf an article sits on, chosen from a
curated list; a tag is a keyword an author types while writing. Filing both in
`categories` would put ad-hoc keywords into the lookup that campaign and
programme pages read from.

Tag identity is the **normalised slug**, which is UNIQUE — "Field Notes",
"field notes" and "Field-Notes" all resolve to one row. `blog_post_tags` uses a
composite primary key, so tagging a post twice with the same tag is impossible
rather than merely discouraged.

### `category_kind` gains `blog`

Rather than a second taxonomy. An article about the education programme belongs
under the education the rest of the site already names; a `blog_categories`
table would have meant two spellings of "Child Welfare" and a public URL for
each. `both` is deliberately **not** widened — it predates this value and means
"programme and campaign", so widening it would silently re-file every existing
category as a blog category.

### Row-level security is part of the migration

`ALTER TABLE … ENABLE ROW LEVEL SECURITY` on all three tables, with **no
policies** — the convention every other table here follows.

It is not a formality. Supabase publishes the `public` schema through PostgREST
using the `anon` key, which is public by design, so a table without RLS is
readable by anyone who knows the project URL. For the blog that would mean
**every draft, readable by the world** — exactly what the publish gate exists to
prevent. RLS with no policies denies every row to any role it applies to, and
the application connects as the table owner and bypasses it; a policy here would
be a second authorization system with different rules from the permission
guards.

The first version of the migration omitted this. `apps/api/test/database.spec.ts`
asserts the property for **every** table rather than a fixed list, so it failed
there rather than shipping — which is what that test is for.

### Why the migration is hand-written

`drizzle-kit generate` diffs against `meta/0007_snapshot.json`, which is eleven
migrations stale — it proposes re-creating half the schema and prompts about a
`product_status` enum that has existed since `0000`. Every migration since
`0008` is hand-written for the same reason; `0019` follows them.

---

## C. Permissions

Five, mirroring `story.*` exactly. **96 → 100** was Phase 10.6; this phase takes
the catalogue to **105**.

| Key | Sensitive | Why |
| --- | --- | --- |
| `blog.read` | no | Drafts are visible only behind it |
| `blog.create` | no | |
| `blog.update` | no | Editing is ordinary work |
| `blog.publish` | **yes** | Puts the organisation's name behind an article |
| `blog.archive` | **yes** | Takes down something that may already be linked |

`content.*` exists and was rejected here for the reason it was rejected for
stories: it already governs pages and site copy, so granting it to let somebody
write an article would grant them the homepage.

There is **no `blog.delete`**, and no delete route. Archiving keeps the row, its
audit trail and its slug, so a URL that was once live never becomes a lie.

> `blog.archive` is enforced in the service rather than on the route, because
> all three transitions share one endpoint and `@RequirePermission` is an AND
> over its arguments — listing both would demand archive rights merely to
> unpublish. (`story.archive` is declared in the catalogue and enforced
> nowhere. That is a pre-existing gap in the stories module, not a pattern
> copied here.)

---

## D. API

Admin — `@RequireAudience('staff')`, SUPER_ADMIN is the only staff role:

| Method | Path | Permission | Sensitive |
| --- | --- | --- | --- |
| GET | `/admin/blog` | `blog.read` | no |
| GET | `/admin/blog/:id` | `blog.read` | no |
| POST | `/admin/blog` | `blog.create` | no |
| PATCH | `/admin/blog/:id` | `blog.update` | no |
| PATCH | `/admin/blog/:id/status` | `blog.publish` (+ `blog.archive` to archive) | **yes** |

Public — every route `@Public()`:

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/blog` | Published only. `q`, `category`, `tag`, `page` |
| GET | `/blog/categories` | Only categories carrying a published post |
| GET | `/blog/:slug` | Published only; a retired slug answers `{ redirectTo }` |

**Two read paths, deliberately not one function with a flag.** A flag
defaulting the wrong way, or a caller forgetting to pass it, publishes drafts —
and the failure is silent, because a draft renders perfectly. The public reads
pin `status = 'published'` in SQL and take no argument that can widen it.

Creating always yields a **draft**, whatever the caller asks for. Publishing is
a separate call, permission, gate and audit row.

---

## E. Admin and public routes

| Route | |
| --- | --- |
| `/admin/blog` | list, status filter, search, pagination; title, status, category, author, published, updated |
| `/admin/blog/new` | |
| `/admin/blog/[id]` | edit, publish, archive |
| `/blog` | featured lead post, category chips, search, pagination |
| `/blog/[slug]` | article, author, date, category, tags, related posts |

The sidebar's Blog entry pointed at `/admin/blog` already; the stale
`Phase 4` label is removed. No duplicate entry was added.

**No delete action** anywhere — archive instead, for the reason in §C.

The slug follows the title only until somebody edits it, or until the post
exists. Changing a published slug is allowed and safe: the old one is retired
into `slug_history` and 301s to the new one.

---

## F. Media integration

The blog **never uploads**. `featured_media_id` references a row Phase 10.6
already owns, and there is no second R2 path, no second upload endpoint and no
second copy of the magic-byte validation.

`MediaPicker` was a private function inside `story-form.tsx`; it is now a shared
component at `components/admin/media-picker.tsx`, keyed by **media id** rather
than URL. It offers **public images only** — a private image has no public URL
by database constraint, so it would render broken for every visitor, and the
API refuses one as a featured image with a field error.

The picker shows a preview of the current selection and offers "Remove the
featured image".

---

## G. Content, and why there is no sanitiser

The body is **Markdown**, rendered by `lib/blog/markdown.tsx` to **React
elements**. `dangerouslySetInnerHTML` does not appear in that file and must not.

The usual shape — store HTML, sanitise on the way out, hand it to
`dangerouslySetInnerHTML` — makes safety a denylist that must stay ahead of
every parser quirk for the life of the product. Here, text becomes `children`,
which React escapes, and every element and attribute is one the renderer wrote.
An article containing a `<script>` tag renders those characters as words
because that is all they can be.

URLs are still checked, because a URL is the one place an author-supplied
string reaches an attribute React cannot make safe: `safeUrl` allows `http`,
`https`, `mailto` and site-relative paths, normalising entity- and
control-character tricks (`java&#09;script:`) before reading the scheme.

The editor is a textarea with a small marker toolbar — no new dependency, and
explicitly not a page builder. Supported: headings, paragraphs, bold, italic,
links, ordered and unordered lists, blockquotes, images, inline code.

---

## H. SEO, structured data and the sitemap

- `noIndex` is **gone** from both blog pages.
- Title falls back `metaTitle → title`; description falls back
  `metaDescription → excerpt → opening of the article`.
- `canonical_url` is honoured when set (an article first published elsewhere);
  otherwise the page is its own canonical, which is the honest default. This
  added `canonicalOverride` to `buildMetadata`.
- `publishedTime` and `modifiedTime` come from real columns.

**`BlogPosting` JSON-LD is emitted**, and every field comes from a column.
Optional fields are **omitted rather than filled in**: `author` is dropped when
the post has none, because `author_id` is `ON DELETE SET NULL` and an article
can outlive the account that wrote it — naming the organisation, or "Admin",
would be a small lie told to a crawler. No `datePublished`, no markup at all.

**Sitemap**: `/blog` and every published post are listed, dated by the post's own
`updated_at`, at its current slug. Drafts and archived posts cannot appear —
`getBlogSitemapEntries` reads the public list endpoint, which pins
`status = 'published'` in SQL. It pages through rather than asking for one large
limit, so the sitemap does not silently truncate as the blog grows.

---

## I. Caching and static generation

`/blog/[slug]` is **dynamic, with no `generateStaticParams`**. The previous
version pre-rendered all eight mock posts. Two reasons for the change:

1. **Drafts must not leak through the build.** A route whose safety depends on
   a build-time snapshot fails silently the moment something is unpublished,
   because the old HTML stays on disk.
2. **Unpublishing must take effect immediately**, not at the next deployment.

The cost is a request per view, absorbed by `publicCache` (300s revalidate,
`blog` tag) which the admin actions invalidate on every publish.

The content layer's blog adapter is **the only one without a fixture
fallback**. Every other loader falls back so a developer with no API sees a
page; doing that here would reinstate fabricated articles in a place nobody
looks. An unreachable API yields an empty blog, which the pages render as an
honest empty state.

**Building the web app requires the API running** — this is the established
architecture, unchanged by this phase.

---

## J. Audit

Existing table, existing actor and context conventions. Actions:
`blog.create`, `blog.update`, `blog.published`, `blog.draft`, `blog.archived`.

Publication and archival are recorded at **`warning`** severity; both change
what the public can read. The audit row carries the title and slug — **not the
article body**. An audit log is not a second copy of the content.

---

## K. Security

- Public responses name their columns explicitly. `users` holds the password
  hash and the TOTP secret, so a `select()` on a join to it is one careless
  line from serialising both.
- The public author is a **display name only** — no id, no email, no avatar,
  no role.
- The public post response carries no `id`, `categoryId` or `featuredMediaId`.
- A draft slug 404s **indistinguishably** from one that never existed. A 403
  would be an oracle confirming which unpublished articles exist.
- Content is stored verbatim; escaping is structural at render time (§G).

---

## L. Tests

| Suite | Count | Covers |
| --- | --- | --- |
| `apps/api/test/blog.spec.ts` | 42 | authorization, re-auth, create/update, slug uniqueness and history, tags, publish gate, pagination, filtering, public published-only reads, safe fields, audit |
| `apps/web/src/lib/blog/__tests__/markdown.test.tsx` | 24 | XSS, URL schemes, rendering, excerpting |
| `apps/web/src/app/__tests__/sitemap.test.ts` | rewritten | published-only, dates, no invention |
| `apps/web/e2e/admin-blog.spec.ts` | 2 | the full lifecycle |
| `apps/web/e2e/shell.spec.ts` | inverted | indexable, with real `BlogPosting` markup |
| `apps/web/e2e/journeys.spec.ts` | updated | a real article, real byline, semantic markup |
| `apps/api/test/database.spec.ts` | updated | the three new tables registered; RLS asserted |

The E2E lifecycle is: create a draft → confirm it is **not** public (detail and
listing) → re-authenticate → publish → confirm it **is** public, with canonical,
robots and JSON-LD → archive → confirm it is **not** public again.

Public assertions run in a **signed-out reader context**, because asserting
"what the public can see" from a staff browser asserts the wrong thing.

`global-setup.ts` seeds one published post into the isolated E2E database, so
the cross-viewport public journey has a real article to open. It is a test
fixture, not product content.

### Defects these tests caught before release

- **A hang, not a failure.** `renderInline` recursed while sharing one `/g`
  regex, so the inner call rewound the outer cursor and the loop never
  terminated. It hung the vitest worker rather than failing an assertion.
- **`c.map is not a function`.** `admin/categories` returns `{ items }`, not a
  bare array. It typechecked perfectly and 500'd the page at runtime.
- **A publish that silently did nothing.** The status buttons carried
  `name`/`value`, which the shared `Button` does not forward, so the action got
  no status and answered "The submitted data is not valid" — after the
  re-authentication, which made it look as though the re-auth had failed.
  Replaced with the two-step confirmation `story-form.tsx` uses.
- **Three tables with no row-level security** (§B). Caught by the schema test,
  not by review.
- **A cross-spec session collision.** This spec re-authenticates in order to
  publish, which opens a five-minute window on the *session* — and it shared
  `STAFF_STATE` with every other spec, so `admin-stories.spec.ts`, which
  asserts that publishing without a re-authentication is refused, failed
  depending on which ran first. The blog spec now signs in through the form and
  keeps its own session.
- **A "Saved." banner instead of a redirect.** `revalidatePath('/sitemap.xml')`
  invalidated enough of the client router to remount the form, resetting
  `useActionState` and discarding the `redirectTo` it had returned. The path
  revalidation was redundant (the sitemap reads through the `blog` tag) and is
  gone; creation now redirects **on the server**.

---

### Results

`prettier` clean · `typecheck` 13/13 · `lint` 13/13 · `build` 8/8

| Suite | Result |
| --- | --- |
| `@sailent/api` | **607 passed** |
| `@sailent/validation` | 186 passed |
| `@sailent/database` | 147 passed |
| `@sailent/web` (unit) | 52 passed |
| `@sailent/worker` | 5 passed |
| `test:e2e` | **495 passed, 0 failed** (493 before this phase) |

---

## M. Known limitations

1. **Soft 404s, app-wide and pre-existing.** `notFound()` renders the correct
   page but this application answers it with **200** — on `/blog`, and equally
   on `/stories`, `/campaigns`, `/programs` and `/team`. It predates the blog
   and is not fixed here because it is not a blog defect; it is worth a small
   dedicated change, as search engines treat a soft 404 as a thin page. The E2E
   asserts on **content** rather than status for this reason.
2. **No media in the E2E fixture**, so the picker's populated state is covered
   by unit tests and the admin UI rather than by a browser journey.
3. **No scheduled publishing.** `published_at` is stamped when somebody
   publishes; a future-dated draft is not released automatically.
4. **Search is `ILIKE`.** Correct and sufficient at this size, and deliberately
   not an external search service. It scans the body on the public route; if
   the blog grows into the thousands, a `tsvector` index is the next step.
5. **`story.archive` remains unenforced** in the stories module (§C). Out of
   scope here, flagged rather than silently changed.

---

## N. Production deployment

**None of this has been run against production.** In order:

1. **Migration** — `drizzle/0019_phase10_7_blog.sql`. Additive, idempotent, no
   existing row read or written. Apply with the guarded command:

   ```
   pnpm --filter @sailent/database db:migrate --target=production \
     --confirm-host=<exact production host>
   ```

2. **Permissions** — the reference seed adds the five `blog.*` keys, taking
   production from **100 to 105**:

   ```
   pnpm --filter @sailent/database db:seed --target=production \
     --confirm-host=<exact production host> --reference
   ```

   Note what else `--reference` does, unchanged from previous phases: it
   **deletes and re-inserts every SUPER_ADMIN grant** — a window in which the
   only administrator has no permissions, and a lockout if it fails midway —
   and it upserts category names and slugs, which are public URLs. Settings
   values are not touched.

3. **No environment variables** are introduced by this phase.

4. **No content.** The blog starts empty and renders an honest empty state
   until somebody writes the first post. Nothing is seeded, and no fabricated
   article is shipped.
