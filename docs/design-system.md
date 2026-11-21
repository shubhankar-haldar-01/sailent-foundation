# Design System — Sailent Foundation

**First written:** Phase 0, 19 September 2026. **Rewritten for the built system:** visual polish brief, Phases 1–5, 21 November 2026 (sections 2–5 and 8). Sections 1, 6, 7, 9–11 are the original rules and still apply.

**Source of truth:** `packages/ui/src/styles/tokens.css` (tokens, theme, base styles and utilities) and `packages/ui/src/primitives` (components). Live reference: `/dev/ui-states` (every component in every state, light and dark) and `/dev/design` (the chosen direction). Owner decisions behind it: `AGENTS.md` §11 items 2, 7, 10, 12, 13, 22, 23.

---

## 1. Visual direction

### The problem with the obvious approach

An NGO platform assembled from a landing-page template and a dashboard starter produces a site that looks like every SaaS product of the last three years: a gradient hero, four rounded cards with icons, a testimonial carousel, a pricing-table-shaped donation section. It is competent and it is forgettable, and for an organisation asking strangers for money, forgettable is expensive.

Two references are useful, and neither should be copied. Mainline contributes typographic rhythm and section composition. Kiranism contributes admin density and data-table conventions. Neither contributes the visual identity.

### The direction

**Editorial, not promotional.** The public site is closer to a well-made magazine or a serious documentary photo essay than to a product marketing page. Photographs of real work carry the emotional weight; the interface gets out of their way. Generous whitespace, a confident type scale, restrained colour, almost no decoration.

Six principles:

1. **Photography leads.** Real images at real size. No stock, no illustration where a photograph should be, no abstract shapes filling space where a picture belongs.
2. **Type does the work.** A strong editorial scale and good measure carry hierarchy. Colour is not a substitute for typographic structure.
3. **Colour is scarce.** One accent, used for action and progress. Everything else is a warm neutral. Scarcity is what makes a Donate button unmissable.
4. **Depth is minimal.** Borders and background shifts define surfaces. A shadow appears only where something genuinely floats — a dropdown, a modal, a sticky bar.
5. **Motion is functional.** Transitions confirm state changes. Nothing animates on scroll for decoration. Every motion respects `prefers-reduced-motion`.
6. **Numbers are earned.** A statistic renders only when the database can produce it (A14). This is a design rule as much as a data rule, and it shapes how sections are composed — every stat component handles its own absence.

### Two experiences, one system

| | Public | Admin |
|---|---|---|
| Feeling | Warm, human, trustworthy | Quiet, operational, efficient |
| Neutrals | Warm (slight red/yellow hue) | Cool (slight blue hue) |
| Density | Generous — 96–128px section rhythm | Dense — 16–24px |
| Type scale | Editorial, large display sizes | Compressed, 14px base |
| Radius | Softer (8–12px) | Tighter (6px) |
| Colour | Photography plus one accent | Neutral plus semantic status |
| Motion | Considered, slower (200–300ms) | Immediate (100–150ms) |

Same type family, same radius language, same accent hue, same component primitives. **What changes is density and warmth, not identity.** That is how two genuinely different experiences come from one system without maintaining two systems.

### Explicitly rejected

Gradient heroes · glassmorphism · everything-rounded card grids · scroll-triggered fade-ins on every section · floating 3D shapes · emoji as iconography · vague stock photography of hands and sunsets · counters that animate upward on scroll (they draw attention to the number rather than to what it means, and they feel like a sales page) · manufactured urgency.

---

## 2. Typography

### Family

**Inter only** (owner, 2026-11-21), self-hosted through `next/font` (`apps/web/src/app/layout.tsx`): subset `latin`, `display: swap`, weights **400** (text), **500** (labels), **600** (headings, buttons, figures). Nothing heavier is loaded, so `font-bold` renders at 600. A metric-matched "Inter Fallback" `@font-face` (`apps/web/src/styles/globals.css`) keeps text from moving when Inter arrives (CLS 0). Manrope and the Caveat script accent are retired. A Devanagari companion is still needed before Hindi content.

### Scale (theme tokens, `--text-*`)

