# Sailent Foundation — Master Design System

> **AUTHORITY NOTICE:** This document is the authoritative Master Design System for the Sailent Foundation platform.
> It unifies the project rules from `AGENTS.md`, the production token definitions from `packages/ui/src/styles/tokens.css`, and UI/UX design intelligence.
> When building or refactoring a specific page, first check `design-system/sailent-foundation/pages/[page-name].md`. If that file exists, its rules **override** this master file. Otherwise, follow the rules below strictly.

---

**Project:** Sailent Foundation  
**Organisation:** Indian NGO (registration details as entered in Admin → Settings; INR-only, one-time donations)  
**Architecture:** Next.js 15 App Router, React 19, Tailwind CSS v4 (`@utility`, OKLCH tokens), Radix primitives  
**Last Updated:** 2026-10-12  

---

## 1. Visual Direction & Core Principles

### Editorial, Not Promotional
The public website presents the dignity and reality of humanitarian work. It is styled closer to a documentary photo essay or an editorial journal than a generic SaaS product. Photographs of actual community work carry the emotional weight; the user interface stays clean, disciplined, and unobtrusive.

### Core Design Principles
1. **Photography Leads:** High-fidelity real imagery at true proportions. No generic stock photos, no abstract 3D floating shapes, and no decorative illustrations where real impact photography belongs.
2. **Typography Does the Heavy Lifting:** A disciplined editorial hierarchy (Manrope headings + Inter body) establishes clear visual order. Color is never used as an excuse for poor typographical structure.
3. **Scarcity of Action Color:** Brand Orange (`#EB6A1F`) is reserved strictly for action: *Donate Now*, *Volunteer*, *Register*. A page with orange everywhere is a page where nothing stands out.
4. **Restrained Elevation:** Cards at rest feature a delicate tinted border (`#fbe8d8`) and soft, tailored dual-layer shadows. Heavy drop-shadow grids are strictly forbidden.
5. **Functional Motion:** Micro-interactions reinforce user intent without delaying interactions. All animations strictly respect `prefers-reduced-motion`.
6. **Numbers Are Earned:** Every public figure and statistic must be backed by live database records. No fabricated vanity metrics or synthetic counters.

---

## 2. Two Experiences, One System Architecture

The platform serves two distinct audiences with unified token primitives:

| Dimension | Public Site (`:root`) | Admin Console (`[data-surface="admin"]`) |
|---|---|---|
| **Atmosphere** | Warm, trustworthy, human, editorial | Calm, operational, highly efficient |
| **Neutrals** | Cool navy-tinted neutral (`--neutral-hue: 250`) | Cool technical neutral (`--neutral-hue: 255`) |
| **Page Surface** | Soft off-white `#F7F9FC` (`--background`) | Crisp light grey `var(--neutral-100)` |
| **Header Surface** | Pure white `oklch(1 0 0)` (`--surface`) | Pure white `oklch(1 0 0)` (`--surface`) |
| **Footer Surface** | Pure white `#FFFFFF` (`--surface`) with subtle top border | Pure white `oklch(1 0 0)` (`--surface`) |
| **Density Rhythm** | Generous: `section-y` (64–128px), `band-y` (32–44px) | Dense: 16–24px padding, tight tables |
| **Typography** | Manrope Display (Headings) + Inter (Body) | Manrope (Main Titles) + Inter (All Admin Headings) |
| **Base Text Size** | 16px (`1rem`) | 14px (`0.875rem`) |
| **Corner Radius** | `0.5rem` (`rounded-lg` / `rounded-2xl` on cards) | `0.375rem` (`rounded-md` / `rounded-lg`) |
| **Action Speed** | 200–300ms smooth cubic-bezier transitions | 100–150ms immediate transitions |

---

## 3. Brand Colors & Semantic Color Tokens

### 3.1 The Three Core Brand Colors
- **Navy Identity & Text (`#102A43` / `oklch(0.255 0.045 250)`):** Delivers authority, readability, and permanence. Contrast ratio on white is **14.6:1**.
- **Trust Blue (`#1976D2` / `oklch(0.545 0.152 250)`):** Used for informational elements, secondary links, and exploration cues. Contrast ratio on white is **4.60:1**.
- **Action Orange (`#EB6A1F` / `oklch(0.6721 0.1784 45.43)`):** Reserved for primary conversion actions (donations, checkout, volunteer signups).

