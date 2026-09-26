# Design System — Sailent Foundation

**Phase:** 0 · **Date:** 19 September 2026
**Status:** Direction and token architecture. **Colours are placeholders** pending the real brand palette (decision A11, open question 1).

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

### Families

| Role | Choice | Reason |
|---|---|---|
| Display & headings | A humanist serif or a high-contrast grotesque — **candidates for review** | Editorial authority; distinguishes Sailent from the default geometric-sans look |
| Body & UI | A neutral humanist sans (Inter, Public Sans or similar) | Legibility at small sizes, wide weight range, good Devanagari companion for future i18n |
| Numerals | Body family with `font-variant-numeric: tabular-nums` | **Mandatory in tables, progress figures and currency** — proportional digits make aligned numbers jitter |

Both families must include a Devanagari-compatible companion. Retrofitting Hindi onto a Latin-only stack is far more expensive than choosing well now.

### Scale

A 1.25 modular scale on the public site; a compressed 1.15 in admin.

| Token | Public | Admin | Use |
|---|---|---|---|
| `display-lg` | 60/1.05 | — | Hero |
| `display` | 48/1.1 | 30/1.2 | Page title |
| `h1` | 38/1.15 | 24/1.25 | Section heading |
| `h2` | 30/1.2 | 20/1.3 | Subsection |
| `h3` | 24/1.3 | 17/1.4 | Card title |
| `h4` | 20/1.4 | 15/1.4 | Label heading |
| `body-lg` | 18/1.65 | 15/1.5 | Lead paragraph |
| `body` | 16/1.65 | 14/1.5 | Default |
| `body-sm` | 14/1.6 | 13/1.45 | Secondary |
| `caption` | 13/1.5 | 12/1.4 | Metadata |
| `overline` | 12/1.4, +0.08em, uppercase | 11/1.3 | Eyebrow labels |

Display sizes clamp fluidly between breakpoints so a hero never overwhelms a 390px screen.

### Rules

- **Measure: 60–75 characters** for body text. Long-form content is capped at `max-width: 68ch`, regardless of container width. This single rule does more for readability than any other.
- Line height rises as size falls — 1.05 for display, 1.65 for body.
- Two weights per family in normal use (400/600 body, 500/700 display). More weights is decoration.
- Never centre more than three lines of text.
- Headings never rely on colour alone for hierarchy.

---

## 3. Colour

### Token architecture

OKLCH throughout, because it is perceptually uniform: a lightness step produces the same visual step at every hue, so a generated scale stays even and contrast ratios behave predictably. Hex does not do this.

The brand is a small number of variables:

```css
:root {
  /* ─ Brand inputs — replace when the real palette arrives ─ */
  --brand-hue: 152;          /* placeholder */
  --brand-chroma: 0.11;
  --neutral-hue: 60;         /* warm neutrals, public */
  --neutral-chroma: 0.006;

  /* ─ Generated scales ─ */
  --accent-50 … --accent-950;
  --neutral-0 … --neutral-1000;

  /* ─ Semantic tokens: what components actually reference ─ */
  --color-bg;            --color-surface;       --color-surface-raised;
  --color-border;        --color-border-strong;
  --color-fg;            --color-fg-muted;      --color-fg-subtle;
  --color-accent;        --color-accent-fg;     --color-accent-hover;
  --color-success; --color-warning; --color-danger; --color-info;
  --color-focus-ring;
}
```

**Components reference semantic tokens only.** No component contains a raw colour value. When the real palette arrives, the change is the four brand inputs at the top — not a refactor.

Admin overrides `--neutral-hue` to a cool value and nothing else. That single variable is the entire difference in temperature between the two experiences.

### Accent placeholder

A deep, slightly desaturated green is the placeholder: it reads as growth and trust without the saturated "eco-brand" look, holds contrast well against white, and is distinct from the red/orange most Indian NGO sites default to. **It is a placeholder and is labelled as one everywhere it appears.**

> **Phase 1 correction.** `--primary` maps to accent step **700**, not 600.
> White text on step 600 measures ~4.0:1, which fails AA for normal text — and
> the first casualty was the Donate button. Caught by an automated axe contrast
> check; fixed with a one-line token change and no component edits, which is the
> token architecture working as intended. See `phase-1.md` §3.2.

### Rules

- One accent. Status colours (success, warning, danger, info) are semantic only and never decorative.
- **Colour never carries meaning alone.** Every status pairs a colour with an icon and a label — required for accessibility and for the 8% of men with colour vision deficiency, who are well represented among donors.
- Progress bars use the accent, with the percentage always present as text.
- Body text on background: **minimum 7:1** (AAA) even though AA requires 4.5:1. The public site is read on cheap phones in bright daylight; the extra headroom is free.
- Dark mode ships for admin. The public site is light-first; a dark variant is optional and must not compromise photography.

---

## 4. Spacing, radius, elevation

### Spacing — 4px base