| Token | Size | Use |
|---|---|---|
| `text-display-hero` | clamp 32–50px | Home hero headline |
| `text-display` | clamp 32–48px | Rare display headings |
| `text-h1` | clamp 28–38px | Page titles |
| `text-h2` | clamp 24–30px | Section titles inside a page |
| `text-section` | clamp 22–26px | Homepage band titles |
| `text-h3` / `text-h4` | 24 / 20px | Card and block titles |
| `text-body-lg` | 18px / 1.65 | Leads; article body (blog posts, stories) |
| `text-body` | 16px / 1.65 | Default text |
| `text-body-sm` | 14px | Secondary text, dense UI |
| `text-caption` | 13px | Meta, helper text |
| `text-overline` | 12px, 600, +0.08em, uppercase | Eyebrow labels, in the brand colour |

### Rules

- Headings are 600 with slight negative tracking (h1/h2 −0.02em, h3 −0.01em, from the base layer).
- **Sentence case** for all fixed copy — headings, labels, buttons, navigation. Titles and text entered in admin are shown as written.
- **Tabular numbers** for every amount, count and table column (`tabular-nums`, or `[data-numeric]` / `[data-amount]`).
- No highlighted words in headings, no decorative rules beside them.
- Long-form reading: a 680px column (`prose-measure`) with 18px body text on a 1.75 line height.

## 3. Colour

### Roles (owner, 2026-11-21; `AGENTS.md` §11 item 12)

| Role | Token | Light | Dark | Used for |
|---|---|---|---|---|
| **Brand** | `primary` (`--brand-600`) | `#1E7B24` | `#5CC461` | Default buttons, links, active nav and tabs, selected chips, badges, progress bars, focus ring, the admin |
| Brand tint | `accent` / `accent-foreground` | brand-50 / brand-800 | dark green / light green | Selected backgrounds, tags, icon discs |
| **Action** | `action` | `#EB6A1F` | same | **Donate and the page's one primary conversion button only.** White label at 3.18:1, the owner's recorded exception |
| Text | `foreground` / `muted-foreground` | `#111827` / `#4B5563` | `#E5E7EB` / `#9CA3AF` | Body and secondary text |
| Surfaces | `background` / `surface` / `muted` | `#F9FAFB` / white / `#F3F4F6` | `#0B0D10` / `#121417` / `#1B1E23` | Page, cards, sunken areas |
| Always dark | `surface-inverse` | `#111827` | same | Photo scrims, camera viewfinders |
| Borders | `border` / `border-strong` / `input` | `#E5E7EB` / `#D1D5DB` / `#6B7280` | — | Card hairlines / hover / control borders (≥ 3:1) |
| **Success** | `success` | `#0F766E` (teal) | `#2DD4BF` | Confirmations, **always with an icon**; never the brand green |
| Warning / destructive / info | `warning`, `destructive`, `info` (+ `-subtle`) | — | — | Status only, always with an icon and a word |

### Rules

- Every colour in code is a token. A hard-coded hex is allowed only where CSS cannot reach: canvas drawings and Razorpay's theme read `apps/web/src/lib/brand-colours.ts`; payment-network and share-network marks keep their owners' colours; the staff ID card is its own printed artwork. The grep is in `docs/design-audit/colour-grep-*.txt`.
- One accent hue per page: causes and programmes all use the brand (their icons tell them apart); the old pastel `wash-*` tokens remain only for campaign status visuals and legacy artwork.
- Selected is not success: a selected chip is brand border + brand tint + a check; success is teal with its own icon.
- Contrast: `apps/web/src/components/__tests__/tokens-contrast.test.ts` checks the AA pairs in light and dark against `tokens.css` itself.

## 4. Spacing, radius, elevation

### Spacing

