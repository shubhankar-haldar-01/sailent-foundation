# Phase 2 — Public Website

**Date:** 19 September 2026 · **Status:** Complete and verified

Phase 2 built the complete public-facing website on the Phase 1 design system,
using development fixtures. No backend business logic, no payment provider, no
authentication.

---

## 1. What was built

| Area | Delivered |
|---|---|
| Pages | 26 routes, including 5 dynamic collections with static generation |
| Components | 24 new components across 12 domain folders |
| Mock data | 11 domain modules, ~1,900 lines, fully typed |
| SEO | Per-page metadata, canonicals, OG, sitemap with dynamic entries, Organization / Article / Event / BreadcrumbList / FAQPage schema |
| States | Loading skeletons, three distinct empty states, section error boundary, four not-found pages |
| Testing | 223 Playwright assertions across 4 viewports and 2 engines |

### Routes

```
/                       /about              /team
/programs               /programs/[slug]    (7 generated)
/campaigns              /campaigns/[slug]   (6 generated)
/donate                 /impact
/stories                /stories/[slug]     (6 generated)
/volunteer              /events             /events/[slug]   (6 generated)
/blog                   /blog/[slug]        (6 generated)
/contact                /faq                /search
/privacy-policy  /terms  /refund-policy  /donation-policy
```

---

## 2. Verification

| Gate | Result |
|---|---|
| `pnpm lint` | 13/13 tasks, zero warnings |
| `pnpm typecheck` | 13/13 tasks, strict mode |
| `pnpm test` | 51 unit tests passing |
| `pnpm build` | 8/8 tasks; every public route prerendered |
| `pnpm test:e2e` | **223 passed, 0 failed** |
| `pnpm format:check` | Clean |

E2E runs across **desktop (1280)**, **tablet (768, WebKit)**, **mobile (393)** and
**320px** — and covers the eight journeys the brief names, plus a
horizontal-scroll check on 18 pages, one-`h1`-per-page, unique titles,
canonical tags, and **axe WCAG 2.1 AA audits on 14 pages** (0 violations).

---

## 3. Defects found and fixed

Phase 2 surfaced four real bugs. Three came from testing on a second browser
engine and at the narrowest viewport, which is exactly why those are in the
matrix.

### 3.1 Currency formatting broke hydration in Safari — serious

**Symptom.** Every donation interaction silently failed in WebKit. The quantity
stepper updated the input but no total appeared.

**Cause.** `Intl.NumberFormat` with `style: 'currency'` does not agree across
engines. Node and Chromium produce `"₹900"`; **WebKit produces `"₹ 900"`**
with a non-breaking space. The server renders one string, Safari renders
another, React sees a text mismatch, and hydration fails — discarding the
client tree.

**Blast radius.** Every page displaying money, for every Safari and iOS
visitor. In the Indian donor market that is a large fraction of traffic, and the
affected interaction is the one the platform exists for.

**Fix.** Format the *number* with `Intl` (Indian lakh/crore grouping is
consistent across engines) and prepend `₹` ourselves. Applied in both
`@sailent/ui` and `@sailent/validation`, with a regression test asserting no
whitespace ever appears between the symbol and the digits.

### 3.2 Invalid HTML nesting in breadcrumbs — hydration failure on ~20 pages

`BreadcrumbSeparator` renders an `<li>`, and it had been placed *inside*
`BreadcrumbItem`'s `<li>`. Browsers silently repair `<li>` inside `<li>`, so the
client DOM differed from the server DOM and React threw a hydration error on
every page carrying breadcrumbs.

The minified production error (`#418`) pointed nowhere useful; the unminified
dev message named it immediately. Separator is now a sibling of the item.

### 3.3 Status colours failed WCAG AA contrast

The success badge measured **4.11:1** against the 4.5:1 floor for normal text.
The same defect was latent in `destructive` and `info`, which axe had not
happened to render on an audited page.

Each status token is now set by the hardest case it must pass — the colour used
as *text on its own subtle background* — rather than by how it looks as a fill.
A one-line token change per colour, no component edits.

### 3.4 Horizontal scroll at 320px, site-wide

The header logo and action cluster were both `shrink-0`, overflowing the
viewport by 5px at 320px and making every page scroll sideways. The logo now
shrinks and steps down a type size at the narrowest widths.

---

## 4. Decisions taken

