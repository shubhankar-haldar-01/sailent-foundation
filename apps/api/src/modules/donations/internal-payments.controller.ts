import { Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiExcludeController } from '@nestjs/swagger';

import { INTERNAL_AUTH_HEADER } from '@sailent/config';

import { Public } from '../../common/decorators/public.decorator.js';
import { ServiceUnavailableException, UnauthenticatedException } from '../../common/exceptions.js';
import { presentsInternalSecret } from '../../common/security/internal-request.js';
import { AppConfig } from '../../config/app.config.js';
import { PaymentReconciliationService } from './payment-reconciliation.service.js';

/**
 * The worker's way in (Phase 11).
 *
 * The worker schedules payment reconciliation and calls this endpoint to run
 * it, because the capture logic lives here and must not be copied. It is
 * authenticated by `INTERNAL_API_SECRET` alone — no user, no session — and
 * hidden from the API documentation.
 *
 * Abuse would gain nothing: a run only records payments Razorpay confirms and
 * expires donations nobody paid for, and every write is conditional. It is
 * still refused without the secret, and answers 503 where none is configured
 * so a misconfigured worker shows up as failing jobs rather than silent no-ops.
 */
@ApiExcludeController()
@Controller('internal/payments')
export class InternalPaymentsController {
  constructor(
    private readonly config: AppConfig,
    private readonly reconciliation: PaymentReconciliationService,
  ) {}

  @Public()
  @SkipThrottle()
  @Post('reconcile')
  @HttpCode(200)
  reconcile(@Headers() headers: Record<string, string | string[] | undefined>) {
    const secret = this.config.env.INTERNAL_API_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException(
        'Reconciliation is not configured on this server (INTERNAL_API_SECRET is unset).',
      );
    }
    if (!presentsInternalSecret(headers, secret)) {
      throw new UnauthenticatedException(`A valid ${INTERNAL_AUTH_HEADER} header is required.`);
    }
    return this.reconciliation.run();
  }
}
