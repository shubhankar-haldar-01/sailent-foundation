# CHANGELOG

A chronological development history built from the git history, the migration journal (`packages/database/drizzle/meta/_journal.json`), the phase documents in `docs/` and the work recorded in this project's development sessions. Nothing here is invented.

**Dating notes:**
- The phase documents 0, 1 and 2 are dated 2026-09-19. The other phase documents carry no date; their migrations' journal timestamps are used instead. The timestamps for `0017`–`0022` were hand-assigned and may not be exact.
- The first commit (`2ba2b43`, 2026-09-26) contains all work up to Phase 10.12, so individual dates before it cannot be confirmed from git. Later commits (from 2026-10-04) are dated from git.

Newest first.

---

## 2026-10-21 — Pre-push review, last pass (not pushed)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Homepage: the featured band's heading is "Make a Real Difference" again, in the redesigned band | `6e7fa25` changed it to "Real Needs. Lasting Change. Transforming Lives Together." with no recorded owner decision | — | — |
| Events: the "Want to get involved?" panel (→ `/volunteer`) and "Past events" (the latest three; "View all past events" lists all, through the `past=all` the query already parsed) are back under the listing, from the owner's 17 October brief; a past event's link reads "View Details", as that entry decided. New E2E test for both, on the seed's own past event | Owner: restore what the brief required | — | — |
| `docs/api-architecture.md`: `/me/impact` is what a donor's giving bought; the Updates page's `/me/updates` (published impact updates from funded campaigns, paginated) gets its own row | The doc described `/me/impact` as the updates | — | — |
| Client-address forwarding, security review: the web refuses to read the address from either of its own internal headers, whatever `CLIENT_IP_HEADER` says; tests that a browser's forged internal headers and forged `x-forwarded-for` entries are ignored | A misconfiguration could otherwise have let a visitor choose the address the API believes | — | — |
| E2E: on WebKit the featured-rail keyboard test moves with Option+Shift+Tab, the key Safari uses to reach buttons and links | Safari's plain Tab skips them unless the user turns that on; same assertions | — | — |