`0.5(2) · 1(4) · 1.5(6) · 2(8) · 3(12) · 4(16) · 5(20) · 6(24) · 8(32) · 10(40) · 12(48) · 16(64) · 20(80) · 24(96) · 32(128)`

Section rhythm: **96–128px** public, **16–24px** admin. That difference alone reads as two products.

### Radius
`sm 4 · md 6 · lg 8 · xl 12 · 2xl 16 · full`

Public defaults to `lg`; admin to `md`. **Nothing larger than `2xl`** — the pill-shaped-everything look is exactly the template aesthetic being avoided.

### Elevation
`none` · `sm` (1px border + faint shadow, resting cards) · `md` (dropdowns, popovers) · `lg` (modals, drawers) · `focus` (a 2px ring at 2px offset).

**Cards at rest have a border, not a shadow.** A grid of shadowed cards is the single strongest signal of a template.

---

## 5. Core components

Built on shadcn/ui primitives, restyled to the tokens above. shadcn is a starting point, not the finished look.

### Buttons

| Variant | Use | Appearance |
|---|---|---|
| `primary` | **Donate Now** and one main action per view | Filled accent, white text |
| `secondary` | Become a Volunteer, secondary actions | Outline, accent text |
| `ghost` | Tertiary, toolbars | Text only, background on hover |
| `destructive` | Delete, void, suspend | Danger fill, always confirmation-gated |
| `link` | Inline navigation | Underlined text |

Sizes `sm 32 · md 40 · lg 48 · xl 56` (public hero CTA).
Minimum touch target **44×44px** on all touch devices, achieved with padding rather than by reducing text.
Loading state shows a spinner **and keeps the label**, with the width locked so the layout does not shift. A button whose text vanishes into a spinner leaves the user unsure what they clicked.
Disabled buttons always have a visible reason nearby — never a dead control with no explanation.

### Inputs, selects, textareas

- Labels are **always visible above the field**. Placeholder-as-label fails the moment the user starts typing, and fails screen readers entirely.
- Helper text below, error replacing helper text with an icon.
- Error state: red border, an icon, and specific text — *"Enter a 10-digit mobile number"*, never *"Invalid input"*.
- Required fields marked with an asterisk plus a legend; optional fields marked "(optional)" where that is clearer.
- 44px minimum height on touch.
- Errors appear on blur, not on every keystroke. Correction is validated live so the user sees the moment they are right.
- Numeric inputs use `inputmode="numeric"`; phone uses `type="tel"`; amounts show the ₹ prefix inside the field.

### Cards

Border-defined, `lg` radius, `sm` elevation on hover only for interactive cards. Optional media, header, body, footer. Interactive cards get the whole surface as the hit area, with an inner button that stops propagation.

### Badges

`neutral · success · warning · danger · info · accent`. Always icon plus text. Campaign statuses, payment states, volunteer states.

### Tabs, tables, modals, drawers

- **Tabs** — underline style, keyboard-navigable with arrow keys, state in the URL so a tab is linkable.
- **Tables** (admin) — sticky header, zebra off by default (borders are enough), **tabular numerals**, sortable headers with a clear indicator, row selection, sticky first column when scrolling horizontally. On mobile, tables become stacked cards; a table forced into 390px is unreadable.
- **Modals** — focus trapped, Escape closes, backdrop click closes non-destructive dialogs only, focus returns to the trigger, `aria-labelledby` and `aria-describedby` set. Never for a long form — that is a page or a drawer.
- **Drawers** — side (admin filters, detail panes) or bottom (mobile donation summary). Bottom sheets support drag-to-dismiss with a visible grabber.

### Alerts and toasts

Alerts are inline and persistent. Toasts are transient, top-right on desktop and bottom on mobile, 5s auto-dismiss (errors persist until dismissed), stacking to a maximum of three, and announced via `aria-live`.

**Never a toast for a payment outcome.** Payment results get a page (`/donate/status/[reference]`), because a donor who misses a 5-second toast has no way to recover the information.

### Progress

- Bar with the percentage as text beside it, plus absolute figures.
- `role="progressbar"` with `aria-valuenow`, `valuemin`, `valuemax`.
- Over 100% renders honestly as over-subscribed rather than clamping to full.
- **No count-up animation on scroll** — decorative, distracting, and it makes a real number feel like a sales device.

---

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

| Token | Duration | Curve | Use |
|---|---|---|---|
| `instant` | 100ms | ease-out | Hover, focus |
| `fast` | 150ms | ease-out | Toggles, tabs |
| `base` | 200ms | ease-in-out | Dropdowns, accordions |
| `slow` | 300ms | ease-in-out | Modals, drawers |
| `deliberate` | 400ms | custom ease | Page transitions (public only) |

Rules: motion communicates a state change or spatial relationship, never decorates. Nothing animates on scroll except lazy-loaded images fading in. No parallax. No counter animations.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

This is not optional. Vestibular disorders are real and common, and the setting exists to be honoured.

---

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
