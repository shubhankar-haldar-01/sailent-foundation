-- ---------------------------------------------------------------------------
-- Phase 8 cleanup: one LIVE volunteer record per email address.
--
-- ══════════════════════════════════════════════════════════════════════════
-- WHY THIS WAS MISSING, AND WHY IT MATTERED.
--
-- Duplicate protection was enforced on PHONE. The volunteer's own dashboard
-- resolves their record by EMAIL. Nothing joined the two, so:
--
--   apply(email E, phone P1)  -> accepted
--   apply(email E, phone P2)  -> accepted, because P2 is not taken
--
-- left one person holding two live volunteer rows. `/me/volunteering` then did
-- `WHERE lower(btrim(email)) = E LIMIT 1` with no ORDER BY, so Postgres
-- returned whichever row it liked — possibly the one with no VOL- identifier,
-- no hours and no certificates, to somebody who had been approved months ago.
--
-- Not a cross-user leak: every row involved belongs to the same person. It is
-- a correctness defect that shows the wrong record to the right person, and it
-- needed no rejection to reach — two applications with different numbers did it.
--
-- PARTIAL, exactly like `volunteers_phone_unique`, and for the same reason: a
-- plain unique index would burn the address, so somebody rejected in March
-- could never apply again. Re-application stays a policy decision governed by
-- the cooling period, not an accident of a constraint.
--
-- Indexed on `lower(btrim(email))` because that is the form `apply()` stores
-- and the form the resolver looks up. Indexing the raw column would let
-- " Asha@Example.com " and "asha@example.com" both live.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Refuse rather than fail halfway. CREATE UNIQUE INDEX on a table that already
-- violates it aborts with a message naming two row ids and nothing else, which
-- is useless to whoever has to fix the data. This names the addresses.
DO $$
DECLARE
  offending text;
BEGIN
  SELECT string_agg(e || ' (' || n || ' live records)', ', ')
    INTO offending
    FROM (
      SELECT lower(btrim(email)) AS e, count(*) AS n
        FROM volunteers
       WHERE status NOT IN ('rejected', 'archived')
       GROUP BY 1
      HAVING count(*) > 1
    ) d;

  IF offending IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot add volunteers_email_live_unique: these addresses already hold more than one live volunteer record: %. Merge or archive the duplicates first — archiving is usually right, because the surviving record should be the one carrying the VOL- identifier and the hours.',
      offending;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS volunteers_email_live_unique
    ON volunteers (lower(btrim(email)))
 WHERE status NOT IN ('rejected', 'archived');

COMMIT;
