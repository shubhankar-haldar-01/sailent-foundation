# CHANGELOG

A chronological development history built from the git history, the migration journal (`packages/database/drizzle/meta/_journal.json`), the phase documents in `docs/` and the work recorded in this project's development sessions. Nothing here is invented.

**Dating notes:**
- The phase documents 0, 1 and 2 are dated 2026-09-19. The other phase documents carry no date; their migrations' journal timestamps are used instead. The timestamps for `0017`–`0022` were hand-assigned and may not be exact.
- The first commit (`2ba2b43`, 2026-09-26) contains all work up to Phase 10.12, so individual dates before it cannot be confirmed from git. Later commits (from 2026-10-04) are dated from git.

Newest first.

---

## 2026-10-08 — Campaign card: smaller, evenly aligned figures (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `campaign-card.tsx`: Donors / Raised / Goal in three equal columns (two when the donor count is hidden), each figure centred, dividers between; the tinted disc hugs its icon (22px around a 12px icon; was 30px around 14px), values 12–13px (were 14–15), labels 11px. Loading skeleton matched | Owner: "make little small and align properly", then "decrease the icon height and remove the right and left padding of the icon" — the content-sized columns left uneven spacing between the figures | Every campaign card (listing, homepage bands, programme pages, related campaigns). Replaces the "sized to content, edge to edge" spacing from earlier the same day. ₹10,00,000 fits at the narrowest card measured (80px column at 1024px) | — |

## 2026-10-08 — Login card: text kept off the photograph; fits the screen after "Send OTP" (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `AuthShell`: the welcome panel keeps its proportions (`aspect-[770/840]`) and the form column centres in it. The panel's peach shapes stretch with its height, so a panel only as tall as the short form squashed the greeting's ground and the text ran onto the photograph | Owner: the welcome text overlapped the photograph | Card height is now set by the panel (622px at 1470px wide) and does not jump when the code step opens | — |
| `sign-in-form.tsx`: "Send OTP" is hidden once a code is sent ("Resend OTP" below does that job); tighter code-step spacing. `/sign-in` and `/sign-up`: one-line intro, smaller heading | Owner: the card grew past the screen after "Send OTP" | Whole card visible on a 1470×735 window in both states (dev preview banner aside) | — |

## 2026-10-08 — Login: the OTP step appears after "Send OTP"; footer link targets (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `sign-in-form.tsx`: the "Enter OTP" divider, the OTP field and the Login button render only once a code has been sent; focus then moves to the OTP field. "Use a different email?" hides them again until the next send | Owner request | Before sending, the card shows only the email field, Send OTP and Sign Up. `dashboard.spec.ts` now also asserts the OTP field and Login button are absent before sending | — |
| `site-footer.tsx`: each link in the footer's link lists is a 24px-high target (`min-h-6`), rows 2px apart (was 16px text 6px apart) | WCAG 2.2 target size (2.5.8): the links had 23.2px of clear space, flagged by axe whenever sub-pixel positions fell badly (seen on `/sign-in` after sending a code) | Footer lists about 4px taller per row; every page | — |

## 2026-10-08 — Login and Sign Up card made smaller (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `AuthShell`: card capped at 66rem (was 88.5rem); the welcome panel's fixed `min-h-[52rem]` removed, so the form sets the height; tighter padding; smaller brand lockup. `/sign-in`, `/sign-up` and `sign-in-form.tsx`: smaller heading, text and spacing; fields and buttons 44px (`h-11`, was 56px). The panel's tagline may shrink to 11px so it stays on its peach ground at 1024px | Owner: the card was too big and not visible without scrolling | Card 917px → 636px tall; the whole card shows on a 1470×830 window. Layout, wording and behaviour unchanged; touch targets stay ≥ 44px | — |

## 2026-10-08 — Header: Login / Sign Up replaces Donate (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| The header bar's Donate pill is now a "Login / Sign Up" pill (`site-header.tsx`), linking to `/sign-in`, from `sm` up. A signed-in donor sees their initials badge instead (new `signedIn` prop, set by the public and dashboard layouts). Between 1024 and 1279px the pill drops its icon and some padding so the brand name is not cut off | Owner request. Owner decision: one button to sign-in, because a donor account is created by the first donation and there is no separate sign-up | Donate stays in the hero, campaign cards, closing blocks and as the first button in the phone menu. `docs/information-architecture.md` updated | — |
| Phone menu: a "Login / Sign Up" row ("My account" when signed in) above Search | Owner decision: add login to the menu; Donate stays in the menu | — | — |
| Tests: `dashboard.spec.ts` — signed out, the header offers Login / Sign Up (bar or menu) and no Donate in the bar; signed in, the header shows the account badge and no login | Refusal and state paths | — | — |

## 2026-10-08 — Stories page redesigned to the owner's design (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `/stories` rebuilt (`components/stories/`): hero with title, lead, three promises and a three-photo collage (`stories-hero.tsx`); breadcrumb; category pills (`story-filters.tsx`); a featured story with photo and peach panel (`featured-story.tsx`); a three-column card grid; "View More Stories"; a "Support more stories like these" band with two framed photos (`stories-cta.tsx`). Decorations in `stories-decor.tsx` | Owner's Stories page design ("exact 100 percent" match), measured against the design at its own width (1130px) | Stories listing only; header and footer unchanged | — |
| Everything is live data. The lead is the newest story in the current view (owner decision). Pills are the categories published stories are filed under, in programme order. "View More Stories" adds six more on the same page as a plain link (`?count=`), keeping the filter (owner decision); `?category=` filters. Empty states for no stories and for a category with none. A story with no cover keeps the featured card at its designed height (the placeholder fills the frame instead of sizing it) | Brief: no hard-coded stories or categories | — | — |
| API: `GET /stories` takes `?category=` (case-insensitive, max 80 chars) and each row carries `category` — the story's own, else its programme's (owner decision), via `coalesce` in `content.service.ts`. Four new tests in `apps/api/test/stories.spec.ts` | The design files each story under a category | Additive; existing callers unaffected | — |
| `StoryCard` redesigned (category chip with its icon on the photo, two-line summary, place and date, arrow). Used on `/stories`, story detail, programme detail and `/impact` | Design | Healthcare chips blue and Disaster Relief amber on story cards (palette pairs); other categories keep `categoryTone`. The Education book stays outlined (filled, it becomes a block). The arrow hides on cards narrower than 19rem so place and date stay on one line | — |
| Story covers: `public/images/story-sunita-finished-school.webp`, `story-a-healthier-season-for-ramesh.webp`, `story-from-training-to-a-shop-of-her-own.webp`, copies of existing site photos | Owner decision: use the matching photos already in `public/images` | Replaced automatically when a cover is uploaded in Admin → Stories | — |
| Leaf decorations drawn whole: the top leaf of every sprig on the page (hero, featured story, closing band) was cut off by its SVG box (`viewBox` started at 0; the top leaf rises to y = −22). Boxes now start above it, and each placement is rescaled so every other leaf keeps its size and position | Owner: "every leaf the top is not complete" | `/stories` only | — |
| Known differences from the design: it shows nine stories and seven categories; the local data has three published stories in three categories, so only those appear and "View More" is hidden. The CTA photos are the closest available (children walking arm in arm, hands planting). Navy button labels follow the owner's colour decision | Data and owner decisions | — | — |

