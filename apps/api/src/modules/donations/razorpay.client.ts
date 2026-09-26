import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';

import { AppConfig } from '../../config/app.config.js';
import { ServiceUnavailableException } from '../../common/exceptions.js';

/**
 * Razorpay, over its REST API.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY NOT THE OFFICIAL SDK.
 *
 * Two endpoints and two HMACs is the entire surface this platform uses. The
 * npm package wraps that in a callback-era client with its own `request`
 * dependency, and the part that actually matters — signature verification — is
 * eleven lines of `node:crypto` either way.
 *
 * The deciding reason is testability. This class is an injectable with a narrow
 * interface, so the capture tests substitute a fake and exercise the state
 * machine without a network or a sandbox account. Mocking a transitive HTTP
 * client to achieve the same thing tests the mock.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * NOTHING HERE IS EVER LOGGED. Not the key secret, not the webhook secret, not
 * a signature, not a full payment payload. The logger below prints order and
 * payment IDENTIFIERS only, which are already stored in the database and
 * already appear in the Razorpay dashboard.
 */

const API_BASE = 'https://api.razorpay.com/v1';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string;
}

export interface RazorpayPayment {
  id: string;
  order_id: string | null;
  /** Paise, as Razorpay reports it. Compared against our own figure, never trusted as it. */
  amount: number;
  currency: string;
  /**
   * RAZORPAY'S vocabulary, not ours. `refunded` stays in this union because
   * Razorpay can genuinely report it — a refund raised in their dashboard — and
   * a type that omitted it would be lying about the API. Nothing here acts on
   * it; see ALARM_EVENTS in payment-verification.service.ts.
   */
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  method?: string;
  bank?: string | null;
  wallet?: string | null;
  card?: { last4?: string; network?: string } | null;
  international?: boolean;
  fee?: number | null;
  tax?: number | null;
  error_code?: string | null;
  error_description?: string | null;
}

@Injectable()
export class RazorpayClient {
  private readonly logger = new Logger(RazorpayClient.name);

  /**
   * The credentials, held as NON-ENUMERABLE fields.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * Not `private readonly config: AppConfig`, and not plain private fields.
   *
   * A private field in TypeScript is a compile-time courtesy: at runtime it is
   * an ordinary enumerable property, so `JSON.stringify(client)` prints it, and
   * so does anything that serialises an object graph — a Sentry breadcrumb, a
   * structured log that was handed the wrong argument, a debug dump of a failed
   * injection. Holding the whole `AppConfig` is worse again: that exposes every
   * secret the process has, through a class whose failures are most likely to
   * be logged.
   *
   * `defineProperty` with `enumerable: false` keeps them reachable from methods
   * and invisible to serialisation. It is not a defence against determined code
   * — nothing in a process can be — but it removes the accident, and the
   * accident is the realistic threat.
   *
   * There is a test asserting `JSON.stringify(client)` contains neither secret.
   * ══════════════════════════════════════════════════════════════════════════
   */
  private readonly keyId!: string;
  private readonly keySecret!: string;
  private readonly webhookSecret!: string;

  constructor(config: AppConfig) {
    for (const [name, value] of [
      ['keyId', config.env.RAZORPAY_KEY_ID ?? ''],
      ['keySecret', config.env.RAZORPAY_KEY_SECRET ?? ''],
      ['webhookSecret', config.env.RAZORPAY_WEBHOOK_SECRET ?? ''],
    ] as const) {
      Object.defineProperty(this, name, { value, enumerable: false, writable: false });
    }
  }

  /**
   * Whether payments can be taken at all.
   *
   * Checked by the donation endpoints so a development machine without
   * credentials refuses one request with an explanation, rather than the whole
   * API failing to boot. In production the config layer has already made these
   * mandatory, so this is always true there.
   */
  get isConfigured(): boolean {
    return Boolean(this.keyId && this.keySecret);
  }

  /** The only credential that may reach a browser. */
  get publicKeyId(): string {
    return this.keyId;
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
  }