### 3.2 Action Orange Contrast Matrix (Authoritative Rules)
White text on `#EB6A1F` produces a contrast ratio of only **3.18:1**, failing WCAG AA, so filled orange carries a **navy** label (owner, 2026-10-21). The system enforces strict role-based orange tokens:

| Token | Value / OKLCH | Foreground Pairing | Contrast Ratio | Application |
|---|---|---|---|---|
| `--primary` | `#EB6A1F` / `oklch(0.672 0.178 45.4)` (= `--cta`) | **Navy (`#0F172A`)** | **5.62:1** (AA; owner decision 2026-10-21, `AGENTS.md` §11.12) | Filled buttons, active pills, badges (`bg-primary`) |
| `--primary-hover` | `#F07A33` | **Navy (`#0F172A`)** | **6.41:1** (Passes AA) | Hover state of `bg-primary` fills |
| `--primary-active` | `#EB6A1F` (= `--cta`) | **Navy (`#0F172A`)** | **5.62:1** (Passes AA) | Pressed/active button fills |
| `--cta-active` | `#B3450E` / `oklch(0.534 0.155 41.7)` | **White (`#FFFFFF`)** | **5.56:1** (Passes AA) | A darker fill for white text where one is needed |
| `--cta` | `#EB6A1F` / `oklch(0.672 0.178 45.4)` | **Navy (`#102A43`)** | **4.61:1** (Passes AA) | Campaign card Donate Now, active rings, progress bars |
| `--cta-hover` | `#F57C3A` / `oklch(0.715 0.168 46.4)` | **Navy (`#102A43`)** | **5.46:1** (Passes AA) | Hover state of navy-label `--cta` fills |
| `--cta-ink` / `--primary-ink` | `#B74500` / `oklch(0.540 0.164 45.4)` | Sits on light grounds | **4.52:1+** (Passes AA) | Orange text, eyebrows, category labels, inline links (`text-primary`) |
| `--cta-glow` | `#EB6A1F` | Non-text graphics | **3.18:1** (Passes UI 3:1) | Decorative icons, status rings, SVG strokes |
| `--cta-light` | `oklch(0.956 0.049 86.4)` | `--accent-950` / `--cta-ink` | >7:1 | Light badge backgrounds, icon washes |
| `--cta-soft` | `oklch(0.980 0.016 73.7)` | `--accent-950` | >12:1 | Selected row highlights, warm card tints |

### 3.3 Semantic Color Tokens

```css
:root {
  /* Surface and Grounds */
  --background: #f7f9fc;                         /* Default soft off-white background */
  --foreground: var(--accent-950);               /* #102A43 Deep navy body copy */
  --surface: oklch(1 0 0);                       /* Pure white #FFFFFF cards, elevated surfaces and footer */
  --surface-foreground: oklch(0.205 0.008 250);  /* Dark neutral text */
  --surface-warm: #fdf5ec;                       /* Occasional warm cream section (testimonials, CTA) */
  --surface-tint: #f0f4f8;                       /* Subtle cool tint band */
  --surface-sunken: oklch(0.967 0.008 250);      /* Inset sections */

  /* Neutral Borders and Inputs */
  --border: oklch(0.922 0.008 250);              /* Neutral container border */
  --border-strong: oklch(0.870 0.008 250);       /* Enhanced boundary border */
  --border-card: #fbe8d8;                        /* Delicate warm peach card border */
  --input: oklch(0.922 0.008 250);               /* Input default border */
  --ring: var(--accent-600);                     /* Standard keyboard focus ring */

  /* Text Muting */
  --muted: oklch(0.967 0.008 250);               /* Muted container background */
  --muted-foreground: oklch(0.439 0.008 250);    /* Secondary metadata copy */
  --muted-foreground-strong: oklch(0.269 0.008 250); /* Copy over photos and hero washes */

  /* Semantic Status Tokens (Contrast-guaranteed on subtle grounds) */
  --success: oklch(0.470 0.130 150);             /* Darkened for 4.5:1 text on badge */
  --success-foreground: oklch(0.990 0 0);
  --success-subtle: oklch(0.960 0.030 150);
  
  --warning: oklch(0.720 0.150 75);
  --warning-foreground: oklch(0.200 0.030 75);
  --warning-subtle: oklch(0.960 0.040 75);

  --destructive: oklch(0.480 0.190 27);
  --destructive-foreground: oklch(0.990 0 0);
  --destructive-subtle: oklch(0.960 0.030 27);

  --info: oklch(0.480 0.140 250);
  --info-foreground: oklch(0.990 0 0);
  --info-subtle: oklch(0.960 0.030 250);
}
```

