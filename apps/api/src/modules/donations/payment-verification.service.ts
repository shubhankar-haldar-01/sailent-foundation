import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { donations, payments, paymentWebhooks, type DatabaseClient } from '@sailent/database';

import { DATABASE } from '../database/database.module.js';
import { DonationCaptureService, type CaptureOutcome } from './donation-capture.service.js';
import { RazorpayClient, type RazorpayPayment } from './razorpay.client.js';
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions.js';

/** The Razorpay events this platform acts on. Anything else is stored and ignored. */
const HANDLED_EVENTS = new Set(['payment.captured', 'payment.failed']);

/**
 * Events this platform does not act on, but must not swallow.
 *
 * The platform does not offer refunds, so nothing here raises one and no code
 * path adjusts a counter back down. A refund raised directly in the Razorpay
 * dashboard is therefore an OUT-OF-BAND event: money has left the account and
 * this database does not know it.
 *
 * Reconciling it automatically would be reintroducing refund handling. Ignoring
 * it quietly would let the books drift with nothing to show for it. So it is
 * logged at error level and left alone — a human settles it, and the log is
 * what tells them to.
 */
const ALARM_EVENTS = new Set(['refund.created', 'refund.processed']);

export interface WebhookOutcome {
  /** Always true unless the signature failed — a stored event is a handled event. */
  accepted: boolean;
  duplicate: boolean;
  eventType?: string;
}

