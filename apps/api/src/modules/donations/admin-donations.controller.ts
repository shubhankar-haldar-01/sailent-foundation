import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedActor } from '@sailent/types';

import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import {
  RequireAudience,
  RequirePermission,
} from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AdminDonationsService } from './admin-donations.service.js';
import { ReceiptsService } from './receipts.service.js';
import { adminDonationListQuerySchema, donationIdParam } from './dto/donations.dto.js';

/**
 * Donation administration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THERE IS NO ENDPOINT THAT MARKS A DONATION SUCCESSFUL, and its absence is the
 * most important thing about this controller.
 *
 * An administrator who could set that flag could manufacture a donation that
 * never happened, and every downstream figure — campaign progress, a donor's
 * history, the annual filing — would inherit it. The only routes into
 * `successful` are a Razorpay payment verified against the provider and a
 * reconciliation that re-fetches one. Reconciliation is Finance's, is sensitive,
 * and still ends at the same verification.
 *
 * PII IS GATED IN THE QUERY, not in a serialiser. A caller without
 * `donation.read_pii` gets `NULL` for donor name, email and phone because those
 * columns are never selected — not because something dropped them on the way
 * out. Same for payment identifiers and `payment.read`.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('admin: donations')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class AdminDonationsController {
  constructor(
    private readonly donations: AdminDonationsService,
    private readonly receipts: ReceiptsService,
  ) {}

  @RequirePermission('donation.read')
  @Get('donations')
  @ApiOperation({
    summary: 'List donations',
    description:
      'Donor name and email are returned only to a caller holding `donation.read_pii`; otherwise those columns are not selected at all, and the search does not match on them either.',
  })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'campaignId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date' })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search the reference (and donor, with PII access)',
  })
  list(
    @Query(new ZodValidationPipe(adminDonationListQuerySchema)) query: never,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.donations.list(query, {
      includePii: actor.permissions.includes('donation.read_pii'),
    });
  }

  @RequirePermission('donation.read')
  @Get('donations/:id')
  @ApiOperation({
    summary: 'One donation, with its items and payment',
    description:
      'Payment identifiers require `payment.read`; donor identity requires `donation.read_pii`. Line items always show the SNAPSHOTTED name and price — what the donor actually paid, not what the catalogue says today.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  get(
    @Param(new ZodValidationPipe(donationIdParam)) params: { id: string },
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.donations.getById(params.id, {
      includePii: actor.permissions.includes('donation.read_pii'),
      includePayment: actor.permissions.includes('payment.read'),
    });
  }

  @RequirePermission('receipt.read')
  @Get('donations/:id/receipt')
  @ApiOperation({
    summary: 'The receipt issued for a donation',
    description:
      'A transactional acknowledgement, not an 80G certificate. The stored line items are the historical record and are never re-derived from the catalogue.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  async receipt(@Param(new ZodValidationPipe(donationIdParam)) params: { id: string }) {
    const donation = await this.donations.getById(params.id, {
      includePii: true,
      includePayment: false,
    });
    return this.receipts.getByNumber(donation.receiptNumber ?? '');
  }
}