### 3.4 Decorative Wash Inks
For cause badges, stat disc icons, and category marks:
- **`--wash-coral`** (`oklch(0.96 0.025 50)`) + **`--wash-coral-ink`** (`oklch(0.60 0.22 32)`): Campaign card Donors & Goal icons.
- **`--wash-mint`** (`oklch(0.945 0.04 160)`) + **`--wash-mint-ink-strong`** (`oklch(0.48 0.15 155)`): Raised stat & View All pills (5.08:1 contrast).
- **`--wash-blue`** (`oklch(0.945 0.035 250)`) + **`--wash-blue-ink`** (`oklch(0.54 0.18 255)`): Education & Water causes.
- **`--wash-amber`** (`oklch(0.95 0.045 70)`) + **`--wash-amber-ink`** (`oklch(0.56 0.17 45)`): Nutrition & Food drives.

---

## 4. Typography & Text Hierarchy

### 4.1 Type Families
- **Display & Headings:** `Manrope` (`--font-display`), geometric yet friendly humanist qualities. Weight 700 for Display and H1/H2; weight 600 for H3–H6.
- **Body & Interface:** `Inter` (`--font-sans`), exceptional clarity and hinting at small screen sizes with full Devanagari compatibility.
- **Figures & Financials:** `font-variant-numeric: tabular-nums` (`[data-numeric]`, tables). Proportional digits are strictly forbidden for currency, donation tallies, and progress indicators.
- **Decorative Script:** `--font-script` (cursive accent, used minimally for editorial warmth).

### 4.2 Public Scale & Fluid Tokens

| Token | Size Range (Clamp / CSS) | Line Height | Letter Spacing | Target Application |
|---|---|---|---|---|
| `--text-display-lg` | `clamp(2.5rem, 1.8rem + 3.5vw, 3.75rem)` | `1.05` | `-0.03em` | Primary editorial hero statements |
| `--text-display-hero`| `clamp(2rem, 1.4rem + 2.2vw, 3.125rem)` | `1.08` | `-0.028em` | Homepage hero (3-column layout) |
| `--text-display` | `clamp(2rem, 1.5rem + 2.5vw, 3rem)` | `1.10` | `-0.025em` | Impact report and major landing headers |
| `--text-h1` | `clamp(1.75rem, 1.4rem + 1.75vw, 2.375rem)` | `1.15` | `-0.02em` | Interior page titles (About, Campaigns, Events) |
| `--text-section` | `clamp(1.375rem, 1.15rem + 0.85vw, 1.625rem)` | `1.20` | `-0.015em` | **Band Headings** (Featured Campaigns, Stories) |
| `--text-h2` | `clamp(1.5rem, 1.3rem + 1vw, 1.875rem)` | `1.20` | `-0.015em` | Major section breaks |
| `--text-h3` | `1.5rem` (`24px`) | `1.30` | `0` | Primary card headers, modal titles |
| `--text-h4` | `1.25rem` (`20px`) | `1.40` | `0` | Subsection headings, campaign card titles |
| `--text-body-lg` | `1.125rem` (`18px`) | `1.65` | `0` | Lead paragraphs and introduction copy |
| `--text-body` | `1rem` (`16px`) | `1.65` | `0` | Standard body paragraphs, form fields |
| `--text-body-sm` | `0.875rem` (`14px`) | `1.60` | `0` | Secondary descriptions, card meta, tooltips |
| `--text-caption` | `0.8125rem` (`13px`) | `1.50` | `0` | Helper text, timestamps, status labels |
| `--text-overline` | `0.75rem` (`12px`) | `1.40` | `+0.08em` | Eyebrow tags (Inter 600, uppercase) |

### 4.3 Typography Rules
- **Line Measure:** Long-form paragraphs must always be capped at `prose-measure` (`max-width: 68ch`).
- **Headings Balance:** Headings use `text-wrap: balance` to prevent awkward orphaned words.
- **Alignment:** Never center more than 3 consecutive lines of text.

---

## 5. Spacing, Containers & Responsive Breakpoints

