import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm';

import {
  auditLogs,
  campaigns,
  donations,
  donors,
  events,
  newsletterSubscribers,
  notifications,
  programs,
  users,
  type DatabaseClient,
} from '@sailent/database';
import type { AuthenticatedActor } from '@sailent/types';
import { deadlineCutoff } from '@sailent/validation';

import { DATABASE } from '../database/database.module.js';
import { PaymentExceptionsService } from '../donations/payment-exceptions.service.js';
import { VolunteersService } from '../volunteers/volunteers.service.js';
import { CommunicationsService } from '../communications/communications.service.js';

/** Midnight at the start of this month, India time, as a UTC instant. */
export function startOfIstMonth(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - 330 * 60 * 1000);
}

const count = sql<number>`count(*)::int`;

/**
 * The admin home page (Phase 13).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * REAL COUNTS, AND ONLY THE ONES THIS PERSON MAY SEE.
 *
 * Every figure is a live query — nothing cached, nothing demo. Each section
 * is computed only if the caller holds that area's read permission, and is
 * otherwise absent from the response (not zero: zero would be a claim). The
 * one SUPER_ADMIN role holds all of them, but the endpoint does not assume it.
 *
 * Deliberately small: headline counts and short "needs attention" lists that
 * link to the existing pages. Reports keep the analysis.
 *
 * NO SENSITIVE DETAIL: recent donations carry an amount, a campaign and a
 * time; the donor's name only for `donation.read_pii`, and never for an
 * anonymous gift. Recent activity carries the action and who did it, never
 * the audit row's old/new values.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class DashboardService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly payments: PaymentExceptionsService,
    private readonly volunteers: VolunteersService,
    private readonly communications: CommunicationsService,
  ) {}

  async summary(actor: AuthenticatedActor, now: Date = new Date()) {
    const can = (permission: string) => actor.permissions.includes(permission);
    const db = this.database.db;
    const result: Record<string, unknown> = { generatedAt: now.toISOString() };
    const tasks: Promise<void>[] = [];

    if (can('campaign.read')) {
      tasks.push(
        (async () => {
          const cutoff = deadlineCutoff(now);
          const [row] = await db
            .select({
              open: sql<number>`count(*) FILTER (WHERE ${campaigns.status} = 'active' AND (${campaigns.endDate} IS NULL OR ${campaigns.endDate} >= ${cutoff.toISOString()}::timestamptz))::int`,
              pastDeadline: sql<number>`count(*) FILTER (WHERE ${campaigns.status} = 'active' AND ${campaigns.endDate} < ${cutoff.toISOString()}::timestamptz)::int`,
              paused: sql<number>`count(*) FILTER (WHERE ${campaigns.status} = 'paused')::int`,
              draft: sql<number>`count(*) FILTER (WHERE ${campaigns.status} IN ('draft', 'published'))::int`,
              completed: sql<number>`count(*) FILTER (WHERE ${campaigns.status} = 'completed')::int`,
            })
            .from(campaigns)
            .where(isNull(campaigns.deletedAt));
          result.campaigns = row;
        })(),
      );
    }

    if (can('program.read')) {
      tasks.push(
        (async () => {
          const [row] = await db
            .select({
              published: sql<number>`count(*) FILTER (WHERE ${programs.status} = 'published')::int`,
              draft: sql<number>`count(*) FILTER (WHERE ${programs.status} = 'draft')::int`,
            })
            .from(programs)
            .where(isNull(programs.deletedAt));
          result.programs = row;
        })(),
      );
    }

    if (can('donation.read')) {
      tasks.push(
        (async () => {
          const monthStart = startOfIstMonth(now);
          const [month] = await db
            .select({
              count,
              amountPaise: sql<number>`coalesce(sum(${donations.amount}), 0)::bigint`,
            })
            .from(donations)
            .where(and(eq(donations.status, 'successful'), gte(donations.completedAt, monthStart)));
          const [pending] = await db
            .select({ count })
            .from(donations)
            .where(inArray(donations.status, ['pending', 'processing']));

          const showNames = can('donation.read_pii');
          const recent = await db
            .select({
              id: donations.id,
              amountPaise: donations.amount,
              completedAt: donations.completedAt,
              campaignTitle: campaigns.title,
              anonymous: donations.anonymous,
              firstName: donors.firstName,
              lastName: donors.lastName,
            })
            .from(donations)
            .leftJoin(campaigns, eq(campaigns.id, donations.campaignId))
            .leftJoin(donors, eq(donors.id, donations.donorId))
            .where(eq(donations.status, 'successful'))
            .orderBy(desc(donations.completedAt))
            .limit(5);

          result.donations = {
            thisMonth: { count: month?.count ?? 0, amountPaise: Number(month?.amountPaise ?? 0) },
            pending: pending?.count ?? 0,
            recent: recent.map((row) => ({
              id: row.id,
              amountPaise: Number(row.amountPaise),
              completedAt: row.completedAt,
              campaignTitle: row.campaignTitle,
              donorName:
                showNames && !row.anonymous
                  ? [row.firstName, row.lastName].filter(Boolean).join(' ') || null
                  : null,
            })),
          };
        })(),
      );
    }

    if (can('payment.read')) {
      tasks.push(
        (async () => {
          const exceptions = await this.payments.list(now);
          result.payments = exceptions.summary;
        })(),
      );
    }

    if (can('donor.read')) {
      tasks.push(
        (async () => {
          const [row] = await db
            .select({
              total: count,
              withDonations: sql<number>`count(*) FILTER (WHERE ${donors.donationCount} > 0)::int`,
            })
            .from(donors);
          result.donors = row;
        })(),
      );
    }

    if (can('volunteer.read')) {
      tasks.push(
        (async () => {
          result.volunteers = { pendingApplications: await this.volunteers.pendingCount() };
        })(),
      );
    }

    if (can('event.read')) {
      tasks.push(
        (async () => {
          const [row] = await db
            .select({ upcoming: count })
            .from(events)
            .where(
              and(
                eq(events.status, 'published'),
                gte(events.startDate, now),
                isNull(events.deletedAt),
              ),
            );
          result.events = row;
        })(),
      );
    }

    if (can('contact.read')) {
      tasks.push(
        (async () => {
          result.messages = { new: await this.communications.countNewContact() };
        })(),
      );
    }

    if (can('newsletter.read')) {
      tasks.push(
        (async () => {
          const [row] = await db
            .select({ subscribed: count })
            .from(newsletterSubscribers)
            .where(eq(newsletterSubscribers.status, 'subscribed'));
          result.newsletter = row;
        })(),
      );
    }

    if (can('notification.read')) {
      tasks.push(
        (async () => {
          const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const [row] = await db
            .select({ failedLast7Days: count })
            .from(notifications)
            .where(
              and(
                eq(notifications.channel, 'email'),
                eq(notifications.status, 'failed'),
                gte(notifications.createdAt, since),
              ),
            );
          result.notifications = row;
        })(),
      );
    }

    if (can('audit.read')) {
      tasks.push(
        (async () => {
          const rows = await db
            .select({
              id: auditLogs.id,
              action: auditLogs.action,
              entityType: auditLogs.entityType,
              severity: auditLogs.severity,
              createdAt: auditLogs.createdAt,
              actorFirstName: users.firstName,
              actorLastName: users.lastName,
            })
            .from(auditLogs)
            .leftJoin(users, eq(users.id, auditLogs.userId))
            // Things staff did: a user actor with an account. Donors' and the
            // public's own actions are not "activity" on this page.
            .where(and(eq(auditLogs.actorType, 'user'), isNotNull(auditLogs.userId)))
            .orderBy(desc(auditLogs.createdAt))
            .limit(8);
          result.activity = rows.map((row) => ({
            id: row.id,
            action: row.action,
            entityType: row.entityType,
            severity: row.severity,
            createdAt: row.createdAt,
            actor: [row.actorFirstName, row.actorLastName].filter(Boolean).join(' ') || null,
          }));
        })(),
      );
    }

    await Promise.all(tasks);
    return result;
  }
}
