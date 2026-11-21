# Visual audit — Phase 0 (2026-11-21)

Before any visual polish. No code was changed for this audit.

- **Screenshots:** 174 full-page captures (29 routes × 360 / 768 / 1440 px × light / dark) were taken for this audit from a production build against the seeded E2E database, then **deleted at the owner's request (2026-11-21)**. The findings below were made from them; recapture with the same routes for the after/ comparison.
- **Routes:** home, campaigns list, campaign detail (active and ended), checkout (donor form), donate, donation status (paid), programmes, a programme, events, an event, stories, a story, blog, a blog post, FAQ, about, contact, volunteer, sign-in, privacy, 404; donor dashboard, payments and profile; admin dashboard, campaigns list, campaign editor and settings.
- **Raw inventories:** `computed-styles.txt` (what the browser actually renders, all 29 pages at 1440 light), `inventory-*.json` (the same per page), `source-inventory.txt` (fonts, hard-coded colours, sizes, shadows, radii, icons in the source).

Notes on the capture: the seeded data is demo copy ("Demo campaign narrative…"), and some story and "Who we are" images are blank in this data set; check those on real data before judging them. Full-page captures show the sticky header wherever the page was scrolled to (the checkout shot): not a defect.

---

## 1. Inventory

| What | Found |
|---|---|
| **Font families** | Inter (body, 2,719 text nodes), Manrope (headings, 404), Caveat (script accents, 75), plus `ui-serif` and `ui-monospace` in a few places. Manrope is loaded twice: 600/700 in the layout and 800 again in `lib/fonts.ts` for three headings. |
| **Font sizes** | **34 distinct** rendered sizes (12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 28, 30, 36, 38, 48… plus 10, 11, 12.5, 13.2978, 13.5 px). In the source, ~300 arbitrary sizes (`text-[11px]` ×40, `text-[0.8125rem]` ×37, `text-[0.9375rem]` ×37, `text-[10px]` ×24, down to `text-[8px]`). |
| **Font weights** | 400, 500, 600, **700 (710 nodes), 800, 900**. |
| **Text colours** | **71 distinct.** Tokens (`oklch …`) mixed with raw slate values (`rgb(71,85,105)`, `rgb(15,23,42)`, `rgb(100,116,139)`). |
| **Backgrounds** | **117 distinct.** Orange `#EB6A1F` on 113 elements; peach `rgb(255,237,213)` on 76; several pastel washes. |
| **Borders** | 50 distinct; the warm **peach border `rgb(251,232,216)` on 146 elements**. |
| **Shadows** | 44 distinct rendered; the default card shadow **is tinted orange** (`rgba(235,106,31,0.06) 0 12px 28px`) on 124 elements. Source: shadow-xs ×165, sm ×72, md ×43, lg ×17, xl, 2xl, plus 15 one-off `shadow-[…]` values. |
| **Radii** | **16 distinct** rendered (2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36 px, plus full). |
| **Hard-coded colours** | **606 hex values in 40 files** outside `tokens.css` (179 × `#EB6A1F`, plus `#0F172A`, `#64748B`, `#102A43`, `#0070BA` …). Worst: `about/page.tsx` (70), `download-pass.ts` (60), `stories/[slug]` (37), `identity-card-dialog` (35), `mobile-footer` (33). These cannot follow dark mode or a palette change. |
| **Buttons** | Kit `Button` with primary, secondary, ghost, tertiary, dark, destructive, info, link, subtle; sizes sm 36 / md 44 / lg 48–50 / xl 56 px, all pills. 52 files also draw raw `<button>`s with their own styles. |
| **Icons** | lucide-react only (215 imports). Good. |

## 2. Problems by page