  private async call<T>(path: string, init: RequestInit & { body?: string } = {}): Promise<T> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'Online payments are not configured on this server. No money has been taken.',
      );
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
          Authorization: this.authHeader(),
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
        // A payment provider that has not answered in fifteen seconds is not
        // going to. Holding the request open longer ties up a donor's browser
        // and, on a create, risks them pressing the button again.
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      // The message is deliberately vague to the caller and specific in the
      // log: a donor does not need our provider's hostname.
      this.logger.error(
        `Razorpay ${init.method ?? 'GET'} ${path} failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      throw new ServiceUnavailableException(
        'We could not reach the payment provider. Please try again in a moment.',
      );
    }

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
      error?: { description?: string; code?: string };
    };

    if (!response.ok) {
      // Razorpay's own description is logged but NOT returned: it can quote
      // back parts of the request, and this is a path a donor can reach.
      this.logger.error(
        `Razorpay ${init.method ?? 'GET'} ${path} → ${response.status} ${payload.error?.code ?? ''}: ${payload.error?.description ?? ''}`,
      );
      throw new ServiceUnavailableException(
        'The payment provider rejected this request. No money has been taken.',
      );
    }

    return payload as T;
  }

  /**
   * Create an order.
   *
   * `amount` is paise and comes from OUR calculation, never from the browser.
   * `receipt` is our donation reference, which is how a payment found in the
   * Razorpay dashboard is traced back to a row here.
   */
  async createOrder(input: {
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<RazorpayOrder> {
    const order = await this.call<RazorpayOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        receipt: input.receipt,
        // Razorpay captures automatically on success. The alternative,
        // authorise-then-capture, leaves money held on a donor's card while a
        // second call is made, and there is nothing here to review in between.
        payment_capture: 1,
        notes: input.notes ?? {},
      }),
    });

    this.logger.log(`Razorpay order ${order.id} created for receipt ${input.receipt}`);
    return order;
  }

  /** Fetch a payment from the provider. The authority on what was actually charged. */
  async fetchPayment(paymentId: string): Promise<RazorpayPayment> {
    return this.call<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
  }

  // -------------------------------------------------------------------------
  // Signatures
  // -------------------------------------------------------------------------

  /**
   * The checkout handshake signature.
   *
   * Razorpay returns `razorpay_signature` to the BROWSER after a successful
   * payment, computed as HMAC-SHA256 of `order_id|payment_id` keyed with the
   * API secret. Because the secret never leaves our server, a browser cannot
   * manufacture this — which is what makes the client's success callback worth
   * anything at all.
   *
   * It is still not proof on its own. It proves the browser saw a genuine
   * Razorpay response for this order; it does not prove the payment captured,
   * nor for how much. The caller re-fetches the payment and compares the amount
   * before anything is marked paid.
   */
  verifyCheckoutSignature(input: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    if (!this.keySecret) return false;
    return this.matches(`${input.orderId}|${input.paymentId}`, input.signature, this.keySecret);
  }

  /**
   * The webhook signature.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * COMPUTED OVER THE RAW BYTES, and this is the single most common way a
   * webhook verification is written wrongly.
   *
   * `JSON.parse` then `JSON.stringify` does not round-trip: key order, unicode
   * escaping and number formatting can all change, and the HMAC then differs
   * from the provider's over the same logical document. The API sets
   * `rawBody: true` at bootstrap precisely so the untouched buffer is available
   * here.
   *
   * A DIFFERENT SECRET from the API key. Razorpay issues the webhook secret
   * when the endpoint is registered; using the key secret here fails every
   * delivery, silently, because a rejected webhook looks exactly like one that
   * never arrived.
   * ══════════════════════════════════════════════════════════════════════════
   */
  verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined): boolean {
    if (!this.webhookSecret || !signature) return false;
    return this.matches(rawBody, signature, this.webhookSecret);
  }

  /**
   * Constant-time comparison.
   *
   * `===` on a signature leaks its prefix through timing: an attacker who can
   * measure the response can find the correct digest one byte at a time. The
   * length check first is not a leak — the length of a hex SHA-256 is public.
   */
  private matches(payload: Buffer | string, signature: string, secret: string): boolean {
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const given = Buffer.from(signature, 'utf8');
    const mine = Buffer.from(expected, 'utf8');
    if (given.length !== mine.length) return false;
    return timingSafeEqual(given, mine);
  }
}
