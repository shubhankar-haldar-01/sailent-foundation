---
target: homepage screen
total_score: 23
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 3
target_identity: "file:/Users/shubhankarhaldar/Desktop/sailent-foundation/apps/web/src/app/(public)/page.tsx"
target_fingerprint: "sha256:8532f6224ebb24205a28e0c841194463ddc82509845e6a17da59b6a893a1e48e"
target_path: /Users/shubhankarhaldar/Desktop/sailent-foundation/apps/web/src/app/(public)/page.tsx
timestamp: 2026-10-23T17-46-31Z
slug: apps-web-src-app-public-page-tsx
closed: true
---
### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live aggregate numbers update accurately, but the hero banner lacks explicit interactive feedback (passive image link). |
| 2 | Match System / Real World | 4 | Real-world NGO conventions, natural Indian context (INR currency format, local cause categories). |
| 3 | User Control and Freedom | 3 | Featured rail can be paused or manually swiped, but the entire hero banner is a coarse single click area. |
| 4 | Consistency and Standards | 2 | Campaign cards look conflicting: Featured Rail cards strip funding progress for share icons, while Browse cards show full stats. |
| 5 | Error Prevention | 3 | Safe navigation links throughout; no destructive actions on the landing surface. |
| 6 | Recognition Rather Than Recall | 3 | Category pills feature clear recognizable icons and titles across causes. |
| 7 | Flexibility and Efficiency | n/a | Mode applicability: Persuade surface (public homepage); accelerators not applicable. |
| 8 | Aesthetic and Minimalist Design | 2 | Monotonous "cards-inside-cards" container stacking; redundant back-to-back campaign sections showing duplicate items. |
| 9 | Error Recovery | 3 | Category filtering provides clean fallback (`SearchX` state with alternate links) when zero campaigns match. |
| 10 | Help and Documentation | n/a | Mode applicability: Persuade landing page; standard footer contact/FAQ links serve support needs. |
| **Total** | | **23/32** | **Good (72%)** |

---

### Design Specificity Verdict

**LLM Assessment:**
The Sailent Foundation homepage has a welcoming, human, and empathetic foundation (warm typography, authentic photography of children and community workers, live database metrics). However, it suffers from two major structural vulnerabilities that weaken its brand authority:
1. **Hero Asymmetry & Passive Presentation:** The primary conversion zone uses a rasterized banner image where typography is baked in and no distinct, tactile call-to-action button exists. It behaves like a static promotional billboard rather than an interactive non-profit platform.
2. **Structural Redundancy:** Placing two campaign carousels/grids directly adjacent to one another ("Featured Campaigns" followed immediately by "Browse By Cause") with the exact same cards creates visual confusion and dilutes donor urgency.

**Deterministic Scan:**
Automated scan completed on `apps/web/src/app/(public)/page.tsx` and `apps/web/src/components/home`.
- Findings: 0 syntax/token lint violations found (`[]`).
- CSS token adherence: Follows design tokens and OKLCH color rules from `packages/ui`.

**Visual Overlays:**
Browser inspection executed on live instance `http://localhost:3000`. No script injection overlay was added to preserve clean production state.

---

### Overall Impression

The homepage conveys authenticity and warmth through authentic field imagery, live impact numbers, and clean typography. However, the conversion architecture is hindered by a passive hero image without an explicit CTA button, an unnecessary repetition of campaign cards between two adjacent sections, and an over-reliance on repetitive rounded card containers.

---

### What's Working

1. **Authentic Photography & Human Focus:** High-quality imagery of real community initiatives (education, flood relief, healthcare vans, animal welfare) creates immediate empathy and credibility.
2. **Transparent Live Proof:** The live database metrics ("6,232 lives already impacted across India", impact stats band) reinforce trust and organizational accountability without relying on unsubstantiated marketing claims.
3. **Responsive Micro-Interactions:** Keyboard-accessible autoplay rail pause toggles, card hover depth transitions, and category pill selection work smoothly.

---

### Priority Issues (Homepage Screen Ki Sabse Badi 3 Design Problems)

#### [P1] 1. Hero Section Lacks a Functional, High-Conversion Call-To-Action (Passive Baked Image)
- **What**: The entire above-the-fold hero area is a static raster image (`hero-banner-desktop.webp`) wrapped in a single `<Link href="/donate">`. Headline text and subcopy are baked into the image pixels, and there is no visible, high-contrast, tactile CTA button (e.g., "Donate Now" or "Support a Cause").
- **Why it matters**: In non-profit fundraising, 60%+ of donors make their giving decision above the fold. Users interpret the image as an informational banner rather than an interactive donation trigger. Furthermore, baked image text cannot be selected, loses sharpness on Retina screens, and harms accessibility.
- **Fix**: Convert the hero into a true responsive semantic component: keep the emotional background photo, use live HTML typography, and add an unmistakable, prominent brand-orange CTA button (`#EB6A1F` with white text, matching project design rules §11.12) accompanied by quick-action options (e.g., "Explore Campaigns" or "₹500 / ₹1,000 / ₹2,500" quick-give presets).
- **Suggested command**: `$impeccable bolder apps/web/src/components/home/hero-section.tsx`

