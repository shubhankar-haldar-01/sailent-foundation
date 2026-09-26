# SEO Strategy — Sailent Foundation

**Phase:** 0 · **Date:** 19 September 2026

An NGO's search presence has two jobs that pull in different directions: reach people searching for a cause to support, and reach people checking whether this organisation is legitimate. The second matters more. Someone who searches "Sailent Foundation" after receiving a WhatsApp forward is deciding whether to trust us, and what they find decides whether they donate.

---

## 1. Intent map

| Intent | Example query | Landing page |
|---|---|---|
| Brand verification | "sailent foundation" · "sailent foundation genuine" | `/` and `/about` |
| Cause discovery | "donate for children's education india" | `/programs/education`, `/campaigns` |
| Concrete giving | "donate school kit" · "sponsor a child's books" | Campaign detail with products |
| Tax motivation | "80g donation online" · "tax exemption donation" | `/donate`, `/about` |
| Volunteering | "ngo volunteer opportunities [city]" | `/volunteer` |
| Research | "annual report ngo education india" | `/impact`, `/programs` — the platform publishes no documents |
| Informational | "how many children out of school in india" | `/blog`, `/stories` |

**Product-based giving is the differentiated opportunity.** "Donate school kit" has clear intent and far less competition than "donate to charity", and a page that answers it concretely — this is the kit, this is what is in it, this is the price, this is who receives it — outperforms a generic donation page for that query.

---

## 2. URL structure

Flat, readable, permanent.

```
/                              /about                    /team
/programs/[slug]               /campaigns/[slug]         /stories/[slug]
/events/[slug]                 /blog/[slug]              /blog/category/[slug]
/impact                        /about
/volunteer                     /contact                  /faq
```

Rules:
- Lowercase, hyphenated, no dates, no ids, no nesting beyond two levels.
- Slugs are descriptive but short: `/campaigns/school-kits-jharkhand`, not `/campaigns/help-us-provide-school-kits-to-underprivileged-children-in-jharkhand-2026`.
- **Slugs never change silently.** A change 301-redirects permanently from the old slug, and slug history is retained in the database.
- Trailing slashes normalised; one canonical form.
- Filters use query parameters (`/campaigns?program=education`), which keeps one canonical URL for the listing.

### Noindex

`/account/*`, `/volunteer/portal/*`, `/admin/*`, `/donate/checkout`, `/donate/status/*`, filtered and paginated listing variants beyond page 1, search results, and preview URLs. These are transactional or private; indexing them wastes crawl budget and can expose reference numbers.

---

## 3. Metadata

### Titles

| Template | Pattern | Example |
|---|---|---|
| Home | `{Org} — {Positioning}` | Sailent Foundation — Education and health for children in rural India |
| Programme | `{Programme} — {Org}` | Education Programme — Sailent Foundation |
| Campaign | `{Campaign} — Donate to {Org}` | School Kits for Jharkhand — Donate to Sailent Foundation |
| Story | `{Title} — Stories — {Org}` | |
| Blog | `{Title} — {Org} Blog` | |
| Event | `{Event} — {Date} — {Org}` | |

50–60 characters. The distinguishing words come first — a title where the first forty characters are the organisation name wastes the whole of a mobile SERP line.

### Descriptions

150–160 characters, written per page, never auto-truncated from body copy. Campaign descriptions state the concrete ask: *"₹900 provides a school kit — notebooks, stationery, uniform and a bag — for one child in rural Jharkhand for a full school year."*

Descriptions are a database field, written by the editor, with a publish-time warning when missing. Google may rewrite them; that is not a reason to leave them empty.

### Canonicals

Self-referencing on every indexable page. Filtered and sorted listings canonicalise to the unfiltered listing. Paginated pages self-canonicalise (they are distinct content, not duplicates of page 1).

---

## 4. Open Graph and social

Every public page emits OG and Twitter Card tags. **This matters more than usual here**: campaigns spread by WhatsApp and Instagram, and a share with no image and a truncated title converts far worse than one with a proper card.

```
og:title, og:description, og:image (1200×630), og:url, og:type, og:site_name, og:locale
twitter:card = summary_large_image
```

- Campaigns use their cover image; a per-campaign override is available for share-optimised crops, because a 16:9 hero often crops badly at 1.91:1.
- A generated fallback carries the organisation mark and the page title — never a broken or missing image.
- **WhatsApp is the primary sharing channel in this market.** OG tags are tested against WhatsApp's scraper specifically, which is stricter about image size and slower to refresh its cache than Facebook's.

---

## 5. Structured data

Only what is true and substantiated. Misleading markup risks a manual action, and for an NGO it is also simply dishonest.

### Organization — site-wide, in the root layout

```jsonc
{
  "@type": "NGO",
  "name": "Sailent Foundation",
  "url": "https://sailentfoundation.org",
  "logo": "…",
  "description": "…",
  "address": { "@type": "PostalAddress", … },
  "contactPoint": { "@type": "ContactPoint", "contactType": "customer support", … },
  "sameAs": ["…social profiles…"],
  "nonprofitStatus": "NonprofitType"   // only with real registration details
}
```

