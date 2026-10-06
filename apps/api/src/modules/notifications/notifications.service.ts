import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';

import {
  notificationTemplateRevisions,
  notificationTemplates,
  notifications,
  type DatabaseClient,
} from '@sailent/database';
import type { AuthenticatedActor } from '@sailent/types';
import {
  expectedVariables,
  isKnownTemplateSlug,
  renderNotification,
  unsafeRawPlaceholders,
} from '@sailent/validation';

import { DATABASE } from '../database/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditContext } from '../catalog/programs.service.js';
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions.js';
import { offsetFor, paginate } from '../../common/dto/pagination.dto.js';
import { QueueService, QUEUE_NAMES, jobKey } from '../queue/queue.service.js';

interface LogQuery {
  page: number;
  pageSize: number;
  status?: 'pending' | 'sent' | 'failed' | 'read';
  channel?: 'email' | 'sms' | 'whatsapp' | 'push' | 'in_app';
  type?: string;
}

/**
 * Notifications: the inbox, the send log, and the templates.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE SEND LOG IS A RECORD, NOT A WORKING SET.
 *
 * Nothing here updates a notification's content, and nothing deletes one. A
 * row saying an email was sent to a donor on a date is the answer to "did they
 * get their receipt", and an answer somebody can edit is not evidence.
 *
 * The two things that DO change are `read_at` on an in-app notification, which
 * belongs to the administrator reading it, and a retry, which adds a new
 * attempt rather than rewriting the old one.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
  ) {}

  private get db() {
    return this.database.db;
  }

  // -------------------------------------------------------------------------
  // The inbox — in-app notifications for one administrator
  // -------------------------------------------------------------------------

  /**
   * This actor's own in-app notifications.
   *
   * SCOPED BY `user_id` IN THE QUERY, which is what stops this being an IDOR:
   * there is no id parameter to tamper with, and one administrator cannot ask
   * for another's feed by any route. `recipient_id` is not trusted for this —
   * `user_id` is the foreign key, and it is the one the index is on.
   */
  async inbox(
    actor: AuthenticatedActor,
    query: { page: number; pageSize: number; unreadOnly?: boolean },
  ) {
    const filters: SQL[] = [
      eq(notifications.userId, actor.id),
      eq(notifications.channel, 'in_app'),
    ];
    if (query.unreadOnly) filters.push(isNull(notifications.readAt));

    const where = and(...filters);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select({
          id: notifications.id,
          type: notifications.type,
          title: notifications.title,
          message: notifications.message,
          data: notifications.data,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .limit(query.pageSize)
        .offset(offsetFor(query.page, query.pageSize)),
      this.db.select({ total: count() }).from(notifications).where(where),
    ]);

    return paginate(rows, query.page, query.pageSize, totals?.total ?? 0);
  }

  /** How many unread, for the bell. One number, one query. */
  async unreadCount(actor: AuthenticatedActor): Promise<{ unread: number }> {
    const [row] = await this.db
      .select({ total: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, actor.id),
          eq(notifications.channel, 'in_app'),
          isNull(notifications.readAt),
        ),
      );

    return { unread: row?.total ?? 0 };
  }

  /**
   * Mark one read.
   *
   * The `user_id` predicate is in the WHERE, not checked afterwards: marking
   * somebody else's notification read must not be possible, and it must not be
   * possible to learn that theirs exists by being told "forbidden".
   */
  async markRead(id: string, actor: AuthenticatedActor) {
    const updated = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, actor.id),
          eq(notifications.channel, 'in_app'),
        ),
      )
      .returning({ id: notifications.id });

    if (updated.length === 0) throw new NotFoundException('That notification does not exist.');
    return { id, readAt: new Date() };
  }

  async markAllRead(actor: AuthenticatedActor) {
    const updated = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, actor.id),
          eq(notifications.channel, 'in_app'),
          isNull(notifications.readAt),
        ),
      )
      .returning({ id: notifications.id });

    return { marked: updated.length };
  }

  // -------------------------------------------------------------------------
  // The send log
  // -------------------------------------------------------------------------

  /**
   * Every send, with what happened to it.
   *
   * THE RECIPIENT'S ADDRESS IS NOT A COLUMN HERE, and never was — the log
   * records who a notification was ADDRESSED TO by id, not by address, so
   * browsing it does not hand an administrator a list of donor emails.
   */
  async log(query: LogQuery) {
    const filters: SQL[] = [];
    if (query.status) filters.push(eq(notifications.status, query.status));
    if (query.channel) filters.push(eq(notifications.channel, query.channel));
    if (query.type) filters.push(eq(notifications.type, query.type));

    const where = filters.length > 0 ? and(...filters) : undefined;

    const [rows, [totals]] = await Promise.all([
      this.db
        .select({
          id: notifications.id,
          type: notifications.type,
          title: notifications.title,
          message: notifications.message,
          channel: notifications.channel,
          status: notifications.status,
          recipientType: notifications.recipientType,
          recipientId: notifications.recipientId,
          templateId: notifications.templateId,
          templateVersion: notifications.templateVersion,
          retryCount: notifications.retryCount,
          sentAt: notifications.sentAt,
          error: notifications.error,
          providerMessageId: notifications.providerMessageId,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .limit(query.pageSize)
        .offset(offsetFor(query.page, query.pageSize)),
      this.db.select({ total: count() }).from(notifications).where(where),
    ]);

    return paginate(rows, query.page, query.pageSize, totals?.total ?? 0);
  }

  /** How many failed sends are outstanding — the number the bell also shows. */
  async failureCount(): Promise<{ failed: number }> {
    const [row] = await this.db
      .select({ total: count() })
      .from(notifications)
      .where(and(eq(notifications.status, 'failed'), eq(notifications.channel, 'email')));

    return { failed: row?.total ?? 0 };
  }

  /**
   * Try a failed send again.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * IT ENQUEUES; IT DOES NOT SEND. AND IT NEVER REWRITES THE OLD ROW.
   *
   * The API has no mail client and should not grow one — delivery belongs to
   * the worker, which is where the retry policy, the Brevo configuration and
   * the fail-soft semantics already live.
   *
   * The failed row stays exactly as it is. A new attempt produces a NEW log
   * entry, so "this was attempted three times on three days" remains readable
   * afterwards; overwriting would destroy the only evidence of the first
   * failure while claiming to fix it.
   * ══════════════════════════════════════════════════════════════════════════
   */
  async retry(id: string, actor: AuthenticatedActor, context: AuditContext) {
    const [row] = await this.db
      .select({
        id: notifications.id,
        type: notifications.type,
        status: notifications.status,
        channel: notifications.channel,
        data: notifications.data,
        retryCount: notifications.retryCount,
      })
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);

    if (!row) throw new NotFoundException('That notification does not exist.');

    if (row.status !== 'failed') {
      throw new ConflictException('Only a failed send can be tried again.');
    }
    if (row.channel !== 'email') {
      throw new ConflictException('Only an email can be tried again.');
    }

    const job = RETRYABLE_JOBS[row.type];
    if (!job) {
      /*
        A closed map, not a computed job name. `type` is a string on a row, and
        turning one into a queue job name by convention would let a hand-edited
        row enqueue anything the worker knows how to run.
      */
      throw new ConflictException(
        `There is no retry path for ${row.type}. It has to be re-triggered from the record it belongs to.`,
      );
    }

    const payload = job.payload(row.data as Record<string, unknown> | null);
    if (!payload) {
      throw new ConflictException(
        'That log entry does not carry enough detail to try again. The original record has it.',
      );
    }

    /*
      The EMAIL queue — the one the worker consumes, under the same job names
      the original sends used. Until Phase 13 this went to the `notifications`
      queue, which has no consumer: every retry sat in Redis and nothing was
      sent.
    */
    await this.queue.enqueue(QUEUE_NAMES.EMAIL, job.name, payload, {
      // A fresh id per attempt: BullMQ ignores a duplicate, and reusing the
      // original would make the second retry a silent no-op.
      jobId: jobKey('retry', id, Date.now()),
    });

    await this.db
      .update(notifications)
      .set({ retryCount: sql`${notifications.retryCount} + 1` })
      .where(eq(notifications.id, id));

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: 'notification.retry',
      entityType: 'notification',
      entityId: id,
      newValues: { type: row.type, attempt: row.retryCount + 1 },
      ...context,
    });

    return { queued: true, type: row.type };
  }

  // -------------------------------------------------------------------------
  // Templates
  // -------------------------------------------------------------------------

  async listTemplates() {
    const rows = await this.db
      .select({
        id: notificationTemplates.id,
        slug: notificationTemplates.slug,
        name: notificationTemplates.name,
        description: notificationTemplates.description,
        channel: notificationTemplates.channel,
        subject: notificationTemplates.subject,
        isActive: notificationTemplates.isActive,
        version: notificationTemplates.version,
        updatedAt: notificationTemplates.updatedAt,
      })
      .from(notificationTemplates)
      .orderBy(notificationTemplates.slug);

    return { items: rows };
  }

  async getTemplate(id: string) {
    const [template] = await this.db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.id, id))
      .limit(1);

    if (!template) throw new NotFoundException('That template does not exist.');

    const revisions = await this.db
      .select({
        version: notificationTemplateRevisions.version,
        note: notificationTemplateRevisions.note,
        createdBy: notificationTemplateRevisions.createdBy,
        createdAt: notificationTemplateRevisions.createdAt,
      })
      .from(notificationTemplateRevisions)
      .where(eq(notificationTemplateRevisions.templateId, id))
      .orderBy(desc(notificationTemplateRevisions.version))
      .limit(20);

    return {
      ...template,
      // What the sender actually supplies, so an editor is not guessing at
      // which `{{names}}` will resolve.
      expectedVariables: expectedVariables(template.slug),
      revisions,
    };
  }

  /**
   * Save a new version.
   *
   * The snapshot and the save are ONE TRANSACTION. A version number that
   * advanced without its revision row would make "revert to version 4" name
   * nothing, and the failure would only be discovered by somebody trying to
   * undo a mistake — the worst possible moment.
   */
  async updateTemplate(
    id: string,
    input: {
      subject?: string;
      bodyHtml?: string;
      bodyText?: string;
      isActive?: boolean;
      note?: string;
    },
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const [existing] = await this.db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.id, id))
      .limit(1);

    if (!existing) throw new NotFoundException('That template does not exist.');

    const next = {
      subject: input.subject ?? existing.subject,
      bodyHtml: input.bodyHtml ?? existing.bodyHtml,
      bodyText: input.bodyText ?? existing.bodyText,
    };

    this.assertSafePlaceholders(existing.slug, next);

    const version = existing.version + 1;

    await this.db.transaction(async (tx) => {
      await tx.insert(notificationTemplateRevisions).values({
        templateId: id,
        version,
        subject: next.subject,
        bodyHtml: next.bodyHtml,
        bodyText: next.bodyText,
        variables: existing.variables,
        note: input.note ?? null,
        createdBy: actor.id,
      });

      await tx
        .update(notificationTemplates)
        .set({
          ...next,
          isActive: input.isActive ?? existing.isActive,
          version,
          updatedBy: actor.id,
          updatedAt: new Date(),
        })
        .where(eq(notificationTemplates.id, id));
    });

    await this.audit.record({
      actorType: 'user',
      userId: actor.id,
      action: 'notification.template.update',
      entityType: 'notification_template',
      entityId: id,
      oldValues: { version: existing.version, subject: existing.subject },
      newValues: { version, subject: next.subject, isActive: input.isActive ?? existing.isActive },
      reason: input.note,
      ...context,
    });

    return this.getTemplate(id);
  }

  /**
   * Refuse a raw placeholder the slug does not permit.
   *
   * `{{{name}}}` inserts without escaping. Turning `{{donorName}}` into
   * `{{{donorName}}}` is a one-character edit that would put an unescaped,
   * donor-supplied string into an outgoing email, and it would read as a
   * formatting tweak in a diff. The registry says which — one, on one slug.
   */
  private assertSafePlaceholders(
    slug: string,
    bodies: { subject: string; bodyHtml: string; bodyText: string },
  ): void {
    const unsafe = unsafeRawPlaceholders(slug, bodies.subject, bodies.bodyHtml, bodies.bodyText);

    if (unsafe.length > 0) {
      throw new ValidationException(
        unsafe.map((name) => ({
          code: 'unsafe_placeholder',
          field: 'bodyHtml',
          message:
            `{{{${name}}}} inserts a value without escaping it, and this template is not ` +
            `permitted to. Use {{${name}}}.`,
        })),
        'That template would send unescaped content.',
      );
    }
  }

  /** Restore an earlier version, as a NEW version. */
  async revertTemplate(
    id: string,
    input: { version: number; note?: string },
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const [snapshot] = await this.db
      .select()
      .from(notificationTemplateRevisions)
      .where(
        and(
          eq(notificationTemplateRevisions.templateId, id),
          eq(notificationTemplateRevisions.version, input.version),
        ),
      )
      .limit(1);

    if (!snapshot) throw new NotFoundException('There is no such version of that template.');

    /*
      Forward, never backward. Reverting writes a NEW version carrying the old
      content, so the history says "on Tuesday somebody went back to version 3"
      rather than quietly losing versions 4 and 5.
    */
    return this.updateTemplate(
      id,
      {
        subject: snapshot.subject,
        bodyHtml: snapshot.bodyHtml,
        bodyText: snapshot.bodyText,
        note: input.note ?? `Reverted to version ${input.version}.`,
      },
      actor,
      context,
    );
  }

  /**
   * Render a body with sample values, without sending anything.
   *
   * The SAME renderer the worker uses. Two implementations would eventually
   * mean a preview that reassures somebody about an email which goes out
   * looking different — the precise failure a preview exists to prevent.
   */
  preview(
    slug: string,
    body: { subject: string; bodyHtml: string; bodyText: string },
    values?: Record<string, string>,
  ) {
    if (!isKnownTemplateSlug(slug)) {
      throw new ValidationException([
        {
          code: 'unknown_slug',
          field: 'slug',
          message: 'That is not a template this platform sends.',
        },
      ]);
    }

    this.assertSafePlaceholders(slug, body);

    // Anything the caller did not supply is filled with its own name in angle
    // brackets, so a gap in the preview is visible rather than blank.
    const expected = expectedVariables(slug);
    const sample: Record<string, string> = {};
    for (const name of Object.keys(expected)) sample[name] = `«${name}»`;

    const rendered = renderNotification(body, { ...sample, ...(values ?? {}) });

    return {
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      missing: rendered.missing,
      expectedVariables: expected,
    };
  }
}

