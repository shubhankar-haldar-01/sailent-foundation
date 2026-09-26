import { eq } from 'drizzle-orm';
import type { Logger } from 'pino';

import { notifications, users, type DatabaseClient } from '@sailent/database';

/**
 * Tell the administrators an email did not go out.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS IS THE "VISIBLE TO ADMINS" HALF OF §4.21'S ACCEPTANCE CRITERION.
 *
 * "…and a failed send is retried and visible to admins."
 *
 * The retry was already there — only `unreachable` throws, so BullMQ tries
 * again — and the failed row was already written to the send log. What was
 * missing is the part that reaches somebody: a log nobody opens is not
 * visibility, and the person who needs to know a donor never received their
 * receipt is not going to go looking on the off chance.
 *
 * ONE ROW PER STAFF USER, not one broadcast row.
 *
 * A single row with a null recipient would be marked read by whoever opened it
 * first and disappear for everyone else. Fanning out costs one insert per
 * administrator — there is one administrative role and a handful of accounts —
 * and makes "I have read this" mean what it says.
 *
 * IT NEVER CARRIES THE RECIPIENT'S ADDRESS. An administrator needs to know
 * that a receipt for donation X failed, not to browse donor addresses in a
 * notification feed. The send log itself holds the detail, behind
 * `notification.read`.
 *
 * AND IT NEVER THROWS. This is called from the failure path of a job that has
 * already failed. An alert that could itself fail the job would turn one unsent
 * email into a retry storm.
 * ══════════════════════════════════════════════════════════════════════════
 */
export async function alertStaffOfFailedSend(
  db: DatabaseClient['db'],
  entry: {
    /** The notification type that failed, e.g. `donation.confirmation`. */
    type: string;
    /** A short, non-identifying description of what did not go out. */
    summary: string;
    /** The provider's category: `not_configured`, `rejected`, `unreachable`. */
    reason: string;
    /** Whatever identifies the underlying record, for an administrator to chase. */
    context?: Record<string, unknown>;
  },
  logger: Logger,
): Promise<void> {
  try {
    /*
      `not_configured` is not an incident.

      On a development machine, and on any deployment without a Brevo key, every
      single send reports it. Alerting on that would fill the inbox with rows
      saying the same thing about a state the administrator already knows, and
      train them to ignore the feed — which is how a real failure gets missed.
    */
    if (entry.reason === 'not_configured') {
      logger.debug({ type: entry.type }, 'Send skipped: no mail provider configured');
      return;
    }

    const staff = await db.select({ id: users.id }).from(users).where(eq(users.status, 'active'));

    if (staff.length === 0) {
      logger.warn({ type: entry.type }, 'A send failed and there is no active staff to tell');
      return;
    }

    await db.insert(notifications).values(
      staff.map((member) => ({
        userId: member.id,
        recipientType: 'user' as const,
        recipientId: member.id,
        type: 'notification.send_failed',
        title: 'An email did not go out',
        message: `${entry.summary} (${entry.reason})`,
        data: { failedType: entry.type, reason: entry.reason, ...entry.context },
        channel: 'in_app' as const,
        // `pending` is the wrong word for something that needs no delivery.
        // An in-app notification is delivered the moment it is written.
        status: 'sent' as const,
        sentAt: new Date(),
      })),
    );
  } catch (error) {
    // Never fail the job for this. See the note above.
    logger.error(
      { type: entry.type, err: String(error) },
      'Could not write the in-app alert for a failed send',
    );
  }
}
