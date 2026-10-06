import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  RequireAudience,
  RequirePermission,
} from '../../common/decorators/permissions.decorator.js';
import { PaymentExceptionsService } from './payment-exceptions.service.js';

/**
 * Payment exceptions (Phase 11). GET only — there is deliberately no write
 * route here, and no way to mark a donation successful by hand.
 */
@ApiTags('admin: payments')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly exceptions: PaymentExceptionsService) {}

  @RequirePermission('payment.read')
  @Get('exceptions')
  @ApiOperation({
    summary: 'Payment exceptions',
    description:
      'Webhooks that failed, never finished or were flagged for review (amount, currency or order mismatch; refunds raised outside the platform), and donations still pending long after they should have settled. Read-only; identifiers only, no donor details and no raw payloads.',
  })
  list() {
    return this.exceptions.list();
  }
}