### 5.1 Breakpoint Scale
- **`xs` (320px / `20rem`):** Small mobile viewports (iPhone SE).
- **`sm` (480px / `30rem`):** Standard mobile viewports.
- **`md` (768px / `48rem`):** Tablets, portrait iPads.
- **`lg` (1024px / `64rem`):** Small desktops, landscape tablets.
- **`xl` (1280px / `80rem`):** Standard laptops and desktop screens.
- **`2xl` (1536px / `96rem`):** High-resolution monitors.

### 5.2 Container Widths
- **`container-page` (`90rem` / 1440px):** Standard maximum width for public headers, banners, card rails, and footers. Side gutters adapt: `px-4` on mobile, `px-6` on tablet, `px-10` on desktop.
- **`container-wide` (`82.5rem` / 1320px):** Content-dense band containment.
- **`container-content` (`45rem` / 720px):** Focus prose measure for policy documents, blog articles, and receipts.

### 5.3 Vertical Rhythm Utilities
- **`section-y`:** Generous public vertical padding (`py-16` mobile, `py-24` tablet, `py-32` desktop).
- **`band-y`:** Compact rhythm for homepage stacked rails (`py-8` mobile, `py-10` tablet, `py-11` desktop).

---

## 6. Component Specifications

### 6.1 Buttons
The Button primitive (`packages/ui/src/primitives/button.tsx`) implements strict hierarchical semantics, accessible contrast (WCAG AA >= 4.5:1) except the primary fill's owner-accepted 3.18:1 (§3.2), and consistent pill-radius proportions:

- **`variant="primary"`:**
  - Classes: `bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active active:text-primary-active-foreground shadow-[0_2px_8px_rgba(235,106,31,0.22)] hover:shadow-[0_4px_14px_rgba(235,106,31,0.32)] active:shadow-xs active:translate-y-px motion-reduce:transform-none focus-visible:outline-primary`
  - Style: Brand orange `#EB6A1F` (`--primary` = `--cta`) fill with a navy label (`#0F172A`, 5.62:1, AA; owner decision 2026-10-21, `AGENTS.md` §11.12). Lighter orange on hover (`#F07A33`, 6.41:1) and `#EB6A1F` pressed, so the label passes in every state. `#C5531A` is retired.
  - Usage: Flagship conversion actions only (*Donate Now*, *Submit Donation*, *Register*).
- **`variant="secondary"`:**
  - Classes: `border-2 border-info-action bg-surface text-info-action hover:bg-info-action/10 active:bg-info-action/20 active:translate-y-px motion-reduce:transform-none shadow-xs focus-visible:outline-info-action`
  - Style: Pure white/surface background with trust-blue border and text (`#1976D2`, 4.60:1 contrast).
  - Usage: Secondary actions (*Watch Our Story*, *Become a Volunteer*, alternative pathways).
- **`variant="ghost"` / `variant="tertiary"`:**
  - Classes: `bg-transparent text-foreground hover:bg-muted active:bg-muted/80 active:translate-y-px motion-reduce:transform-none focus-visible:outline-ring`
  - Usage: Quiet actions, toolbars, icon triggers, quiet back buttons.
- **`variant="dark"`:**
  - Classes: `bg-accent-950 text-white hover:bg-accent-900 active:bg-accent-850 active:translate-y-px motion-reduce:transform-none shadow-sm focus-visible:outline-accent-950 dark:bg-accent-900 dark:hover:bg-accent-850`
  - Style: Deep navy background (`#102A43`) with pure White text (14.4:1 contrast).
  - Usage: High-contrast selected contexts.
- **`variant="destructive"`:**
  - Classes: `bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/95 active:translate-y-px motion-reduce:transform-none shadow-sm focus-visible:outline-destructive`
  - Usage: Always confirmation-gated (cancelling registrations, deletions).
- **`variant="info"`:**
  - Classes: `bg-info-action text-info-action-foreground hover:bg-info-action-hover active:bg-accent-800 active:translate-y-px motion-reduce:transform-none shadow-sm focus-visible:outline-info-action`
  - Usage: Trust and exploratory information (*Learn More*, *Read Stories*, *View Details*).
