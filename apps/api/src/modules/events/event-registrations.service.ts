import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';

import {
  donors,
  eventRegistrations,
  events,
  notifications,
  otpCodes,
  type DatabaseClient,
} from '@sailent/database';
import {
  ATTENDANCE_OUTCOMES,
  SEAT_HOLDING_STATUSES,
  isPassAdmitted,
  parsePassCode,
  passNumberFor,
  passQueryFromScan,
  passesOf,
  registrationAvailability,
  type AttendeeStatus,
  type EventLifecycle,
  type EventPass,
  type EventPublishStatus,
  type ParsedPassCode,
  type ResolvedEventPass,
} from '@sailent/validation';
import type { AuthenticatedActor } from '@sailent/types';

import { DATABASE } from '../database/database.module.js';
import { RazorpayClient } from '../donations/razorpay.client.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditContext } from '../catalog/programs.service.js';
import { QUEUE_NAMES, QueueService, jobKey } from '../queue/queue.service.js';
import {
  ConflictException,
  NotFoundException,
  RateLimitException,
  UnauthenticatedException,
  ValidationException,
} from '../../common/exceptions.js';
import { AppConfig } from '../../config/app.config.js';
import { offsetFor, paginate } from '../../common/dto/pagination.dto.js';
import type {
  AttendanceInput,
  CheckInPassInput,
  MyEventsQuery,
  RegisterForEventInput,
  RegistrationListQuery,
} from './dto/events.dto.js';

/**
 * Event registration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * CAPACITY IS ENFORCED UNDER A ROW LOCK. NOT BY READING A COUNTER FIRST.
 *
 * The failure this exists to prevent: capacity 100, 99 seats taken, two people
 * submit at the same instant. Both read 99, both find room, both insert, and
 * the event now has 101 registrations for 100 places. No amount of checking
 * before the write fixes that — the check and the write have to be one
 * indivisible step.
 *
 * So `register()` opens a transaction, takes `SELECT … FOR UPDATE` on the
 * event row, and does everything else while holding it. The second request
 * blocks on that lock until the first commits, then reads 100 and is refused.
 * The lock is on `events`, not on `event_registrations`, because the row being
 * protected is the one holding the count.
 *
 * The seat count is RECOMPUTED from the registration rows inside that lock
 * rather than trusted from `registered_count`. Same cost — one aggregate on an
 * indexed column — and it makes the cached counter self-correcting instead of
 * something that can drift silently and start admitting an extra person.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THREE OTHER GUARANTEES, and where each actually lives:
 *
 *   • No duplicate registrations — `event_registrations_unique` on
 *     (event_id, email). A database constraint, not a service check: the check
 *     would race exactly the way the capacity check does. The service check
 *     below exists only to produce a readable message on the ordinary path.
 *
 *   • No registration after the deadline, for a cancelled, completed,
 *     unpublished or archived event — `registrationAvailability()`, evaluated
 *     against the locked row.
 *
 *   • A donor may only ever touch their OWN registration. There is no
 *     `donorId` parameter in this file; ownership is a WHERE clause.
 */
/** A registration id, as a gate operator might paste it. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How many bookings the gate lists when a lookup matches more than one. */
const MAX_CANDIDATES = 10;

/** What the gate is shown about a booking. */
const GATE_REGISTRATION_COLUMNS = {
  id: eventRegistrations.id,
  eventId: eventRegistrations.eventId,
  fullName: eventRegistrations.fullName,
  email: eventRegistrations.email,
  phone: eventRegistrations.phone,
  attendeeCount: eventRegistrations.attendeeCount,
  functionName: eventRegistrations.functionName,
  attendees: eventRegistrations.attendees,
  status: eventRegistrations.status,
  isPaid: eventRegistrations.isPaid,
  paidAmount: eventRegistrations.paidAmount,
  registeredAt: eventRegistrations.registeredAt,
  attendedAt: eventRegistrations.attendedAt,
};

/** The event as the gate needs it. Exported because the controller returns it. */
export interface GateEvent {
  id: string;
  title: string;
  registrationStatus: string;
}

/** The least of a booking the gate's verdict reads. */
export interface GateRegistration {
  id: string;
  fullName: string;
  status: string;
  attendedAt: Date | null;
  attendees: EventPass[] | null;
}

/** A backslash, `%` and `_` are LIKE syntax. A search for "%%" looks for two percent signs. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

const ADMISSION_TIME = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

/**
 * " at 4:05 pm IST", for "already admitted" — in India's time, not the
 * server's, because that is the clock the person at the gate is looking at.
 */
function admissionTime(value: string | Date | null): string {
  return value ? ` at ${ADMISSION_TIME.format(new Date(value))} IST` : '';
}

/**
 * The pass a check-in is for.
 *
 * A group booking has to say which person: there is no default that would
 * not risk admitting the wrong one, or leaving the right one stuck outside.
 */
function passToAdmit(passes: ResolvedEventPass[], passNumber: string | undefined) {
  if (passNumber) {
    const wanted = passNumber.trim().toUpperCase();
    const pass = passes.find((candidate) => candidate.passNumber.toUpperCase() === wanted);
    if (!pass) {
      throw new ValidationException(
        [{ field: 'passNumber', code: 'not_found', message: 'That pass is not on this booking.' }],
        'That pass is not on this booking.',
      );
    }
    return pass;
  }
  if (passes.length === 1) return passes[0]!;
  throw new ValidationException(
    [
      {
        field: 'passNumber',
        code: 'required',
        message: `This booking has ${passes.length} passes. Say which one to admit.`,
      },
    ],
    'Choose which pass to admit.',
  );
}

/**
 * The race the payment pre-check in `register` cannot see: two registrations
 * with the same payment, both past the check before either commits. The
 * unique index stops the second, and this gives it the same refusal.
 */
function rethrowPaymentReuse(error: unknown): never {
  const err = error as { code?: string; constraint?: string } | null;
  if (err?.code === '23505' && err.constraint === 'event_registrations_payment_id_unique') {
    throw new ConflictException('This payment has already been used for a registration.');
  }
  throw error;
}

