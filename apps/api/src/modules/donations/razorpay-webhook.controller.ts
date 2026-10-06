import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator.js';
import { RawResponse } from '../../common/decorators/raw-response.decorator.js';
import { PaymentVerificationService } from './payment-verification.service.js';
import { ServiceUnavailableException, UnauthenticatedException } from '../../common/exceptions.js';

/**
 * The Razorpay webhook.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE AUTHORITATIVE PATH. The browser's return from Checkout is a convenience;
 * this is what the record is finally built on, because it arrives whether or
 * not the donor's phone survived the redirect.
 *
 * `@Public()` because Razorpay has no session — the HMAC over the raw body IS
 * the authentication, and it is stronger than a bearer token would be.
 *
 * `@SkipThrottle()` because rate-limiting a payment provider is
 * self-sabotage. A burst of deliveries is Razorpay catching up after an outage,
 * which is exactly when the events matter most; throttling them turns a
 * recoverable backlog into lost captures. The unique event id is what protects
 * against repetition, and it protects against it properly.
 *
 * WHAT IT ANSWERS:
 *   - 401 on a bad signature: misconfiguration or probing. Nothing is stored.
 *   - 503 when processing failed in a way a later delivery may fix (provider
 *     unreachable, database error). The event is stored `failed` — not
 *     terminal — and Razorpay's retry processes it again.
 *   - 200 for everything that is finished: processed, ignored, flagged for a
 *     human, or a duplicate of a finished event.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('webhooks')
@Controller()
export class RazorpayWebhookController {
  constructor(private readonly verification: PaymentVerificationService) {}

  @Public()
  @SkipThrottle()
  /*
    OUTSIDE the response envelope.

    Every other endpoint answers `{ success, data, meta }`, which is right for a
    client that shares one error-handling path. Razorpay is not that client: it
    reads the status code and ignores the body, and wrapping a webhook
    acknowledgement in our own shape only makes the log of what we told it
    harder to read against their dashboard.
  */
  @RawResponse()
  @Post('payments/razorpay/webhook')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Razorpay payment events' })
  async handle(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Headers('x-razorpay-event-id') eventId: string | undefined,
  ) {
    /**
     * THE RAW BUFFER, never `request.body`.
     *
     * The HMAC is computed over the exact bytes Razorpay sent. Re-serialising a
     * parsed object does not reproduce them — key order, unicode escaping and
     * number formatting all drift — and the signature then fails over a
     * document that is logically identical. `rawBody: true` is set at bootstrap
     * in main.ts for this one line.
     */
    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {}), 'utf8');

    const outcome = await this.verification.handleWebhook({
      rawBody,
      signature,
      eventId,
      headers: {
        // A deliberately narrow copy. The full header set carries the signature
        // and whatever else a proxy added, and this is written to the database.
        'user-agent': request.headers['user-agent'],
        'content-type': request.headers['content-type'],
        'x-razorpay-event-id': eventId,
      },
    });

    // A bad signature: either a misconfiguration or someone probing. 401, and
    // nothing was stored. (`@HttpCode(200)` only sets the SUCCESS status; a
    // thrown exception carries its own.)
    if (!outcome.accepted) {
      throw new UnauthenticatedException('The webhook signature did not verify.');
    }

    // Not finished, and worth another try: a non-2xx is what makes Razorpay
    // deliver the event again.
    if (outcome.retry) {
      throw new ServiceUnavailableException('The event could not be processed yet. Please retry.');
    }

    return { status: outcome.duplicate ? 'duplicate' : 'received' };
  }
}
