# The content layer

How the public website gets its data, and why the development fixtures cannot reach production.

---

## 1. The problem this solves

Phase 2 built the complete public website against fixtures in `apps/web/src/lib/mock/`. Phase 3 gave it a real backend.

The obvious move — rewrite twenty pages to call the API — would have meant re-reviewing twenty pages of finished design for a change that is not about design at all. The pages now import from `@/lib/content` instead, and that layer decides where data comes from.

```
page ──▶ @/lib/content ──▶ API ──▶ Postgres
                    └────▶ fixtures   (development only, when the API is unreachable)
```

---

## 2. The rule

**The API is the source of truth. The fixtures are a development convenience that cannot survive into production.**

Three things hold that line:

**The flag.** The fallback runs only while `FEATURE_MOCK_DATA` is on, and the config schema **refuses to boot with that flag enabled in production**. A production build therefore has no path to a fixture at all.

**The boundary.** No page and no component imports a fixture for data. They import a function from `@/lib/content`. The only remaining `@/lib/mock` imports are types, and the three content kinds that have no backing table yet (blog posts, testimonials, published documents) — each marked with a comment saying so.

**The noise.** Every fallback logs a warning naming what failed. "The API is down and you are looking at fixtures" is never a silent state.

```ts
export async function loadContent<T>(options: LoadOptions<T>): Promise<T> {
  const api = createServerApiClient();
  try {
    return await options.fromApi(api);
  } catch (error) {
    if (!fixturesEnabled || !options.fallback) {
      throw error;    // production: fail loudly
    }
    console.warn(`[content] ${options.label}: the API is unreachable, serving development fixtures…`);
    return options.fallback();
  }
}
```

A page that renders plausible-looking placeholder numbers when the database is unreachable is worse than a page that fails, because nobody finds out.

### Verified

| API | `FEATURE_MOCK_DATA` | Result |
|---|---|---|
| up | either | Builds from the database. Zero fallback warnings. |
| **down** | **`false`** (production) | **Build fails**: `Failed to collect page data for /campaigns/[slug]` |
| down | `true` (development) | Builds from fixtures, 140 warnings, fixture-only slugs appear |

The middle row is the one that matters, and it is the reason the layer exists.

> Note when checking this yourself: Next.js persists its fetch cache in `.next/cache` between builds, so a second build with the API down will quietly succeed from cache. `rm -rf .next` first.

---

## 3. A 404 is an answer, not a failure

```ts
try {
  return toProgram(await api.get<ApiProgramDetail>(`programs/${slug}`, …));
} catch (error) {
  if (isNotFound(error)) return null;   // NOT a fallback trigger
  throw error;
}
```

Without this, a slug that genuinely does not exist would fall through to the fixtures, find a match there, and render — so the 404 page would never be seen and an unpublished campaign would appear to be live.

---

## 4. Mappers

Each module translates the API's vocabulary into the page's:

| API / database | Presentation | Why they differ |
|---|---|---|
| `title` | `name` | A programme has a name on the page |
| `campaignCount` | `activeCampaignCount` | The card says what it counts |
| `coverImage: string \| null` | `cover: MediaRef` | Placeholder art needs a seed until real photography exists |
| `description` (one text field) | `story: string[]` | Split on blank lines, rendered as paragraphs |
| `impactDate`, `description` | `occurredOn`, `body` | The schema reads as a schema; the component reads as a component |
| `registrationStatus` + `startDate` | `status` | The card needs to know registration is shut, not why |

Translating here rather than renaming either side keeps both readable.

Fields the database does not yet carry map to empty — `''`, `[]`. A programme with no recorded activities renders no activities section rather than an invented one. **Decision A14 applies to prose as much as to statistics.**

---

## 5. Caching

`publicCache(tag)` gives every public read `revalidate: 300` and a cache tag.

Five minutes: long enough that a burst of traffic to a campaign page does not become a burst of database queries, short enough that publishing something shows up while the person who published it is still looking at the page. The tags let a future CMS save revalidate precisely instead of waiting.

---

## 6. Fetch in parallel

```ts
const [featured, campaigns, programs, filters] = await Promise.all([
  getFeaturedCampaign(), getCampaigns(), getPrograms(), getCampaignFilters(),
]);
```

Four independent reads awaited one after another make the page as slow as their sum. The homepage issues seven this way.

---

## 7. What Phase 3 changed in the API to make this work

The integration surfaced real gaps, which were fixed in the backend rather than papered over in the frontend:

- **Editorial columns** added to `programs` (`problem`, `approach`, `activities`, `metrics`, `accent_icon`), `campaigns` (`faqs`, `impact_notes`, `updates`) and `events` (`schedule`, `gallery`) — migration `0003`. Without these, half of each page would still have come from a fixture in production.
- **Slugs joined** into the story and event listings and details. A client that receives `programId` and needs "which programme is this about" has to fetch every programme to find out.
- **`hasProducts`** added to the campaign listing as an `EXISTS` subquery. The card changes when a campaign offers product-based giving; returning every product for every campaign would be paying for a whole catalogue to render one badge.
- **Geographic reach computed** in `/impact` from the programme records themselves:

  ```sql
  SELECT location ->> 'state' AS state,
         array_agg(DISTINCT location ->> 'district') AS districts,
         array_agg(DISTINCT p.title) AS programmes
  FROM programs p
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(p.locations, '[]'::jsonb)) AS location
  WHERE p.status = 'published' AND p.deleted_at IS NULL
  GROUP BY location ->> 'state'
  ```

  "We work in four states" is a claim, and the only honest source for it is the programme records. Nobody types this number in, so nobody can inflate it — and when a programme closes, the figure falls on its own.

The impact page's per-state *beneficiary* column was **removed** rather than reconstructed: no table records beneficiaries per state, and A14 says a figure with no source does not render.

---

## 8. Still fixture-backed

| Content | Waiting on |
|---|---|
| Blog posts | A `blog_posts` table — Phase 7 CMS |
| Testimonials | A `testimonials` table — Phase 7 CMS |
| Published documents | The `documents` table plus R2 storage — Phase 5 |
| Gallery, FAQs | Phase 7 CMS |
| Site search | A server-side query against Postgres full-text search — the client-side index over fixtures stays until then |
| `methodologyNotes` | Stays in code deliberately: it is a commitment the organisation stands behind, so it belongs in review rather than in a row someone can quietly edit |

Each import is marked with a comment naming what it is waiting for.

---

## 9. Adding a content type

1. Add the fetch + mapper to `apps/web/src/lib/content/<type>.ts`.
2. Export it from `index.ts`.
3. Give it a `fallback` only if a fixture exists; content with no fixture simply throws when the API is down, which is correct.
4. Import the function in the page and make the component `async`.
5. Never import from `@/lib/mock` in a page or component except for types.