@Injectable()
export class EventRegistrationsService {
  private readonly logger = new Logger(EventRegistrationsService.name);

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
    private readonly config: AppConfig,
    private readonly razorpay: RazorpayClient,
  ) {}

  // -------------------------------------------------------------------------
  // Public Event OTP: Request & Verify
  // -------------------------------------------------------------------------

  async requestEventOtp(
    eventId: string,
    emailRaw: string,
    name?: string,
    context?: AuditContext,
  ): Promise<{ sent: true }> {
    const email = emailRaw.trim().toLowerCase();

    // Verify event exists and is open
    const [event] = await this.database.db
      .select({
        id: events.id,
        title: events.title,
        status: events.status,
        lifecycle: events.registrationStatus,
        startDate: events.startDate,
        registrationDeadline: events.registrationDeadline,
        capacity: events.capacity,
        registeredCount: events.registeredCount,
      })
      .from(events)
      .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
      .limit(1);

    if (!event) throw new NotFoundException('Event');

    const availability = registrationAvailability({
      status: event.status as EventPublishStatus,
      lifecycle: event.lifecycle as EventLifecycle,
      startDate: event.startDate,
      registrationDeadline: event.registrationDeadline,
      capacity: event.capacity,
      registeredCount: event.registeredCount,
      attendeeCount: 1,
    });

    if (availability.state !== 'open') {
      throw new ConflictException(availability.reason);
    }

    // Rate limit: max 5 OTP requests per 15 mins for this email
    const [recent] = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.identifier, email),
          eq(otpCodes.purpose, 'event_registration'),
          gt(otpCodes.createdAt, new Date(Date.now() - 15 * 60_000)),
        ),
      );

    if ((recent?.count ?? 0) >= 5) {
      throw new RateLimitException(
        'Too many verification codes requested. Please try again in a few minutes.',
      );
    }

    const code = String(randomInt(100_000, 1_000_000));
    const codeHash = createHash('sha256').update(code).digest('hex');

    await this.database.db.insert(otpCodes).values({
      identifier: email,
      purpose: 'event_registration',
      codeHash,
      expiresAt: new Date(Date.now() + 10 * 60_000), // 10 minutes
      ipAddress: context?.ipAddress ?? null,
    });

    try {
      await this.queue.enqueue(
        QUEUE_NAMES.EMAIL,
        'donor.login_code',
        {
          email,
          name: name?.trim() || null,
          code,
          ttlMinutes: 10,
          purpose: 'event_registration',
        },
        { removeOnComplete: true, removeOnFail: { age: 10 * 60 } },
      );
    } catch (error) {
      this.logger.error(
        `Could not enqueue event registration OTP: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }

    if (this.config.mockDataEnabled) {
      this.logger.warn(`[dev] Event registration OTP for ${email}: ${code}`);
    }

    return { sent: true };
  }

  async verifyEventOtp(
    _eventId: string,
    emailRaw: string,
    code: string,
    _context?: AuditContext,
  ): Promise<{ verified: true; email: string }> {
    const email = emailRaw.trim().toLowerCase();

    const [record] = await this.database.db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.identifier, email),
          eq(otpCodes.purpose, 'event_registration'),
          isNull(otpCodes.consumedAt),
          gt(otpCodes.expiresAt, new Date()),
        ),
      )
      .orderBy(sql`${otpCodes.createdAt} DESC`)
      .limit(1);

    if (!record) {
      throw new UnauthenticatedException(
        'Verification code has expired or is invalid. Please request a new code.',
      );
    }

    if (record.attempts >= 5) {
      throw new RateLimitException('Too many attempts on this code. Please request a new code.');
    }

    const presented = Buffer.from(createHash('sha256').update(code.trim()).digest('hex'));
    const matches =
      presented.length === record.codeHash.length &&
      timingSafeEqual(presented, Buffer.from(record.codeHash));

    if (!matches) {
      await this.database.db
        .update(otpCodes)
        .set({ attempts: record.attempts + 1 })
        .where(eq(otpCodes.id, record.id));
      throw new UnauthenticatedException('Invalid verification code. Please check and try again.');
    }

    // Burn code immediately so it records as consumed (valid for registration within 15 mins)
    await this.database.db
      .update(otpCodes)
      .set({ consumedAt: new Date() })
      .where(eq(otpCodes.id, record.id));

    return { verified: true, email };
  }

  // -------------------------------------------------------------------------
  // Paid Event: Create Razorpay Order
  // -------------------------------------------------------------------------

  async createRegistrationOrder(
    eventId: string,
    donorId: string | null,
    input: {
      email?: string;
      fullName?: string;
      phone?: string;
      attendeeCount?: number;
      functionName?: string;
      attendees?: { fullName: string }[];
    },
    _context?: AuditContext,
  ): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    eventTitle: string;
  }> {
    const [event] = await this.database.db
      .select({
        id: events.id,
        title: events.title,
        status: events.status,
        lifecycle: events.registrationStatus,
        startDate: events.startDate,
        registrationDeadline: events.registrationDeadline,
        capacity: events.capacity,
        registeredCount: events.registeredCount,
        isPaid: events.isPaid,
        feeAmount: events.feeAmount,
      })
      .from(events)
      .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
      .limit(1);

    if (!event) throw new NotFoundException('Event');

    if (!event.isPaid || !event.feeAmount || event.feeAmount <= 0) {
      throw new ConflictException('This event does not require payment.');
    }

    const attendeeCount = Math.min(4, Math.max(1, input.attendeeCount ?? 1));

    const availability = registrationAvailability({
      status: event.status as EventPublishStatus,
      lifecycle: event.lifecycle as EventLifecycle,
      startDate: event.startDate,
      registrationDeadline: event.registrationDeadline,
      capacity: event.capacity,
      registeredCount: event.registeredCount,
      attendeeCount,
    });

    if (availability.state !== 'open') {
      throw new ConflictException(availability.reason);
    }

    let email = input.email?.trim().toLowerCase();
    if (donorId && !email) {
      const [donor] = await this.database.db
        .select({ email: donors.email })
        .from(donors)
        .where(eq(donors.id, donorId))
        .limit(1);
      email = donor?.email?.toLowerCase();
    }

    if (email) {
      const [existing] = await this.database.db
        .select({ id: eventRegistrations.id, status: eventRegistrations.status })
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.eventId, eventId),
            sql`lower(btrim(${eventRegistrations.email})) = ${email}`,
          ),
        )
        .limit(1);

      if (existing && existing.status !== 'cancelled') {
        throw new ConflictException('You are already registered for this event.');
      }
    }

    const totalAmount = event.feeAmount * attendeeCount;
    const receipt = `EVT-${eventId.slice(0, 8)}-${Date.now().toString(36)}`;
    const order = await this.razorpay.createOrder({
      amount: totalAmount,
      currency: 'INR',
      receipt,
      notes: {
        eventId,
        eventTitle: event.title.slice(0, 40),
        donorId: donorId ?? '',
        email: email ?? '',
        attendeeCount: String(attendeeCount),
      },
    });

    return {
      orderId: order.id,
      amount: totalAmount,
      currency: 'INR',
      keyId: this.razorpay.publicKeyId,
      eventTitle: event.title,
    };
  }

  // -------------------------------------------------------------------------
  // Donor: register
  // -------------------------------------------------------------------------

  async register(
    eventId: string,
    donorId: string | null,
    input: RegisterForEventInput,
    context: AuditContext,
  ) {
    let email: string;
    let fullName: string;
    let phone: string | null = null;

    if (donorId) {
      const [donor] = await this.database.db
        .select({
          id: donors.id,
          firstName: donors.firstName,
          lastName: donors.lastName,
          email: donors.email,
          phone: donors.phone,
        })
        .from(donors)
        .where(eq(donors.id, donorId))
        .limit(1);

      if (!donor) throw new NotFoundException('Account');

      const resolvedEmail = (input.email?.trim() || donor.email)?.toLowerCase();
      if (!resolvedEmail) {
        throw new ValidationException(
          [
            {
              field: 'email',
              code: 'required',
              message: 'Add an email address to your profile before registering for an event.',
            },
          ],
          'Your account has no email address on file.',
        );
      }
      email = resolvedEmail;
      fullName =
        input.fullName?.trim() ||
        [donor.firstName, donor.lastName].filter(Boolean).join(' ').trim() ||
        'Guest';
      phone = input.phone?.trim() || donor.phone;
    } else {
      // Public / Guest registration
      const candidateEmail = input.email?.trim().toLowerCase();
      if (!candidateEmail) {
        throw new ValidationException(
          [
            {
              field: 'email',
              code: 'required',
              message: 'An email address is required for event registration.',
            },
          ],
          'An email address is required.',
        );
      }
      email = candidateEmail;

      const candidateName = input.fullName?.trim();
      if (!candidateName) {
        throw new ValidationException(
          [
            {
              field: 'fullName',
              code: 'required',
              message: 'Full name is required.',
            },
          ],
          'Full name is required.',
        );
      }
      fullName = candidateName;

      const candidatePhone = input.phone?.trim();
      if (!candidatePhone) {
        throw new ValidationException(
          [
            {
              field: 'phone',
              code: 'required',
              message: 'A valid mobile number is required.',
            },
          ],
          'A mobile number is required.',
        );
      }
      phone = candidatePhone;
    }

    if (!phone) {
      throw new ValidationException(
        [
          {
            field: 'phone',
            code: 'required',
            message: 'A valid mobile number is required.',
          },
        ],
        'A mobile number is required.',
      );
    }

    if (!donorId) {
      // For public guest registration: verify that OTP was validated within last 15 minutes
      const [verified] = await this.database.db
        .select({ id: otpCodes.id })
        .from(otpCodes)
        .where(
          and(
            eq(otpCodes.identifier, email),
            eq(otpCodes.purpose, 'event_registration'),
            isNotNull(otpCodes.consumedAt),
            gt(otpCodes.consumedAt, new Date(Date.now() - 15 * 60_000)),
          ),
        )
        .limit(1);

      if (!verified) {
        throw new ValidationException(
          [
            {
              field: 'email',
              code: 'unverified',
              message: 'Please verify your email address with OTP before confirming registration.',
            },
          ],
          'Email address must be verified with OTP.',
        );
      }
    }

    // Multi-pass booking: up to 4 passes per registration.
    const attendeeCount = Math.min(4, Math.max(1, input.attendeeCount ?? 1));
    const functionName = input.functionName?.trim() || null;

    // Collect attendee names for each pass
    const attendeesList: { fullName: string; passNumber?: string }[] = [];
    if (input.attendees && input.attendees.length > 0) {
      for (let i = 0; i < attendeeCount; i++) {
        const att = input.attendees[i];
        attendeesList.push({
          fullName: att?.fullName?.trim() || (i === 0 ? fullName : `Attendee ${i + 1}`),
        });
      }
    } else {
      attendeesList.push({ fullName });
      for (let i = 1; i < attendeeCount; i++) {
        attendeesList.push({ fullName: `Attendee ${i + 1}` });
      }
    }

    const outcome = await this.database.db
      .transaction(async (tx) => {
        // ─── THE LOCK ───────────────────────────────────────────────────────
        // Everything from here to the commit is serialised per event.
        const [event] = await tx
          .select({
            id: events.id,
            title: events.title,
            slug: events.slug,
            status: events.status,
            lifecycle: events.registrationStatus,
            startDate: events.startDate,
            registrationDeadline: events.registrationDeadline,
            venueName: events.venueName,
            city: events.city,
            capacity: events.capacity,
            isPaid: events.isPaid,
            feeAmount: events.feeAmount,
            deletedAt: events.deletedAt,
          })
          .from(events)
          .where(eq(events.id, eventId))
          .for('update')
          .limit(1);

        if (!event || event.deletedAt) throw new NotFoundException('Event');

        // The authoritative seat count, read inside the lock.
        const [held] = await tx
          .select({
            seats: sql<number>`coalesce(sum(${eventRegistrations.attendeeCount}), 0)::int`,
          })
          .from(eventRegistrations)
          .where(
            and(
              eq(eventRegistrations.eventId, eventId),
              inArray(eventRegistrations.status, SEAT_HOLDING_STATUSES),
            ),
          );

        const seatsHeld = held?.seats ?? 0;

        const availability = registrationAvailability({
          status: event.status as EventPublishStatus,
          lifecycle: event.lifecycle as EventLifecycle,
          startDate: event.startDate,
          registrationDeadline: event.registrationDeadline,
          capacity: event.capacity,
          registeredCount: seatsHeld,
          attendeeCount,
        });

        if (availability.state !== 'open') {
          // 404 for an event the public cannot see, so an unpublished event does
          // not confirm its own existence to someone probing ids.
          if (availability.state === 'unpublished') throw new NotFoundException('Event');
          throw new ConflictException(availability.reason);
        }

        /**
         * An existing row for this person.
         *
         * The unique index covers CANCELLED rows too, so somebody who cancels and
         * changes their mind would otherwise be permanently barred from an event
         * with free seats. That is the reinstatement path below — one row per
         * person per event, reused, which is also what keeps the index honest.
         */
        const [existing] = await tx
          .select({
            id: eventRegistrations.id,
            status: eventRegistrations.status,
            donorId: eventRegistrations.donorId,
          })
          .from(eventRegistrations)
          .where(
            and(
              eq(eventRegistrations.eventId, eventId),
              sql`lower(btrim(${eventRegistrations.email})) = ${email}`,
            ),
          )
          .limit(1);

        if (existing && existing.status !== 'cancelled') {
          throw new ConflictException('You are already registered for this event.');
        }

        if (event.isPaid && event.feeAmount && event.feeAmount > 0) {
          if (!input.razorpayOrderId || !input.razorpayPaymentId || !input.razorpaySignature) {
            throw new ValidationException(
              [
                {
                  field: 'payment',
                  code: 'required',
                  message: 'Payment details are required for paid events.',
                },
              ],
              'This event requires payment.',
            );
          }

          const validSignature = this.razorpay.verifyCheckoutSignature({
            orderId: input.razorpayOrderId,
            paymentId: input.razorpayPaymentId,
            signature: input.razorpaySignature,
          });

          if (!validSignature) {
            throw new ConflictException('Payment verification failed: invalid signature.');
          }

          const expectedAmount = event.feeAmount * attendeeCount;
          const payment = await this.razorpay.fetchPayment(input.razorpayPaymentId);
          if (payment.amount !== expectedAmount || payment.currency !== 'INR') {
            throw new ConflictException(
              'Payment verification failed: amount or currency mismatch.',
            );
          }

          if (payment.status !== 'authorized' && payment.status !== 'captured') {
            throw new ConflictException(`Payment is in unexpected status: ${payment.status}.`);
          }

          /*
          ONE PAYMENT, ONE BOOKING.

          Everything above proves the payment is genuine and for the right
          amount — none of it proves it has not already been spent. Without
          this, the same payment details sent again under another email issue
          another set of passes. The person's own cancelled row is excluded:
          reinstating it reuses that row, and the payment that paid for it.

          `event_registrations_payment_id_unique` is the guarantee when two
          registrations race with the same payment; this is the readable
          refusal on the ordinary path.
        */
          const [spent] = await tx
            .select({ id: eventRegistrations.id })
            .from(eventRegistrations)
            .where(
              and(
                eq(eventRegistrations.paymentId, input.razorpayPaymentId),
                existing ? ne(eventRegistrations.id, existing.id) : undefined,
              ),
            )
            .limit(1);

          if (spent) {
            throw new ConflictException('This payment has already been used for a registration.');
          }
        }

        const values = {
          eventId,
          donorId,
          fullName,
          email,
          phone,
          attendeeCount,
          functionName,
          attendees: attendeesList,
          status: 'registered' as const,
          isPaid: Boolean(event.isPaid),
          paymentId: input.razorpayPaymentId ?? null,
          orderId: input.razorpayOrderId ?? null,
          paidAmount: event.isPaid && event.feeAmount ? event.feeAmount * attendeeCount : null,
          registeredAt: new Date(),
          cancellationReason: null,
          updatedAt: new Date(),
        };

        let registrationId: string;
        if (existing) {
          await tx
            .update(eventRegistrations)
            .set(values)
            .where(eq(eventRegistrations.id, existing.id));
          registrationId = existing.id;
        } else {
          const [created] = await tx
            .insert(eventRegistrations)
            .values(values)
            .returning({ id: eventRegistrations.id });
          if (!created) throw new ConflictException('Could not record the registration.');
          registrationId = created.id;
        }

        const basePassId = passNumberFor(registrationId);
        const finalAttendees = attendeesList.map((att, idx) => ({
          fullName: att.fullName,
          passNumber: attendeeCount === 1 ? basePassId : `${basePassId}-${idx + 1}`,
        }));

        await tx
          .update(eventRegistrations)
          .set({ attendees: finalAttendees })
          .where(eq(eventRegistrations.id, registrationId));

        const seatsAfter = seatsHeld + attendeeCount;
        const nowFull = event.capacity !== null && seatsAfter >= event.capacity;

        await tx
          .update(events)
          .set({
            registeredCount: seatsAfter,
            // `full` is set BY THE SERVER, from the count it just wrote — it is
            // not a button. An operator who wants registration shut uses
            // `closed`, and the two stay distinguishable, so a cancellation can
            // reopen a full event without reopening one somebody closed on
            // purpose.
            ...(nowFull ? { registrationStatus: 'full' as const } : {}),
            updatedAt: new Date(),
          })
          .where(eq(events.id, eventId));

        return {
          registrationId,
          event,
          seatsAfter,
          reinstated: Boolean(existing),
          finalAttendees,
          functionName,
        };
      })
      .catch(rethrowPaymentReuse);

    await this.audit.record({
      actorType: donorId ? 'donor' : 'system',
      action: outcome.reinstated ? 'event.registration.reinstate' : 'event.registration.create',
      entityType: 'event_registration',
      entityId: outcome.registrationId,
      // `actorType` says how to read this id: it is a `donors.id`, not a
      // `users.id`. The column carries no foreign key precisely so that both
      // kinds of actor can be recorded in one append-only log.
      userId: donorId ?? undefined,
      // The attendee's email is NOT written here. `redact()` would strip it,
      // and an audit row for a registration is about which event and how many
      // seats — the person is identified by the registration id.
      newValues: { eventId, attendeeCount, seatsAfter: outcome.seatsAfter },
      ...context,
    });

    await this.queue.enqueue(
      QUEUE_NAMES.EMAIL,
      'event.registration.confirmed',
      { registrationId: outcome.registrationId },
      // One confirmation per registration per reinstatement cycle. A retried
      // request cannot send two; a genuine re-registration after cancelling
      // gets a fresh id suffix because `registeredAt` moved.
      { jobId: jobKey('event-registration', outcome.registrationId, outcome.seatsAfter) },
    );

    const passNumber = passNumberFor(outcome.registrationId);

    if (donorId) {
      const reg = await this.myRegistration(eventId, donorId);
      return {
        ...reg,
        passNumber,
        functionName: outcome.functionName,
        attendees: outcome.finalAttendees,
      };
    }

    return {
      id: outcome.registrationId,
      registrationId: outcome.registrationId,
      passNumber,
      eventId: outcome.event.id,
      eventTitle: outcome.event.title,
      eventSlug: outcome.event.slug,
      startDate: outcome.event.startDate,
      venueName: outcome.event.venueName,
      city: outcome.event.city,
      fullName,
      email,
      phone,
      attendeeCount,
      functionName: outcome.functionName,
      attendees: outcome.finalAttendees,
      status: 'registered' as const,
      registeredAt: new Date().toISOString(),
      reinstated: outcome.reinstated,
    };
  }

  // -------------------------------------------------------------------------
  // Donor: read and cancel
  // -------------------------------------------------------------------------

  /**
   * The signed-in donor's registration for one event.
   *
   * Ownership is the WHERE clause, and a registration belonging to someone else
   * is NOT FOUND rather than forbidden — a 403 would confirm that a
   * registration exists for an event the caller has no business knowing about.
   */
  async myRegistration(eventId: string, donorId: string) {
    const [row] = await this.database.db
      .select({
        id: eventRegistrations.id,
        eventId: eventRegistrations.eventId,
        fullName: eventRegistrations.fullName,
        email: eventRegistrations.email,
        phone: eventRegistrations.phone,
        attendeeCount: eventRegistrations.attendeeCount,
        functionName: eventRegistrations.functionName,
        attendees: eventRegistrations.attendees,
        status: eventRegistrations.status,
        isPaid: eventRegistrations.isPaid,
        paidAmount: eventRegistrations.paidAmount,
        paymentId: eventRegistrations.paymentId,
        registeredAt: eventRegistrations.registeredAt,
        attendedAt: eventRegistrations.attendedAt,
        eventTitle: events.title,
        eventSlug: events.slug,
        startDate: events.startDate,
        endDate: events.endDate,
        venueName: events.venueName,
        city: events.city,
        isOnline: events.isOnline,
        lifecycle: events.registrationStatus,
        /**
         * THE JOINING LINK, RELEASED HERE AND ONLY HERE.
         *
         * `ContentService` strips it from every public payload. This endpoint
         * is reached with a donor session and returns the row that donor owns,
         * so it is the one place a link may legitimately come out — and only
         * while the registration is live. A cancelled registration gets null.
         */
        meetingUrl: sql<string | null>`CASE
          WHEN ${eventRegistrations.status} = 'cancelled' THEN NULL
          ELSE ${events.meetingUrl}
        END`,
      })
      .from(eventRegistrations)
      .innerJoin(events, eq(events.id, eventRegistrations.eventId))
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.donorId, donorId),
          isNull(events.deletedAt),
        ),
      )
      .limit(1);

    if (!row) throw new NotFoundException('Registration');
    return {
      ...row,
      passNumber: passNumberFor(row.id),
    };
  }

  async myEvents(donorId: string, query: MyEventsQuery) {
    const filters: SQL[] = [eq(eventRegistrations.donorId, donorId), isNull(events.deletedAt)];

    if (query.when === 'past') {
      filters.push(sql`${events.startDate} < now()`);
    } else if (query.when === 'upcoming') {
      filters.push(sql`${events.startDate} >= now()`);
    }

    const where = and(...filters);
    const descending = query.when === 'past';

    const [items, [count]] = await Promise.all([
      this.database.db
        .select({
          registrationId: eventRegistrations.id,
          status: eventRegistrations.status,
          isPaid: eventRegistrations.isPaid,
          paidAmount: eventRegistrations.paidAmount,
          attendeeCount: eventRegistrations.attendeeCount,
          registeredAt: eventRegistrations.registeredAt,
          id: events.id,
          title: events.title,
          slug: events.slug,
          summary: events.summary,
          coverImage: events.coverImage,
          startDate: events.startDate,
          endDate: events.endDate,
          venueName: events.venueName,
          city: events.city,
          isOnline: events.isOnline,
          lifecycle: events.registrationStatus,
          eventStatus: events.status,
          eventIsPaid: events.isPaid,
          feeAmount: events.feeAmount,
        })
        .from(eventRegistrations)
        .innerJoin(events, eq(events.id, eventRegistrations.eventId))
        .where(where)
        // Id tiebreaker: several registrations can share a start time.
        .orderBy(descending ? desc(events.startDate) : asc(events.startDate), eventRegistrations.id)
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.database.db
        .select({ value: sql<number>`count(*)::int` })
        .from(eventRegistrations)
        .innerJoin(events, eq(events.id, eventRegistrations.eventId))
        .where(where),
    ]);

    return paginate(items, query.page, query.limit, count?.value ?? 0);
  }

  /**
   * Cancel the signed-in donor's own registration.
   *
   * The freed seat is returned under the same lock registration takes, so a
   * cancellation and a registration racing for the last place cannot both
   * succeed against a stale count.
   */
  async cancelMine(
    eventId: string,
    donorId: string,
    reason: string | undefined,
    context: AuditContext,
  ) {
    const outcome = await this.database.db.transaction(async (tx) => {
      const [event] = await tx
        .select({
          id: events.id,
          title: events.title,
          capacity: events.capacity,
          lifecycle: events.registrationStatus,
          deletedAt: events.deletedAt,
        })
        .from(events)
        .where(eq(events.id, eventId))
        .for('update')
        .limit(1);

      if (!event || event.deletedAt) throw new NotFoundException('Event');

      const [registration] = await tx
        .select({
          id: eventRegistrations.id,
          status: eventRegistrations.status,
          attendeeCount: eventRegistrations.attendeeCount,
        })
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.eventId, eventId),
            // OWNERSHIP IN THE QUERY. There is no id in the request that could
            // address somebody else's row.
            eq(eventRegistrations.donorId, donorId),
          ),
        )
        .limit(1);

      if (!registration) throw new NotFoundException('Registration');

      if (registration.status === 'cancelled') {
        throw new ConflictException('That registration is already cancelled.');
      }

      /**
       * Attendance, once recorded, is a fact about what happened.
       *
       * Letting someone cancel over it would replace "this person came" with
       * "this person withdrew", and those are different claims — one of which
       * the attendance register says is false.
       */
      if (registration.status === 'attended' || registration.status === 'no_show') {
        throw new ConflictException(
          'Attendance has already been recorded for this event, so the registration can no longer be cancelled.',
        );
      }

      await tx
        .update(eventRegistrations)
        .set({
          status: 'cancelled',
          cancellationReason: reason?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(eventRegistrations.id, registration.id));

      const [held] = await tx
        .select({
          seats: sql<number>`coalesce(sum(${eventRegistrations.attendeeCount}), 0)::int`,
        })
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.eventId, eventId),
            inArray(eventRegistrations.status, SEAT_HOLDING_STATUSES),
          ),
        );

      const seatsAfter = held?.seats ?? 0;
      const wasFull = event.lifecycle === 'full';
      const hasRoom = event.capacity === null || seatsAfter < event.capacity;

      await tx
        .update(events)
        .set({
          registeredCount: seatsAfter,
          // ONLY `full` reopens. An event an operator set to `closed`, or that
          // is `cancelled` or `completed`, stays where they put it — a freed
          // seat is not a reason to overrule a human decision.
          ...(wasFull && hasRoom ? { registrationStatus: 'open' as const } : {}),
          updatedAt: new Date(),
        })
        .where(eq(events.id, eventId));

      return { registrationId: registration.id, seatsAfter };
    });

    await this.audit.record({
      actorType: 'donor',
      action: 'event.registration.cancel',
      entityType: 'event_registration',
      entityId: outcome.registrationId,
      userId: donorId,
      newValues: { eventId, seatsAfter: outcome.seatsAfter },
      reason,
      ...context,
    });

    return { cancelled: true, eventId, registrationId: outcome.registrationId };
  }

  // -------------------------------------------------------------------------
  // Staff: attendee list and attendance
  // -------------------------------------------------------------------------

  /**
   * The attendee list for one event.
   *
   * Behind `event.registration.read`, which is marked SENSITIVE in the
   * permission catalogue: this is the only place names, emails and phone
   * numbers of everyone attending come out together.
   */
  async listRegistrations(eventId: string, query: RegistrationListQuery) {
    const [event] = await this.database.db
      .select({
        id: events.id,
        title: events.title,
        capacity: events.capacity,
        isPaid: events.isPaid,
        feeAmount: events.feeAmount,
      })
      .from(events)
      .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
      .limit(1);

    if (!event) throw new NotFoundException('Event');

    const filters: SQL[] = [eq(eventRegistrations.eventId, eventId)];
    if (query.status && query.status !== 'all') {
      filters.push(eq(eventRegistrations.status, query.status));
    } else if (!query.status) {
      // The default list is who is COMING. Cancellations are still reachable
      // with `?status=cancelled`, but an organiser printing a register should
      // not have to filter them out by eye on the morning of the event.
      filters.push(sql`${eventRegistrations.status} <> 'cancelled'`);
    }

    const where = and(...filters);

    const [items, [count]] = await Promise.all([
      this.database.db
        .select({
          id: eventRegistrations.id,
          fullName: eventRegistrations.fullName,
          email: eventRegistrations.email,
          phone: eventRegistrations.phone,
          attendeeCount: eventRegistrations.attendeeCount,
          functionName: eventRegistrations.functionName,
          attendees: eventRegistrations.attendees,
          status: eventRegistrations.status,
          isPaid: eventRegistrations.isPaid,
          paidAmount: eventRegistrations.paidAmount,
          paymentId: eventRegistrations.paymentId,
          registeredAt: eventRegistrations.registeredAt,
          attendedAt: eventRegistrations.attendedAt,
          cancellationReason: eventRegistrations.cancellationReason,
        })
        .from(eventRegistrations)
        .where(where)
        .orderBy(asc(eventRegistrations.fullName), eventRegistrations.id)
        .limit(query.limit)
        .offset(offsetFor(query.page, query.limit)),
      this.database.db
        .select({ value: sql<number>`count(*)::int` })
        .from(eventRegistrations)
        .where(where),
    ]);

    return { event, ...paginate(items, query.page, query.limit, count?.value ?? 0) };
  }

  /**
   * Record who turned up.
   *
   * One transaction for the whole register. A half-applied attendance sheet is
   * worse than none: nobody can tell which half was marked, so the only safe
   * recovery is to do it all again — and doing it again over a partial write
   * is how people end up marked twice in the reporting.
   */
  async recordAttendance(
    eventId: string,
    input: AttendanceInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const [event] = await this.database.db
      .select({ id: events.id, title: events.title, startDate: events.startDate })
      .from(events)
      .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
      .limit(1);

    if (!event) throw new NotFoundException('Event');

    /**
     * Attendance cannot be recorded before the event starts.
     *
     * Not pedantry: an attendance figure dated before the thing happened is
     * exactly the kind of number decision A14 exists to keep off the site, and
     * these rows feed the impact metrics.
     */
    if (event.startDate.getTime() > Date.now()) {
      throw new ConflictException('This event has not started yet.');
    }

    const ids = input.entries.map((entry) => entry.registrationId);
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      throw new ValidationException(
        [
          {
            field: 'entries',
            code: 'duplicate',
            message: 'The same attendee appears twice, with no way to tell which mark is meant.',
          },
        ],
        'Duplicate entries in the attendance sheet.',
      );
    }

    const marked = await this.database.db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: eventRegistrations.id,
          status: eventRegistrations.status,
          fullName: eventRegistrations.fullName,
          attendees: eventRegistrations.attendees,
        })
        .from(eventRegistrations)
        .where(and(eq(eventRegistrations.eventId, eventId), inArray(eventRegistrations.id, ids)));

      const rowsById = new Map(rows.map((row) => [row.id, row]));
      const known = new Map(rows.map((row) => [row.id, row.status as AttendeeStatus]));
      const unknown = ids.filter((id) => !known.has(id));
      if (unknown.length > 0) {
        throw new ValidationException(
          unknown.map((id) => ({
            field: 'entries',
            code: 'not_found',
            message: `Registration ${id} is not on this event.`,
          })),
          'Some of those registrations are not on this event.',
        );
      }

      const cancelled = ids.filter((id) => known.get(id) === 'cancelled');
      if (cancelled.length > 0) {
        throw new ConflictException(
          `${cancelled.length} of those registrations ${
            cancelled.length === 1 ? 'was' : 'were'
          } cancelled. Someone who cancelled and came anyway should register again first.`,
        );
      }

      const now = new Date();
      for (const entry of input.entries) {
        // The sheet marks the whole booking, so every pass on it follows: the
        // gate must not admit someone the sheet already says came, nor turn
        // away someone the sheet has corrected to a no-show.
        const passes = passesOf(rowsById.get(entry.registrationId)!);
        const attendees = passes.map((pass) => ({
          ...pass,
          checkedInAt: entry.status === 'attended' ? (pass.checkedInAt ?? now.toISOString()) : null,
        }));

        await tx
          .update(eventRegistrations)
          .set({
            status: entry.status,
            // Stamped only for an attendance. A no-show has no time to record,
            // and clearing it means a correction from `attended` to `no_show`
            // does not leave a timestamp behind contradicting the status.
            attendedAt: entry.status === 'attended' ? now : null,
            attendees,
            updatedAt: now,
          })
          .where(eq(eventRegistrations.id, entry.registrationId));
      }

      return input.entries.length;
    });

    await this.audit.record({
      action: 'event.attendance',
      entityType: 'event',
      entityId: eventId,
      userId: actor.id,
      newValues: {
        marked,
        attended: input.entries.filter((entry) => entry.status === 'attended').length,
        noShow: input.entries.filter((entry) => entry.status === 'no_show').length,
      },
      severity: 'warning',
      ...context,
    });

    return this.listRegistrations(eventId, { page: 1, limit: 100, status: 'all' });
  }

  // -------------------------------------------------------------------------
  // Staff: the gate
  // -------------------------------------------------------------------------

  /**
   * What the gate sees when a pass is scanned or something is typed.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * ONLY A PASS NUMBER CAN ADMIT ON ITS OWN.
   *
   * Input that reads as a pass number (`SF-EVT-E355F430-2`, `e355f430`), a
   * registration id, or a link carrying one is looked up EXACTLY, and only
   * that answers `matchedBy: 'pass'` — the one result the kiosk's Auto-Admit
   * acts on. Anything else is a staff SEARCH by name, email or phone. It
   * answers `matchedBy: 'search'`, so a person looks before anyone is let in,
   * and when more than one booking matches it lists them instead of quietly
   * picking the first. A QR code carrying a name, or `%%`, admits nobody.
   * ══════════════════════════════════════════════════════════════════════════
   */
  async verifyPass(eventId: string, rawCode: string) {
    const [event] = await this.database.db
      .select({
        id: events.id,
        title: events.title,
        startDate: events.startDate,
        endDate: events.endDate,
        venueName: events.venueName,
        city: events.city,
        registrationStatus: events.registrationStatus,
      })
      .from(events)
      .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
      .limit(1);

    if (!event) throw new NotFoundException('Event');

    const query = passQueryFromScan(rawCode);
    const parsed = parsePassCode(query);
    if (parsed || UUID_PATTERN.test(query)) {
      return this.verifyByPass(event, query, parsed);
    }
    return this.searchBookings(event, query);
  }

  /** An exact lookup: a pass number or a registration id. */
  private async verifyByPass(event: GateEvent, query: string, parsed: ParsedPassCode | null) {
    // `baseHex` is eight hex digits by construction, so it carries no LIKE syntax.
    const match = parsed
      ? sql`replace(${eventRegistrations.id}::text, '-', '') LIKE ${`${parsed.baseHex}%`}`
      : eq(eventRegistrations.id, query);

    const rows = await this.database.db
      .select(GATE_REGISTRATION_COLUMNS)
      .from(eventRegistrations)
      .where(and(eq(eventRegistrations.eventId, event.id), match))
      .orderBy(eventRegistrations.id)
      .limit(MAX_CANDIDATES + 1);

    if (rows.length === 0) {
      const [other] = await this.database.db
        .select({
          id: eventRegistrations.id,
          eventId: eventRegistrations.eventId,
          eventTitle: events.title,
          fullName: eventRegistrations.fullName,
        })
        .from(eventRegistrations)
        .innerJoin(events, eq(eventRegistrations.eventId, events.id))
        .where(match)
        .limit(1);

      if (other) {
        return {
          valid: false,
          status: 'wrong_event' as const,
          matchedBy: 'pass' as const,
          message: `This pass is for another event: "${other.eventTitle}". Not valid for "${event.title}".`,
          registration: other,
          event,
        };
      }

      return {
        valid: false,
        status: 'not_found' as const,
        matchedBy: 'pass' as const,
        message: 'No booking has this pass number. Check the code, or search by name or phone.',
        event,
      };
    }

    // Two bookings on one event whose ids start with the same eight digits.
    // Rare, and exactly the case where guessing would admit the wrong person.
    if (rows.length > 1) return this.candidatesFor(event, rows, 'pass');

    const row = rows[0]!;
    const passes = passesOf(row);

    let matched: ResolvedEventPass | null;
    if (parsed?.index) {
      matched = passes[parsed.index - 1] ?? null;
      if (!matched) {
        return {
          valid: false,
          status: 'not_found' as const,
          matchedBy: 'pass' as const,
          message: `This booking has ${passes.length} ${passes.length === 1 ? 'pass' : 'passes'}, and no pass number ${parsed.index}.`,
          event,
        };
      }
    } else {
      // A group booking's own number names the booking, not a person.
      matched = passes.length === 1 ? passes[0]! : null;
    }

    return this.passVerdict(event, row, passes, matched, 'pass');
  }

  /** A staff search by name, email or phone, on this event only. */
  private async searchBookings(event: GateEvent, query: string) {
    const text = query.trim();
    const digits = text.replace(/\D/g, '');
    const conditions: SQL[] = [];
    let byName = false;

    if (/^[\d\s()+-]+$/.test(text) && digits.length >= 10) {
      conditions.push(
        sql`right(regexp_replace(${eventRegistrations.phone}, '[^0-9]', '', 'g'), 10) = ${digits.slice(-10)}`,
      );
    } else if (text.includes('@')) {
      conditions.push(sql`lower(btrim(${eventRegistrations.email})) = ${text.toLowerCase()}`);
    } else if (text.length >= 2) {
      byName = true;
      const pattern = `%${escapeLike(text)}%`;
      conditions.push(
        sql`${eventRegistrations.fullName} ILIKE ${pattern}`,
        sql`EXISTS (
          SELECT 1 FROM jsonb_array_elements(coalesce(${eventRegistrations.attendees}, '[]'::jsonb)) AS pass
           WHERE pass->>'fullName' ILIKE ${pattern}
        )`,
      );
    }

    if (conditions.length === 0) {
      return {
        valid: false,
        status: 'not_found' as const,
        matchedBy: 'search' as const,
        message:
          'Enter a pass number, a full phone number, an email address, or at least two letters of a name.',
        event,
      };
    }

    const rows = await this.database.db
      .select(GATE_REGISTRATION_COLUMNS)
      .from(eventRegistrations)
      .where(and(eq(eventRegistrations.eventId, event.id), or(...conditions)))
      .orderBy(asc(eventRegistrations.fullName), eventRegistrations.id)
      .limit(MAX_CANDIDATES + 1);

    if (rows.length === 0) {
      return {
        valid: false,
        status: 'not_found' as const,
        matchedBy: 'search' as const,
        message: `Nobody on this event's list matches "${text}".`,
        event,
      };
    }

    if (rows.length > 1) return this.candidatesFor(event, rows, 'search');

    const row = rows[0]!;
    const passes = passesOf(row);
    let matched: ResolvedEventPass | null = passes.length === 1 ? passes[0]! : null;
    if (!matched && byName) {
      const needle = text.toLowerCase();
      const named = passes.filter((pass) => pass.fullName.toLowerCase().includes(needle));
      if (named.length === 1) matched = named[0]!;
    }

    return this.passVerdict(event, row, passes, matched, 'search');
  }

  /** More than one booking matched: list them for a person to choose from. */
  private candidatesFor<R extends GateRegistration>(
    event: GateEvent,
    rows: R[],
    matchedBy: 'pass' | 'search',
  ) {
    const more = rows.length > MAX_CANDIDATES;
    return {
      valid: false,
      status: 'multiple_matches' as const,
      matchedBy,
      message: more
        ? `More than ${MAX_CANDIDATES} bookings match. Type more of the name, or scan the pass.`
        : `${rows.length} bookings match. Choose the right person.`,
      candidates: rows.slice(0, MAX_CANDIDATES).map((row) => {
        const passes = passesOf(row);
        return {
          registrationId: row.id,
          fullName: row.fullName,
          passNumber: passNumberFor(row.id),
          attendeeNames: passes.map((pass) => pass.fullName),
          status: row.status,
          totalPasses: passes.length,
          admittedCount: passes.filter((pass) => isPassAdmitted(row, pass)).length,
        };
      }),
      event,
    };
  }

  /**
   * The answer for one booking, and the person on it when one was named.
   *
   * In this order: a cancelled registration, a cancelled event, then whether
   * this person (or, with nobody named, everyone on the booking) is already in.
   */
  private passVerdict<R extends GateRegistration>(
    event: GateEvent,
    row: R,
    passes: ResolvedEventPass[],
    matched: ResolvedEventPass | null,
    matchedBy: 'pass' | 'search',
  ) {
    const view = (pass: ResolvedEventPass) => ({ ...pass, admitted: isPassAdmitted(row, pass) });
    const allAttendees = passes.map(view);
    const matchedAttendee = matched ? view(matched) : null;
    const base = {
      matchedBy,
      registration: { ...row, basePassId: passNumberFor(row.id), matchedAttendee, allAttendees },
      event,
    };

    if (row.status === 'cancelled') {
      return {
        ...base,
        valid: false,
        status: 'cancelled' as const,
        message: 'This registration was cancelled. Entry denied.',
      };
    }

    if (event.registrationStatus === 'cancelled') {
      return {
        ...base,
        valid: false,
        status: 'event_cancelled' as const,
        message: 'This event has been cancelled. Entry denied.',
      };
    }

    if (matchedAttendee?.admitted) {
      return {
        ...base,
        valid: false,
        status: 'already_attended' as const,
        message: `${matchedAttendee.fullName} was already admitted${admissionTime(
          matchedAttendee.checkedInAt ?? row.attendedAt,
        )}.`,
      };
    }

    if (!matchedAttendee && allAttendees.every((pass) => pass.admitted)) {
      return {
        ...base,
        valid: false,
        status: 'already_attended' as const,
        message: 'Everyone on this booking has already been admitted.',
      };
    }

    return {
      ...base,
      valid: true,
      status: 'valid' as const,
      message: !matchedAttendee
        ? `A booking for ${allAttendees.length} people. Choose who is at the gate.`
        : matchedBy === 'search'
          ? 'Matched by name or contact details, not by pass. Check their pass before admitting.'
          : 'Valid pass. Ready to admit.',
    };
  }

  /**
   * Admit ONE person, by their pass.
   *
   * The registration row is locked for the whole decision. Without it, two
   * gates scanning the same pass at the same moment both read "not yet
   * admitted", both write, and both wave the person through. With it, the
   * second reads the first one's stamp and answers "already admitted".
   *
   * A group booking must name the pass: admitting pass 1 says nothing about
   * pass 2. The booking becomes `attended` at its first arrival, which is what
   * stops it being cancelled afterwards (`cancelMine`).
   */
  async checkInPass(
    eventId: string,
    input: CheckInPassInput,
    actor: AuthenticatedActor,
    context: AuditContext,
  ) {
    const outcome = await this.database.db.transaction(async (tx) => {
      const [event] = await tx
        .select({ id: events.id, lifecycle: events.registrationStatus })
        .from(events)
        .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
        .limit(1);

      if (!event) throw new NotFoundException('Event');
      if (event.lifecycle === 'cancelled') {
        throw new ConflictException('This event has been cancelled, so nobody can be admitted.');
      }

      const [registration] = await tx
        .select()
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.id, input.registrationId),
            eq(eventRegistrations.eventId, eventId),
          ),
        )
        .for('update')
        .limit(1);

      if (!registration) throw new NotFoundException('Registration');

      if (registration.status === 'cancelled') {
        throw new ConflictException('This registration was cancelled and cannot be checked in.');
      }

      const passes = passesOf(registration);
      const target = passToAdmit(passes, input.passNumber);

      if (isPassAdmitted(registration, target)) {
        return { fresh: false, registration, passes, target };
      }

      const now = new Date();
      const admitted = { ...target, checkedInAt: now.toISOString() };
      const stamped = passes.map((pass) =>
        pass.passNumber === target.passNumber ? admitted : pass,
      );

      const [updated] = await tx
        .update(eventRegistrations)
        .set({
          attendees: stamped,
          status: 'attended',
          // The booking's first arrival. A later pass on it keeps this time.
          attendedAt: registration.attendedAt ?? now,
          updatedAt: now,
        })
        .where(eq(eventRegistrations.id, registration.id))
        .returning();

      return { fresh: true, registration: updated!, passes: stamped, target: admitted };
    });

    if (outcome.fresh) {
      await this.audit.record({
        action: 'event.attendance',
        entityType: 'event',
        entityId: eventId,
        userId: actor.id,
        // The pass number identifies the person; their name is not copied into
        // the append-only log, for the same reason `register` leaves out the email.
        newValues: {
          registrationId: outcome.registration.id,
          passNumber: outcome.target.passNumber,
          status: 'attended',
          attendedAt: outcome.target.checkedInAt,
        },
        severity: 'info',
        ...context,
      });
    }

    const admittedCount = outcome.passes.filter((pass) =>
      isPassAdmitted(outcome.registration, pass),
    ).length;

    return {
      success: true,
      alreadyAttended: !outcome.fresh,
      attendedAt: outcome.target.checkedInAt ?? outcome.registration.attendedAt,
      passNumber: outcome.target.passNumber,
      attendeeName: outcome.target.fullName,
      admittedCount,
      totalPasses: outcome.passes.length,
      registration: outcome.registration,
      message: outcome.fresh
        ? `Checked in: ${outcome.target.fullName}`
        : `${outcome.target.fullName} was already admitted${admissionTime(
            outcome.target.checkedInAt ?? outcome.registration.attendedAt,
          )}.`,
    };
  }

  /**
   * Recompute `registered_count` from the registration rows.
   *
   * The counter is written inside every registration and cancellation, so it
   * should never be wrong. This exists because "should never" is not a
   * guarantee, and a drifted counter on an event with a cap would quietly
   * admit an extra person. Called by the admin recount endpoint.
   */
  async reconcile(eventId: string, actor: AuthenticatedActor, context: AuditContext) {
    const result = await this.database.db.transaction(async (tx) => {
      const [event] = await tx
        .select({ id: events.id, registeredCount: events.registeredCount })
        .from(events)
        .where(eq(events.id, eventId))
        .for('update')
        .limit(1);

      if (!event) throw new NotFoundException('Event');

      const [held] = await tx
        .select({
          seats: sql<number>`coalesce(sum(${eventRegistrations.attendeeCount}), 0)::int`,
        })
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.eventId, eventId),
            inArray(eventRegistrations.status, SEAT_HOLDING_STATUSES),
          ),
        );

      const actual = held?.seats ?? 0;
      if (actual !== event.registeredCount) {
        await tx
          .update(events)
          .set({ registeredCount: actual, updatedAt: new Date() })
          .where(eq(events.id, eventId));
      }

      return { was: event.registeredCount, now: actual, drifted: actual !== event.registeredCount };
    });

    if (result.drifted) {
      this.logger.warn(
        { eventId, was: result.was, now: result.now },
        'Event registered_count had drifted and was corrected',
      );
      await this.audit.record({
        action: 'event.reconcile',
        entityType: 'event',
        entityId: eventId,
        userId: actor.id,
        oldValues: { registeredCount: result.was },
        newValues: { registeredCount: result.now },
        severity: 'warning',
        ...context,
      });
    }

    return result;
  }

  /** Written by the worker; read here so the donor dashboard can show them. */
  async notificationsFor(donorId: string, limit: number) {
    return this.database.db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientType, 'donor'),
          eq(notifications.recipientId, donorId),
          sql`${notifications.type} LIKE 'event.%'`,
        ),
      )
      .orderBy(desc(notifications.createdAt), notifications.id)
      .limit(limit);
  }
}

/** Re-exported so a caller can render the same two options the service accepts. */
export { ATTENDANCE_OUTCOMES };