/**
 * Deciding whether a payment really happened.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE BROWSER IS NEVER BELIEVED, AND NEITHER IS THE WEBHOOK BODY.
 *
 * Both paths end at the same place: a payment object FETCHED FROM RAZORPAY over
 * an authenticated connection, checked for status and amount, and only then
 * handed to the capture service.
 *
 * That is stricter than it needs to be for the webhook, whose HMAC already
 * proves the body came from Razorpay. It is done anyway because the signature
 * proves origin, not freshness or completeness, and because one verification
 * routine that both paths share is one routine to get right. A webhook is a
 * notification that something happened; the API is the authority on what.
 *
 * THREE THINGS ARE CHECKED before anything is captured:
 *   1. the signature, so the message is genuinely Razorpay's
 *   2. the payment's own status at Razorpay, so an authorised-but-not-captured
 *      payment is not recorded as money received
 *   3. the AMOUNT against our own figure, so a tampered order cannot pay ₹1
 *      for a ₹9,000 donation
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class PaymentVerificationService {
  private readonly logger = new Logger(PaymentVerificationService.name);

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseClient,
    private readonly razorpay: RazorpayClient,
    private readonly capture: DonationCaptureService,
  ) {}

  /**
   * The browser's return from Checkout — the FAST path.
   *
   * Its only job is to let the donor see a result in a second rather than
   * waiting for Razorpay to call us. It is not privileged: it verifies exactly
   * what the webhook verifies, and if it is wrong about anything the webhook
   * arrives shortly afterwards and puts the record right.
   */
  async verifyCheckout(input: {
    donationId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<CaptureOutcome> {
    const donation = await this.loadDonation(input.donationId);

    /**
     * The handshake signature.
     *
     * HMAC of `order_id|payment_id` keyed with the API secret, which never
     * leaves this server — so a browser cannot manufacture it. This is what
     * stops someone posting a made-up payment id against their own pending
     * donation.
     */
    const signatureValid = this.razorpay.verifyCheckoutSignature({
      orderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
    });

    if (!signatureValid) {
      this.logger.warn(
        `Rejected checkout verification for donation ${donation.reference}: bad signature`,
      );
      throw new ValidationException(
        [
          {
            field: 'razorpaySignature',
            code: 'invalid',
            message: 'That payment could not be verified.',
          },
        ],
        'We could not verify this payment. If money has left your account it will be recorded shortly or returned.',
      );
    }

    // The order on the signature must be the order we created for THIS
    // donation. Without it, a valid signature from any other order of the
    // donor's own would verify this one.
    const [payment] = await this.database.db
      .select({ providerOrderId: payments.providerOrderId })
      .from(payments)
      .where(eq(payments.donationId, donation.id))
      .limit(1);

    if (!payment?.providerOrderId || payment.providerOrderId !== input.razorpayOrderId) {
      this.logger.warn(
        `Rejected checkout verification for donation ${donation.reference}: order mismatch`,
      );
      throw new ConflictException('That payment does not belong to this donation.');
    }

    const providerPayment = await this.razorpay.fetchPayment(input.razorpayPaymentId);
    return this.captureIfGenuine(donation, providerPayment, 'api_fetch');
  }

  /**
   * A webhook delivery.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * THE ORDER OF OPERATIONS IS THE DESIGN.
   *
   *   1. verify the HMAC over the RAW bytes — reject outright if it fails
   *   2. INSERT into `payment_webhooks`, whose unique `provider_event_id` is
   *      the entire deduplication strategy. A duplicate delivery becomes an
   *      insert conflict and returns here as a no-op.
   *   3. only then do the work
   *
   * Storing before processing, rather than after, is what makes step 2 a lock
   * rather than a record. It also means a delivery that crashes us mid-process
   * is on disk with its raw body, and can be replayed.
   *
   * ALWAYS 200 unless the signature is bad. Razorpay retries non-2xx responses,
   * and retrying an event we have stored and decided not to act on achieves
   * nothing but noise. A bad signature is the one case worth refusing loudly.
   * ══════════════════════════════════════════════════════════════════════════
   */
  async handleWebhook(input: {
    rawBody: Buffer | string;
    signature: string | undefined;
    eventId: string | undefined;
    headers: Record<string, unknown>;
  }): Promise<WebhookOutcome> {
    const valid = this.razorpay.verifyWebhookSignature(input.rawBody, input.signature);

    if (!valid) {
      // Logged without the body or the signature: an unverified payload is
      // attacker-controlled and does not belong in our logs.
      this.logger.warn('Rejected a Razorpay webhook with an invalid signature');
      return { accepted: false, duplicate: false };
    }

    const body = this.parse(input.rawBody);
    const eventType = typeof body?.event === 'string' ? body.event : 'unknown';

    /**
     * `x-razorpay-event-id` is the dedupe key Razorpay guarantees. Falling back
     * to the payload's own id keeps a delivery without the header usable; the
     * unique index means the worst case of a bad fallback is a rejected
     * duplicate, never a double capture.
     */
    const eventId = input.eventId ?? `${eventType}:${this.entityId(body) ?? crypto.randomUUID()}`;

    const stored = await this.database.db
      .insert(paymentWebhooks)
      .values({
        provider: 'razorpay',
        providerEventId: eventId,
        eventType,
        rawBody: typeof input.rawBody === 'string' ? input.rawBody : input.rawBody.toString('utf8'),
        signature: input.signature ?? null,
        signatureValid: true,
        headers: input.headers,
        processingStatus: 'pending',
      })
      .onConflictDoNothing({ target: paymentWebhooks.providerEventId })
      .returning({ id: paymentWebhooks.id });

    if (stored.length === 0) {
      this.logger.log(`Razorpay event ${eventId} already seen; ignoring the duplicate`);
      return { accepted: true, duplicate: true, eventType };
    }

    const webhookRowId = stored[0]!.id;

    try {
      if (ALARM_EVENTS.has(eventType)) {
        /*
          Deliberately no state change — see ALARM_EVENTS. Marked `needs_review`
          rather than `ignored` so these are one query away
          (`WHERE processing_status = 'needs_review'`) instead of buried among
          every subscription and settlement event Razorpay also sends.
        */
        this.logger.error(
          `Razorpay sent ${eventType} but this platform does not offer refunds. ` +
            `Money may have left the account without being recorded here. ` +
            `Reconcile by hand against the Razorpay dashboard; the full event is stored ` +
            `in payment_webhooks (id ${webhookRowId}).`,
        );
        await this.finish(webhookRowId, 'needs_review');
        return { accepted: true, duplicate: false, eventType };
      }

      if (!HANDLED_EVENTS.has(eventType)) {
        await this.finish(webhookRowId, 'ignored');
        return { accepted: true, duplicate: false, eventType };
      }

      await this.dispatch(eventType, body);
      await this.finish(webhookRowId, 'processed');
      return { accepted: true, duplicate: false, eventType };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Razorpay event ${eventId} (${eventType}) failed: ${message}`);
      await this.finish(webhookRowId, 'failed', message);
      // Still 200 to the caller: the event is on disk and replayable, and a
      // retry storm does not help a bug in our own handler.
      return { accepted: true, duplicate: false, eventType };
    }
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async dispatch(eventType: string, body: Record<string, unknown>): Promise<void> {
    const entity = this.paymentEntity(body);

    if (eventType === 'payment.captured' && entity) {
      const donation = await this.donationForOrder(entity.order_id);
      if (!donation) {
        // A payment for an order we have no record of. Worth shouting about —
        // it means an order was created that never became a donation row.
        this.logger.error(
          `Razorpay payment ${entity.id} captured for unknown order ${entity.order_id ?? 'none'}`,
        );
        return;
      }
      // Re-fetched rather than trusted: the signature proves origin, not that
      // the body still describes the payment's current state.
      const fresh = await this.razorpay.fetchPayment(entity.id);
      await this.captureIfGenuine(donation, fresh, 'webhook');
      return;
    }

    if (eventType === 'payment.failed' && entity) {
      const donation = await this.donationForOrder(entity.order_id);
      if (!donation) return;
      await this.capture.markFailed({
        donationId: donation.id,
        reason: entity.error_description ?? 'The payment was not completed.',
        errorCode: entity.error_code ?? undefined,
        providerPaymentId: entity.id,
        source: 'webhook',
      });
      return;
    }
  }

  /**
   * Capture, but only if the provider agrees this is real money.
   *
   * The amount check is the one that matters most: an attacker who can alter
   * the amount in a checkout call would otherwise pay ₹1 and have a ₹9,000
   * donation recorded. Comparing the provider's own figure against ours closes
   * that, and a mismatch is a refusal rather than a partial credit.
   */
  private async captureIfGenuine(
    donation: { id: string; reference: string; amount: number },
    providerPayment: RazorpayPayment,
    source: 'webhook' | 'api_fetch',
  ): Promise<CaptureOutcome> {
    if (providerPayment.status !== 'captured') {
      if (providerPayment.status === 'failed') {
        await this.capture.markFailed({
          donationId: donation.id,
          reason: providerPayment.error_description ?? 'The payment was not completed.',
          errorCode: providerPayment.error_code ?? undefined,
          providerPaymentId: providerPayment.id,
          source,
        });
      }

      throw new ConflictException(
        'That payment has not completed. If money has left your account it will be recorded or returned shortly.',
      );
    }

    if (providerPayment.amount !== donation.amount) {
      // Loud, because there is no innocent explanation. Either our arithmetic
      // disagrees with the order we created, or the amount was tampered with.
      this.logger.error(
        `Amount mismatch on donation ${donation.reference}: provider says ${providerPayment.amount}, we expect ${donation.amount}`,
      );
      throw new ConflictException(
        'The amount paid does not match this donation. Our team has been alerted and will contact you.',
      );
    }

    return this.capture.capture({
      donationId: donation.id,
      providerPayment,
      source,
    });
  }

  private async loadDonation(donationId: string) {
    const [donation] = await this.database.db
      .select({
        id: donations.id,
        reference: donations.reference,
        amount: donations.amount,
        status: donations.status,
      })
      .from(donations)
      .where(eq(donations.id, donationId))
      .limit(1);

    if (!donation) throw new NotFoundException('Donation');
    return donation;
  }

  private async donationForOrder(orderId: string | null | undefined) {
    if (!orderId) return null;

    const [row] = await this.database.db
      .select({
        id: donations.id,
        reference: donations.reference,
        amount: donations.amount,
      })
      .from(donations)
      .innerJoin(payments, eq(payments.donationId, donations.id))
      .where(eq(payments.providerOrderId, orderId))
      .limit(1);

    return row ?? null;
  }

  private async finish(
    id: string,
    status: 'processed' | 'failed' | 'ignored' | 'needs_review',
    error?: string,
  ): Promise<void> {
    await this.database.db
      .update(paymentWebhooks)
      .set({ processingStatus: status, processedAt: new Date(), error: error ?? null })
      .where(eq(paymentWebhooks.id, id));
  }

  private parse(rawBody: Buffer | string): Record<string, unknown> {
    try {
      return JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')) as Record<
        string,
        unknown
      >;
    } catch {
      return {};
    }
  }

  private paymentEntity(body: Record<string, unknown>): RazorpayPayment | null {
    const payload = body.payload as { payment?: { entity?: RazorpayPayment } } | undefined;
    return payload?.payment?.entity ?? null;
  }

  private entityId(body: Record<string, unknown>): string | null {
    return this.paymentEntity(body)?.id ?? null;
  }
}