**P2-1 — ~~`/reports` is the canonical document library.~~ Superseded in Phase 7.**
Phase 2 settled on one public document page at `/reports`, with `/transparency`
linking to it. **Both pages were removed in Phase 7:** the platform publishes no
documents to the public at all — reports and filings are admin-only, under
*Content → Reports & documents*. The registration identifiers moved to `/about`,
because a donor claiming 80G relief needs them.

**P2-2 — A standing demo notice, not `[DEMO]` prefixes.**
Phase 1 prefixed fixture strings with `[DEMO]`. That does not scale to a full
site and makes layouts impossible to judge. Instead the content reads
realistically and a persistent banner states plainly that figures are
placeholders — tied to the same `FEATURE_MOCK_DATA` flag the config schema
**refuses** to leave enabled in production, so the notice cannot be forgotten
and the fixtures cannot silently become the live site.

**P2-3 — Statistics carry a visible "Demo data" marker.**
`StatSource` gained a `demo` kind. Every fixture figure renders with a marker
and a note describing how the number will be derived from real data. Decision
A14 holds: a figure nobody can verify is never displayed as though verified.

**P2-4 — Statutory identifiers are filled, and unmistakably fake.**
These were originally left blank, because an invented registration number on an
NGO site is a legal exposure rather than a placeholder. They are now filled so
the design can be reviewed complete, with two safeguards: every identifier
carries a literal `DEMO` marker (`DEMO-80G-00000000`, `DEMOP0000A`), and the
site-wide notice names them. An e2e test asserts that any PAN-shaped string on
the transparency page contains `DEMO` — the original intent, re-expressed for
the filled state.

All dummy organisation details live in one file, `lib/demo-org.ts`, so the real
ones replace them in a single edit.

**P2-5 — No financial figures in fixtures.**
The report fixtures describe documents without asserting anything about their
contents. Phase 2 must not invent an NGO's financials, and the most convincing
place to get that wrong is a well-designed reports page.

**P2-6 — `MediaFrame` instead of stock photography.**
No real imagery exists and reference-site assets are off limits. Rather than
grey boxes, a deterministic illustrative composition is generated from the
design tokens. The composition is chosen from the media seed, so a team slot
renders a **portrait**, a product slot renders a **still life**, a classroom
renders an **interior**, and everything else renders a **landscape with
figures** — an abstract swatch in every slot makes a page impossible to read as
a design.

**Alt text already describes the photograph that belongs there**, so the
accessibility copy is correct before the picture arrives, and aspect ratios are
fixed so nothing shifts when it does. Every frame carries
`data-media-placeholder` for a find-and-replace sweep. Swapping in `next/image`
is a change to one component.

**P2-7 — Deadlines only when real.**
Campaigns without an end date show no countdown. The water-infrastructure
campaign has `endsAt: null` deliberately, and a blog post explains why. Urgency
raises money; invented urgency costs credibility.

---

## 5. Content architecture

```
lib/mock/
├── types.ts          Presentation models mirroring the Phase 0 domain
├── programs.ts       7 programmes
├── campaigns.ts      6 campaigns, 11 products, updates, FAQs
├── stories.ts        6 stories in the five-part structure
├── events.ts         6 events, upcoming and past
├── team.ts           8 people across 4 departments
├── blog.ts           6 articles with block content
├── impact.ts         Metrics, geography, updates, methodology
├── reports.ts        10 documents, public and on-request
├── faqs.ts           22 questions across 6 categories
├── testimonials.ts   5 quotes
└── index.ts          Barrel, demo flag, search index
```

All amounts are **integer paise** (decision A2). Field names mirror
`docs/database-architecture.md`, so the Phase 4 mapping is close to 1:1.

The search index is **derived** from the same fixtures rather than maintained
separately, so adding a campaign makes it searchable without a second edit.

---

## 6. Component architecture

```
components/
├── layout/        header, footer, page shell, demo notice, newsletter
├── sections/      page hero, breadcrumbs, how-donations-work, skeletons, legal
├── media/         MediaFrame, MediaFigure
├── campaigns/     card, filters
├── programs/      card (with a featured variant)
├── stories/       card
├── events/        card, registration form
├── blog/          post card
├── donations/     donation builder, donate flow
├── volunteers/    six-step application form
├── team/          member card
├── transparency/  document card
├── impact/        stat band
└── forms/         contact form
```