## 2026-10-09 — Fix: signed-in donors (and staff) logged out ~15 minutes into a visit (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Sessions are refreshed in the middleware (`apps/web/src/middleware.ts`, now `runtime: 'nodejs'` and matching every route except static files), two minutes before the 15-minute access token expires; the new cookie goes to the browser and into the request being rendered. A refresh the API refuses clears the cookie (and `/dashboard` / `/admin` then redirect to sign-in); an unreachable or failing API leaves the session alone | Owner: "after login, pages like the homepage or a campaign log me out". Cause: the refresh ran during a page render, which cannot write cookies — the API rotated the token, the new one was lost, and the next use of the spent token revoked the session as a replay (confirmed in local `sessions` / `audit_logs`) | Donor and staff sessions now last their full 30 / 7 days of activity. No API, database or schema change | — |
| `lib/auth/session-refresh.ts` (new): the audiences' cookie names and lifetimes, the cookie attributes, `parseSession`, and `refreshIfDue` — one refresh per token for requests that arrive together, its result kept 60 s for late ones still carrying the old cookie (web server memory only — the API's reuse detection is unchanged), keyed by the token's SHA-256, at most 5,000 entries; display name kept across refreshes | Concurrent requests must not replay a spent token | Per process (see `SECURITY.md`, refresh-token row) | — |
| `lib/auth/token-store.ts`: a page render never rotates a token — where cookies cannot be saved it uses the token while valid and never calls the API; route handlers and server actions keep their fallback refresh. Shares cookie options and parsing with the middleware | The root cause | — | — |
| Tests: `session-refresh.test.ts` (23), `token-store.test.ts` (4), `middleware.test.ts` (rewritten, 23: refresh on public pages and the dashboard; expired / revoked / replayed / forged refresh tokens and a garbled cookie clear the session without looping; API down, failing or rate-limiting keeps it; donor and staff never refresh each other). `e2e/dashboard.spec.ts`'s sign-out test first makes the stored session look expired and browses `/`, `/campaigns`, `/dashboard` — still signed in on every page, and the first response's `Set-Cookie` carries a rotated token (checked in the header, not the cookie jar: the production build marks the cookie `Secure`, which WebKit will not store over the suite's plain `http://localhost`) | CLAUDE.md §5 refusal paths | All 48 signed-in donor tests pass on the four projects | — |

## 2026-10-08 — Donor dashboard redesigned to the owner's design (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `/dashboard` rebuilt in three columns from `xl`: account sidebar (avatar, name, email; Dashboard, Payments, Profile, Settings; a rule; Saved, Events, Volunteering, Updates; Logout in red; a "Together we create brighter futures." card), the welcome banner, three figures, Recent Payments and Campaigns You've Supported in the centre, and My Profile, Your Impact, Explore More Campaigns (and What you funded, when there are items) on the right. One `Panel` shape for every card | Owner's dashboard design | Donor account area only: `app/(dashboard)/layout.tsx`, `dashboard/page.tsx`, `components/dashboard/*`. The public header and footer, admin and the other account pages are unchanged (the profile page's `<dl>` markup was corrected, see below). Dark mode supported | — |
| The banner has no photograph: cream ground, peach shapes, leaves and orange strokes, "Good to see you again, / {first name} 👋". The `<h1>` carries both lines, so it is announced as the greeting with the name | Owner: remove the girl image | — | — |
| All figures are the donor's own (decision A14): Total Donations (with the donation count), Campaigns Supported, Items Provided. The design's "Lives Impacted 25+" and "12% from last month" have no data behind them and are not shown | A14 | — | — |
| Recent Payments: a table from `md` (Date, Transaction ID, Campaign, Amount, Status, Receipt — the receipt icon opens the receipt when one exists, "—" otherwise), one card per payment below `md`. Campaigns You've Supported: six most recent from `me/campaigns`, with thumbnail, category chip, last donation date, the donor's own amount and View; "Showing 6 of N" when there are more; "View All Campaigns" goes to the public listing | Design | `/dashboard/campaigns` is removed (owner: no separate page); it is gone from the nav and from `e2e/dashboard.spec.ts`'s protected list | — |
| My Profile shows phone, location (city, state) and "Member since" (the account's `createdAt`, which the API already sent and `DonorProfile` now types) — each only when present; Edit opens the existing profile page. Avatars are initials: no photograph is held | Design; no hard-coded personal data | — | — |
| New states: `dashboard/loading.tsx` (skeletons matching the layout) and `(dashboard)/error.tsx` ("Something went wrong… Try Again", inside the shell). Empty states say "No payments yet" / "You haven't supported a campaign yet." with Explore Campaigns | Brief | — | — |
| Phone: the sidebar becomes an identity row with a sideways-scrolling nav at the top, Logout at the foot; sections in the brief's order; no sideways page scrolling at 320–480px | Brief | Logout button is now labelled "Logout" (`e2e/dashboard.spec.ts` accepts either name) | — |
| On a desktop (from 1280px) the whole dashboard fits the screen without scrolling (owner request): every panel tightened, and Recent Payments / Campaigns You've Supported show as many rows as the window's height allows — 2 at 1467×803 (the owner's screen), 3 from ~915px tall, 4 from ~1030px, 5 from ~1145px (`components/dashboard/fit.ts`, thresholds measured). Transaction IDs show in full on one line; campaign names wrap to two lines. Phones and tablets keep every row and scroll normally | Owner: "there should be no scroll" | Content ends at 790px in an 803px window; checked at 1440×900, 1470×956, 1536×960, 1680×1050, 1920×1080, 1920×1200, 2560×1440. Nav rows are 40px with a mouse, 44px on touch screens. The global footer still follows below | — |
| Right-hand cards re-matched to the owner's card design: My Profile (17px title, 58px avatar, solid phone / pin / calendar icons, "Member since Oct 2024", Indian mobiles shown as "+91 98765 43210" — other numbers exactly as stored), Your Impact (solid green leaf, narrow four-line text, a sprout-in-soil illustration with the sun), Explore More Campaigns (peach rise with pointed leaves, more room under the button). Artwork in `components/dashboard/decor.tsx`; `formatPhone` unit-tested | Owner: "exact 100 percent" | The column still fits the owner's screen (ends at 749px, 793px with a location row). Unchanged by design: initials instead of a photo (none is stored), the button's navy label (AGENTS.md §11 contrast rule), and no Location row when the donor has no city | — |
| `dashboard/profile/page.tsx`: each `<dl>` row is one `<div>` holding only its `<dt>`/`<dd>` (the hint moved inside the `<dd>`) | axe `definition-list` failed on the page before this work | Markup only | — |

## 2026-10-08 — White header on a tinted page (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Light `--background` is now `oklch(0.958 0.016 245)` (about #e9f3fb) instead of `--neutral-50` (about #f6fbff); the header bar is `bg-surface` (pure white, opaque) instead of `bg-background/95` | Owner decision: the header and the pages were the same colour and did not read as different surfaces | Every public and dashboard page in light mode; white cards and panels now stand out from the page. Dark mode is unchanged. `--surface-tint` stepped down to `oklch(0.94 0.028 250)` so the tinted bands (Who We Are, the Programs breadcrumb band, campaign sections) still read as bands. `--muted`/`--surface-sunken` (`--neutral-100`) are now a touch lighter than the page; they are used inside cards, where that is fine | — |
| Two contrast fixes the darker page needed: light `--info-action` (small blue links, "View All …") is `oklch(0.515 0.155 250)`, a step below `--accent-600`, which measured 4.43:1 on the tinted page and 4.19:1 on the band; "View More Programs" is a solid peach (`--cta-50`) instead of 10% orange, which turned grey over the tinted page (4.34:1) | WCAG AA | Every blue text link and info button, light mode only (white on the button is higher-contrast than before). axe clean on /, /programs, /stories, /campaigns, a campaign page, /about, /sign-in and /donate | — |

## 2026-10-08 — Login page redesigned to the owner's design; a Sign Up explanation page (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `/sign-in` rebuilt as a two-panel card (`components/auth/auth-shell.tsx`): a welcome panel ("Welcome to Sailent Foundation", tagline, the homepage banner's schoolgirl — the owner's photo choice — leaves, and an "Education today for a brighter tomorrow." card) beside the form panel (brand lockup, "Login to Continue", email + Send OTP, Enter OTP divider, OTP + Login, "Resend OTP in 30s", OR, "Don't have an account? Sign Up") | Owner's login design | Sign-in only; the flow is unchanged (email code, decision A8). The welcome panel is sized in container units so it keeps its proportions from 1024px up; below `lg` the form stands alone. The form comes first in the source for keyboard and screen-reader users | — |
| Both steps on one screen (`components/dashboard/sign-in-form.tsx`): both fields usable from the start; after a code is sent the address is held, focus moves to the OTP field, "Use a different email?" appears, and "Resend OTP" waits 30 seconds | Design | The status line still says only "if this address matches a donation or a volunteer application…" | — |
| Unit tests for the sign-in actions' refusal paths (`lib/auth/__tests__/donor-actions.test.ts`, 9 tests): a non-address, a malformed or missing code, a wrong or expired code, an unreachable server, and redirects that would leave the site | Auth change rule (CLAUDE.md §5) | The actions themselves are unchanged | — |
| New `/sign-up` (noindex): explains that an account starts with a donation or a volunteer application and that there is no password, with Donate Now and Volunteer with Us, and "Already have an account? Login" | Owner decision: "Sign Up" explains rather than adding self-registration (codes are only ever emailed to addresses already held) | No server change | — |
| `lib/fonts.ts`: the scoped Manrope 800 now shared by the programs hero and the sign-in/sign-up headings | Designs set these headings heavier | Only those pages load it | — |
| `e2e/dashboard.spec.ts`: the three signed-out sign-in checks follow the new wording (heading, "Send OTP", OTP field) with the same intent, and now also follow Sign Up to `/sign-up` | Design change | — | — |

## 2026-10-08 — Programs page redesigned to the owner's design (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `/programs` rebuilt: two-column hero (photo in an organic outline with peach shape, rays, hand-drawn leaf and green sprig; three principles; the design's small "Stronger communities, brighter futures" card over the photo was removed at the owner's request), breadcrumb band, area pills, a three-column grid of programme cards, "View More Programs", and a "Support our programs" panel with a photo collage | Owner's Programs page design and brief | Programs listing only. The global header and footer are unchanged | — |
| All data is live: programmes, their areas, covers and open-campaign counts come from the API in CMS display order. The pills are the areas the programmes have; the grid shows six at a time, and "View More Programs" appears only while more remain. Area and page are URL parameters (`?category=…&page=…`, `components/programs/programs-query.ts`), server-rendered with no client script. Unknown areas or page numbers fall back safely; canonical stays `/programs` | Brief: no hard-coded programmes, counts or areas; works for 0 to 20+ programmes | `Program.category` is now mapped from the API (it was dropped). Fixture fallback uses the programme name | — |
| New program card (`program-card.tsx`): photo, an area-coloured icon on a white ring over the photo's edge, Manrope 600 title, description, campaign count, arrow. The whole card is one link, with a focus ring round the card | Design | Program-card icon colours follow the design (Education, Disaster Relief and Animal Welfare orange; Healthcare blue; Women Empowerment purple; Environment green; Child Welfare pink). Campaign cards keep their own category colours | — |
| `public/images/program-child-welfare.webp`, a copy of the Child Welfare campaign's own photo (`campaign-child-nutrition-gaya.webp`) | Child Welfare was the only programme without a photo, and its card showed the generated placeholder | Replaced automatically when a cover is uploaded in Admin → Programs | — |
| Tests: `programs-query.test.ts` (0, 1, 3, 6, 7 and 23 programmes; area matching; fallbacks) and `program-card.test.tsx`; a `programs listing` block in `e2e/journeys.spec.ts` (pill narrows the grid; View More adds the rest) | Brief | — | — |
| Hero re-matched to the owner's banner reference: ExtraBold heading (Manrope 800, loaded only by `programs-hero.tsx`, so other pages' fonts are unchanged); navy body text; the design's principle labels and icons (leafy stem, three people, heart); a pale sun with three thick rays, a taller peach shape, larger orange leaf and broad sage sprig (whole, in clear space just right of the photo so it neither covers the photo nor is cut off — owner requests; the photo takes 82% of its column to make that room, and the sprig's drawing box was enlarged so no leaf is clipped); the photo outline traced from the design; a wider frame so the girl appears at about the design's scale. Between 1024 and 1440px the copy wraps narrower and the left-hand decorations sit closer, so they never cross the text | Owner: "exact 100 percent" match of the hero | /programs only. The "Stronger communities" card stays removed (owner's earlier request). The design's taller crop of the photo is not available: the supplied photo is a 625×314 crop, so the girl is shown slightly larger than in the design | — |

