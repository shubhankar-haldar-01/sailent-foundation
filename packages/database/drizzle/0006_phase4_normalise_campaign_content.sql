-- Move campaign FAQs, gallery and updates out of JSON and into tables.
--
-- Each entry needed things a JSON array cannot give it: a stable id to edit or
-- delete by, its own published flag, its own display order, and — for gallery
-- images — a foreign key to the media record that holds the storage key.
--
-- THE DATA IS MIGRATED BEFORE THE COLUMNS ARE DROPPED. Re-seeding would also
-- recreate it, because everything currently in these columns is demo content,
-- but a migration that discards rows on the assumption that nobody has written
-- real ones is a habit worth not forming.

-- FAQs → `faqs`, keyed to the campaign that owned them.
INSERT INTO faqs (question, answer, context_type, context_id, display_order, is_published)
SELECT
  left(entry ->> 'question', 300),
  entry ->> 'answer',
  'campaign',
  c.id,
  (ordinality * 10)::int,
  -- Previously-embedded FAQs were visible wherever their campaign was, so they
  -- carry over as published. Anything else would silently remove content from
  -- a live page.
  true
FROM campaigns c
CROSS JOIN LATERAL jsonb_array_elements(coalesce(c.faqs, '[]'::jsonb)) WITH ORDINALITY AS t(entry, ordinality)
WHERE entry ->> 'question' IS NOT NULL
  AND entry ->> 'answer' IS NOT NULL;
--> statement-breakpoint

-- Updates → `impact_updates`, which already carries every field a campaign
-- update needs: title, description, date, location, media, statistics and a
-- publication state. A second table would have duplicated all of it.
INSERT INTO impact_updates (campaign_id, program_id, title, description, impact_date, status, is_public, published_at)
SELECT
  c.id,
  c.program_id,
  left(entry ->> 'title', 240),
  entry ->> 'body',
  coalesce((entry ->> 'publishedAt')::timestamptz::date, current_date),
  'published',
  true,
  coalesce((entry ->> 'publishedAt')::timestamptz, now())
FROM campaigns c
CROSS JOIN LATERAL jsonb_array_elements(coalesce(c.updates, '[]'::jsonb)) AS entry
WHERE entry ->> 'title' IS NOT NULL
  AND entry ->> 'body' IS NOT NULL;
--> statement-breakpoint

-- Gallery → `media` + `campaign_gallery`.
--
-- The old shape held a placeholder seed and alt text but never a storage key,
-- because no upload pipeline existed to produce one. A synthetic key is
-- derived from the seed so the row is well-formed and the image resolves to
-- the same deterministic placeholder it did before.
WITH entries AS (
  SELECT
    c.id AS campaign_id,
    coalesce(entry ->> 'seed', 'campaign-' || c.slug || '-' || ordinality) AS seed,
    coalesce(entry ->> 'alt', c.title || ' photograph') AS alt_text,
    entry ->> 'caption' AS caption,
    (ordinality * 10)::int AS display_order
  FROM campaigns c
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(c.gallery, '[]'::jsonb)) WITH ORDINALITY AS t(entry, ordinality)
),
inserted AS (
  INSERT INTO media (storage_key, url, alt_text, caption, mime_type, size_bytes, visibility)
  SELECT 'legacy/' || seed || '.jpg', NULL, left(alt_text, 300), left(caption, 300), 'image/jpeg', 1, 'public'
  FROM entries
  ON CONFLICT (storage_key) DO NOTHING
  RETURNING id, storage_key
)
INSERT INTO campaign_gallery (campaign_id, media_id, display_order, visibility)
SELECT e.campaign_id, m.id, e.display_order, 'public'
FROM entries e
JOIN media m ON m.storage_key = 'legacy/' || e.seed || '.jpg'
ON CONFLICT (campaign_id, media_id) DO NOTHING;
--> statement-breakpoint

ALTER TABLE "campaigns" DROP COLUMN "faqs";--> statement-breakpoint
ALTER TABLE "campaigns" DROP COLUMN "updates";--> statement-breakpoint
ALTER TABLE "campaigns" DROP COLUMN "gallery";
