# Page Specification: Public Campaigns & Listing

> **Scope:** `/campaigns`, `/campaigns/[slug]`, and Homepage Campaign Rails  
> **Inherits:** `design-system/sailent-foundation/MASTER.md`

---

## 1. Layout & Composition

### 1.1 Campaigns Listing (`/campaigns`)
- **Banner:** Full-width hero with editorial background, category search bar, and cause pill selectors.
- **Filter Controls:**
  - Status Menu: Active / Urgent / Completed / All.
  - Cause Filter: Education, Healthcare, Clean Water, Livelihood, Disaster Relief.
  - Sorting: Most Urgent, Recently Added, Most Funded.
- **Card Grid:**
  - Desktop (>=1024px): 3 columns (`grid-cols-3 gap-6`).
  - Tablet (768px–1023px): 2 columns (`grid-cols-2 gap-5`).
  - Mobile (<768px): 1 column with exact 6 cards rendered initially, followed by a "View More" button.

### 1.2 Campaign Detail Page (`/campaigns/[slug]`)
- **Main Fold (2 Columns on Desktop):**
  - Left Column (65% width): Campaign title, cause badge, gallery slider, campaign story/narrative (`prose-measure`), updates, and comments.
  - Right Column (35% width sticky): Floating donation widget (`card-elevated`) with donation goal progress, donor tally, quick-amount selection pills, product add-ons, and primary "Donate Now" CTA.
- **Campaign Gallery:** Integrated in "About This Campaign". Supports image lightbox and video embed; must never be removed.

---

## 2. Component Overrides & Specific Rules

### 2.1 Campaign Card Specification
- **Container:** `card-interactive` with `rounded-2xl`, `--border-card` (`#fbe8d8`), and hover elevation.
- **Photo Container:**
  - Aspect ratio: 16:10 or 4:3 with `object-cover`.
  - Top-Left: Status pill (e.g., Active) with icon and text.
  - Top-Right: Heart button with `heart-pop` micro-animation.
  - Bottom-Left: Cause badge on tinted glass pill.
- **Stats Row (3 Columns with Dividers):**
  - Donors: Peach disc (`--wash-coral`) with solid icon, count, "Donors" label.
  - Raised: Mint disc (`--wash-mint`) with INR icon, formatted currency, "Raised" label.
  - Goal: Peach disc (`--wash-coral`) with target icon, formatted currency, "Goal" label.
- **Progress Bar:** Brand Orange bar with dual captions (`N% Complete` and `N% to go`).
- **Action:** Full-width or right-aligned pill-shaped button (`rounded-full`) with Navy text on `#EB6A1F`.

---

## 3. Interaction & Animation Specs
- **Photo Hover:** `hover-zoom` (500ms cubic-bezier) applied to the image inside the card.
- **Card Hover:** `hover-lift` translates `-2.5px` and elevates box-shadow to `--shadow-card-hover`.
- **Keyboard Navigation:** Tabbing focuses cards sequentially with visible 2px focus ring.