## 2026-10-08 — Campaign card redesigned to the owner's card design (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `campaign-card.tsx`: photo rounded on all corners; filled status pill; category pill with its icon; 18px Manrope title; Donors / Raised / Goal stacked and centred with dividers and tinted discs; orange progress bar; taller layout | Owner's card design (replaces the approved card in `AGENTS.md` §11 item 2, updated to match) | Used on `/campaigns`, the homepage bands, programme pages and related campaigns. Donor count still hidden below five (two columns then); figures size to the card (`@container`) | — |
| Figures sized to their content and spread edge to edge: Donors aligns with the title and bar on the left, Goal with the bar on the right, dividers centred between | Owner follow-up: less side space around Donors and Goal | Same on every card width (288–358 px measured) | — |
| New `--wash-coral` / `--wash-coral-ink` tint pair (light and dark) in `tokens.css` | The design's red-orange Donors and Goal marks sit between the rose and amber tints | No raw colours in the component | — |
| Kept: the category pill's 60% wash (full wash puts the blue and gold inks at 4.36:1 and 4.24:1), Education's closed-book icon (shared with the approved cause tiles), the navy Donate label | Contrast and the approved cause tiles | — | — |

## 2026-10-07 — Dark mode; search icon removed from the header bar (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `ThemeProvider` follows the device setting (`defaultTheme="system"`, `enableSystem`); a visitor's choice is remembered (next-themes, `localStorage` `theme`) | Owner decision: follow device setting | Dark devices get the dark theme on first visit, with no flash (next-themes sets the class before paint) | — |
| `components/layout/theme-toggle.tsx`: `ThemeToggle` (icon button, `aria-pressed`) in the public header at every width (on a phone beside the menu button, at its size and navy — owner request) and in the admin header; `ThemeToggleRow` (`role="switch"`) as a "Dark mode" row in the phone menu | Owner decision: header + phone menu; public site and admin | The phone header bar gains the moon/sun button; the phone menu is one row taller than the approved panels | — |
| Dark-mode fixes: the admin's own light grounds (`[data-surface='admin']`) no longer override the dark theme (`.dark [data-surface='admin']`; light text on white panels was 1.09:1 on every admin screen); `--warning-foreground` is a light amber in `.dark` (was dark on the dark subtle ground, 1.37:1); `/campaigns` search button label navy in dark only; account badge uses `text-success-foreground`; payment marks sit on a white chip in dark; About script accents get a light dark-mode ink; the `/campaigns` banner's four text colours get dark-mode values (≥ 7:1; light banner unchanged) | Found by an axe + screenshot pass in dark mode | No change to the light theme | — |
| Search icon removed from the header bar at every width | Owner request | Search stays in the phone menu and at `/search` | — |
| About, "Check us before you give": the Donate Now button is hidden on phones (below `sm`) | Owner request | On a phone the section's one action is "Ask us anything"; tablet and desktop unchanged | — |

