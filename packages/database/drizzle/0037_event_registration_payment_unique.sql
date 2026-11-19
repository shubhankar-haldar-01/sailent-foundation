-- One Razorpay payment pays for one event booking.
--
-- Registration checks the payment's signature, amount and status, but nothing
-- recorded that a payment had already been spent, so the same payment details
-- could be sent again under another email and issue a second set of passes.
-- The service refuses a reused payment with a readable message; this index is
-- the guarantee, because two registrations racing with the same payment would
-- both pass that check.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
      FROM "event_registrations"
     WHERE "payment_id" IS NOT NULL
     GROUP BY "payment_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'event_registrations has a payment_id used by more than one registration. Resolve the duplicates before applying 0037.';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_registrations_payment_id_unique"
ON "event_registrations" ("payment_id")
WHERE "payment_id" IS NOT NULL;
