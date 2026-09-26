-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 8 — start the VOL- counter above the identifiers already issued.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- A NEW COUNTER DOES NOT KNOW WHAT CAME BEFORE IT.
--
-- `volunteer_sequences` was created empty, so the first approval drew 1 and
-- tried to mint VOL-2026-00001 — which already existed. The unique index
-- caught it, which is exactly what it is for, but the operator saw
-- "duplicate key value violates unique constraint" while approving somebody.
--
-- Volunteer identifiers predate this table: they were written directly by the
-- seed, and in a real deployment they would have been carried over from
-- whatever the organisation used before. The counter has to be told where the
-- existing run ends.
--
-- Parsed from the identifiers themselves rather than from a count, because a
-- count is wrong the moment a row has been deleted or an identifier was issued
-- out of band. The largest number actually used is the only safe answer.
-- ═══════════════════════════════════════════════════════════════════════════

--> statement-breakpoint
INSERT INTO volunteer_sequences (year, next_value)
SELECT
  -- The year encoded in the identifier, not the row's created_at: an identifier
  -- carried over from a previous system belongs to the year it was issued in.
  substring(volunteer_id from 'VOL-([0-9]{4})-')::smallint AS year,
  max(substring(volunteer_id from 'VOL-[0-9]{4}-([0-9]+)$')::int) + 1 AS next_value
FROM volunteers
WHERE volunteer_id ~ '^VOL-[0-9]{4}-[0-9]+$'
GROUP BY 1
ON CONFLICT (year) DO UPDATE
  SET next_value = GREATEST(volunteer_sequences.next_value, EXCLUDED.next_value),
      updated_at = now();--> statement-breakpoint

/*
  The invariant, asserted rather than assumed: for every year that has issued
  identifiers, the counter points past the highest one.
*/
DO $$
DECLARE
  bad record;
BEGIN
  FOR bad IN
    SELECT substring(volunteer_id from 'VOL-([0-9]{4})-')::smallint AS year,
           max(substring(volunteer_id from 'VOL-[0-9]{4}-([0-9]+)$')::int) AS highest
      FROM volunteers
     WHERE volunteer_id ~ '^VOL-[0-9]{4}-[0-9]+$'
     GROUP BY 1
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM volunteer_sequences s
       WHERE s.year = bad.year AND s.next_value > bad.highest
    ) THEN
      RAISE EXCEPTION
        'The % counter does not point past VOL-%-%. The next approval would collide.',
        bad.year, bad.year, lpad(bad.highest::text, 5, '0');
    END IF;
  END LOOP;
END $$;