- **Consistent Size Scale:**
  - `sm`: 36px (`h-9`), `px-4`, text `xs`/`sm`, font semibold (compact/admin).
  - `md`: 44px (`h-11`), `px-6`, text `sm`/`0.9375rem`, font semibold (standard).
  - `lg`: 48–52px (`h-12 sm:h-12.5`), `px-7 sm:px-8`, text `0.9375rem sm:text-base` (~16px), font semibold (primary CTAs).
  - `xl`: 56px (`h-14`), `px-9`, text `base sm:text-lg`, font semibold (prominent hero CTAs).
  - `icon`: 44×44px (`size-11`) circular touch target.

### 6.2 Cards & Elevation System
Cards use the unified elevation system defined in `tokens.css`:

```css
/* Card Elevation Variables */
--border-card: #fbe8d8;
--transition-card: 200ms var(--ease-out-soft);
--shadow-card: 0 4px 12px rgba(20, 40, 60, 0.04), 0 12px 28px rgba(235, 106, 31, 0.06);
--shadow-card-hover: 0 8px 20px rgba(20, 40, 60, 0.07), 0 16px 36px rgba(235, 106, 31, 0.10);
--shadow-elevated: 0 4px 14px rgba(20, 40, 60, 0.04), 0 12px 32px rgba(20, 40, 60, 0.08);
--shadow-featured: 0 4px 12px rgba(20, 40, 60, 0.04), 0 14px 34px -8px rgba(235, 106, 31, 0.16);
```

**Card Variants:**
- **`standard` (`card-standard`):** Background `--surface`, 1px border `--border-card`, `--shadow-card`. Used for standard cards.
- **`interactive` (`card-interactive`):** Standard rest appearance, smoothly translates `-2.5px` on hover and deepens to `--shadow-card-hover`.
- **`elevated` (`card-elevated`):** Deeper shadow for floating summary widgets and donation payment carts.
- **`featured` (`card-featured`):** Subtle warm ambient glow (`rgba(235, 106, 31, 0.16)`) for spotlight campaigns.
- **`flat` (`card-flat`):** Visually quiet, 1px border `--border`, no shadow. Reserved for dense admin views and tabular cards.

### 6.3 Campaign Card Specification (Authoritative Decision)
As approved in `AGENTS.md` §11:
1. **Photograph:** Full 4-corner rounded container, with:
   - Filled status badge top-left (e.g., Active / Urgent).
   - White heart (save/favorite) button top-right with `heart-pop` micro-interaction.
   - Category badge bottom-left (icon + cause name on translucent pill).
2. **Title:** Manrope Bold (18px, `text-h4`), clamped to exactly 2 lines.
3. **Stat Grid (3 Columns with Dividers):**
   - Column 1: Donors (Peach disc `--wash-coral` with solid icon, value, label).
   - Column 2: Raised (Mint disc `--wash-mint` with solid rupee mark, value in INR, label).
   - Column 3: Goal (Peach disc `--wash-coral` with target icon, value in INR, label).
4. **Progress Bar:** Brand orange bar with `--rise-delay` animation and dual captions (*N% Complete* and *N% to go*).
5. **CTA:** Pill-shaped *Donate Now* button in Navy on `#EB6A1F`.

### 6.4 Inputs & Form Elements
- **Height & Targets:** Minimum 44px height (`h-11`) with `rounded-lg`.
- **Labels:** Explicit `<Label>` element is mandatory. Floating or disappearing placeholder-as-label patterns are strictly forbidden.
- **Focus Ring:** Border transitions to Brand Orange (`#EB6A1F`) with a 2px offset ring (`focus-visible:outline-primary`).
- **Error State:** Border becomes `--destructive` (`#DC2626`) with `aria-invalid="true"` and an adjacent error message linked via `aria-describedby`.

### 6.5 Badges & Status Indicators
- **Rule:** Color never carries meaning alone. Every badge pairs an SVG icon with a text label.
- **Variants:** `neutral`, `accent`, `success`, `warning`, `destructive`, `info`, `outline`.
- **Size:** `text-caption font-medium` (`13px`) with `rounded-md px-2 py-0.5`.

### 6.6 Dialogs & Modals
- **Behavior:** Focus trapped inside modal, `Escape` key dismisses, background page marked inert, focus restores to trigger upon close.
- **Mobile Adaptability:** Full-screen on mobile (`inset-0`), centered and capped at 640px on desktop (`sm:max-w-[640px]`).
- **Backdrop:** Tinted navy overlay (`bg-neutral-950/50`) with subtle `backdrop-blur-[1px]`.

---

