-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 8 — one administrative role.
--
-- Six roles become one. SUPER_ADMIN stays; ADMIN, FINANCE_MANAGER,
-- CAMPAIGN_MANAGER, VOLUNTEER_MANAGER and CONTENT_MANAGER are removed.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- NOBODY LOSES AN ACCOUNT AND NOTHING LOSES ITS HISTORY.
--
-- The order below is the whole point:
--
--   1. Give every affected user SUPER_ADMIN.
--   2. Only then drop their old assignment.
--   3. Only then remove the role.
--
-- Reversing steps 1 and 2 would leave a staff member with no role for the
-- duration of the transaction, and a deny-by-default guard would lock them out
-- if anything failed midway. Doing it in this order means the worst case is a
-- user holding two roles, which is harmless.
--
-- `audit_logs` is untouched. It stores no role reference — an entry records the
-- actor's id and an email snapshot — so historical entries made by a Campaign
-- Manager remain exactly as they were. That is the point of an append-only log.
-- ═══════════════════════════════════════════════════════════════════════════

--> statement-breakpoint
/*
  Every user holding a retired role gets SUPER_ADMIN.

  `ON CONFLICT DO NOTHING` because somebody may already hold it — an
  administrator who was also, say, the content manager.

  This GRANTS ACCESS, and deliberately so: the alternative is leaving staff
  with no role at all, which locks them out of the platform they administer.
  The five roles being removed were curated subsets of SUPER_ADMIN, so nobody
  gains a permission that a colleague did not already have; what they gain is
  the rest of the same administrative surface. On a single-NGO platform where
  the same one or two people do every job, that is the arrangement that was
  already true in practice.
*/
INSERT INTO user_roles (user_id, role_id)
SELECT DISTINCT ur.user_id, (SELECT id FROM roles WHERE key = 'SUPER_ADMIN')
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
 WHERE r.key IN ('ADMIN', 'FINANCE_MANAGER', 'CAMPAIGN_MANAGER', 'VOLUNTEER_MANAGER', 'CONTENT_MANAGER')
   AND EXISTS (SELECT 1 FROM roles WHERE key = 'SUPER_ADMIN')
ON CONFLICT DO NOTHING;--> statement-breakpoint

/*
  A GUARD, not a step. If the reassignment above did not cover everybody, stop
  here rather than proceeding to delete the roles they depend on.
*/
DO $$
DECLARE
  stranded int;
BEGIN
  SELECT count(*) INTO stranded
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
   WHERE r.key IN ('ADMIN', 'FINANCE_MANAGER', 'CAMPAIGN_MANAGER', 'VOLUNTEER_MANAGER', 'CONTENT_MANAGER')
     AND NOT EXISTS (
       SELECT 1 FROM user_roles keep
       JOIN roles sa ON sa.id = keep.role_id AND sa.key = 'SUPER_ADMIN'
       WHERE keep.user_id = ur.user_id
     );

  IF stranded > 0 THEN
    RAISE EXCEPTION
      '% user(s) hold a retired role without SUPER_ADMIN. Removing the role would lock them out.', stranded;
  END IF;
END $$;--> statement-breakpoint

-- Now the old assignments can go: everyone affected holds SUPER_ADMIN.
DELETE FROM user_roles
 WHERE role_id IN (
   SELECT id FROM roles
    WHERE key IN ('ADMIN', 'FINANCE_MANAGER', 'CAMPAIGN_MANAGER', 'VOLUNTEER_MANAGER', 'CONTENT_MANAGER')
 );--> statement-breakpoint

-- The grants attached to those roles. `role_permissions` is a join table and
-- carries no history worth keeping — the permission catalogue itself is
-- untouched, and that is where the meaning lives.
DELETE FROM role_permissions
 WHERE role_id IN (
   SELECT id FROM roles
    WHERE key IN ('ADMIN', 'FINANCE_MANAGER', 'CAMPAIGN_MANAGER', 'VOLUNTEER_MANAGER', 'CONTENT_MANAGER')
 );--> statement-breakpoint

DELETE FROM roles
 WHERE key IN ('ADMIN', 'FINANCE_MANAGER', 'CAMPAIGN_MANAGER', 'VOLUNTEER_MANAGER', 'CONTENT_MANAGER');--> statement-breakpoint

/*
  The invariant this migration exists to establish, asserted rather than
  assumed: exactly one staff role, and every staff user holds it.
*/
DO $$
DECLARE
  role_count int;
  roleless int;
BEGIN
  SELECT count(*) INTO role_count FROM roles;

  /*
    AT MOST one, not exactly one.

    On a FRESH database this migration runs before anything has been seeded, so
    `roles` is legitimately empty — roles are reference data created by
    `db:seed --reference`, not by a migration. Asserting `<> 1` made the whole
    migration chain unrunnable on a new environment, which included any new
    production database: `pnpm db:migrate` failed here with
    "Expected exactly one role after the migration, found 0."

    What this guard is actually for is the UPGRADE path — a database that had
    the five retired roles must end with one and only one. Zero means nothing
    has been seeded yet, which is not a failure, and the seed's own assertions
    cover what happens next.
  */
  IF role_count > 1 THEN
    RAISE EXCEPTION 'Expected at most one role after the migration, found %.', role_count;
  END IF;

  -- `users` has no soft-delete column; lifecycle lives on `status`.
  SELECT count(*) INTO roleless
    FROM users u
   WHERE u.status = 'active'
     AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id);

  IF roleless > 0 THEN
    RAISE WARNING
      '% active user(s) hold no role. They were roleless before this migration too — it removes nothing from them — but they cannot use the admin panel.', roleless;
  END IF;
END $$;