**Campaign detail (the donation journey's centre)**
- *Colour:* orange is the active tab underline, the "Most Needed" badge, progress bars, the CTA, links ("See the items and their prices"); green for the selected chip, the giving-mode switch and the total; **purple** for the raised figure and "Your Impact"; blue info icon. No single meaning for any colour.
- *Components:* every section is its own white card with a pastel icon tile ("Why This Campaign?", "What Will Your Support Provide?", "Our Goal", "Your Impact"), stacked cards; FAQs are 7–10 separate boxed items; two different stat treatments (Our Goal vs Your Impact).
- *Typography/content:* Title Case headings and labels ("Choose How You Want to Help", "About This Campaign", "Add an Amount", "Total Amount", "Share Campaign", "Recent Supporters").
- *Donate card:* five accents in one card (green switch, purple ₹ raised, green ₹ total, orange CTA, coloured assurance discs); payment logos uneven; **dark mode puts the logos on a bright white slab**.
- *Content:* "mountain" (dev database) has the admin form's label as its text ("Why This Campaign? (The Story)") in both the story and "What will your support provide?" — content entered in admin, not a template bug.

**Home**
- **"In The Spotlight"** shows press marks (THE COMMUNITY POST, Impact Journal, TODAY INDIA…) hard-coded in `spotlight-section.tsx`, and **"Voices of Hope and Change"** shows named quotes from `lib/mock/home.ts`. Neither is a record — AGENTS.md §10/§12 forbid invented press names and testimonials. (Re-added in `c0c8c25`.)
- Every campaign card carries a full-width orange "Donate Now" (12 orange CTAs on one screen), three coloured icon discs and a coloured cause pill.
- Headings with orange highlight words and underline flourishes ("Discover Causes That *Inspire You.*", "In The *Spotlight*", "Voices of *Hope and Change*"); eyebrow labels with orange rules.
- Pastel cause tiles in eight colours; impact strip with four colour discs; peach testimonial band.

**Header & footer (every page)**
- Login / Sign Up is the largest, loudest element in the header (orange pill, 44 px); active nav link orange.
- Footer: orange underline under each heading, Caveat script tagline "People Purpose Possibilities", faded orange background graphic, orange contact discs.

**Donor dashboard**
- Peach hero band with Title Case ("View Your Successful Donations And Receipts."), orange name highlight, orange and amber icon tiles, green "Your Impact" card with an illustration — three accent systems on one screen.

**Admin**
- Orange is the admin primary too (filters, "New campaign", pagination, active nav); otherwise the admin is the most consistent area (neutral tables, clear hierarchy).

**Dark mode (all pages)**
- Payment logos on a white slab; peach/orange tints and coloured discs carry over unchanged; card surfaces navy, borders faint; mostly readable but loud.

**Responsive**
- No sideways scroll found (tests pass at 320–1440 px). At 360 px the campaign page stacks four section cards and ten FAQ boxes — very long.

**Accessibility**
- White on brand orange is ~3.2:1 (below 4.5:1 for normal text) — owner decision on record (§5.6). Admin avatar and count pill 4.45:1. Focus rings present on the kit components; raw `<button>`s vary.

## 3. Top 15, ranked by user impact (donation journey first)

| # | Issue | Where | Seen in |
|---|---|---|---|
| 1 | **Invented press marks and testimonials** shown as fact (trust and AGENTS.md §10) | Home | home spotlight testimonials |
| 2 | **Orange means everything** — CTA, login, active nav/tab, badges, progress, links, admin primary | All | header login pill, home cards orange |
| 3 | **Donate card has five accent colours** and Title Case labels; dark-mode white logo slab | Campaign | donate card, dark donate card |
| 4 | **Section cards with pastel icon tiles**, stacked card-on-card, two stat styles | Campaign | section cards icon tiles |
| 5 | **Title Case everywhere** (~60 headings + buttons/labels) against the sentence-case rule | All | campaign, dashboard |
| 6 | **Type scale out of control**: 34 sizes, weights to 900, ~300 arbitrary sizes, a third font weight file | All | `computed-styles.txt` |
| 7 | **Warm/peach surfaces**: peach borders ×146, orange-tinted shadow ×124, peach bands | All | campaign, dashboard, home |
| 8 | **Campaign card grid is loud**: an orange full-width button per card + 3 colour discs + colour pill | Home, campaigns | home cards orange |
| 9 | **FAQ as 7–10 heavy boxes** instead of one divided list | Campaign, FAQ | faq boxes |
| 10 | **Login / Sign Up pill outweighs Donate** | Header | header login pill |
| 11 | **Footer busy**: orange underlines, script tagline, faded graphic | All | footer |
| 12 | **606 hard-coded colours** bypass tokens (dark mode and any palette change miss them) | 40 files | `source-inventory.txt` |
| 13 | **Inconsistent radius and elevation**: 16 radii, 44 rendered shadows | All | `computed-styles.txt` |
| 14 | **Decorative heading flourishes** (orange highlight words, underline marks, eyebrow rules) and **pastel cause tiles** | Home, campaigns | home cause tiles |
| 15 | **Dashboard header**: peach band, Title Case, three accent systems | Dashboard | dashboard header |

## 4. Conflicts with earlier owner decisions (AGENTS.md §11) — need your call before Phase 1

| Brief asks | Recorded decision |
|---|---|
| Orange only on Donate; brand blue/green for links, active nav, selected states | **§11 item 12**: `--primary` is orange `#EB6A1F` with a white label for buttons, the header Login, active pills and badges. |
| New type scale, 8 px controls, possibly one font | **§11 item 7**: a "single font, new type scale, 1320 px container, 8 px buttons" refinement was **reverted by you on 2026-10-06**. Fonts are Manrope + Inter by decision (AGENTS.md §11 item 10: fonts, colours and spacing are approval-gated). |
| Remove or restyle home sections (spotlight, testimonials) | **§11 items 3 and 6**: the Testimonials rail is an approved homepage section, and homepage sections are not removed unless you ask. Its *content* is invented, which §10 forbids — your decision: real quotes, or remove. |
| Simpler campaign cards (fewer colours, one CTA style) | **§11 item 2**: the campaign card was redesigned by you on 2026-10-08. |
| Footer without underlines/tagline | **§11 item 13** fixes the footer's columns and links (structure, not styling) — compatible. |
| Success page and receipt "match the approved design" | **§11 items 15–16** — keep as approved; only token-level colour changes. |

## 5. Not changed, noted for later

- The "mountain" campaign's text is admin content to rewrite; a Phase 4 safeguard could hide "What will your support provide?" when it repeats the story word for word.
- Missing images in the seeded data set (story and "Who we are" tiles) — check on real data.
- Uncommitted from before this audit: the minimal assurance strip (5 files), waiting for your approval to commit.

---

## Phase 2 — foundation (2026-11-21)

Applied the owner's Phase 1 choice: direction 2 (logo green `#1E7B24`, Inter only), Donate orange `#EB6A1F`, success teal. Tokens in `packages/ui/src/styles/tokens.css`; roles in `AGENTS.md` §11 item 12.

**Hard-coded colours** (`colour-grep.sh`; full output in `colour-grep-before.txt` and `colour-grep-after.txt`):

| | Before | After |
|---|---|---|
| Hex values | 606 in 60 files | 91 in 12 files |
| `rgb()` | 52 | 2 |
| `oklch()` | 41 | 40 |
| Tailwind palette classes | 1,327 | 3 |

What remains is deliberate:
- `lib/brand-colours.ts`: the token values for output that cannot read CSS (the event pass canvas, Razorpay's theme, `global-error.tsx`);
- the staff ID card artwork (`identity-card-dialog.tsx`), drawn on a canvas in its own navy design;
- payment-network marks (`payment-logos.tsx`) and the Facebook/WhatsApp share buttons, which keep their owners' colours;
- illustration SVGs (`*/decor.tsx`) and `media-frame.tsx`'s placeholders, which already follow `--brand-hue`;
- the print styles in `globals.css`, and code comments.
