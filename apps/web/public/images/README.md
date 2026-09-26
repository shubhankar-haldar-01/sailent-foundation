# Photography

Real photographs go here. Anything not supplied yet is drawn by
`components/media/media-frame.tsx`, which generates a deterministic placeholder
from a seed so the layout can be judged before the pictures exist.

## Slots the code looks for

| File                             | Used by                      | Shape                         |
| -------------------------------- | ---------------------------- | ----------------------------- |
| `sailent-foundation-banner.webp` | the homepage hero background | wide landscape, ~2.4:1 to 3:1 |

### Everything else: name the file after its seed

Any other picture on the site is drawn by `MediaFrame` from a **seed**, and the
content layer swaps in a real photograph the moment a file of that name exists
here. `.webp`, `.jpg`, `.jpeg` and `.png` are all tried, in that order.

The seed is in the markup — inspect the placeholder and read its
`data-media-placeholder` attribute — or derive it: `story-<slug>`,
`campaign-<slug>`, `event-<slug>`, `team-<slug>`.

Current story covers, for example:

| File                                          | Story                          |
| --------------------------------------------- | ------------------------------ |
| `story-sunita-finished-school.jpg`             | A New Beginning for Meera      |
| `story-a-healthier-season-for-ramesh.jpg`      | A Healthier Tomorrow for Ramesh |
| `story-from-training-to-a-shop-of-her-own.jpg` | From Struggle to Self-Reliance |

Story covers are shown in an upright 3:4 frame, so a portrait crop works best.
Drop the file in, restart the server, and it appears.

A slot is **optional**. `publicAssetExists` (see `lib/media/public-asset.ts`)
checks for the file on the server before rendering, so a missing photograph
falls back to the placeholder rather than showing a broken image. Drop the file
in, restart the server, and it appears — no code change.

## What the hero photograph needs

- **Landscape, and wide.** The band is roughly 3:1 at desktop and much taller in
  proportion on a phone, so the crop moves. `object-[62%_50%]` holds the
  right-hand side of the frame as the viewport narrows.
- **Its subject right of centre.** The left of the band carries the headline
  under an opaque cream wash; anything important on that side is covered.
- **Quiet on the left.** Sky, landscape, or open ground reads best under the
  wash.
- 2400px wide or more, so it stays sharp on a 2× display at full width. Next.js
  re-encodes it to AVIF/WebP and serves per-viewport sizes, so file size at rest
  matters less than resolution.

## Permissions

Only publish photographs the organisation has the right to use, and only
photographs of identifiable people with their consent — for children, their
guardian's. That is not a formality here: the same rule is enforced in the
database for success stories (`consent_obtained`), and it should not be looser
for the picture at the top of the homepage.
