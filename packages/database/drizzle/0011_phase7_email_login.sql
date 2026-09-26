-- ═══════════════════════════════════════════════════════════════════════════
-- Donor sign-in moves from phone to EMAIL.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- THIS CHANGES WHAT IDENTIFIES A DONOR, WHICH IS NOT A COSMETIC CHANGE.
--
-- `donors` deduplicated on PHONE, and the reason was recorded in the code: an
-- email is shared within a household far more often than a mobile number, so
-- phone kept a husband's and a wife's giving history apart.
--
-- Signing in by email requires the opposite. For "type your email, get a code"
-- to be unambiguous, an email must resolve to exactly ONE donor — otherwise the
-- code is a coin toss between two people's giving history, which is the worst
-- possible outcome. So email becomes the identity and phone becomes contact
-- detail.
--
-- THE TRADE-OFF, STATED PLAINLY: two people sharing one email address now share
-- one donor record. That is the cost of email-addressed accounts and it is the
-- same bargain every donation platform that logs you in by email has already
-- made. Phone-based dedup was the better model for a platform nobody logs into.
-- ═══════════════════════════════════════════════════════════════════════════

--> statement-breakpoint
-- Guard: a duplicate email would make two donors indistinguishable at sign-in,
-- and this migration must not be the thing that merges them.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT lower(btrim(email)) FROM donors
     WHERE email IS NOT NULL AND btrim(email) <> ''
     GROUP BY 1 HAVING count(*) > 1
  ) duplicates;

  IF n > 0 THEN
    RAISE EXCEPTION
      'Refusing to make donors.email unique: % address(es) belong to more than one donor. Merge them by hand first — picking one automatically would join two people''s giving history.', n;
  END IF;
END $$;
--> statement-breakpoint

-- Guard: a donor with no email could never sign in, and would be invisible to
-- their own account for reasons nothing in the UI could explain.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM donors WHERE email IS NULL OR btrim(email) = '';
  IF n > 0 THEN
    RAISE EXCEPTION
      'Refusing to make email the sign-in identifier: % donor(s) have no email address on file.', n;
  END IF;
END $$;
--> statement-breakpoint

-- CASE-INSENSITIVE, because people do not type their own address consistently
-- and `Asha@example.com` is the same mailbox as `asha@example.com`. Every
-- lookup normalises the same way.
CREATE UNIQUE INDEX IF NOT EXISTS "donors_email_lower_unique" ON "donors" (lower(btrim("email")));--> statement-breakpoint

/*
  Phone stops being unique.

  It is no longer what identifies a donor, and leaving the constraint would make
  it a second identity that can still collide: two family members with separate
  email addresses and one shared mobile number would have the SECOND donation
  fail on a constraint that no longer means anything. The plain index stays,
  because staff search donors by phone.
*/
DROP INDEX IF EXISTS "donors_phone_unique";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "donors_phone_idx" ON "donors" ("phone");