Registration numbers appear in this markup only once confirmed (open question 2). **Asserting a registration we have not verified is exactly the misleading markup to avoid.**

### Article — blog posts and stories
`headline`, `image`, `datePublished`, `dateModified`, `author`, `publisher`. Author is a real person, not "Admin".

### Event — event pages
`name`, `startDate`, `endDate`, `location` (`Place` or `VirtualLocation`), `organizer`, `eventStatus`, `eventAttendanceMode`. `offers` only for genuinely free registration, priced at zero.

### BreadcrumbList — every page with breadcrumbs
Mirrors the visible breadcrumb exactly. Markup that disagrees with the visible page is a violation.

### FAQPage — `/faq` and campaign FAQ sections
Only where the questions are genuinely displayed on the page.

### Deliberately not used

| Schema | Why not |
|---|---|
| `DonateAction` | Poorly supported and easily read as a transactional claim we cannot back |
| `AggregateRating` / `Review` | We have no legitimate review corpus. Fabricating one is the clearest possible violation. |
| `Product` / `Offer` on campaign products | A school kit is not a product for sale. Marking it as one invites shopping-surface treatment that misrepresents a donation, and risks tax and consumer-law confusion. |
| `MonetaryGrant` | Not applicable — we receive, not grant. |

---

## 6. Sitemaps

Segmented by type with a sitemap index, so a large blog never delays discovery of a new campaign.

```
/sitemap.xml            index
  /sitemap-pages.xml    static pages
  /sitemap-programs.xml
  /sitemap-campaigns.xml
  /sitemap-stories.xml
  /sitemap-blog.xml
  /sitemap-events.xml
```

Generated dynamically from the database, cached and revalidated on publish. `lastmod` reflects real content updates, not the build time — a build-time `lastmod` on every URL trains crawlers to ignore the signal.

**Excluded:** drafts, archived campaigns, noindex routes, and past events older than 12 months.

`changefreq` and `priority` are omitted. Google ignores both, and guessing at them adds noise.

### robots.txt

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /account/
Disallow: /volunteer/portal/
Disallow: /donate/checkout
Disallow: /donate/status/
Disallow: /api/
Disallow: /search
Sitemap: https://sailentfoundation.org/sitemap.xml
```

---

## 7. Technical SEO

### Rendering
Public pages are server-rendered or statically generated. **No public content depends on client-side JavaScript to appear.** Campaign listings, detail pages, stories and blog posts render fully on the server; only the donation builder and filters are interactive on the client.

### Performance
Core Web Vitals are a ranking factor, and on Indian mobile connections they are also simply the difference between a page being read and being abandoned.

| Metric | Target |
|---|---|
| LCP | < 2.5s on a mid-range Android over 4G |
| INP | < 200ms |
| CLS | < 0.1 |

Achieved by: explicit image dimensions and blurhash placeholders (CLS), the hero image preloaded and correctly sized (LCP), minimal client JavaScript on content pages, self-hosted fonts with `font-display: swap` and a metric-compatible fallback, and Cloudflare caching in front of everything public.

### Other
- `hreflang` omitted while the site is English-only, with the structure ready for `en-IN` / `hi-IN`.
- HTTPS everywhere, HSTS preloaded.
- 404s return a real 404 (never a soft 200); removed public documents return **410 Gone**, which is a meaningful distinction for an NGO removing a published report.
- Pagination uses real links crawlers can follow, not an infinite scroll that hides content behind an event handler.
- Internal linking: every campaign links to its programme, every story to its campaign, every impact record to its programme. This is how link equity reaches deep pages, and it happens naturally because the relationships already exist in the schema.

---

## 8. Content strategy

**Pillar pages** — programme pages as comprehensive resources on their cause area, not thin descriptions. These are what earn links from journalists and researchers.

**Supporting content** — blog posts and stories linking back to the relevant pillar.

**The transparency page is the highest-value page on the site for trust queries.** Someone searching "is sailent foundation genuine" must find a complete, current page with registration details, audited statements and real reports. Most NGO sites treat this page as an obligation; treating it as a landing page is a genuine advantage.

**What not to do:** keyword-stuffed cause pages, AI-generated blog volume, doorway pages per city, or emotional manipulation in titles. An NGO caught gaming search loses more than the ranking.

---

## 9. Measurement

Google Search Console (property verified, sitemaps submitted, Core Web Vitals and coverage monitored) plus GA4 (`analytics-plan.md`).

Tracked: impressions and clicks per page type, ranking for brand queries (should be position 1), ranking for product-giving queries, organic share of donations, and the `/about` page's performance on trust-intent queries.

**The metric that matters is donations from organic search, not sessions.** A campaign page ranking well and converting nobody is a content problem, not an SEO success.

---

*Related: [`information-architecture.md`](information-architecture.md) · [`analytics-plan.md`](analytics-plan.md)*