A 4px grid (Tailwind's scale). Page sections use `section-y` (64/96px); content sits in `container-page` (max 1440px) or `prose-measure` (680px).

### Radius

| Element | Radius |
|---|---|
| Buttons, inputs, selects, chips, small panels | 8px (`rounded-lg`) — owner, 2026-11-21 |
| Small cards, images | 12px (`rounded-xl`) |
| Large cards | 16px (`rounded-2xl`) |
| Tags, badges, status pills, avatars, social circles | full (pills only for these) |

### Elevation

**Border first.** Cards have a hairline and no shadow at rest (`card-standard`). Only a card that *is* a link or button lifts 2px with a soft shadow on hover (`card-interactive`). `card-featured` is a stronger border, not a shadow. `card-elevated` and `shadow-elevated` are for overlays (menus, dialogs, popovers). Shadows are neutral, never tinted. Never put a card inside a card.

## 5. Core components (`@sailent/ui`)

### Buttons

| Variant | Look | Use |
|---|---|---|
| `action` | Orange fill, white label | Donate; a page's single conversion button (paid registration, pay) |
| `primary` (default) | Brand fill | Every other main action |
| `secondary` | Brand outline | Second actions, filters, "Donate now" on campaign cards |
| `outline` | Neutral outline | Quiet actions: Login, Cancel, Back |
| `ghost` | No fill until hover | Toolbars, icon triggers |
| `destructive` | Red fill | Always behind `ConfirmationDialog` |
| `link` | Brand text | Inline navigation |

Sizes: `sm` 36px (44px hit area on touch, via `touch-target`), `md` 44px, `lg` 48px, `icon` 44×44 (needs `aria-label`). States: hover darkens; press scales to 0.98 (off with reduced motion); one focus ring (2px brand, 2px offset); `disabled`; `isLoading` keeps the label and width and shows the shared spinner.

### Inputs, selects, textareas

44px, 8px corners, `input` border (4.8:1). Hover darkens the border; focus is the brand border and ring; **error** (`hasError`) is a red border and ring with `aria-invalid` and a `FieldError` message under the field; **valid** (`isValid`) is a teal border with a check; `disabled` is muted. `prefix="₹"` draws a fixed lead-in for amount fields. A visible `<Label>` always; placeholders are never labels.

### Amount chips

Brand border, brand tint and a check when selected; a border change on hover; tabular numbers; 8px corners.

### Cards and the campaign card

See §4 for elevation. The campaign card (`apps/web/src/components/campaigns/campaign-card.tsx`, §11 item 2): the whole card is the link; one programme tag; Raised / Goal / Donors as a plain row; a brand progress bar; one quiet "Donate now" to `#give`; a neutral status pill.

### Badges

One size: 24px pill, 12px medium text, 12px icon. Variants `neutral`, `brand`, `success`, `warning`, `destructive`, `info`, `outline`. Status always carries an icon and a word.

### Tabs and the campaign section nav

A 2px brand underline and brand text on the current tab; a neutral underline on hover; arrow keys (Radix). The campaign page's section nav is sticky under the header and tracks the section in view.

### Accordion (FAQ)

`variant="list"`: one bordered card, hairline dividers between rows, a chevron that turns, 250ms open and close (`accordion-motion`, off with reduced motion).

### Progress

8px track, brand fill (teal when a goal is reached), raised vs goal and the percentage in tabular numbers, a 500ms ease to its value.

### Header and footer

Header: white bar, the active link in the brand with a 2px underline, a quiet outline "Login / Sign up", a translucent blurred bar once the page scrolls; it condenses but never hides. Footer (§11 item 13): neutral headings without bars, muted links that turn brand on hover, plain contact icons, 40px neutral social circles, a quiet tagline, the legal row; no Donate button.

### The phone Donate bar

`apps/web/src/components/donations/mobile-donate-bar.tsx` (§11 item 22): below `lg`, fixed to the foot of the screen **only while the campaign page's in-page donation card is out of view**; its button brings the card back. It never covers the card.

### Feedback

Toasts, banners, skeletons, empty and error states and confirmation dialogs follow `docs/ui-feedback.md`.

## 6. Domain components

The components that make this platform rather than a template.

### `CampaignCard`
Anatomy in `information-architecture.md` §5.2. Design rules: image is always 16:9 with a blurhash placeholder so the layout never shifts; the title clamps at two lines; the progress bar shows percentage *and* both absolute figures; "days left" appears only with a real end date; supporter count is suppressed below 5.

### `ProductCard`
The signature component. Image, name, price, **a concrete description of what the donor is buying**, optional progress against target, and the quantity stepper.

The stepper is the interaction that matters: 44px controls, `−` disabled at 0 rather than hidden (so nothing shifts), the line total updating live beside it, and direct numeric entry for donors giving at scale. Fulfilled products grey out, replace the stepper with "Fully funded — thank you", and move to the end of the list.

### `DonationSummary`
Sticky rail on desktop, collapsible bottom sheet on mobile. Itemised lines, each removable in place, a clear total in `display` size with tabular numerals, and the tax-benefit note. On mobile the collapsed bar shows `₹2,900 · 3 items ▲`, expanding to the full itemisation — **every line editable there**, so the donor never scrolls back up to change a quantity.

### `Stat`
Takes a **source identifier, not a string** (A14). Renders value, label, and — where relevant — an "as of" date or a source link. **If the value is unavailable or zero, the component renders nothing.** The parent handles an empty set by collapsing the band entirely rather than showing zeros.

### `Timeline`
Campaign updates, impact updates, volunteer history, audit trails. Date-anchored, media-capable, chronological with a clear vertical structure.

### `TrustPanel`
Registration numbers, 80G eligibility stated as fact, payment security note, and a link to `/about`, where the statutory identifiers live. Deliberately plain — plain text reads as more credible than a badge graphic, which reads as marketing.

---

## 7. States

Every data-bearing component defines all five. Missing states are where products feel unfinished.

### Loading
Skeletons matching final layout dimensions exactly, so nothing shifts on arrival. `aria-busy="true"`. Spinners only for actions under ~1s; skeletons for content. Optimistic UI for admin actions that reliably succeed, with a clear rollback on failure.

### Empty
Three kinds, and conflating them is a common failure:

| Kind | Treatment |
|---|---|
| **Nothing yet** | Explain what will appear here and offer the action that creates it |
| **Nothing matches** | Name the filters that excluded results, offer to clear them individually, show alternatives |
| **Nothing to show you** | Permission-limited — say so plainly rather than showing a misleading empty list |

Never an empty grey box. Never "No data".

### Error
State what happened, whether the user's work is safe, and what to do next. Include a request id for anything support-worthy. Offer a retry that does not lose entered data. **Never expose a stack trace or an internal identifier.**

### Success
Proportional to the action. A saved field gets a quiet inline confirmation; a completed donation gets a full page with the itemisation, receipt number and what happens next.

### Payment states — the important ones

| State | Treatment |
|---|---|
| **Pending** (< 30s) | "Confirming your donation…" Calm, honest, with progress indication. **Never a premature success.** |
| **Pending** (> 30s) | "This is taking longer than usual. Your payment is safe — we'll email you as soon as it's confirmed." Plus the reference number. |
| **Failed** | Plain-language reason, a retry that reuses the same donation record, and a support contact. Never blame the donor. |
| **Successful** | Full confirmation, itemised, receipt number, what the gift funds, tax-ID prompt if missing. |
| **Failed** | Factual: nothing was charged, and what the donor's bank will do about any held amount. |

### Unauthorized / Forbidden / Not Found

- **401** — sign in, returning to where they were afterwards.
- **403** — "You don't have access to this" plus who to ask. Never a generic error, and never a 404 that pretends the record does not exist (that wastes an operator's afternoon).
- **404** — helpful: search, popular campaigns, a route home. An NGO 404 is a chance to show real work.

---

## 8. Motion

| What | Duration | Easing |
|---|---|---|
| Hover, colour and border changes | 150–200ms | `--ease-out-soft` |
| Button press | instant scale to 0.98 | — |
| Accordion open/close, tab underline | 250ms | `--ease-out-soft` |
| Progress fill | 500ms | `--ease-out-soft` |
| Card lift (clickable cards only) | 200ms, 2px | `--ease-out-soft` |

Everything respects `prefers-reduced-motion` (the base layer cuts animations and transitions; components drop their transforms). No entrance animation sits above or just below the fold: it delays the largest paint, and on the homepage's rail a smooth-scrolling snap container stopped Chrome recording it at all (Phase 5). The homepage rails autoplay, with a keyboard-only pause control (§11 item 3).

## 9. Responsive behaviour

| Breakpoint | Width | Layout |
|---|---|---|
| `xs` | 320–479 | Single column, 16px gutters |
| `sm` | 480–767 | Single column, 20px gutters |
| `md` | 768–1023 | Two columns, 24px gutters |
| `lg` | 1024–1279 | Three columns, 32px gutters |
| `xl` | 1280–1535 | Full layout, 1200px container |
| `2xl` | 1536+ | 1320px container, **capped** |

Large screens cap the container and increase whitespace. Text stretched to 1920px is unreadable.

### Component behaviour

| Component | Mobile | Tablet | Desktop |
|---|---|---|---|
| **Navigation** | Full-screen drawer + compact Donate | Drawer or condensed bar | Full horizontal + Donate |
| **Campaign cards** | 1 column, full width | 2 columns | 3 columns |
| **Product cards** | 1 column stacked, or a peek-edge carousel in the builder | 2 columns | 2–3 columns in the builder |
| **Donation summary** | Bottom sheet, collapsed to a total bar | Bottom sheet | Sticky right rail |
| **Tables** | **Stacked cards** with labelled fields | Horizontal scroll, sticky first column | Full table |
| **Admin sidebar** | Off-canvas drawer | Icon rail, expand on hover | Full, collapsible |
| **Forms** | Single column, full-width fields | Single column | Two columns where fields pair naturally |
| **Charts** | Simplified — fewer series, larger touch targets, values in a legend | Standard | Full with tooltips |
| **Modals** | Full-screen | Centred, 90% width | Centred, max 640px |
| **Event registration** | Full-page form | Full-page | Modal or side drawer |

### Mobile-specific

- A **sticky donate bar** appears after the hero leaves the viewport and hides over the closing CTA, so two Donate buttons are never visible at once.
- Bottom sheets respect `env(safe-area-inset-bottom)`.
- Horizontal scroll containers show a partial next item, so scrollability is discoverable without a hint.
- **No horizontal page scroll at any width.** Only tables, diagrams and code blocks scroll, each in its own container.
- Mobile-first CSS: base styles are mobile and breakpoints add, never subtract.

---

## 10. Accessibility — WCAG 2.2 AA

AA is the target throughout. **The donation flow and the volunteer application are hard requirements**, not best-effort: a donor who cannot complete a donation with a screen reader is a donor the organisation has turned away.

### Keyboard
- Every interactive element reachable and operable by keyboard; logical tab order matching visual order.
- **Visible focus indicators everywhere** — a 2px ring at 2px offset, never `outline: none` without a replacement.
- Skip-to-content link, first in the tab order.
- Modals and drawers trap focus and return it to the trigger on close.
- Escape closes overlays. Arrow keys navigate tabs, menus and steppers.
- **No keyboard traps.** The Razorpay iframe is tested specifically for this.
- WCAG 2.2 additions: focus is never obscured by sticky headers or bars (`scroll-margin-top` accounts for the sticky header), and dragging interactions have a single-pointer alternative.

### Screen readers
- Semantic HTML first; ARIA only where semantics fall short.
- Landmarks on every page; one `h1`; no skipped heading levels.
- `aria-live="polite"` for the donation total as it updates, and for the payment status page — a blind donor must hear the total change when they adjust a quantity.
- Form fields associated with labels; errors linked by `aria-describedby` and announced.
- Icon-only buttons carry `aria-label`. Decorative images get `alt=""`; meaningful images get real alt text — and **publishing is blocked when alt text is missing** (`database-architecture.md` §11).
- Tables use `<th>` with `scope`, and a `<caption>` where the context is not otherwise clear.

### Contrast and targets
- Body text ≥ 7:1 (exceeding AA's 4.5:1). Large text ≥ 4.5:1. UI components and focus indicators ≥ 3:1.
- **Touch targets ≥ 44×44px** with at least 8px between adjacent targets. The quantity stepper is the component most at risk and is specified accordingly.
- Text resizes to 200% without loss of content or function; layouts use relative units.
- Reflow at 320px without horizontal scrolling.

### Forms and errors
- Errors are specific, adjacent to the field, and announced.
- Nothing is submitted destructively without confirmation.
- Sessions do not expire mid-form without warning and a way to continue.
- The donation flow **never relies on a timeout**.

### Testing
Automated axe checks in CI, manual keyboard-only passes on the donation and application flows, and screen-reader testing with NVDA and VoiceOver on those same two flows before every release that touches them.

---

## 11. Content and imagery

### Voice
Plain, warm, specific. "₹900 provides a school kit for one child for a year" beats "Support our education initiative". Active voice. No jargon, no development-sector acronyms without expansion.

**Never** manufactured urgency, guilt, pity framing, or savior language. Beneficiaries are named as people with agency, not as recipients of charity.

### Imagery
Real photographs of real work. **Dignity is a hard rule**: no images that a subject would be embarrassed to see, no children's faces without documented consent, no poverty-as-spectacle.

Every image needs alt text, a blurhash placeholder, an explicit aspect ratio, `loading="lazy"` below the fold, responsive `srcset`, and modern formats with fallbacks. EXIF is stripped on upload — GPS coordinates in a photograph can identify a beneficiary's home.

### Numbers
Every public number is a database aggregate or a dated impact record (A14). Indian numbering (`₹4,20,000`, not `₹420,000`). The rupee symbol always precedes. Tabular numerals wherever numbers align. **Fewer, defensible numbers beat a dense band of impressive ones nobody believes.**

---

*Related: [`information-architecture.md`](information-architecture.md) · [`user-flows.md`](user-flows.md) · [`phase-0-decisions.md`](phase-0-decisions.md)*