## 7. Accessibility, Focus States & Motion Behavior

### 7.1 Contrast Guarantees (WCAG 2.2 AA / AAA)
- **Normal Body Text:** Minimum 4.5:1 against any ground (Navy `#102A43` on white is 14.6:1; on tinted page is 13.8:1).
- **Public Hero & Mission Copy:** Minimum 7.0:1 (AAA) for high readability outdoors on mobile devices.
- **Orange Text:** Must use `--primary-ink` (`#B74500`) to guarantee >=4.5:1 contrast against light and tinted surfaces.

### 7.2 Focus Visibility
- Universal `:focus-visible` ring across all interactive controls:
  ```css
  :focus-visible {
    outline: 2px solid var(--color-ring);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }
  ```
- Anchored headings clear sticky headers with `scroll-padding-top: 5rem` so focus is never obscured.
- Accessible Skip Link (`.skip-link`) positioned at top-left, reveals on `:focus`.

### 7.3 Motion & Reduced-Motion Protection
Vestibular safety is strictly enforced:
- **Global Opt-Out:**
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```
- **Marquee & Rails:** CSS marquee halts and renders a standard static wrapped row. Auto-playing rails include the keyboard-only `RailPauseToggle` (WCAG 2.2.2).
- **Hover Lift:** Hover translations (`translateY(-2.5px)`) are guarded by `@media (hover: hover)` to prevent sticky hovers on touchscreens.

---

## 8. Specific Domain & Flow Guidelines

### 8.1 Public Pages & Campaign Listing
- **Hero Banner:** Editorial layout highlighting real community impact.
- **Rails:** Featured Campaigns and Testimonials autoplay smoothly with no visible arrows and no visible pause button, but with hidden keyboard controls intact.
- **Cause Browsing:** Cause filter tiles (Water, Education, Healthcare, Hunger) sit above "Who We Are".
- **Navigation:** Clear breadcrumbs and intuitive routing; no "Impact" link in header nav or footer (AGENTS.md §11).

### 8.2 Donation Flow & Checkout
- **Currency Standard:** Indian Rupee (INR) only (`₹`). All money calculations are stored and processed in integer paise (`bigint`).
- **Server-Side Pricing:** The client sends only campaign ID, product IDs, quantities, and an optional custom amount. Prices are resolved server-side.
- **One-Time Only:** No recurring gifts, mandates, or subscriptions.
- **80G wording:** A receipt is not an 80G certificate; relief is claimed separately through Form 10BE, issued by the Income Tax Department after the annual filing. No eligibility badge or "tax exempt" claim (`AGENTS.md` §10).
- **Refunds:** No refund wording at checkout until a refund/cancellation policy is published (`AGENTS.md` §10).

### 8.3 User / Donor Dashboard
- **Surface:** Donor account portal with authenticated session cookies.
- **Components:** Giving history timeline, receipts (immutable, gapless per FY; printable — a PDF is not built yet), event tickets, volunteer registrations.
- **Data Table:** Tabular numerals for monetary amounts, clear receipt download action.

### 8.4 Admin Interface (`[data-surface="admin"]`)
- **Visual Feel:** Cool neutrals (`--neutral-hue: 255`), high density (16–24px spacing), 14px base font.
- **Security & RBAC:** Staff actions gated by `@RequirePermission`. Sensitive actions enforce re-authentication within 5 minutes (`@Sensitive()`).
- **Data Tables:** Dense sorting, batch actions, search filters, audit logging display.

---

## 9. Verification & Pre-Delivery Checklist

Before approving any UI deliverable:
- [ ] No emojis used as structural UI icons (use Lucide / Phosphor SVG icons).
- [ ] Primary button uses Navy text on Brand Orange (`#EB6A1F`) with 4.61:1 contrast.
- [ ] Orange text uses `--primary-ink` (`#B74500`) to guarantee >=4.5:1 contrast.
- [ ] Page background is tinted blue-grey while header is pure white.
- [ ] All clickable items have `cursor-pointer` and proper hover feedback.
- [ ] Hover transforms are protected by `@media (hover: hover)`.
- [ ] `prefers-reduced-motion` is honored across all animated elements.
- [ ] Focus rings are visible on keyboard navigation without layout shift.
- [ ] Touch targets are at least 44×44px on mobile devices.
- [ ] Tabular numerals (`tabular-nums`) are applied to all currency and numeric counters.
