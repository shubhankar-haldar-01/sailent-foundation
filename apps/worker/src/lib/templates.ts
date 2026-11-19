import { eq, and } from 'drizzle-orm';
import type { Logger } from 'pino';

import {
  NOTIFICATION_TEMPLATE_SEED,
  notificationTemplates,
  type DatabaseClient,
} from '@sailent/database';
import { renderNotification } from '@sailent/validation';

/**
 * Render a transactional email from its stored template.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE BUILT-IN BODY IS NOT A PLACEHOLDER. IT IS THE FALLBACK, AND IT STAYS.
 *
 * `product-requirements.md` §4.21 asks that every transactional email have a
 * template. It does not ask that an email stop going out when one is missing —
 * and that is the failure mode this function is shaped to avoid.
 *
 * A template that has been deactivated, deleted, never seeded, or that fails
 * to load because the database hiccuped, must not silently stop a donor
 * receiving their receipt. So this returns `null` on every one of those, and
 * every caller keeps the body it already had.
 *
 * WHAT IS LOST when it falls back is editability, not delivery. That is the
 * right way round: an email with slightly old wording is an inconvenience; a
 * receipt that never arrives is a donor filing a complaint.
 *
 * MISSING VARIABLES ARE LOGGED, NOT FATAL. `renderNotification` reports the
 * placeholders it could not fill, and a template referring to a variable the
 * sender does not supply is an editing mistake somebody needs to see — but it
 * is not a reason to withhold the email.
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
  templateId: string;
  templateVersion: number;
  /**
   * Whether an administrator has written their own body: the stored body
   * differs from the wording this code ships (`NOTIFICATION_TEMPLATE_SEED`).
   *
   * Not the version number. Reverting to the default, or tests saving and
   * restoring a template, raise the version without anyone writing anything,
   * and an email laid out in code would then repeat the default wording as if
   * it were a personal note.
   */
  customised: boolean;
}

/** Same text, ignoring how it is spaced (an editor may reflow it). */
const normalised = (value: string) => value.replace(/\s+/g, ' ').trim();

const SHIPPED_BODIES = new Map(
  NOTIFICATION_TEMPLATE_SEED.map((template) => [
    template.slug,
    { html: normalised(template.bodyHtml), text: normalised(template.bodyText) },
  ]),
);

/**
 * The stored body differs from the shipped one. A slug with no shipped body
 * is treated as customised: there is nothing to compare it with.
 */
export function isCustomised(slug: string, bodyHtml: string, bodyText: string): boolean {
  const shipped = SHIPPED_BODIES.get(slug);
  if (!shipped) return true;
  return normalised(bodyHtml) !== shipped.html || normalised(bodyText) !== shipped.text;
}

/** The drizzle handle, as every processor already receives it. */
type Db = DatabaseClient['db'];

export async function renderFromTemplate(
  db: Db,
  slug: string,
  values: Record<string, string | number | null | undefined>,
  logger: Logger,
): Promise<RenderedTemplate | null> {
  try {
    const rows = await db
      .select({
        id: notificationTemplates.id,
        version: notificationTemplates.version,
        subject: notificationTemplates.subject,
        bodyHtml: notificationTemplates.bodyHtml,
        bodyText: notificationTemplates.bodyText,
      })
      .from(notificationTemplates)
      .where(and(eq(notificationTemplates.slug, slug), eq(notificationTemplates.isActive, true)))
      .limit(1);

    const template = rows[0];
    if (!template) {
      logger.debug({ slug }, 'No active notification template — using the built-in body');
      return null;
    }

    const rendered = renderNotification(template, values);

    if (rendered.missing.length > 0) {
      /*
        An editing mistake, and one nobody would otherwise find out about: the
        email goes out with a gap where a name should be. Logged at `warn` so
        it surfaces without stopping the send.
      */
      logger.warn(
        { slug, missing: rendered.missing, templateVersion: template.version },
        'Notification template refers to variables the sender does not supply',
      );
    }

    return {
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateId: template.id,
      templateVersion: template.version,
      customised: isCustomised(slug, template.bodyHtml, template.bodyText),
    };
  } catch (error) {
    // A template lookup must never be the reason an email does not arrive.
    logger.error({ slug, err: String(error) }, 'Could not load a notification template');
    return null;
  }
}