/**
 * Which log entries can be tried again, and with what.
 *
 * A CLOSED MAP. `type` is a string on a row; deriving a queue job name from it
 * would let anything that could write a notification row enqueue any job the
 * worker knows. Each entry also says which fields of `data` the job needs, so
 * an entry that does not carry them is refused rather than enqueued to fail.
 */
const RETRYABLE_JOBS: Record<
  string,
  { name: string; payload: (data: Record<string, unknown> | null) => object | null }
> = {
  'donation.confirmation': {
    name: 'donation.confirmation',
    payload: (data) =>
      data && typeof data.donationId === 'string' ? { donationId: data.donationId } : null,
  },
  'event.registration.confirmed': {
    name: 'event.registration.confirmed',
    payload: (data) =>
      data && typeof data.registrationId === 'string'
        ? { registrationId: data.registrationId }
        : null,
  },
  'volunteer.application.received': {
    name: 'volunteer.application.received',
    payload: (data) =>
      data && typeof data.volunteerId === 'string' ? { volunteerId: data.volunteerId } : null,
  },
  'volunteer.assigned': {
    name: 'volunteer.assigned',
    payload: (data) =>
      data && typeof data.assignmentId === 'string' ? { assignmentId: data.assignmentId } : null,
  },
  'volunteer.certificate.issued': {
    name: 'volunteer.certificate.issued',
    payload: (data) =>
      data && typeof data.certificateId === 'string' ? { certificateId: data.certificateId } : null,
  },
  // Phase 13. The worker skips a message already recorded as sent.
  'contact.received': {
    name: 'contact.received',
    payload: (data) =>
      data && typeof data.contactMessageId === 'string'
        ? { contactMessageId: data.contactMessageId }
        : null,
  },
};

/*
  DELIBERATELY ABSENT from the map above:

    • `donor.login_code` — the code is hashed and gone. A retry could not
      reproduce it, and re-sending a sign-in code on an administrator's say-so
      is an account-takeover primitive, not a convenience. The donor asks
      again.
    • `volunteer.approved` / `volunteer.rejected` — re-sending a decision is a
      decision. It goes through the volunteer record, where the status
      transition is checked and audited.
    • `event.cancelled` — a fan-out to everybody holding a seat. Retrying one
      row would mean re-notifying all of them.
    • `newsletter.confirm`, `staff.invite`, `staff.password_reset` (Phase 13)
      — each link carries a token that exists only as a hash. The person asks
      again (subscribe, "forgot password"), or an administrator sends a fresh
      invitation from the staff account.
*/