Design-system components consumed from `@sailent/ui`: Button, Card, Badge,
Input, Textarea, Label, Select, Checkbox, Switch, Progress, Dialog, Accordion,
Tabs, Skeleton, Separator, EmptyState, ErrorState, LoadingState,
CampaignProgress, ProductDonationCard, StatusBadge, Testimonial, SectionHeader,
ImpactStat, Breadcrumb, `cn`, and the currency/date formatters.

---

## 7. Accessibility

axe WCAG 2.1 AA on 14 pages: **0 violations**, at every viewport.

Beyond the automated pass:

- ~~Gallery thumbnails~~ — the standalone gallery was never built and was dropped in Phase 7; this line described a plan, not a shipped page. Media figures elsewhere close on
  Escape, returns focus to the thumbnail, and moves between images with arrow keys
- The volunteer form moves focus to each step heading, so a keyboard user is
  never stranded after advancing
- Scrollable table regions are focusable (`scrollable-region-focusable`), or a
  keyboard user cannot scroll them at all
- Errors are per-field, `role="alert"`, and linked by `aria-describedby`
- The donation total is `aria-live`, so a screen-reader user hears it change
- Every heading level is sequential; exactly one `h1` per page, asserted in CI
- Touch targets are ≥44px, including the quantity stepper

---

## 8. SEO

Per-page `title`, `description`, canonical, OG and Twitter tags. Private and
thin routes (`/search`, `/account`, `/admin`) are `noindex`.

Structured data emitted: **Organization** (site-wide), **Article** (blog),
**Event** (event detail), **BreadcrumbList** (every page with breadcrumbs),
**FAQPage** (only because every question is genuinely rendered).

Deliberately **not** emitted, per `seo-strategy.md` §5: `AggregateRating` and
`Review` (no legitimate corpus), `Product`/`Offer` on campaign products (a
school kit is not merchandise, and shopping-surface treatment would
misrepresent a donation), and `DonateAction`.

The sitemap draws dynamic entries from the content itself and uses each item's
own date for `lastModified` — a build-time timestamp on every URL trains
crawlers to ignore the signal.

---

## 9. Known limitations

1. **No real photography.** `MediaFrame` renders illustrative scenes, not
   photographs. The site cannot yet demonstrate the photography-led direction
   Phase 0 specifies, which remains the single biggest gap between this and a
   finished NGO site.
2. **All organisation details are dummy** — address, phone, registration
   numbers, social links. They live in `lib/demo-org.ts` and are marked `DEMO`.
2. **Palette and typography remain placeholders** (Phase 0 open question 1).
3. **Client-side search.** The whole index ships to the browser (~20 kB on
   `/search`). Correct for fixtures; Phase 4 moves it to a Postgres query.
4. **Filters are client-side and not URL-reflected.** A filtered campaign view
   is not shareable yet. The state shape matches what the Phase 4 endpoint will
   accept, so this is a data-source swap rather than a rewrite.
5. **No document downloads.** Report cards show a disabled action with the
   reason stated rather than a link that 404s. R2 arrives in Phase 4.
6. **Forms are UI only.** Volunteer application, event registration, contact and
   newsletter validate with the shared schemas but submit nothing.
7. **Event dates are relative to render time,** so the upcoming/past split stays
   sensible as the fixtures age. This is a fixture convenience that disappears
   with real data.
8. **No analytics.** `packages/analytics` and consent-gated GA4 were deferred
   again — wiring measurement to fixture data would produce a funnel describing
   nothing. It moves to Phase 3 alongside real interactions.
9. **Blog categories and tags are display-only** — not yet filterable.

---

## 10. What Phase 3 will build

Authentication and the people modules — the first phase to touch real data:

- Donor authentication by email OTP (phone OTP as planned in Phase 0; changed in Phase 7); staff by password + mandatory TOTP
- The `users`, `roles`, `permissions`, `sessions`, `otp_codes`, `donors` tables
- RBAC guards enforcing the permission catalogue in `rbac.md`
- Route protection for `/account` and `/admin`, with the sidebar filtering from
  the same permission list the API enforces
- The donor account shell backed by real sessions
- `packages/analytics` with consent-gated GA4 and the PII whitelist
- Sentry with PII scrubbing configured before the first deploy