## 2026-10-07 — Brand primary colour #EB6A1F; desktop About sections and phone header bar to the owner's mockups (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Primary orange `#EB6A1F` (hover `#F57C3A`, pressed `#C5531A`, light `#FFEFCC`, soft `#FFF7ED`) in `packages/ui/src/styles/tokens.css` — the `--cta-*` scale and new `--primary-active-foreground`, `--primary-ink`, `--primary-light`, `--primary-soft` | Owner's brand-colour brief | Every `bg-`/`border-`/`fill-`/`stroke-`/`outline-primary` (buttons, Donate, back-to-top, active indicators, checked controls, progress, map dots, tints) is `#EB6A1F`. Category and semantic colours unchanged | — |
| Button labels on primary are **navy** (4.61:1); **white only while pressed**, on `#C5531A` (4.54:1) | White on `#EB6A1F` is 3.18:1 and fails WCAG AA — owner chose navy labels over a darker fill | `button.tsx` primary variant gains `active:text-primary-active-foreground` | — |
| `text-primary` (eyebrows, active nav labels, orange links) is the darker `--primary-ink` `#B74500` via `--text-color-primary` in `@theme` | `#EB6A1F` as small text is ~3:1 on the off-white grounds; owner chose a darker shade for text only | No component edits for text; ≥ 4.5:1 on every light surface. Icons and decoration that were `text-primary` now use `text-cta-glow` (`#EB6A1F`) | — |
| Form focus: `Input`, `Textarea`, `SelectTrigger` border and a flush 2 px ring in `#EB6A1F`; an error keeps its red border. Radio dot `#EB6A1F`; product selector's selected row on `#FFF7ED` | Brief §10–11 | Other focus outlines keep the site-wide ring | — |
| About: hero, "How this started" and "Our presence" matched to the owner's desktop mockups (type sizes, collage proportions, larger map in Mercator projection, card, decorations); phone header bar (no Donate pill below `sm`, search + menu icons, one-line name with tagline, orange glyph) | Owner's mockups | Layout below the matched widths adapts; no new data or copy | — |

## 2026-10-07 — Mobile menu matched to the owner's menu design (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| One soft peach capsule at a time: on the open group, or with every group closed on the current page; the open group's text and chevron turn orange. Groups open one at a time | Owner's mobile menu design (Drawer Open / Dropdown Open panels) | Phone menu only (below `lg`). Where a page is both a top-level row and a group link (Stories), or shares /contact with the Contact Us row, the row marks the current page and no group claims it | — |
| Group links in the phone menu: Get Involved → Donate, Volunteer with Us, Partner with Us (/contact); Resources → Stories, Blog, FAQ (`NavEntry.mobileChildren`) | The design lists these | The desktop dropdowns are unchanged. Events and Our Team are no longer in the phone menu; both remain in the footer | — |
| Measured to the design: 44px rows with a 38px capsule 10px from the edges; sub-links indented and 32px apart in slate blue; a 50px Donate Now; dividers above Search and above the social row; a solid envelope for Contact Us; solid Facebook, LinkedIn and YouTube marks (`SOCIAL_ICONS_SOLID`); white panel | Design | Sub-links are below the 44px target in `docs/design-system.md` (recorded in `DEVELOPMENT_STATUS.md` §9, row 26); they pass WCAG 2.2 AA (24px) | — |

## 2026-10-07 — Mobile footer to the approved mobile design (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| New `MobileFooter` (below `md`, 768px): a "Be part of the change" card with Donate Now across the footer's top edge; brand lockup with tagline and a one-line description; round social icons; About, Programs, Campaigns, Get Involved and Resources as collapsed `<details>` groups; Our Office / Email Us / Call Us rows; full-width outline Contact Us; legal links, copyright and a round back-to-top button | Owner's mobile footer design | Every page that uses `SiteFooter`, phones only. The desktop footer is unchanged and hidden below `md` (pixel-identical at 768, 1024 and 1440). The design's donate card overrides the old "no donate band" footer note, on phones only | — |
| Footer group "Campaigns" (`footerCampaignsGroup`: All, Closed, Completed) | The design has a Campaigns group; these are the listing's existing status filters | Phone footer only; desktop columns unchanged | — |
| `BackToTop` button | Design | Smooth scroll unless reduced motion is set; from the keyboard, focus moves to the skip link | — |
| `social-icons.tsx`: one icon map shared by the header menu and both footers, with an X logo for "X"/"Twitter" | The header and footer had separate copies, with the old Twitter bird | Shows only when an X/Twitter link is entered in Admin → Settings | — |
| Legal row keeps the existing links (Privacy Policy, Terms of Use, Donation Policy) | The design's "Sitemap" has no page for people (`/sitemap` is a 404; only the XML index for search engines exists); no refund policy (Phase 9) | — | — |

## 2026-10-07 — Mobile menu redesigned to the approved mobile design (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `SiteHeader` mobile menu (below `lg`) is now a full-screen dialog: brand lockup with tagline and a close button; nav rows with the current page on a soft orange pill; Get Involved and Resources as collapsible groups (the current page's group opens itself); full-width Donate Now; Search and Contact Us rows; the organisation's social links under a rule | Owner's mobile design | Every public and donor-dashboard page. Rendered as a sibling of `<header>` (its backdrop blur traps `fixed` children). Focus moves in on open, Tab is kept inside, Escape and the close button return focus to the menu button, body scroll is locked, any link closes it | — |
| Header menu button always labelled "Open menu" (state in `aria-expanded`) | The open menu has its own "Close menu"; two of the same name were ambiguous | `shell.spec` unchanged and passing | — |
| `SiteHeader` takes `socialLinks`; the public and dashboard layouts pass `getOrganisation().social`. `BrandLockup` gains `tagline="always"` | Social row comes from Admin → Settings, like the footer; the design shows the tagline in the menu | Twitter/X icon supported when that link is entered | — |

## 2026-10-07 — About page: phone layout to the mobile mockup (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `/about` below `sm` (640px) only: larger four-line headline, full-width stacked buttons, rays and leaves beside the photo, horizontal "Focused on people" card; focus areas 2×2 centred; story reflowed (first paragraph, village photo, rest, two photos, centred button) via `contents` + `order`; Mission/Vision icon-and-title row; presence reordered (map, full-width button, rounded photo, handwritten line); "Full team and board" under the cards; registration list in two columns with the buttons after it | Owner's mobile mockup | Desktop and tablet pixel-identical at 640/768/1024/1280/1440 (screenshot diff) | — |

