# Phase 10.8 — Technical SEO

**Status: complete and accepted.**

No database change, no migration, no permission, no admin surface. This phase is
entirely in the web app: the parts of `docs/seo-strategy.md` §5–§7 specified in
Phase 0 and never built. Production was not contacted or modified.

| Spec | Outcome |
| --- | --- |
| §6 segmented sitemap behind an index | done |
| §6 `changefreq` / `priority` omitted | done |
| §6 `robots.txt` | done |
| §5 Article markup on blog posts **and stories** | done |
| §7 real 404s | **not shipped — known technical debt** (§5) |
| §7 410 Gone | **not applicable** (§6) |
| §7 performance (LCP/INP/CLS work) | **deferred** (§7) |

---

## 1. Segmented sitemap

```
/sitemap.xml            index
  /sitemap-pages.xml
  /sitemap-programs.xml
  /sitemap-campaigns.xml
  /sitemap-stories.xml
  /sitemap-blog.xml
  /sitemap-events.xml
```

One `<urlset>` per content type, exactly as §6 specifies, so a growing blog
cannot delay discovery of a new campaign — a crawler re-reads
`sitemap-campaigns.xml` without walking every post.

Implemented as **route handlers**, not Next's `sitemap.ts` convention: that
convention emits a single `<urlset>` and cannot express a `<sitemapindex>`, and
`generateSitemaps()` shards into `/sitemap/0.xml`, which is neither the
documented structure nor readable. `app/sitemap.ts` was replaced by
`app/sitemap.xml/route.ts` plus six siblings, all thin wrappers over
`lib/seo/sitemap-segments.ts`, which holds the loaders, the XML builders and the
exclusion rules in one place.

- `lastmod` is the **content's own date**, never the build time.
- **`changefreq` and `priority` are gone.** §6: "Google ignores both, and
  guessing at them adds noise." The previous sitemap carried hand-assigned
  priorities; they were not carried forward.
- Exclusions: drafts, archived campaigns, past events older than twelve months,
  and every private or transactional route.
- URLs are XML-escaped, so one awkward slug cannot make the document
  unparseable.
- Served as `application/xml` with a one-hour shared cache and
  `stale-while-revalidate`.

## 2. Sitemap index

`/sitemap.xml` returns a `<sitemapindex>` naming the six segments. Each entry is
dated by **its own segment's newest item**, so a crawler can skip a file that has
not changed rather than re-reading the site to find one new record.

## 3. robots.txt

Completed to match §6. `/volunteer/portal/` was missing and is now disallowed —
the route does not exist yet, so listing it costs nothing and means it cannot be
indexed the day it does.

The disallow list and the sitemap's exclusions are deliberately the **same set**:
a URL advertised in one and forbidden in the other is a contradiction a crawler
resolves by trusting neither.

## 4. Article JSON-LD

**Blog** (`BlogPosting`, from Phase 10.7) and **Stories** (`Article`, added
here). §5 asks for Article markup on "blog posts and stories"; only the blog had
it. The existing helper was generalised — it now takes a type and a path prefix
— rather than copied, so the blog's call site is unchanged.

A story is an `Article`, not a `BlogPosting`: a published account of somebody's
life, not a post in a blog.

**Fields are omitted rather than invented**, per decision A14:

- `author` is dropped when there is none. A story has no author column, and a
  blog post can outlive the account that wrote it (`author_id` is
  `ON DELETE SET NULL`). Naming the organisation, or "Admin", would be a small
  lie told to a crawler.
- `dateModified` is dropped when nothing recorded one.
- **No `datePublished`, no markup at all** — the type requires it, and a guess
  would be a fabrication.

## 5. Known technical debt — soft 404s

`notFound()` answers with **HTTP 200** on matched dynamic routes. The page is
correct; the status line is not, and that is the half a crawler reads — a soft
404 gets the URL indexed as a thin page and keeps it there. Unmatched paths (no
route at all) **do** return a real 404.

**The cause is identified:** `app/loading.tsx` wraps every route in a Suspense
boundary, so Next flushes the shell — and a 200 — before the page body runs, and
by then the status cannot be changed. A segment's own `loading.tsx` does the
same for that segment.

**A fix was implemented and reverted.** Removing the root loader made
`/team/*`, `/impact/*` and every unmatched path return real 404s against a
production build. It also destabilised rendering: the E2E suite failed on title
assertions under parallel load across three consecutive runs, having been
495/495 twice immediately before. The server HTML always carried the correct
title (12/12 by direct request; 0 empty titles in 120 navigations on an idle
machine), so pages were correct — but the timing change was observable, and that
is a worse trade than a wrong status on a page nobody should reach.

Five detail routes (`/blog`, `/stories`, `/campaigns`, `/programs`, `/events`)
stayed at 200 even with the root loader removed, and **not** because of their own
`loading.tsx` or `not-found.tsx` — each was removed and rebuilt individually
without effect. `/impact/[slug]` is configured identically and did return 404, so
a second, narrower cause is still unidentified.

Two ways out, neither free, both deliberately **not** taken:

1. Remove the root and segment loaders — needs the title flakiness understood
   first, not worked around.
2. `dynamicParams = false` — gives a true router-level 404 and makes a newly
   published story or campaign 404 until the next deploy, which is worse than the
   bug being fixed.

## 6. 410 Gone — not applicable

§7 wants removed public documents to return **410 Gone**. No document has its own
public URL: documents are listed inside a campaign page and the platform keeps
them admin-only (`/transparency` and `/reports` were removed in an earlier
phase). There is no URL that could be removed, so implementing 410 would mean
first inventing a public document route — which contradicts that decision.
Deferred with the architecture, not forgotten.

## 7. Performance SEO — deferred

§7's Core Web Vitals work is a separate body of work and was not in this scope:
blurhash placeholders and explicit dimensions (CLS), hero preloading and sizing
(LCP), self-hosted fonts with `font-display: swap`, and Cloudflare caching in
front of everything public. Targets remain LCP < 2.5s, INP < 200ms, CLS < 0.1.

`hreflang` also remains omitted, as §7 intends while the site is English-only.

## 8. Tests and validation

| Suite | Covers |
| --- | --- |
| `app/__tests__/sitemap.test.ts` (10, rewritten) | segment contents, exclusions, index shape, dates, XML escaping, absence of `priority` |
| `lib/__tests__/seo.test.ts` (+6) | `BlogPosting` vs `Article`, omitted author, omitted `dateModified`, no date → no markup |
| `e2e/shell.spec.ts` (+2) | the index and all six segments over HTTP; every `robots.txt` disallow |

`server-only` is aliased to an empty stub **in `vitest.config.ts` only**, so the
sitemap builders can be unit-tested. Production resolution — and therefore the
guard — is unchanged.

### Results

`prettier` clean · `typecheck` 13/13 · `lint` 13/13 · `build` 8/8

| Suite | Result |
| --- | --- |
| `@sailent/api` | 610 passed |
| `@sailent/validation` | 186 passed |
| `@sailent/database` | 180 passed |
| `@sailent/web` | 72 passed |
| `@sailent/worker` | 5 passed |
| E2E | **503 passed, 0 failed** |

E2E rose from 495 to 503: two new tests across four viewport projects.
