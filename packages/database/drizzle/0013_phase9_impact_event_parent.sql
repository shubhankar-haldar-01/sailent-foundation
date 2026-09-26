-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 9 — an impact update may hang off an EVENT.
--
-- Migration `0012` added `impact_updates.event_id`, but the table still carries
-- the Phase 3 constraint
--
--     CHECK (campaign_id IS NOT NULL OR program_id IS NOT NULL)
--
-- so an update attached ONLY to an event is rejected by the database. That is
-- exactly the case Phase 9 §30 describes: a medical camp counts its own
-- patients seen, and those figures belong to the camp — not to whichever
-- campaign happened to fund it, and not to a programme invented to hold them.
--
-- The rule being kept is "an update must attach to SOMETHING, or it is
-- unattributable" (decision A14). Widening the constraint keeps that rule and
-- admits the third parent; it does not weaken it. An update with all three
-- columns NULL is still refused.
-- ═══════════════════════════════════════════════════════════════════════════

--> statement-breakpoint
/*
  Dropped and recreated rather than altered: Postgres has no
  `ALTER TABLE … ALTER CONSTRAINT` for a CHECK expression. The two statements
  run inside one migration transaction, so there is no window in which the
  table is unconstrained.
*/
ALTER TABLE "impact_updates"
  DROP CONSTRAINT IF EXISTS "impact_updates_has_parent";--> statement-breakpoint

ALTER TABLE "impact_updates"
  ADD CONSTRAINT "impact_updates_has_parent"
  CHECK (
    "campaign_id" IS NOT NULL
    OR "program_id" IS NOT NULL
    OR "event_id" IS NOT NULL
  );--> statement-breakpoint

/*
  A guard, not a migration step.

  If a later edit ever restores the two-column form, this fails loudly on the
  next run rather than silently making event-only updates unwritable again —
  which would surface as a 500 on an admin form, not as anything pointing here.
*/
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'impact_updates_has_parent'
      AND pg_get_constraintdef(oid) LIKE '%event_id%'
  ) THEN
    RAISE EXCEPTION
      'impact_updates_has_parent does not admit event_id — event-only impact updates would be rejected (Phase 9 §30).';
  END IF;
END $$;