## 2026-10-07 — Typography system: Manrope + Inter (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Fonts: Manrope (600, 700) replaces Plus Jakarta Sans as `--font-heading`; Inter (400, 500, 600) replaces DM Sans as `--font-body`. Only those weights load | Owner's typography spec | Every `font-display` / heading picks up Manrope and all other text Inter, through the existing variables; Inter `font-bold` renders at 600, anything above 700 on Manrope at 700 | — |
| Base rules (`packages/ui` tokens): h1/h2 700, h3–h6 600; admin h4–h6 in Inter; eyebrow token (`text-overline`) 600; display/h1/h2 letter-spacing tightened | Hierarchy per spec | No layout change | — |
| Button primitive `font-medium` → `font-semibold` (Inter 600) | Spec: buttons Inter 600 | All buttons | — |
| Public page/section h1–h2 at display/h1/h2/section size: `font-semibold` → `font-bold`; all `font-extrabold`/`font-black` → `font-bold` | Spec: major headings Manrope 700; no 800 | Visual weight only | — |
| Navbar: active link 600; labels 13px with tighter padding and a one-step-smaller wordmark between `lg` and `xl`; footer headings Inter 600 | Inter and Manrope are wider than the previous faces: "Get Involved" wrapped and the wordmark truncated at 1024–1150px | Header fits at every width | — |
| Admin donations table: reference kept on one line | Wrapped mid-reference in Inter | — | — |
| Admin `StatsCard` value: Manrope 700 | Spec: KPI figures in Manrope | Admin dashboard | — |

## 2026-10-07 — Phase 14: Infrastructure & Production Operations (`feat(infra): complete production operations readiness`; committed locally, NOT pushed; NOTHING DEPLOYED)