#### [P1] 2. Redundant Duplicate Campaign Listings with Inconsistent Card Designs
- **What**: The homepage features two consecutive campaign blocks back-to-back: "Featured Campaigns" (carousel rail) and "Browse By Cause" (filter grid). Both show the exact same campaigns ("Relief for Flood-Affected Families", "Skills for a Brighter Future", "Keep the mobile health clinic running in Bastar"). Moreover, the card designs contradict each other: the Featured rail cards strip away funding progress (Raised, Goal, % bar) in favor of Facebook/WhatsApp share buttons, while the Browse cards right below display full metrics.
- **Why it matters**: Showing identical campaign items twice in a row wastes prime viewport real estate and causes cognitive fatigue. Stripping funding progress from the top Featured rail removes critical donation urgency and social proof at the very moment a user evaluates whether to give.
- **Fix**: Ensure all campaign cards follow the owner-approved card design (AGENTS.md §11.2) with Donors/Raised/Goal and progress bar. Clearly differentiate the sections: either turn the top section into a singular high-urgency "Spotlight Appeal" (or active emergency relief), or merge the category filters directly into the primary campaign explorer so users have one seamless discovery flow.
- **Suggested command**: `$impeccable distill apps/web/src/components/home/campaign-browser.tsx`

#### [P1] 3. Repetitive "Card-in-Card" Container Fatigue & Flat Visual Rhythm
- **What**: The entire homepage page layout relies on repetitive, stacked container cards with similar rounded corners (`rounded-[24px]` to `rounded-3xl`), light borders, and subtle shadows on a grey-blue canvas. Almost every single section (Hero, Featured Rail, Impact Stats, Browse by Cause, Who We Are, Stories/Events, Testimonials, Community CTA, Newsletter) is boxed inside similar card enclosures.
- **Why it matters**: When every section has the same container shape and visual weight, visual hierarchy flattens. The user's eye glides over sections without resting on key focal points (such as the core mission or direct donation asks). The floating impact ticker ("6,232 lives...") feels disconnected, floating in a narrow strip between large boxes.
- **Fix**: Break the monotonous rhythm by alternating section presentations: use full-bleed color transitions (e.g., crisp white bands contrasting with warm light-tinted or dark-navy bands), embed the impact proof bar directly into the hero composition, and vary content density between narrative storytelling (Who We Are / Stories) and transactional cards.
- **Suggested command**: `$impeccable layout apps/web/src/app/(public)/page.tsx`

---

### Persona Red Flags

- **Jordan (Confused First-Timer)**:
  - Red Flag: Lands on homepage looking to help. Sees the big hero graphic with text, looks for a button to click, finds none, and assumes it is just an announcement banner.
  - Red Flag: Scrolls down and sees "Make a Real Difference" cards without any information on how much money has been raised or what the goal is. Doesn't understand why there are share buttons before any progress info.
- **Casey (Distracted Mobile User)**:
  - Red Flag: On mobile (390px), the hero image scales down proportionally, making the baked headline and subtext tiny and hard to read.
  - Red Flag: Encounters two long lists of campaign cards one after another with the same campaigns, requiring excessive thumb-scrolling before reaching "Who We Are".
- **Riley (Methodical Donor / Stress Tester)**:
  - Red Flag: Notices that the campaigns shown in the top rail and the grid below are duplicates. Questions if the organization only has 4 active initiatives or if the platform is unfinished.

---

### Minor Observations

- The newsletter banner uses a peach/cream background that feels slightly disconnected from the cooler blue-grey background and navy tones used elsewhere.
- The "View All Campaigns" mint-pill button with green glow in the Featured rail introduces an extra accent color that competes with the brand orange CTA.
- The impact ticker avatars at the top are tiny and lack interactive donor attribution or tooltip context.

---

### Questions to Consider

- Should the Hero section feature an embedded Quick Donation widget (₹500, ₹1000, ₹2500) to allow one-click giving directly from the homepage?
- Would merging "Featured Campaigns" and "Browse by Cause" into a single, cohesive discovery section reduce page length while boosting donor engagement?
- Can we transition from repetitive boxed cards to an editorial, narrative layout that alternates between immersive full-width storytelling and clean campaign cards?