## 2026-10-21 — Pre-push cleanup: unsupported content out, account navigation, contrast (not pushed)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| **Content that was not a record, removed** (each in its feature commit): the story page's per-campaign figures ("60+ Patients daily", "1,200+ Kits delivered" …, and "100% Direct aid / Verified NGO / 80G Tax exempt") — the campaign's recorded raised amount, goal and (from five) donor count instead; About's "6+ States / 20+ Districts / 100+ Communities" and the presence map's nine fixed state pins (the map draws the API's regions only); the homepage spotlight section, whose press names were invented (the section and its test are gone); the hero's "100% Tax Exemption Under 80G" and "Verified Transparency"; the checkout's "80G Eligible" badge and both "non-refundable" statements (back to the reviewed wording: a receipt by email, 80G relief through Form 10BE); two invented testimonials that reused other people's portraits, the 5/5 stars and the locations added to the four fixtures; About's "Registered as: Public Charitable Trust" default — the identifiers list only what Admin → Settings holds again, with the demo notice ("each is a dummy value marked DEMO") back; the events banner's description, which called an illustrative composite authentic; and the design-system notes (`design-system/sailent-foundation/MASTER.md`, `pages/donation-flow.md`, `pages/donor-dashboard.md`), which prescribed a refund notice, an "exempt from tax under Section 80G" declaration, "80G receipts" and a PDF download, "12A + 80G registered", and the white button label | Owner, 2026-10-21: remove unsupported content and do not invent replacements (`AGENTS.md` §10, §12 item 2) | The homepage keeps its order with the spotlight gone; the identifiers block reads "Our registration details are being added" when nothing is entered | — |
| **Account navigation below 1024px**: the "My Account" card links Dashboard, Payments, Saved Campaigns, Profile, Settings, Updates, Events and Volunteering (the desktop rail's pages and order) and marks the current one with `aria-current`; "Campaigns Supported" is now "Saved Campaigns", the page it opens. New E2E test: every account page is linked at every width | Owner: Settings, Updates, Events and Volunteering had no link on phones and tablets | — | — |
| **Event registration**: the form no longer asks for an email address nothing used; it names the account address the confirmation goes to (the API queues `event.registration.confirmed` to it). The "+91" prefix no longer looks like a menu | Owner | — | — |
| **Restored, as the requirements say**: the homepage community call-to-action (`AGENTS.md` §11 item 6 — no record of a request to remove it); the blog's category chips (`docs/phase-10.7.md`: "featured lead post, category chips, search, pagination"), with pagination keeping the category or tag and the "featured" lead only on the unfiltered first page; the carousels stop for good when touched, scrolled or keyed, as before (`6e7fa25` had them resume after 3.5 s, which WCAG 2.2.2 does not allow for a sighted touch user with no visible pause control) | Requirements and decisions already on record | — | — |
| **Contrast (WCAG AA)**: filled orange keeps `#EB6A1F` with a navy label (owner, 2026-10-21; `AGENTS.md` §11 item 12), hover `#F07A33`, pressed `#EB6A1F`; orange text uses `--cta-ink`, never `#EB6A1F`; the event pages' grey labels, the payment status chips (green, amber, red), the registration form's greys and the story and blog dates were darkened | Owner: accessible text and status colours, keeping the orange | The axe probe over 24 pages found 13 low-contrast nodes after the fills changed, all of them greys, and they were then fixed | — |
| **Fixed**: the campaign search box lost what was typed before hydration (now uncontrolled, as the programs search), and a native submit no longer adds `&status=active`; the events empty state no longer says past events are listed below | Product defects found by the E2E failures | — | — |
| **Rate limits per client for server-rendered calls** (new commit): `donorFetch` and `adminFetch` send the client's address with `INTERNAL_API_SECRET`, as the BFF and the sign-in actions already did, so a donor's or editor's pages count against that client's limits instead of one bucket for the web server's own address. Unit tests for the forwarding with and without the secret and address. The E2E stack gives each Playwright project its own documentation-range address (test-only secret and header in `playwright.config.ts`) | Production behaved as one client for every signed-in page; the E2E projects ran into each other's 429s | Limits unchanged (`apps/api/test/rate-limit.spec.ts`); with the variables unset nothing is sent, as before | — |
| **E2E tests (new commit)**: the blog article test is scoped to the article with the post's h1 (the related-post cards are articles too); the campaign status menu is opened once hydrated; every assertion kept | Test mismatches found by the investigation | — | — |

## 2026-10-21 — Pre-push review: fixes folded into the feature commits (not pushed)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| **Receipts are issued only at capture again** (decision A6). `GET /me/donations/:id` and `/receipt` no longer issue a missing receipt; `ReceiptsService.issue` and `MeModule` are as on `origin/main` (no early return, no `DonationsModule` import), and the donor service's "nothing here writes money" comment is back. New tests in `test/me.spec.ts` ("reading a donation writes nothing"): a successful donation without a receipt is served with none and its receipt route answers 404, under six concurrent reads too; a pending donation has none; another donor gets 404 and nothing is issued | Only the capture transaction makes a donation successful, and it issues the receipt in the same transaction, so the read-time path served only seed or hand-made rows — and it dated the receipt and chose its financial-year book by the time of the read, without the payment reference | The donation page's receipt card no longer polls for a receipt (six `router.refresh()` calls, built for the read-time issuing, which also ran the E2E stack into the API's rate limit): it offers the receipt, says none has been issued, or says the payment is not confirmed. The payments table links a receipt only where one exists | — |
| **Profile photo limits** (`apps/api/src/modules/me/avatar.ts`): `PATCH /me` no longer accepts `avatarUrl`; without object storage, production refuses an upload (503) and elsewhere a photo is stored inline only up to 256 KB; every read serves the stored value only if it is an http(s) URL of at most 2,048 characters or an inline JPEG/PNG/WebP within the cap; the session token never carries an inline image. Ten new tests ("the profile photo"): no session or a staff token → 401; no file or an empty one, a script named `.png`, an SVG → 422; over 5 MB → 413; over the inline cap → 422; production without storage → 503 with nothing changed; `PATCH /me` with a 10 KB URL → 422; five unsafe stored values served as `null`; one donor's photo leaves another's alone; with an object store, only the URL is stored | Any string up to the request limit could be stored and then sent in every profile response and every session cookie | Uploads through the dashboard work as before | — |
| **Events pages** (events commit): the event page and `/events/<slug>/register` show what the shared rule says — cancelled, finished, closed (with the deadline when it has passed) and full, as the event panel they replaced did — instead of a form the API refuses; no nested `<main>`; the registration page has an h1; the event page's breadcrumb ends at the event, not "Register"; the hidden "Register to attend" and "Register my place" strings (test leftovers) are gone; the terms link goes to `/privacy-policy`; the form's placeholders are neutral. No invented data: no "Karnataka" after every city, no "Environment" or "Community Support" category for an event without a programme, no "Demo event summary.", no made-up contact email or phone (only what the organisation entered, with a real `tel:` link), no `/images/event-<slug>.webp` guess; share links use the canonical address, so they no longer render as `#` | The review found the redesigned pages offered registration for cancelled and past events, and printed invented values | — | — |
| **Footers** (layout commit): the desktop and phone footers no longer fall back to the demo address, phone and email (`lib/demo-org.ts` supplies those in development only); with nothing configured they offer the contact form | Production would have published a made-up address and phone number | — | — |
| **Donor dashboard** (dashboard commit): the payments, saved and profile pages keep their h1 below 1024px (read out, not drawn); the banner reads "Dashboard, <name>" (no space before the comma); a supported campaign with no goal shows no progress bar instead of an invented 55%; the progress bar has a name; the two "Donate" links go to `/campaigns/<slug>#give` (they pointed at a route that does not exist) | Accessibility and correctness | — | — |
| **Homepage** (home commit): the testimonial star rating has `role="img"`, so its label is allowed (`aria-prohibited-attr`) | Accessibility | — | — |
| **E2E tests brought up to the redesigned pages**: the events card's "Register Now" goes to `/events/<slug>/register`; "journey: homepage → events" checks the event's h1, its date and place and the registration form; the donor registration test registers on the registration page (terms ticked, "Confirm Registration", "Registration Confirmed!"); the overview and sign-out tests expect the "Dashboard, <name>" banner | The tests described the pages before their redesigns | — | — |

## 2026-10-21 — Local history rewritten into twelve feature commits (not pushed)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| The four unpushed local commits (`9b2305a` "working on user dashboard", `6e7fa25` "added box shadow and effect and ui changes", `1bdb355` "ui fixing", `518a3c2` "working on about page") and the uncommitted work of 2026-10-08 to 2026-10-21 replaced by twelve commits on `main`, one per feature, in dependency order: UI primitives, header and footer, campaigns, donor dashboard (`0024`), stories (`0025`), programmes, About and the retired `/team` pages, homepage, blog, admin donations, events, documentation. Every commit typechecks on its own. The entries below marked "(uncommitted)" from 2026-10-08 to 2026-10-17 are now in those commits. Backups: `refs/backup/2026-10-21/pre-rewrite-main` (= `518a3c2`) and `refs/backup/2026-10-21/working-tree` (the whole working tree as it was, without ignored files or secrets) | Owner, 2026-10-21: rewrite the four unpushed commits into accurate, logical commits before Member Management starts; push nothing | `origin/main` (`5b63b32`) is unchanged; local `main` is twelve commits ahead of it. Nothing is pushed | `0024`, `0025` (local only) |
| Left out of the history: the 172 third-party files under `.agents/skills/` that `1bdb355` committed (they stay on disk, untracked), the three `.pyc` files from `518a3c2`, and the five PNGs `518a3c2` added (`Children Deserve a Brighter Future.png`, `Every Child, A Brighter Future-desktop.png`, `about-hero.png`, `hero-banner-desktop.png`, `hero-banner-mobile.png`), which the working tree had already deleted | Owner: no tool files, `.pyc` files or unapproved images in commits | All of them remain in the backup refs | — |
| Kept: the donor Settings page and form and the Updates page, which `9b2305a` deleted, unchanged; their entries in the account navigation; the settings action revalidates `/dashboard/settings` again (`9b2305a` had pointed it at the profile page); `e2e/dashboard.spec.ts` keeps its settings test and its redirect checks for both pages | Owner: preserve Settings and the newsletter preferences unless a verified replacement exists (none does); review the Updates deletion separately | A donor reaches both pages from the desktop account rail. Below 1024px the account card offers only Dashboard, Payments, Saved and Profile, so Settings and Updates (and Events and Volunteering) are not linked there — an open question for the owner (`DEVELOPMENT_STATUS.md` §5.5) | — |
| Not committed: the homepage relabel of the active-volunteer count from "Volunteers" to "Members" (`lib/content/impact.ts`, 2026-10-21). The working tree is set back to the committed "Volunteers"; the relabel is in the working-tree backup | Owner: the figure counts active volunteers, so "Members" misdescribes it | The homepage still reads "Volunteers" | — |
| Held back, left uncommitted in the working tree: the photography re-applied on 2026-10-17 after the 16 October undo (27 replaced images, 23 deleted numbered images, 53 new images — 63 untracked images in all with the ten unused ones below — `lib/content/source.ts`, `lib/media/public-asset.ts`, the gallery mapping in `lib/content/campaigns.ts`, the image paths in `components/dashboard/donations-table.tsx` and two in `dashboard/saved/page.tsx`); the seed's explicit story cover paths (one points at a held-back image); the ten unused images (`events-hero-*` variants, `story-meera.webp`, `story-ramesh.webp`); and the components nothing renders: `components/events/events-cta.tsx`, `past-event-card.tsx` and `more-events-strip.tsx`, and `components/dashboard/dashboard-mobile-header.tsx`, `dashboard-mobile-nav.tsx` and `dashboard-mobile-context.tsx` (the dashboard layout uses the site header at every width). `event-registration-panel.tsx`, `event-registration-form.tsx` and `components/stories/stories-cta.tsx`, which the redesigns stopped using, stay as they are on `origin/main` | The 16 October undo is the recorded decision (entry below); the re-application is neither recorded nor approved. Unused files are not committed | Committed code refers only to committed images; a story without a stored cover still picks up `public/images/story-<slug>.webp` | — |
| Committed although it had no entry here: the blog redesign (`components/blog/blog-hero.tsx`, `blog-sidebar.tsx`, the post card, `blog-hero-banner-v2.webp`; 2026-10-14 to 16); About's Our Team photographs; the programmes hero photograph (2026-10-17); on `/events`, the panoramic `events-hero-elder.webp` banner in place of the 17 October banner, with the "Want to get involved?" panel and "Past events" taken off the page (2026-10-17); the registration page `/events/[slug]/register` and one seat per registration in the API, form and action (2026-10-17/18); and the four old commits' work — the payments list, donation detail and receipts, the profile photo (`0024`), the admin donations table, the homepage spotlight section and hero banners, and the button and card primitives | Recorded so the history matches the code | `AGENTS.md` §10 and §11 item 14 now describe these; open questions are in `DEVELOPMENT_STATUS.md` §5 and §9 | — |
| Tests: in `e2e/phase-9.spec.ts` the `/team` directory test is replaced by "About's Our Team is the public team directory" (the section, its heading and a member card on `/about`; `/team` answers 404). In `e2e/journeys.spec.ts`, "journey: homepage → events" now expects the panoramic banner's h1 "Events"; it still expected the 17 October headline, which the page no longer has | The `/team` pages are retired (owner); the page's h1 changed with its banner | — | — |

## 2026-10-17 — Events page redesigned to the owner's reference (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `app/(public)/events/page.tsx` rewritten; new `components/events/`: `events-hero.tsx` (visible breadcrumb, "EVENTS" eyebrow, "Come together. / Make a difference.", lead, the approved `campaigns-hero-education` photograph — full-bleed with an elliptical left edge from `lg`, 16:9 on a phone, 21:9 on a tablet; no decoration), `event-toolbar.tsx` (search box + "All Dates" month menu, the design system's Radix `Select`; a GET form first, a client navigation second), `event-listing-card.tsx` (cover, IST date block, programme chip, title, summary, place, IST time range, places left, and the action), `view-more-events.tsx` (outlined orange pill; spinner, no repeat clicks and a `data-pending` dim while the next page loads), `events-cta.tsx` ("Want to get involved?" → `/volunteer`), `past-event-card.tsx` (compact row; "View Details", not "View highlights"), `events-skeletons.tsx`, and `events-query.ts` (URL state, IST months, search, paging, `cardAction`). `loading.tsx` shows the real banner over a card skeleton | Owner: the events page brief with a reference image | Search (every word must appear in title, summary, place or programme), the month menu (only months with events; an unknown month falls back to All Dates) and "View More" (six at a time, one list sliced, so no repeats) all live in the URL (`q`, `date`, `page`, `past=all`) and are server-rendered — shareable and back-button-safe. A card's action is the shared `registrationAvailability` rule: "Register Now" while a place is open; "Fully booked", "Registration closed" (closed by hand or past the deadline) or "Event cancelled" otherwise — the old card's "Waitlist only" is gone from this page (there is no waitlist). Inline error state with a retry link; empty and no-match states. Not taken from the reference: its event names, dates, places, categories and "Limited Spaces" / "Registration Opens Soon" states (no such data or rule — the places left are shown as a count instead), and "View highlights". `EventCard` is unchanged for the programme and volunteer pages | — |
| `apps/api` `content.service.ts` `listEvents`: the public list now also returns `registrationDeadline` (already public on the detail endpoint); `test/events.spec.ts` gains "lists the registration deadline publicly, and never the joining link" | The cards need the cut-off to apply the shared rule — an event can be open and past its deadline | Additive; no schema change; `meetingUrl` still withheld | — |
| Tests: `components/events/__tests__/events-query.test.ts` (24); `e2e/events.spec.ts` (paging without repeats, month alone and with search, lifting either filter, each card state, no-match — each project writes and removes its own eight events, publishing one through the admin page so the cached list is revalidated); `e2e/journeys.spec.ts` "an event shows its details…" expects the new headline | `AGENTS.md` §7 | — | — |

## 2026-10-17 — Donor dashboard (phone): the welcome banner above the "My Account" card (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `components/dashboard/my-account-nav-card.tsx`: new `MyAccountNavSlot`, the layout's phone-only slot for the card, which renders nothing on `/dashboard`. `app/(dashboard)/layout.tsx` uses it in place of the inline `<div className="mb-5 lg:hidden"><MyAccountNavCard /></div>`. `app/(dashboard)/dashboard/page.tsx` renders `<MyAccountNavCard className="lg:hidden" />` straight after `<DashboardHero>` | Owner, with a screenshot of the phone dashboard (card above banner): "kindly replace the position the section" | On a phone or tablet the dashboard home reads: welcome banner, My Account card, then the stat cards (20px apart, as before). Changed in the markup, not with CSS `order`, so screen-reader and Tab order match the screen. The other dashboard pages are unchanged — they hide their own headings below `lg`, so the card is still first there. Desktop unchanged (the card is `lg:hidden`; the sidebar is the desktop navigation) | — |

## 2026-10-16 — Mobile footer: the copyright row becomes a centred band (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `components/layout/mobile-footer.tsx`: the bottom row (left-aligned "© 2026 Sailent Foundation." with Back to top beside it, then the legal links with orange "|" separators) replaced by a full-width band — `-mx-5 -mb-6`, a 1px `#E8E8E8` top rule, `#FEF8EF` fill (`surface-warm` in dark mode), `px-3 pt-[13px] pb-[15px]` — with "Copyright © {year} **Sailent Foundation**. All Rights Reserved." centred (13px/20px `#666666`, the name semibold `#5F48A2`, "All Rights Reserved." kept unbroken) and the three legal links centred under it, 14px apart, no separators. Back to top moved to the right of the "People, Purpose, Possibilities" line, in a three-column grid that keeps the script centred; 36px below 360px, 44px above | Owner, with screenshots of the current row and a reference band (the message repeated last time's "contact us" wording; both images are the copyright row) | Measured at the reference's scale (≈1.67×): rule, line rows (49 vs 49, 100 vs 101 comp px) and band height (80 vs 81 px) match. One line at 390px; at 375 and below the notice breaks before "All Rights Reserved.". Kept ours: the three legal links in our order (the reference has two), the year from the server. The purple is the reference's, as the headings' `#19013E` and the amber bars are; contrast 6.8:1 (name) and 5.4:1 (text) on the band | — |

## 2026-10-16 — Mobile footer: Contact Us as a card, and the link columns re-scaled (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `components/layout/mobile-footer.tsx`: Contact Us becomes a card — 18px radius, 1px `#EDEDEB` border, `#FFFEFD` fill, `0 6px 18px rgb(0 0 0 / 5%)` shadow, `px-5 pt-[22px] pb-6` — with an `h2` "Contact Us" (16px bold `#19013E`) and a 34×3px `#E9A944` bar, both centred; the address, phone and email rows each with a solid `#E9A944` mark in a 14px column (a pin and an envelope drawn locally; the icon set's handset, filled), the text 13px on 19px lines in `#555555`, 20px between rows. The peach circle badges are gone. The three duplicated placeholder branches are folded into `addressLines` / `phone` / `email` values (same placeholders). `Mail` and `MapPin` imports dropped | Owner, with the reference card: "i want the same design for the contact us like that second image" | Measured at the reference's scale, the card's heading, bar, rows, text start and padding match within 2 comp px. Kept ours: the heading "Contact Us" (the reference says "Get In Touch"), the real details, no "Address:" prefix, and a handset rather than the reference's WhatsApp mark, since the row is a `tel:` link | — |
| Same file, Explore and Information **re-scaled**: 16px headings (were 18), 34×3px bars (were 40×4), 13px links on a 28px rhythm (were 15 on 33), equal columns 40px apart (were 3fr/2fr with a 360px switch) | Correction. The earlier entry sized them assuming the owner's image was 1.41× a phone; the owner's screenshots are all ≈1.67× (the same reference bar, 56×5 comp px, appears in both images), so they were about 18% too large | Re-measured against the owner's Explore/Information image: heading height, bar, link pitch and the second column's offset (324 comp px) match within 1–3 comp px | — |

## 2026-10-16 — Footer: "Donate Now" button removed, desktop and phone (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `components/layout/site-footer.tsx` and `components/layout/mobile-footer.tsx`: the orange "Donate Now" button under Contact Us removed, with the `Button`, `Heart` and `ChevronRight` imports it alone used; header comments updated. `lib/site-config.ts`: the `footerNav` note about the removed "Donate" link no longer says the button sits beside it. `AGENTS.md` §11 item 13: no Donate Now button in the footer | Owner: "remove donate now button from the footer" | The footer ends Contact Us with the email, then the script flourish (phone) or the flourish column (desktop). The site's donate actions are the pages' own buttons (17 on the homepage at desktop width, 15 at 390) and the phone menu's Donate Now; the desktop header bar has none. One white-on-`#EB6A1F` axe `color-contrast` node fewer on every page | — |

## 2026-10-16 — Mobile footer: brand, mission and social links centred to the owner's comp (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `components/layout/mobile-footer.tsx`: the brand block is centred — the lockup (mark, name, tagline; unchanged) in the middle, the mission line centred at 13px on 20px lines in `#555555`, max 20rem, and the social links centred as 38px white circles with a 1px `#E8E8E8` border, a soft `0 4px 10px rgb(0 0 0 / 6%)` shadow and `#303030` marks 16px (dark mode: surface fill, border token, `slate-200` marks, no shadow). Spacing set from the comp: lockup → text 20px, text → buttons 16px, buttons 10px apart. `components/layout/social-icons.tsx`: new `FacebookGlyph` and `LinkedInGlyph` — the project's own "f" and "in" cut-outs, filled, view box trimmed to the glyph — and a `SOCIAL_ICONS_GLYPH` map (bare f / in, solid YouTube, Instagram outline). The desktop footer keeps `SOCIAL_ICONS` | Owner, with a screenshot of the current mobile footer and a reference: "the second image content you can see in center i want exact like that" | Measured at the comp's scale (≈1.67× a 390px phone, the same as the owner's own screenshot): text glyph height and line pitch, button diameter, button pitch and icon extent match within 1 comp px; lockup → text 48 vs 49, text → buttons 51 vs 51. Kept ours, not the comp's: the logo and name, the mission wording and its sentence case (the comp sets its line in Title Case), and the four networks the organisation has (Facebook, Instagram, LinkedIn, YouTube — the comp shows Twitter instead of YouTube). The comp's cream grid background is not adopted | — |

## 2026-10-16 — Mobile footer: Explore and Information redesigned to the owner's comp (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `components/layout/mobile-footer.tsx`: the two collapsible `<details>` groups replaced by two always-open columns side by side, each a `nav` named by its `h2` — bold 18px display heading in `#19013E`, a 40×4px rounded `#E9A944` bar, then the links at 15px in `#555555` on a 33px rhythm (each link a 33px-tall target). The first column is the wider (3fr/2fr), as the design draws it; below 360px the two are equal so "Information" fits. Dark mode: white heading, `slate-400` links. Colours and sizes sampled from the owner's image (550px wide ≈ 1.41× a 390px phone). `ChevronDown` import dropped. `AGENTS.md` §11 item 13 records the layout | Owner, with an image of the two columns: "in mobile view of my footer use this design for explore and information" | The links are unchanged (Programs, Campaigns, Stories, Events / About Us, Volunteer, FAQ, Contact Us — §11 item 13): the comp's own labels ("Explore Campaign", "Monthly Campaign", "Blogs", "Privacy Policy"…) are its content, not ours. Desktop footer untouched. The "Contact Us" heading under the columns keeps its earlier style | — |

## 2026-10-16 — Header: the Resources dropdown replaced by a plain "Blog" link (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `lib/site-config.ts` `primaryNav`: the "Resources" group (desktop dropdown with Blog; phone group with Stories and Blog) replaced by a top-level `{ label: 'Blog', href: '/blog' }`; the nav's header comment updated. `components/layout/site-header.tsx`: a comment that cited the phone group's Stories row brought up to date (no code change). `AGENTS.md` §11 item 5 now says no Resources dropdown | Owner, with a screenshot of the one-item dropdown: "remove the resources dropdown and only keep the single blog page button" | The header reads Home, About, Programs, Campaigns, Stories, Get Involved ▾, Blog on a desktop and in the phone menu. Blog is marked current on `/blog` and on an article. Get Involved is the only menu left | — |

## 2026-10-16 — Header: FAQ taken out of the navbar (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `lib/site-config.ts` `primaryNav`: the "FAQ — Common questions" item removed from the Resources dropdown (`children`) and from the phone menu's Resources group (`mobileChildren`). Only those two lines; the file's other uncommitted changes (footer columns, "Our team") belong to earlier work and are untouched. `AGENTS.md` §11 item 5 records the decision | Owner, with a screenshot of the dropdown item: "remove this page from the navbar" | The desktop Resources dropdown now lists Blog only; the phone menu's group lists Stories and Blog. `/faq` still exists and is still linked from the footer's Information column (`AGENTS.md` §11 item 13) and from the campaign page's "View All FAQs" | — |

## 2026-10-16 — Campaign page: "More in <programme>" removed (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `app/(public)/campaigns/[slug]/page.tsx` no longer renders the "More in <programme>" band after the FAQs (up to three other campaigns from the same programme, as cards). Its `Section` and `CampaignCard` imports and the `relatedCampaigns` list are gone. The programme's campaigns are still fetched, because the stories strip uses them to prefer that programme's stories when a campaign has none of its own. `components/campaigns/campaign-card.tsx`: header comment no longer names the "More in" card | Owner: "remove the section after the faq section in campaign program details page". The programme detail page has no FAQ section; on the campaign detail page this band is the only thing after the FAQs | A campaign page ends at its FAQs (or at Stories / Recent Supporters when it has no FAQs), then the footer. Before, it showed on campaigns sharing a programme, e.g. `skills-training-second-cohort` and `women-livelihoods-ranchi` ("More in Women Empowerment"). Programme pages still list their campaigns | — |

## 2026-10-16 — Campaign page: "The Difference Your Support Can Make" removed (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `app/(public)/campaigns/[slug]/page.tsx` no longer renders `<CampaignImpact />` and the section links lose their "Impact" entry; `e2e/campaign.spec.ts` "lays the sections out in the approved order" drops that heading. The component (`components/campaigns/campaign-impact.tsx`) and its unit test are left in place, unused by any page, so the block can be put back with one line if wanted | Owner, with a screenshot of the block: "remove this section from campaign details page". (The same block was removed and then restored earlier today, see the entries below; this is a fresh, explicit instruction) | A campaign page runs photograph, section links, the ways of giving, About, Stories, Recent Supporters, FAQs — on every campaign, with or without products | — |

## 2026-10-16 — Campaign page: one design for every campaign, with or without products (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `app/(public)/campaigns/[slug]/page.tsx` renders the `DonationBuilder` for **every** campaign. The `hasProducts` branch that gave a campaign without products a page of its own — the same two columns, but with the progress-only `CampaignStatusCard` ("Support This Campaign", a Donate link away to `/donate`) in the side column — is removed, and `components/campaigns/campaign-status-card.tsx` is deleted. The section links always open with the ask: "Products" when the campaign lists items, otherwise "Donate". | Owner: a campaign opened from the homepage (the featured four, all with products) and one opened from `/campaigns` (the first cards there have none) looked like two different pages — "take the first design for every campaign details" | Every campaign page now has the "Your Donation" card (progress, amount presets, total, Donate, Secure & Safe Payment, Share Campaign, assurances) beside the content — sticky on a desktop, in the page on a phone — and takes a preset or typed amount on the spot. Without products the main column shows the "Choose an amount" panel where the product grid would be, and the card has no "One-Time Donation / Support with Products" switch. Paused and finished campaigns get the builder's existing notice with the controls disabled. No new way to pay: the API already accepted an amount-only donation for these campaigns (`allowCustomAmount`, database default `true`, true for all nine seeded campaigns), which is what `/donate` used for them | — |
| `components/donations/donation-builder.tsx`: without products, the "Choose an amount" panel carries `id="give"` and `scroll-mt-32`, and is where the page returns to from the checkout, so every `/campaigns/…#give` link on the site (cards, programme pages, receipts) still lands on the ask. `campaign-donation-summary.tsx`: the empty-basket hint reads "Pick an amount below." when there are no products to choose. `donation-layout.ts`: comment brought up to date | The `#give` anchor used to be on the status card | — | — |
| `e2e/campaign.spec.ts`: new test "gives a campaign without products the same donation card and anchor" on `/campaigns/animal-care-pune#give` — no product grid or switch, the amount panel in view, "Donate" first in the section links, the card open on "Donate ₹500", no "Support This Campaign" | `AGENTS.md` §7: user flows get a Playwright test | — | — |

## 2026-10-16 — The photography work of 16 October undone (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Everything in the entry marked UNDONE below reversed: the 51 deleted images restored from the last commit, the 24 replaced ones (campaign, programme and story covers, testimonial portraits, `about-story-hills.webp`, `community-*.webp`, the event cover) restored to their committed versions, the 11 new photographs removed, and the code that pointed at them put back (`lib/mock/home.ts`, `lib/content/events.ts`, `lib/mock/stories.ts`, `components/dashboard/donations-table.tsx` as committed; the `toFixtureStory` helper taken out of `lib/content/stories.ts` and the two fallback paths in `dashboard/saved/page.tsx`, with that week's other work in those two files kept). The campaign page's Impact section had already been restored (entry above) | Owner: undo entry 2 completely | The site shows the images it had at the last commit. Lost: `blog-hero-banner.png`, an unused untracked source file that work deleted before the safety stash was made; `blog-hero-banner-v2.webp` (the banner in use) is unaffected. Left as found: a 3-line change in `lib/media/public-asset.ts` (a second `public` root lookup) that no entry claims | — |

## 2026-10-16 — Campaign detail page: "The Difference Your Support Can Make" restored (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `app/(public)/campaigns/[slug]/page.tsx` and `e2e/campaign.spec.ts` put back as committed: the `CampaignImpact` section and its "Impact" entry in the page's section navigation return (another session had removed them earlier today, see the photography entry below) | Owner: "only revert the last changes made on the campaign page" | A campaign's page shows the Impact section again; the listing page's changes of 2026-10-15 are untouched | — |

## 2026-10-16 — [UNDONE the same day, see the entry above] High-definition documentary photography generated & mapped site-wide (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Replaced low-resolution thumbnails and placeholder crops across the entire site with authentic, high-resolution documentary photography in WebP format (1376x768 for landscape/video cards and hero collages, 400x400 for square portraits and avatars). All 9 campaigns (`campaign-school-kits-jharkhand.webp`, `campaign-mobile-health-clinic-bastar.webp`, `campaign-flood-relief-balasore.webp`, `campaign-skills-training-second-cohort.webp`, `campaign-tailoring-training-centre.webp`, `campaign-child-nutrition-gaya.webp`, `campaign-animal-care-pune.webp`, `campaign-women-livelihoods-ranchi.webp`, `campaign-greener-communities-bhopal.webp`), 7 programs (`program-education.webp`, `program-healthcare.webp`, `program-women-empowerment.webp`, `program-child-welfare.webp`, `program-environment.webp`, `program-disaster-relief.webp`, `program-animal-welfare.webp`), and 4 story covers now load high-definition photography. | User request: "just like you genarte images for the stories kindly genearte iamges for all the image in website replace them" | Clean, vibrant visual presentation across homepage rails/grids, `/campaigns`, `/programs`, `/stories`, and `/about`. | — |
| Testimonials and team portraits: added `public/images/team-testimonial-4.webp` and mapped `photoUrl` in `apps/web/src/lib/mock/home.ts` so every testimonial card displays a real, crisp portrait. Replaced `about-story-hills.webp` with high-resolution photography of schoolchildren overlooking hills at sunrise. | Complete eradication of missing or low-res portrait fallbacks in the testimonial carousel and About page collage. | Every testimonial in the autoplay rail renders with an authentic, crisp portrait. | — |
| Fixture media resolution in `apps/web/src/lib/content/stories.ts` and `apps/web/src/lib/content/events.ts`: added `toFixtureStory` and `toFixtureEvent` helpers to consistently resolve `cover.url` using `toMedia`, ensuring fallback data correctly links to `/images/*.webp`. | Ensures mock and fallback fixtures resolve public WebP assets even when API database covers are not provided. | Prevents SVG placeholder fallbacks from rendering during local preview or offline operation. | — |
| **Purged unused and obsolete images:** removed raw duplicate PNGs (`Children Deserve a Brighter Future.png`, `Every Child, A Brighter Future-desktop.png`, `blog-hero-banner.png`, `about-hero.png`, `hero-banner-desktop.png`, `hero-banner-mobile.png`), legacy numbered fallbacks (`02_` through `20_`), decommissioned partner marks and icons (`22_` through `33_` and `partners/`), orphaned crops (`join_comunity.webp`, `03_hero_overlay_leaves.webp`), and duplicate supporter portraits. Updated `donations-table.tsx` and `saved/page.tsx` fallback paths to named campaign assets. | User request: "ok now delete the old images which are not used anymore" | Reduces public asset footprint by over 29MB; leaves 46 essential WebP photographs + README with zero broken image links. | — |
| `app/(public)/campaigns/[slug]/page.tsx`: removed "The Difference Your Support Can Make" section (`<CampaignImpact />`) and its "Impact" anchor link from the sticky campaign section navigation (`sections`). Updated `e2e/campaign.spec.ts` section ordering expectations. | User request: "remove this section from campaign page inside" | Campaign detail page flows smoothly from Stories and Recent Supporters directly into FAQs without the redundant outcome tiles and gift calculation block. | — |

## 2026-10-16 — Story detail page matched 100% to the owner's design; stories gain a pull quote (uncommitted; migration `0025` local only)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `app/(public)/stories/[slug]/page.tsx` rewritten to 100% match the owner's design mockup: breadcrumb (`Home > Stories > A Healthier Tomorrow for Ramesh`); `HEALTHCARE` category badge on an orange pill (`bg-[#FFF0E6] text-[#EB6A1F] border border-[#FFDFC6]`); Manrope extra-bold title in deep navy (`#102A43`); summary lead; meta row with location, full date ("30 September 2026") and reading time ("5 min read"); high-resolution hero photo (16:9 / 2.2:1) with a frosted white floating quote card on the bottom-left (`“Now I can work, spend time with my family and look forward to the future.” — Ramesh`); four timeline chapters with circular discs joined by a dashed vertical line — 1. The challenge (`HeartPulse` on peach disc), 2. What we did (`Stethoscope` on blue disc), 3. The journey (`Users` on peach disc), 4. The outcome (`TrendingUp` on blue disc); sticky sidebar with Related Campaign (`Keep the mobile health clinic running in Bastar`, van photograph, description, pill-shaped "Support this work →" button, and three statistics: `60+ Patients daily`, `15+ Villages covered`, `100% Donations in action` with icons on the dividing line) and "What it means" highlighted sky-blue quote card attributed to Sailent Foundation with decorative blue leaves; full-width ice-blue "More stories" section featuring three horizontal cards (`A New Beginning for Sita`, `From Struggle to Self-Reliance`, `Clean Water, Healthier Families`) with thumbnail, title, excerpt, date, and "Read Story →" | Owner supplied reference design of the story detail page and requested a 100% exact match | Fully responsive on desktop (1440px), tablet (768px), and mobile (375px) | — |
| **Stories gain a pull quote**: migration `0025_story_pull_quote.sql` adds `success_stories.pull_quote` (text, nullable); Drizzle schema, API DTO (`pullQuote`, 300 chars), `writableFields`, the public detail allowlist, the admin form ("Quote", under Summary), the admin types and action, the web `Story` type and mapping. Shown on the photograph only when an editor fills it, attributed to the subject's name (never on an anonymised story, since its name is withheld). API test added: served once published, `null` when there is none. The seed gives the demo stories quotes matching the design | The design's quote on the photograph had no field behind it; the owner chose to add one rather than leave the card out | Applied to `sailent_dev` and `sailent_e2e` locally. **Not applied to production** — a human runs it (`AGENTS.md` §8) | `0025` |
| `components/stories/story-card.tsx`: `variant="compact"` — the "More stories" card: clean white card with border and shadow, inset thumbnail on the left (4:3), title and excerpt on the right, and bottom row with calendar date and "Read Story →" | Matches the design's bottom cards | Listing's row card is unchanged | — |

## 2026-10-15 — Donor dashboard: "Together we create brighter futures." card removed (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| Visible breadcrumbs removed from the Stories hero (`stories-hero.tsx`: the breadcrumb is now `sr-only`, still the page's one `BreadcrumbList`; grid rows `auto 1fr` so the highlights stay under the text) and the Blog hero ("Home > Blog" was painted into the banner: erased from the artwork, saved as `public/images/blog-hero-banner-v2.webp` — renamed so cached copies of the old file are not served — and the two invisible click areas over it removed from `blog-hero.tsx`; its `sr-only` breadcrumb and structured data stay) | Owner: "remove this" | Nothing visible; screen readers and search engines still get the breadcrumb. The unused source `blog-hero-banner.png` still shows the old breadcrumb | — |
| `/campaigns`: choosing a cause no longer looks like a reload. The results' Suspense boundary is no longer keyed on the query, so a new cause, status or search keeps the tiles and cards on screen until the new results replace them in place (it used to swap both for a skeleton for ~0.5s). New `components/campaigns/link-pending-mark.tsx` (`useLinkStatus`): the tapped tile gets a ring and lifts at once, and the cards dim to 50% while loading (`group-has-[[data-pending]]`). The skeleton remains for the first arrival | Owner: "when I select any option the page is reloading" | Never a full document load (measured); URLs, back button and no-JS behaviour unchanged | — |
| `components/campaigns/cause-filters.tsx`: the tick (✓) before the selected cause's name removed | Owner request | The selected tile is still marked by its coloured border, bold label and `aria-pressed`/`aria-current` | — |
| `components/campaigns/view-more-link.tsx`: "View More Campaigns" restyled to the homepage "View All Campaigns" design — mint pill (`wash-mint`), dark green label, soft green glow, 48px; the side rules with leaves removed. Arrow still points down on `/campaigns` (loads more below) and right on the homepage | Owner: make it the same design as "View All Campaigns" | Both places it appears (`/campaigns`, the homepage campaign showcase) | — |
| `app/(dashboard)/dashboard/profile/page.tsx` and `saved/page.tsx`: the header's top-right decoration on each — peach shape, orange rays, green leaves (`HeaderIllustration`, `SavedHeaderIllustration`) — removed, with the now-unused `LeafSprig` import | Owner: "remove this also from the user dashboard" | Headings and intro text unchanged | — |
| `app/(dashboard)/dashboard/donations/page.tsx` (Payments): the header's top-right decoration — peach circle, three orange rays and a green leaf sprig — removed, with its `LeafSprig` import | Owner: "remove this also from the payment page" | The heading and intro text are unchanged | — |
| `components/dashboard/dashboard-sidebar.tsx`: the `InspirationCard` (peach card with rays and leaf sprigs, "Together / we create / brighter / futures.") removed from under the sidebar, with its now-unused `LeafSprig`/`Rays` import. `dashboard-mobile-nav.tsx`: the same card removed from the phone menu drawer | Owner: "remove this section from user dashboard" | The sidebar ends at Logout; the phone drawer ends at Logout. The card was `aria-hidden`, so nothing changes for screen readers. `LeafSprig` and `Rays` stay in `components/about/decor.tsx` (still used by the saved, donations and dashboard-hero views) | — |

## 2026-10-15 — Stories listing matched to the owner's redesign; leaner footer; no sideways scroll (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `components/stories/featured-story.tsx`, `story-card.tsx`, `story-filters.tsx` refined on top of another tool's uncommitted redesign of 2026-10-14 (kept): lead story 310px tall at 1440 (design 309; was 386); photograph 53% with the category on an orange pill; cream panel with a lighter "Featured Story" badge, 30px title, 15px summary, a larger where/when row and a 54px "Read Full Story"; the panel's peach disc and `OutlineLeaves` spray from 1408px (narrower, they would touch the summary). Supporting cards 242px tall (design ~241): photograph 53% (50% at 1280–1439px), white category badge with the category's ink, 21px title, 15px summary, "Read Story" with a 32px pale-orange arrow, the whole card one link. Pills 44px, 14px labels. Cool blue-grey outline and shadow, as on the programme cards | Owner supplied a reference image of the Stories section and asked for a close match | Same data, links, filters and "View More Stories" behaviour | — |
| **New `components/stories/story-category-icon.tsx`**: the design's glyphs — an open book (Education), a solid heart with a white pulse (Healthcare), solid figures (Women Empowerment, Child Welfare); any other category falls back to `CategoryIcon` | The design's icons; the site-wide `CategoryIcon` mapping is left alone because the campaign cards' icons are an approved design (`AGENTS.md` §11 item 2) | Filters, the lead story's pill and the cards' badges | — |
| `StoryMeta`: each item draws its own hairline and the row is clipped, so when a narrow card wraps the date under the place no divider dangles | At 1280px the 2-up cards wrap that row | Lead story and cards | — |
| `app/(public)/stories/page.tsx`: supporting cards two across from 1280px (was 1024px); single column of row cards below | At 1024px two cards side by side left 170px for the text | — | — |
| Contrast: the "Featured Story" badge background lightened to `cta/8` (4.64:1 for its text; `cta/15` was 4.29:1); card badges are white with the category's ink — 4.75–6.50:1 for every category tone, where blue, amber and mint inks fall under 4.5:1 on their own wash | axe flagged 4.29:1 and 4.36:1 on this page | — | — |
| `lib/site-config.ts` `footerNav`: two columns — **Explore** (Programs, Campaigns, Stories, Events) and **Information** (About Us, Volunteer, FAQ, Contact Us), 8 links (was 16). Removed: "Our Impact" (it broke `AGENTS.md` §11 item 5), "Transparency" (`/about#transparency` — no such anchor), "Careers" and "Partner With Us" (no pages; both opened Contact), the seven area links (campaign filters, two for areas no programme has: "Food Security", "Livelihood"), "Donate" (the Donate Now button is beside it), "Your Account" (the header has Login / Sign Up). `site-footer.tsx`: brand column wider, links in two columns. Contact block and legal row unchanged | Owner: "remove the unnecessary page link from footer", with a competitor's footer as the reference; asked how lean, chose **two columns, like the reference** | Desktop and phone footers (both read `footerNav`). `AGENTS.md` §11 item 13 records the set | — |
| `site-footer.tsx`: `overflow-clip` on the footer | Its corner leaves sat 24px outside it and gave **every page** a 24px sideways scroll (recorded 2026-10-14 as known) | `scrollWidth` equals the viewport on every page measured | — |
| `app/admin/(workspace)/team/[id]/edit/page.tsx`: the unused `Link` import removed | An uncommitted edit of 2026-10-15 22:01 removed the page's only `Link` ("View the public page", with the "Our Team" link removals) and left the import, which failed `lint`, `typecheck` and `next build` | Admin team edit page unchanged otherwise | — |

## 2026-10-14 — Stories hero matched to the owner's redesign (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `components/stories/stories-hero.tsx` rewritten: one cream card (`bg-surface-warm`, 28px corners, 64px padding on a desktop) with, on the left, the "STORIES" eyebrow and orange rule, "Real people." / "Real change." (Manrope 800, up to 70px, the second line `--cta-bright`), the lead, three highlights on 72px `wash-coral` discs (Real people · Stories from the ground · Hope that inspires change, with their one-line notes), and the breadcrumb at the foot; on the right one photograph (`campaigns-hero-education.webp`, 8:7, 44% of the card, set 8px from the card's edge). The collage, its frames and all leaf and ray decorations are gone. On a phone: eyebrow, headline, lead, the photograph full-width at 4:3, the highlights as rows, then the breadcrumb. Highlights sit three across on a tablet and from 1408px; as rows at 1024–1407px, where the text column beside the photograph is narrow | Owner supplied a redesign of the hero (desktop and phone panels) and asked for a close match | The `h1` reads "Real people. Real change." (was "One person, one program, one thing that changed"); the three promises' wording changed to the design's. The photograph is a 2:1 source shown at 8:7, so it is scaled up about 1.6× on a desktop; the design shows the same photograph | — |
| `app/(public)/stories/page.tsx`: the breadcrumb under the hero removed (it is in the hero's card now, so the page has one breadcrumb and one `BreadcrumbList`); the listing's top padding grows to 32–40px | Design puts the breadcrumb inside the card | Listing, filters, lead story and cards unchanged | — |

Known: "Real change." (`#EB6A1F`) on the cream card measures 2.97:1 — a hair under the 3:1 WCAG AA threshold for large text (it is 3.03:1 on the blue-grey page, where the programs heading sits). axe flags it on `/stories`, which is not in the Playwright axe list. The breadcrumb keeps the site's chevron separator; the design draws a slash.

## 2026-10-14 — Programs toolbar: "Sort by" and "Clear filters" removed (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `program-toolbar.tsx`: the panel is now the "All categories" menu, the search box and the count — nothing else. On a phone the menu and the count share the first row and the search takes the second | Owner: "remove this also" (the Sort by control and the Clear filters link) | The way back is in the controls: "All categories" in the menu, and emptying the search box. The empty state keeps its "View all programs" link | — |
| `programs-query.ts`: `sort`, `PROGRAM_SORTS`, `parseSort` and the campaign/name orders removed with the control (`?sort=` is ignored again). A search still ranks the closest answers first (`searchRank`: name over area over tagline over description); without one, the CMS's order | No control reaches them; dead code with tests is worse than none | 4 unit tests removed (27 remain in the file) | — |
| `programs-menu.tsx`: the caption and leading-icon props went with the sort control; it is the orange category menu only | — | — | — |
| `e2e/journeys.spec.ts` › "programs listing": the "Sort by" test removed; the category test goes back through "All categories" instead of "Clear filters" | — | — | — |

## 2026-10-14 — Programs page: "Support our programs" panel removed (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `programs/page.tsx` no longer renders the closing "Support our programs" panel (eyebrow, heading, paragraph, Donate Now, two tilted photographs with leaf decorations); `components/programs/support-programs.tsx` deleted, nothing else used it. The listing section's bottom padding grows to 64–96px so the grid does not sit on the footer | Owner: "remove this section" | The programs page ends with the grid and "View More Programs", then the footer. `components/programs/decor.tsx` keeps its drawings (`auth-shell.tsx` and `dashboard/side-cards.tsx` still use some) | — |

## 2026-10-14 — Programs toolbar: "Sort by" replaces the area chips (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `program-toolbar.tsx`: the panel is now "All categories" menu · search · "Sort by" menu · count · "Clear filters" — the chips and "More filters" are gone. 72px panel, 48px controls, the orange button about 200px wide, the sort control 240px with a small "Sort by" caption over the value (the first cut was 90px with 56px controls; the owner found it too tall). One row from `lg`; below, the search takes its own row, then the sort menu, then the count and "Clear filters" | Owner supplied a second toolbar mockup ("make the bar like this design") | Every area is reached through the "All categories" menu alone | — |
| `programs-query.ts`: `sort` in the query (`?sort=`; `PROGRAM_SORTS`: `relevant` (default, left out of URLs), `campaigns`, `name`; anything else is the default). "Most relevant" is the CMS's order, or — with a search — `searchRank` (name 4, area 3, tagline 2, description 1, summed per word; 0 is no match). "Most campaigns" is `activeCampaignCount` descending; "Name A–Z" is `localeCompare`. All stable, so ties keep the CMS's order. The area, search and sort each keep the other two; "Clear filters" drops all three; "View More" keeps all three | Sorting had to be over something every programme really has | 7 new unit tests (31 in the file) | — |
| `programs-menu.tsx`: a `caption` (the two-line trigger), the sort-arrows leading icon, and entries without an icon; "All categories" keeps its grid icon | The sort menu | — | — |
| `e2e/journeys.spec.ts` › "programs listing": the chip tests become menu tests; a "Sort by" test (Most campaigns puts Women Empowerment first; Name A–Z puts Animal Welfare first; the area keeps the order) | The chips are gone | — | — |

Deliberate: the sort options are the three above, chosen by the agent as the only orders the data supports without inventing anything; the mockup shows only "Most relevant".

## 2026-10-14 — Programs listing: toolbar and compact cards, matched to the owner's mockup (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `programs/page.tsx`: the listing's introduction is now "OUR PROGRAMS" / "Explore **our programs**" (Manrope 800, up to 58px, orange second half) / "Focused initiatives that create real and lasting change in communities." It replaces the "Long-term work, not one-off projects" block added earlier the same day (the hero still carries that). Grid: one column to `lg`, two from `lg`, three from `xl`, 16px gaps. The empty state says "No programs match" with a "View all programs" link when a search or area is in force | Owner supplied a mockup of the section and asked for an exact match | The listing heading changes; "Explore Our Programs" in the hero still lands on it | — |
| **New `program-toolbar.tsx`** (server): one white panel with the "All categories" menu (every area, labelled by the area in force), the search box, chips for the first three areas, a "More filters" menu for the rest, the count of matching programmes (`role="status"`, with the scope and search for screen readers) and "Clear filters". Areas come from the programmes (`programAreaOptions`); only how many are chips is fixed. Single row from `xl`; below `lg` the chips scroll sideways in their own row | Mockup. Asked what "More filters" should hold, the owner chose **the remaining categories** | Replaces the pill row (`program-filters.tsx`, deleted). Every control is a link or a GET form to a listing URL, so area, search and page all live in the URL and the page stays server-rendered | — |
| **New `programs-menu.tsx`** (client, Radix `DropdownMenu` from `@sailent/ui`): menu entries are links with `aria-current`; the trigger is the filled orange button or the outlined "More filters" | The menus need scripting; the chips and search do not | — | — |
| **New `program-search.tsx`** (client): a real GET form (`?q=`), intercepted to navigate without a reload; keeps the area, drops the page; emptying the box lifts the search. The input is **uncontrolled** (`defaultValue`, re-keyed on the URL's `q`): a controlled one wiped text typed before hydration, so on the WebKit tablet Enter searched for nothing — the same failure the campaigns search has on that project | The API has no programme search (`ContentService.listPrograms` ignores `q`), so matching is in `programsView` | Typing before the page has hydrated now works | — |
| `programs-query.ts`: `q` in `ProgramsQuery`, `programsHref` and `parseProgramsQuery` (trimmed, capped at 200); `matchesSearch` (every word, any order, over name, area, tagline and short description); `programAreaOptions` (area + its first programme's icon); `programsView` applies the search inside the area. A search that matches nothing is an empty page, unlike a stale area, which still falls back to everything | Search | 8 new unit tests; the existing 16 updated for the `q` field | — |
| `program-card.tsx`: compact row — the photograph on the left (44% of the inner width, at most 192px, as tall as the card, 16:9 on top below `sm`), then a 40px icon disc, Manrope 800 18px name, 14px description (three lines at most), and the count beside a 34px arrow disc. 12px corners, 14px padding | Mockup: "the current cards are oversized" | Card 220px tall at 1440 (was 477). The single stretched link, hover lift, focus ring and "Ongoing program" wording are unchanged. The journey test's `a → ancestor::div` check still finds the count | — |
| `program-icon.tsx`: `programTone` returns `{disc, ink}`; `accentIcon()` exported for the chips and menus; Disaster Relief and Environment green, Animal Welfare amber (were soft orange) | Mockup's icon colours | Programme cards and the toolbar | — |
| `view-more-programs.tsx`: the shared `Button variant="secondary"` (blue outline, white fill), 52px, centred, no sprig | Mockup | — | — |
| `e2e/journeys.spec.ts` › "programs listing": rewritten for the toolbar (chip → `Clear filters`; "More filters" and "All categories" menus; search by "clinic", kept through a chip, lifted by emptying the box). "View More" test unchanged | The pill row is gone | — | — |

Deliberate differences from the mockup: descriptions, counts and photographs are the programmes' real ones (the mockup's copy is shorter, so some descriptions clamp at three lines with an ellipsis); Women Empowerment keeps its data-driven briefcase icon (the mockup draws people); the eyebrow uses the AA orange ink (`text-primary`).

## 2026-10-14 — Filled orange is #EB6A1F everywhere; #C5531A retired (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `packages/ui/src/styles/tokens.css`: `--primary` is `var(--cta)` (#EB6A1F) in light and dark mode (was #C5531A); `--primary-hover` #D45914 (was #B3450E light, a lighter shade dark); `--primary-active` and `--cta-active` #B3450E (were #9E3905 and #C5531A). Comments rewritten | Owner: replace the darker Donate Now orange with the hero's brighter one "whole website where the first button color used". Asked about the label, the owner chose **white, exactly as shown**, over navy | Every `bg-primary` / `border-primary` fill, about 100 uses: the header's Login / Sign Up, Donate buttons, active pills, badges, back-to-top, admin buttons. No page or theme scanned still paints #C5531A. Orange text (`text-primary` → #B74500) and the campaign card's navy-label Donate Now are unchanged | — |
| `packages/ui/src/primitives/button.tsx`: the primary variant's shadow is tinted #EB6A1F (was #C5531A); comment updated | Follows the fill | Visual only | — |
| `AGENTS.md` §11 item 12 records the decision; `design-system/sailent-foundation/MASTER.md` §3.2 and §6.1 updated | Permanent design decision | — | — |

**Accessibility:** white on #EB6A1F is 3.18:1, below WCAG AA's 4.5:1 for button-size text (#C5531A gave 4.54:1). axe `color-contrast` (WCAG 2.1 AA tags) now flags these fills: 26 elements on `/`, 13 on `/about`, 10 on `/campaigns` and `/donate`, 5 on `/programs`, 3 on `/sign-in` (1440px, light). Some, such as the About hero's buttons, were already white on #EB6A1F before this change. The Playwright axe checks (`shell`, `journeys`, `campaign`, `dashboard`, `phase-9` specs) are expected to fail on these until the owner decides otherwise; they were not changed.

## 2026-10-14 — Programs listing: introduction, pills and cards matched to the owner's mockup (uncommitted)

| Change | Reason | Impact | Migration |
|---|---|---|---|
| `programs/page.tsx`: the listing opens with a visible introduction: an "OUR PROGRAMS" eyebrow led by an orange rule, the two-tone heading "Long-term work, / not one-off projects" (Manrope 800, up to 53px, `--cta-bright` second line), and the paragraph. It replaces the visually hidden "All programs" `h2`. The pills sit 28px below it, the grid 24px below them | Owner supplied a mockup and asked for an exact match. Asked whether to repeat the hero's copy, the owner chose to **add it and keep the hero** | The hero's eyebrow, heading and paragraph now appear twice on `/programs` (hero `h1`, listing `h2`). "Explore Our Programs" (`#programs-list`) lands on the new heading | — |
| `program-filters.tsx`: pills 48px tall from `lg` (44px below), 26px side padding, 12px gaps at every width, a cool blue-grey outline (`accent-100`), and no shadow on the active pill | Mockup | Pill row about 1305px wide at 1440px; wraps to two rows at 1024px; scrolls sideways below `lg` as before | — |
| `program-card.tsx`: 12px corners, a cool blue-grey outline and shadow (no longer the shared warm `card-interactive`), `9/5` photograph (was `12/7`), a 64px icon disc on a 2px white ring centred on the photo's lower edge with a 32px icon, Manrope 800 24px name, 17px description at 1.375 line height, a hairline above the footer, a regular-weight count, and a 44px arrow disc with a 20px arrow. `program-icon.tsx`: the orange disc tint uses `--cta` at 12% (was `--primary`) | Mockup | Card is 477px tall at 1440px (mockup: 475). The hover lift, focus ring, single link and "Ongoing program" wording are unchanged | — |
| `program-card.test.tsx`: stubs `@/lib/fonts` (`next/font` cannot run under Vitest); no assertion changed | The card now imports `headingExtraBold` | — | — |

Deliberate differences from the mockup: the eyebrow text uses the orange text ink (`text-primary` → #B74500) instead of the mockup's brighter orange, because 16px #EB6A1F text fails WCAG AA. The photographs are the programmes' real covers. (The active pill was #C5531A here at first; it became #EB6A1F with the site-wide change above.)

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