**Owner decisions:** Google Cloud Run; Supabase production; web, API and worker as separate services; production database, secrets, migrations, seeds, deployment, DNS/TLS and Razorpay configuration are human-only; SEO and the legal audit stay in Phase 15. Standing decisions unchanged: Campaign Gallery kept, SUPER_ADMIN only, no staff 2FA, no recurring giving.

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Dockerfiles for the API, worker and web; `.dockerignore` | There were no images | Multi-stage, production dependencies only (`pnpm deploy --prod` / Next standalone), non-root, port 8080, exec-form start; no `.env`, secret, migration or seed. **Not built here** (no Docker on this machine) | — |
| Web: `NEXT_OUTPUT=standalone` support; `start-standalone.cjs` runs the environment check before serving | Next's standalone server validates lazily, so a misconfigured container served 500s instead of failing | A bad production configuration now stops the container (exit 1) | — |
| Web build no longer calls the API: slug `generateStaticParams` removed; `loadContent`/`getOrganisation` call `connection()` during `next build` only (`requestTimeOnly()`) | A production build without a reachable API failed at `/impact/[slug]` | Images build with no API, database or secret; `/admin/login`, `_not-found` and the content sitemaps now render per request. A first version also called `connection()` at request time; E2E showed it stalling renders after server actions (Next resolves it on a timer under `NODE_ENV=development`), so it is limited to the build | — |
| `turbo.json`: `build` hashes `NEXT_PUBLIC_APP_URL`, `MEDIA_PUBLIC_BASE_URL`, `NEXT_OUTPUT` | Turborepo stripped them and could reuse a build made with other public values | Correct caching per site | — |
| Cloud Run service templates and a build-only `cloudbuild.yaml` (`infrastructure/cloud-run/`) | No deployment configuration existed | Secrets only as Secret Manager references; worker internal, one instance, CPU always on; no deploy step anywhere | — |
| `PORT` honoured by the API and worker; `DATABASE_POOL_MAX`; the API closes its database pool on shutdown | Cloud Run sets `PORT`; connection budgeting; the pool was never closed | Rolling deploys release connections | — |
| Health: API readiness returns 503 when the database is down and never the error text; worker `/ready` (Redis + database); web `/api/health` no-store; 2 s timeouts, 5 s cache | Probes need a real signal; the old endpoint echoed driver errors | Startup/liveness probes for all three services | — |
| Error tracking: a dependency-free Sentry-compatible reporter in `packages/config` with a scrubber; wired into the API (5xx, start-up), worker (exhausted jobs, unhandled errors) and web (`onRequestError`) | Failures were visible only in logs | Off unless `SENTRY_DSN` is set; no body, cookie, query, user, token, PAN or email leaves the process. `SENTRY_TRACES_SAMPLE_RATE` removed | — |
| Logs carry Cloud Logging `severity`; the API no longer logs the internal-secret and idempotency-key headers; the worker redacts token fields | Security fix and operability | — | — |
| `MEDIA_PUBLIC_BASE_URL` / `R2_PUBLIC_BASE_URL` validated (exact host, https in production, no credentials/query/fragment/wildcard) | Image optimiser allow-list hardening | An invalid value fails the build or start-up | — |
| `pnpm.overrides` for vulnerable transitive packages | `pnpm audit --prod`: 30 advisories (15 high) | 4 remain (drizzle-orm high, file-type ×2 and @nestjs/core moderate), each needing a major upgrade — `SECURITY.md` §2 | — |
| `pnpm check:deploy` (45 static rules) and `pnpm check:web-build-isolation` | Keep the container and Cloud Run rules from regressing | — | — |
| Docs: `DEPLOYMENT.md` §8 and §11–§21 (architecture, release, containers, Cloud Run settings, sizing, env checklist, secrets, monitoring, jobs, backups/restore, rollback); `SECURITY`, `ARCHITECTURE`, `DATABASE`, `PROJECT`, `PHASES`, `infrastructure/README.md` | Phase 14 scope | GA4 not wired (no consent mechanism; the privacy policy's analytics claim is recorded for Phase 15) | — |

**Not done (by scope):** no deployment, no production database access, no secrets created, no DNS/TLS, no Razorpay changes, no SEO. **Validation:** `DEVELOPMENT_STATUS.md` §2.

## 2026-10-07 — About page redesign (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `/about` rebuilt to the owner's approved mockup: hero with photo, floating card, rays and leaf; four focus areas on a wave band; "How this started" with a three-photo collage and a handwritten line; Mission and Vision cards; four "How we work" cards; "Our presence" with a full-bleed photo and an India map; "Who runs it" team cards; "Trust & transparency" registration panel | Owner-supplied design | Copy no longer states fixed counts ("six districts", "three programs discontinued"); the "Where we stand" stat band and visible breadcrumbs dropped as not in the design | — |
| `IndiaPresenceMap` (`components/about/`): simplified outline with one dot per district from `impact.reach.byState`, plus a screen-reader list | Locations must be dynamic | A district not in the coordinate table falls back to its state centre; an unknown state is listed but not plotted | — |
| `components/about/decor.tsx`: leaf sprig, squiggle and rays, decorative SVG | Design accents | `aria-hidden` | — |
| New images `about-story-hills.webp`, `about-presence-walk.webp`: crops of existing `sailent-foundation-banner.webp` and `join_comunity.webp` | Story and presence photographs | Low resolution, like their sources; replace with real photography | — |
| `TeamMemberCard` gains `layout="card"`; `MediaFrame` gains an optional `focus` (object-position) | Image-first team cards on About; `/team` unchanged | All Leadership members shown (was the first three) | — |

## 2026-10-07 — Phase 13: Admin, CMS & Communications Completeness (`feat(admin): complete cms and communications workflows`, `84e77ad`; pushed)

**Owner decisions:** contact messages stored + inbox + emailed; newsletter double opt-in; organisation settings drive the public site; new permissions inserted by migration with their SUPER_ADMIN grant. Standing decisions unchanged: SUPER_ADMIN only, no staff 2FA, Campaign Gallery kept (no standalone gallery), no refunds or recurring giving, SEO in Phase 15, Cloud Run hosting in Phase 14.

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Migration `0023`: `contact_messages`, `newsletter_subscribers`, empty `organization_contact` / `organization_social` settings, six permissions granted to SUPER_ADMIN | Contact and newsletter had no storage; settings had no organisation rows; new admin capabilities needed permissions without a risky reseed | Applied locally only; production is human-only | `0023` (additive) |
| Campaign/programme cover from the media library; Campaign Gallery admin (add by media id, remove, reorder, visibility); progress updates admin (publish, unpublish, archive) | The API existed (or was unsafe: raw storage keys) but nothing in the admin used it | Public Campaign Gallery unchanged, now editable; covers must be public library images | 0023 not needed |
| Admin dashboard: live, permission-filtered counts, needs-attention list, recent donations and staff activity | The home page was a placeholder of em dashes | Links into existing pages; no analytics added | — |
| Settings consumed: footer, `/contact`, `/about`, JSON-LD, years-of-service, receipts' registration number; `GET /settings/public` | No setting was read by anything; contact details were hard-coded DEMO values | DEMO values only in development; production shows what staff enter | rows via `0023` |
| Staff invitations and password reset (single-use hashed tokens in the link fragment, 7 days / 1 hour, sessions revoked on reset, no enumeration) | Invites sent nothing; no way to set or reset a password outside the CLI | Audited; no TOTP | — (uses `otp_codes`) |
| Document deletion (`document.delete`, re-auth, reason; object first) | Requested; no way to remove a document | Audit keeps title/type/visibility | permission via `0023` |
| `story.archive` enforced for archiving and restoring | Declared, never checked | Publishers without it cannot archive | — |
| EXIF/GPS stripped from new image uploads (byte-level, no re-encode) | Photographs could publish where they were taken | Earlier uploads unchanged (human step) | — |
| Notification retry sends through the `email` queue; processors for contact, newsletter confirmation, staff invitation and reset; worker stops logging recipient addresses | Retry went to a queue nothing consumed | Retry only for safe types; send log by id only | — |
| Contact form stored and emailed; newsletter double opt-in with confirm/unsubscribe pages; admin Messages and Newsletter screens | Both forms were UI-only and lost every submission | Rate-limited, honeypot | tables via `0023` |
| General FAQs in the database (admin + `/faq`); site search over published content via the API | `/faq` and search used development fixtures, including in production | Drafts never public; testimonials stay static by design | — |
| Removed the dead "Once / Monthly" widget and presets; corrected "Monthly Donor" and the monthly-giving FAQ; regression test | One-time donations only | No change to the real donation flow | — |
| `MEDIA_PUBLIC_BASE_URL` (web, build time) → `next/image` remote pattern | Library images could not be rendered | Unset = as before | — |
| Docs: Cloud Run recorded as the intended host (Vercel/Render references superseded) | Owner decision | Deployment itself is Phase 14 | — |

Tests: API `cms-communications.spec.ts` (44) and `strip-metadata.spec.ts`; worker `communications.processor.spec.ts`; validation, web unit and E2E specs; 18 mutation checks. Human-only: apply `0023` in production, enter organisation details, set `MEDIA_PUBLIC_BASE_URL`, optionally clean pre-Phase-13 image metadata (`DEPLOYMENT.md` §6c).

## 2026-10-07 — Phase 12: Accounts, Authentication & Security Hardening (`3941ee7`, pushed 2026-10-07)

**Owner decision:** staff authenticate with email and password; **staff TOTP/2FA is not required** and was not built.

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Sign-in codes are sent to an address held by a donor **or a live volunteer record** | A volunteer who had never donated could not sign in to see their volunteering | First sign-in opens the general account; unknown addresses still get the same answer and no mail | none |
| One `normaliseEmail()` (NFC, trim, lower case) across staff login, OTP, email change, guest checkout, volunteers, invites and admin corrections | Addresses were compared inconsistently | `Admin@X.org ` and `admin@x.org` are the same account everywhere | none |
| Email change only by a code sent to the new address (`POST /me/email/change`, `/me/email/verify`); `PATCH /me` refuses `email` | A donor could take over someone else's future guest donations by changing their address | Read-only address on the profile with a confirm-by-code form | none |
| Guest checkout no longer changes an existing donor's name or phone | Anyone knowing a donor's email could rewrite their details | Same response whether or not an account exists | none |
| Access JWT pinned to HS256 (sign and verify) | No algorithm allow-list | `none`/other algorithms refused | none |
| Atomic refresh rotation (`UPDATE … WHERE revoked_at IS NULL RETURNING` in one transaction) | Two simultaneous refreshes could both succeed | The loser is treated as reuse: family revoked, audited | none |
| Authentication audit events (staff login success/failure/lockout, re-auth, donor OTP, logout, refresh reuse, email change) | Sign-ins were not audited | No passwords, codes, tokens or PANs recorded | none |
| Client IPs for audit and sessions from `requestClientIp()` (trusted header with `INTERNAL_API_SECRET`, else the connection) in 18 controllers | `X-Forwarded-For` was trusted and spoofable | Recorded addresses can no longer be forged | none |
| PAN encrypted with AES-256-GCM (`enc:v1:`; `FIELD_ENCRYPTION_KEY`, required in production); donors see a masked value only | PANs were stored and returned in plaintext | Satisfies the local `donors_tax_id_encrypted` CHECK, so the 4 `me.spec` drift failures are gone; legacy plaintext is read and re-encrypted on write | none (column stays `text`) |
| Content-Security-Policy on the web (Razorpay Checkout allowed); HSTS with `APP_ENV=production` | No CSP or HSTS | External script injection blocked; `'unsafe-inline'` kept for Next.js (documented) | — |
| BFF refuses cross-site writes (Origin / `Sec-Fetch-Site` check, `TRUSTED_ORIGINS`) | CSRF relied on `SameSite=Lax` only | 403 before any token is attached | — |
| Web validates its environment at startup; production refuses mock data, demo organisation data, missing `INTERNAL_API_SECRET`/`CLIENT_IP_HEADER` or a non-https URL; mock fixtures never used in production; worker requires an https `APP_PUBLIC_URL` | `webEnvSchema` was never loaded; unset `FEATURE_MOCK_DATA` meant ON | Misconfigured production fails to start instead of serving demo data | — |
| Tests: `account-security.spec.ts` (22), JWT and encryption unit tests, config guards, `normaliseEmail`, origin check, CSP, runtime flags; E2E CSP, BFF cross-site and email-change tests | Cover the phase | Tests only | — |

No schema, migration, seed, CI or payment-behaviour change. Not in scope: staff invite and password reset (Phase 13), SEO (Phase 15). Human-only: generate and store `FIELD_ENCRYPTION_KEY`, re-encrypt existing production PANs, configure the production web environment (`DEPLOYMENT.md` §6b).

## 2026-10-07 — Phase 11: Payment & Donation Production Readiness (`5170ce0`, pushed 2026-10-07)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Payment reconciliation and pending expiry: a worker-scheduled job (`payments` queue, every 10 min) calls `POST /internal/payments/reconcile` (shared `INTERNAL_API_SECRET`); the API checks pending donations older than 15 min against Razorpay's order payments, captures through the normal path (source `reconciliation`), and cancels unpaid donations after 24 h | Payment audit H1: a payment missed by browser and webhook stayed `pending` forever; nothing wrote `cancelled` | Captured money is recorded exactly once; abandoned checkouts expire; `cancelled` still captures a late payment | none |
| Checkout: a failed attempt no longer ends the checkout; the same basket reopens the same donation and order; `POST /donations` accepts `Idempotency-Key` (Redis, 30 min) | H2: a successful retry after a failure was dropped and the donor could pay twice; every retry created another pending donation | No unnecessary duplicate donations or orders | none |
| Rate limits keyed on the real client: the web server forwards the client address with the internal secret; the API trusts it only with the secret (never `X-Forwarded-For`) | H3: every limit was site-wide | Limits apply per donor once the web server is configured (`CLIENT_IP_HEADER`) | none |
| Hardening: receipt financial year in IST; production rejects `rzp_test_` keys and requires `INTERNAL_API_SECRET`; the fetched payment's order and currency are checked before capture | M1, M2, L2, L3 | — | none |
| Read-only admin **Payment exceptions** (`/admin/payments`, `payment.read`): failed/unfinished/needs-review webhooks and stuck donations; identifiers only | M4 | No write route; no "mark successful" | none |
| `Permissions-Policy`: `payment` allowed for this origin and Razorpay's only (was `payment=()`) | It blocked the Payment Request API inside Razorpay Checkout | Other features still off | — |
| Tests: reconciliation, retries on one order, idempotency, hardening, exceptions authorisation (API); per-client limits; config guards; IST boundary; worker processor; checkout wrapper, attempt reuse, client IP, policy (web); E2E header and admin page | Cover the phase | Tests only | — |

Exactly-once capture, signatures, amount checks, distinct donor counts and campaign rules are unchanged. Human-only: production scheduling (worker env), web proxy configuration, Razorpay dashboard settings (`DEPLOYMENT.md` §6a).

## 2026-10-07 — `e87864b` Razorpay webhook hardening, payment audit C1 + L1 (pushed 2026-10-07)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Webhook events stored `pending` or `failed` are processed again when Razorpay redelivers them; only `processed`, `ignored` and `needs_review` are terminal duplicates. Event-id uniqueness unchanged | A transient failure was marked `failed` and answered 200, and a redelivery was treated as a duplicate, so a captured payment could stay `pending` | Crashed or failed events recover on redelivery | none |
| Transient processing failures (Razorpay re-fetch, database) answer **503**; an amount mismatch becomes `needs_review` (200) | Razorpay only retries non-2xx; a mismatch cannot be fixed by retrying | Razorpay retries what can succeed | none |
| Invalid webhook signature answers **401** (was 200) | The controller's stated intent; a forged delivery should be refused | Nothing stored, as before | — |
| Tests: 6 webhook-redelivery tests; forged-webhook test expects 401 and no stored row | Cover retry, crash recovery and exactly-once capture | Tests only | — |

Exactly-once capture is unchanged (the `status <> 'successful'` gate in the capture transaction). Still open from the payment audit: reconciliation and pending expiry, checkout retry handling, throttling, and the other findings in `DEVELOPMENT_STATUS.md` §5.5.

## 2026-10-06 — `f9816be` Programme campaign counts (pushed 2026-10-07)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Public `GET /programs` and `GET /programs/:slug` compute `campaignCount` live: open campaigns (active, not deleted, not past their end date; the `status=open` rule) | They read `programs.campaign_count`, a rollup nothing writes, so every card showed "Ongoing program" | Programme cards show "N active campaigns". Same field and shape; admin count unchanged; `campaign_count` column retained, unused by public reads | none |
| Fixture fallback derives programme counts from the campaign fixtures (`countOpenCampaigns`) | The hand-typed fixture counts disagreed with the fixture campaigns | Development fallback only | — |
| Tests: programme-count API tests (count 2 across seven campaign states; equality with SQL for every programme); web unit test; E2E card assertion | Cover the rule and the silent-zero subquery risk | Tests only | — |

## 2026-10-06 — `2fc5aa9` Accurate donor count (pushed 2026-10-06)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `campaigns.donor_count` counts distinct donors per campaign: capture adds 1 only for a donor's first successful donation to that campaign (identity `donations.donor_id`), under the existing campaign-row lock | It counted donations, so a repeat donor was counted again | Repeat gifts raise `amount_raised` only; the same donor counts once per campaign | none |
| Public `GET /impact` `totals.donorCount` = distinct successful donors, not `SUM(campaigns.donor_count)` | The sum counted one person once per campaign, and repeats | Same field and shape; the web does not render it | none |
| Donation tests: a donor-count block; webhook-race test given its own donor; teardown restores `amount_raised`/`donor_count`. `/impact` distinct-count test | Cover the rule; stop tests leaking counter increments into `sailent_dev` | Tests only | — |
| `DATABASE.md` §6 semantics and §12 human-only recount runbook | Existing counters were not recounted | Documentation | — |

## 2026-10-06 — `ed69d41` Campaign public experience cleanup (pushed 2026-10-06)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Public API `status=open` (active, not past its end date) and `status=closed` (paused, or active past its end date), using the new `deadlineCutoff()` in `@sailent/validation`; listing Active → `open`, Closed → `closed`; homepage "Browse by cause" grid uses `open` | Owner: the homepage shows only campaigns accepting donations; "Active" must not include paused or ended campaigns | Paused and past-deadline campaigns leave the homepage grid and the Active filter and appear under Closed | none |
| "Other Ways to Support" custom-amount panel restored on the campaign page | Owner decision | Typed amount and card presets share one value | — |
| Mobile donation area: the fixed bottom "Review" bar is replaced by the full donation card in the page flow | Owner: non-sticky donation area on mobile; the bar covered content and focus | Desktop sticky card unchanged | — |
| Duplication cleanup: "What Will Your Support Provide?" becomes a summary; "Difference Your Support Can Make" shows outcomes and "What one gift does", without the target or the repeated people-reached figure | Owner decisions | Goal kept on the card and in "Our Goal"; reached figures kept in "Your Impact"; Campaign Gallery kept | — |
| Stories: a campaign shows only its own (matched by `campaignId`); borrowed stories are labelled | Unrelated stories appeared under a campaign's name | — | — |
| Section-nav scroll hint; header wordmark wraps on phones; JSON-LD output escaped | Responsive/accessibility audit; stored-injection risk | — | — |
| Tests: E2E campaign/donations/journeys updated to the new layout; new unit, API and E2E tests | Cover the new decisions | — | — |

Also recorded: `166b70c` (docs) and `7fe6c25` ("ci: pass test database and redis env through turbo", `turbo.json` `passThroughEnv`) were committed and pushed on 2026-10-06. The CI run for `7fe6c25` has not been observed.

## 2026-10-06 — `0e94632` "ci: target local database in CI migrations and seed" (21:08 IST; not pushed as of 2026-10-06)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `.github/workflows/ci.yml`: `pnpm db:migrate --target=local` and `pnpm db:seed --target=local` | The database target guard refused both commands without a declared target, so every CI run stopped at "Apply migrations" | CI can reach the test steps. With the flag, the guard also verifies that CI's `DATABASE_URL` is a localhost database. **Not verified on GitHub yet.** | — |

## 2026-10-06 — `d7f42e3` "added md files" (20:59 IST; not pushed as of 2026-10-06)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Documentation/context system: `AGENTS.md` (project rules above the Turborepo block), `CLAUDE.md`, `PROJECT.md`, `ARCHITECTURE.md`, `SECURITY.md`, `DEVELOPMENT_STATUS.md`, `PHASES.md`, `DATABASE.md`, `DEPLOYMENT.md`, `CHANGELOG.md` | Read-only audit, so any agent can resume work safely; revised after a fresh-agent verification | Documentation only | — |
| Owner decisions recorded: the Supabase project behind the production guard is **production**; AI agents never operate on the production database | Owner, 2026-10-06 | Permanent rule in `AGENTS.md` §8 | — |

Later on 2026-10-06 (working tree): `AGENTS.md`, `CLAUDE.md` and the other docs were updated for the main-only git workflow (no feature branches or PRs unless requested) and the CI fix. Not committed as of this entry.

## 2026-10-06 — `dd64d41` "feat(campaigns): admin-controlled featured campaigns and optional end-date deadlines" (20:50 IST; pushed to `origin/main` 2026-10-06)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Ongoing-by-default campaigns: `hasEnded()` (end of day, IST); `donationAvailability`/`acceptsDonations` aware of the deadline; checkout uses it; cards, status card, donation builder and featured band hide Donate for ended campaigns; campaign header shows "Ends …/N days left" or "Closed …" and the "Campaign period" row is removed; admin date hints rewritten | Owner: "there should be no campaign period". The page offered donations that checkout refused after the end date. | Campaigns without an end date never close on their own | none (seed: `endDate: null`). Dev database `UPDATE campaigns SET end_date=NULL` (local only, approved). |
| Admin-controlled featured campaigns: "Feature on the homepage" and "Featured order" in the admin form; "Featured · N" badge in the admin list; public `sort=featured`; homepage band uses `getFeaturedCampaigns()` (open campaigns only) | Owner asked to give admins the power to choose featured campaigns. The band previously showed the oldest campaigns, ignoring `is_featured`. | Homepage order now follows admin choice | none (columns existed since `0000`) |
| E2E: shared `settle-animations.ts` for the axe audits; new `admin-featured.spec.ts` | Fix a WebKit axe timing flake; cover the featured flow | Tests only | — |

Also on 2026-10-06:
- Local `main` (`8dae087`, `d569fcf`, `ae1520b`) was pushed to `origin/main` with a fast-forward push. Until then, `origin/main` held only `2ba2b43`.
- The homepage visual refinement (single font, type scale, 1320px container, 8px buttons, hero redesign) was made and then **reverted by the owner** the same day. It is not in the history.

## 2026-10-05 — `ae1520b` "homepage and campaign page design done"

44 files changed. The work, as recorded at the time it was done (2026-10-04 to 2026-10-05):
- `/campaigns` rebuilt to the owner's mockup: banner, search and status menu (Active, Closed, Completed, All), cause tiles, cards with status badges and category-coloured progress, "View More".
- Homepage:
  - a "Browse by cause" campaign grid, added before "Who We Are";
  - the focus-area strip removed;
  - the Featured and Testimonials rails autoplay, with no visible controls but a keyboard pause.
- "Impact" removed from the header nav and the footer.
- The seed gained 4 campaigns (`animal-care-pune`, `child-nutrition-gaya`, `women-livelihoods-ranchi`, `greener-communities-bhopal`) and 2 programmes (`animal-welfare`, `environment`), so every campaign now has a programme.

## 2026-10-04 — `8dae087`, `d569fcf` "campaign page design" / "campaign page design complete"

36 files changed in total: the campaign detail page and listing design.

## 2026-09-26 — `2ba2b43` "first commit"

The initial commit: 859 files, the entire platform through Phase 10.12.

## 2026-09-23 — Phases 10.5–10.12 (journal timestamps)

| Migration | Phase | Change |
|---|---|---|
| `0017_phase8_volunteer_rls` | 8 | RLS on the volunteer tables; schema-wide RLS assertion |
| `0018_phase8_volunteer_email_unique` | 8 | Live volunteer email unique |
| `0019_phase10_7_blog` | 10.7 | Blog tables; `category_kind` gains `blog` |
| `0020_phase10_9_pages` | 10.9 | Pages and revisions (section composer) |
| `0021_phase10_10_documents` | 10.10 | Documents: unique `file_key`; public requires `published_at` |
| `0022_phase10_11_notifications` | 10.11 | Notification templates and revisions |

Phases 10.5 (stories), 10.6 (media, R2), 10.8 (SEO) and 10.12 (reports) added no migrations. According to their documents, none of these migrations or seeds were run on the hosted database. That database is the production Supabase project, which older documents call "staging".

## 2026-09-21 — Phases 9 and 8

| Migration | Change |
|---|---|
| `0012_phase9_team_events_impact` | Impact slug and event link; event deadline and organiser |
| `0013_phase9_impact_event_parent` | Impact parent CHECK includes event |
| `0014_phase8_single_admin_role` | All roles collapsed into `SUPER_ADMIN` (data rewrite). The file was later edited after it had been applied. |
| `0015_phase8_volunteer_management` | Volunteer tables |
| `0016_phase8_volunteer_sequence_backfill` | `VOL-` sequence backfill |

Other changes recorded in the docs:
- Staff TOTP dropped (owner decision).
- Redis throttler storage added.
- `db:harden`, `db:create-admin` and the database-target guard added.
- E2E isolation set up (`sailent_e2e`, ports 3100/4100).
- `/refund-policy` removed.
- `jobKey()` fix for queue job IDs.

## 2026-09-20 — Phases 5, 6, 7

| Migration | Phase | Change |
|---|---|---|
| `0008_phase5_product_catalogue` | 5 | Products master; campaign products become a junction |
| `0009_phase6_receipts_and_one_time_only` | 6 | Receipts and sequences; recurring and subscriptions removed |
| `0010_phase7_donor_accounts` | 7 | Refunds removed; saved campaigns; donor notification flags |
| `0011_phase7_email_login` | 7 | Donor identity becomes the unique email (was phone) |

## 2026-09-19 — Phases 0–4

- Documents dated: phase-0 decisions, phase-1 foundation, phase-2 public website.

| Migration | Phase | Change |
|---|---|---|
| `0000_reflective_morg` | 3 | Initial schema |
| `0001_add_session_reauth` | 3 | Session re-authentication stamp |
| `0002_team_slug_unique` | 3 | Team slug unique |
| `0003_editorial_content_columns` | 3 | Editorial content columns |
| `0004_lock_down_data_api` | 3 | Supabase Data API lockdown and RLS |
| `0005_phase4_taxonomy` | 4 | Categories, slug history, FAQs, media, campaign gallery |
| `0006_phase4_normalise_campaign_content` | 4 | jsonb content moved to tables (data rewrite) |
| `0007_allow_draft_campaign_without_goal` | 4 | Drafts may omit a goal |

## Undated — local database drift (discovered 2026-10-06)

- **Unknown migration.** An unrecorded migration was applied to the local `sailent_dev` and `sailent_e2e` databases at some point after `0022`. It adds CHECK `donors_tax_id_encrypted`. Its file is not in the repository, and no encryption code exists. See `DEVELOPMENT_STATUS.md` §5.1.
- **Edited migration.** `0014` was edited after it had been applied.
