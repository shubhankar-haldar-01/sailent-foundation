import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gt, isNull, sql, type SQL } from 'drizzle-orm';

import { contactMessages, newsletterSubscribers, type DatabaseClient } from '@sailent/database';
import {
  normaliseEmail,
  type ContactMessageStatus,
  type ContactSubmission,
  type NewsletterStatus,
} from '@sailent/validation';
import type { AuthenticatedActor } from '@sailent/types';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditContext } from '../catalog/programs.service.js';
import { QUEUE_NAMES, QueueService, jobKey } from '../queue/queue.service.js';
import { NotFoundException, ValidationException } from '../../common/exceptions.js';
import { offsetFor, paginate } from '../../common/dto/pagination.dto.js';

/** How long a newsletter confirmation link works. */
export const NEWSLETTER_CONFIRM_TTL_MS = 48 * 60 * 60 * 1000;
/** A pending address is sent at most one confirmation email in this window. */
export const NEWSLETTER_RESEND_INTERVAL_MS = 10 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Contact messages and newsletter subscriptions (Phase 13).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * CONTACT: STORED, THEN EMAILED. The row is written before anything else, so
 * a message survives an email provider that is down or not configured; the
 * worker's job carries only the message id (no personal data in Redis) and
 * the worker reads the message and the organisation's address itself.
 *
 * NEWSLETTER: DOUBLE OPT-IN. Subscribing writes or refreshes a `pending` row
 * and emails a confirmation link; only following it makes the row
 * `subscribed`. The public answer is the same whatever the address's state —
 * new, pending, already subscribed — so the form cannot be used to find out
 * who is on the list. Nothing here sends a newsletter.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class CommunicationsService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
  ) {}

  // ── Contact ──────────────────────────────────────────────────────────────

  async submitContact(input: ContactSubmission, context: AuditContext) {
    // The honeypot: accepted, answered like any other, and dropped.
    if (input.website && input.website.trim().length > 0) {
      return { received: true as const };
    }

    const [created] = await this.database.db
      .insert(contactMessages)
      .values({
        name: input.name,
        email: normaliseEmail(input.email),
        subject: input.subject,
        message: input.message,
        ipAddress: context.ipAddress ?? null,
      })
      .returning({ id: contactMessages.id });
    if (!created) throw new Error('Contact message insert returned no row');

    await this.queue.enqueue(
      QUEUE_NAMES.EMAIL,
      'contact.received',
      { contactMessageId: created.id },
      { jobId: jobKey('contact-received', created.id) },
    );

    return { received: true as const };
  }

  async listContact(query: { page: number; limit: number; status?: ContactMessageStatus | 'all' }) {
    const where: SQL | undefined =
      query.status && query.status !== 'all' ? eq(contactMessages.status, query.status) : undefined;

    const [rows, [total], statusCounts] = await Promise.all([
      this.database.db
        .select({
          id: contactMessages.id,
          name: contactMessages.name,
          email: contactMessages.email,
          subject: contactMessages.subject,
          // A preview, not the whole message, for the list.
          preview: sql<string>`left(${contactMessages.message}, 160)`,
          status: contactMessages.status,
          createdAt: contactMessages.createdAt,
          handledAt: contactMessages.handledAt,
        })
        .from(contactMessages)
        .where(where)
        .orderBy(desc(contactMessages.createdAt))
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.database.db.select({ value: count() }).from(contactMessages).where(where),
      this.database.db
        .select({ status: contactMessages.status, value: count() })
        .from(contactMessages)
        .groupBy(contactMessages.status),
    ]);

    return {
      ...paginate(rows, query.page, query.limit, total?.value ?? 0),
      counts: Object.fromEntries(statusCounts.map((row) => [row.status, row.value])) as Partial<
        Record<ContactMessageStatus, number>
      >,
    };
  }

  async getContact(id: string) {
    const [row] = await this.database.db
      .select()
      .from(contactMessages)
      .where(eq(contactMessages.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Message');
    // The sender's IP is kept for abuse handling, not shown to staff.
    const { ipAddress: _ip, ...message } = row;
    return message;
  }

  async setContactStatus(
    id: string,
    status: ContactMessageStatus,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const [before] = await this.database.db
      .select({ status: contactMessages.status })
      .from(contactMessages)
      .where(eq(contactMessages.id, id))
      .limit(1);
    if (!before) throw new NotFoundException('Message');

    // Who first dealt with it is kept when a handled message is archived;
    // reopening it ("new") clears that.
    let handled: { handledBy: string | null; handledAt: Date | null } | Record<string, never> = {};
    if (status === 'new') handled = { handledBy: null, handledAt: null };
    else if (before.status === 'new') handled = { handledBy: actor.id, handledAt: new Date() };

    await this.database.db
      .update(contactMessages)
      .set({ status, ...handled, updatedAt: new Date() })
      .where(eq(contactMessages.id, id));

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: `contact_message.${status}`,
      entityType: 'contact_message',
      entityId: id,
      // Status only: the message itself stays in its own row.
      oldValues: { status: before.status },
      newValues: { status },
      ...context,
    });

    return this.getContact(id);
  }

  /** Unhandled messages, for the dashboard. */
  async countNewContact(): Promise<number> {
    const [row] = await this.database.db
      .select({ value: count() })
      .from(contactMessages)
      .where(eq(contactMessages.status, 'new'));
    return row?.value ?? 0;
  }

  // ── Newsletter ───────────────────────────────────────────────────────────

  /** Always answers the same; see the class comment. */
  async subscribe(input: { email: string; website?: string }, context: AuditContext) {
    const answer = { status: 'check_inbox' as const };
    if (input.website && input.website.trim().length > 0) return answer;

    const email = normaliseEmail(input.email);
    const now = new Date();

    const [existing] = await this.database.db
      .select()
      .from(newsletterSubscribers)
      .where(sql`lower(btrim(${newsletterSubscribers.email})) = ${email}`)
      .limit(1);

    // Already confirmed: nothing to do, and nothing to reveal.
    if (existing?.status === 'subscribed') return answer;

    // Pending and recently emailed: do not send another (mail bombing guard).
    if (
      existing?.status === 'pending' &&
      existing.confirmationSentAt &&
      now.getTime() - existing.confirmationSentAt.getTime() < NEWSLETTER_RESEND_INTERVAL_MS
    ) {
      return answer;
    }

    const confirmToken = newToken();
    const unsubscribeToken = newToken();
    const fields = {
      status: 'pending' as const,
      confirmTokenHash: hashToken(confirmToken),
      confirmExpiresAt: new Date(now.getTime() + NEWSLETTER_CONFIRM_TTL_MS),
      unsubscribeTokenHash: hashToken(unsubscribeToken),
      confirmationSentAt: now,
      confirmedAt: null,
      unsubscribedAt: null,
      source: 'website',
      consentIp: context.ipAddress ?? null,
      updatedAt: now,
    };

    let subscriberId: string;
    if (existing) {
      await this.database.db
        .update(newsletterSubscribers)
        .set(fields)
        .where(eq(newsletterSubscribers.id, existing.id));
      subscriberId = existing.id;
    } else {
      try {
        const [created] = await this.database.db
          .insert(newsletterSubscribers)
          .values({ email, ...fields })
          .returning({ id: newsletterSubscribers.id });
        if (!created) throw new Error('Newsletter insert returned no row');
        subscriberId = created.id;
      } catch (error) {
        // Two simultaneous submissions of one address: the other one won.
        if ((error as { code?: string }).code === '23505') return answer;
        throw error;
      }
    }

    await this.queue.enqueue(
      QUEUE_NAMES.EMAIL,
      'newsletter.confirm',
      { subscriberId, confirmToken, unsubscribeToken },
      {
        // One job per token: a retry resends the same link.
        jobId: jobKey('newsletter-confirm', subscriberId, String(now.getTime())),
        removeOnComplete: true,
        removeOnFail: { age: 3600 },
      },
    );

    return answer;
  }

  async confirm(token: string, context: AuditContext) {
    const now = new Date();
    const [updated] = await this.database.db
      .update(newsletterSubscribers)
      .set({
        status: 'subscribed',
        confirmedAt: now,
        confirmTokenHash: null,
        confirmExpiresAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(newsletterSubscribers.confirmTokenHash, hashToken(token)),
          eq(newsletterSubscribers.status, 'pending'),
          gt(newsletterSubscribers.confirmExpiresAt, now),
        ),
      )
      .returning({ id: newsletterSubscribers.id });

    if (!updated) {
      throw new ValidationException(
        [
          {
            code: 'link_invalid',
            message: 'This confirmation link has expired or was already used.',
          },
        ],
        'This confirmation link has expired or was already used. Subscribe again to get a new one.',
      );
    }

    await this.audit.record({
      actorType: 'system',
      action: 'newsletter.subscribed',
      entityType: 'newsletter_subscriber',
      entityId: updated.id,
      ...context,
    });
    return { status: 'subscribed' as const };
  }

  async unsubscribe(token: string, context: AuditContext) {
    const now = new Date();
    const [row] = await this.database.db
      .select({ id: newsletterSubscribers.id, status: newsletterSubscribers.status })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.unsubscribeTokenHash, hashToken(token)))
      .limit(1);
    if (!row) {
      throw new ValidationException(
        [{ code: 'link_invalid', message: 'This unsubscribe link is not valid.' }],
        'This unsubscribe link is not valid.',
      );
    }

    // Idempotent: a second click says the same thing.
    if (row.status !== 'unsubscribed') {
      await this.database.db
        .update(newsletterSubscribers)
        .set({
          status: 'unsubscribed',
          unsubscribedAt: now,
          confirmTokenHash: null,
          confirmExpiresAt: null,
          updatedAt: now,
        })
        .where(
          and(eq(newsletterSubscribers.id, row.id), isNull(newsletterSubscribers.unsubscribedAt)),
        );
      await this.audit.record({
        actorType: 'system',
        action: 'newsletter.unsubscribed',
        entityType: 'newsletter_subscriber',
        entityId: row.id,
        ...context,
      });
    }
    return { status: 'unsubscribed' as const };
  }

  async listSubscribers(query: { page: number; limit: number; status?: NewsletterStatus | 'all' }) {
    const where: SQL | undefined =
      query.status && query.status !== 'all'
        ? eq(newsletterSubscribers.status, query.status)
        : undefined;

    const [rows, [total], statusCounts] = await Promise.all([
      this.database.db
        .select({
          id: newsletterSubscribers.id,
          email: newsletterSubscribers.email,
          status: newsletterSubscribers.status,
          createdAt: newsletterSubscribers.createdAt,
          confirmedAt: newsletterSubscribers.confirmedAt,
          unsubscribedAt: newsletterSubscribers.unsubscribedAt,
        })
        .from(newsletterSubscribers)
        .where(where)
        .orderBy(desc(newsletterSubscribers.createdAt))
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.database.db.select({ value: count() }).from(newsletterSubscribers).where(where),
      this.database.db
        .select({ status: newsletterSubscribers.status, value: count() })
        .from(newsletterSubscribers)
        .groupBy(newsletterSubscribers.status),
    ]);

    return {
      ...paginate(rows, query.page, query.limit, total?.value ?? 0),
      counts: Object.fromEntries(statusCounts.map((row) => [row.status, row.value])) as Partial<
        Record<NewsletterStatus, number>
      >,
    };
  }
}
