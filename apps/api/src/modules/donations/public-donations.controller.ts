import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { DonationsService } from './donations.service.js';
import { DonationIdempotencyService } from './donation-idempotency.service.js';
import { PaymentVerificationService } from './payment-verification.service.js';
import { ReceiptsService } from './receipts.service.js';
import {
  CreateDonationDto,
  VerifyPaymentDto,
  createDonationSchema,
  donationIdParam,
  donationReferenceParam,
  verifyPaymentSchema,
} from './dto/donations.dto.js';

/**
 * The donor-facing donation endpoints.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * EVERY ROUTE HERE IS `@Public()`, AND EVERY ONE IS DELIBERATE.
 *
 * Giving does not require an account (decision A8). A donor arrives from a
 * shared link, gives, and receives a receipt by email; making them sign up
 * first loses most of them and gains the organisation nothing it cannot get
 * from the donation itself.
 *
 * Public does not mean unprotected. Each route is rate-limited well below the
 * global ceiling, each takes ids rather than amounts, and the two that matter
 * verify everything server-side against Razorpay before a rupee is recorded.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('donations')
@Controller()
export class PublicDonationsController {
  constructor(
    private readonly donations: DonationsService,
    private readonly idempotency: DonationIdempotencyService,
    private readonly verification: PaymentVerificationService,
    private readonly receipts: ReceiptsService,
  ) {}

  /**
   * Start a donation and get an order to pay it with.
   *
   * Ten a minute per address. A donor pressing the button twice is normal and
   * must not be punished; a script opening a thousand orders to enumerate
   * campaign products is not. Each attempt costs a Razorpay order, so the
   * limit protects the provider account as well as this service.
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('donations')
  @ApiOperation({
    summary: 'Create a donation and its payment order',
    description:
      'The body carries campaign-product ids and quantities only. Every price and the total are read from the database and recomputed here — an amount sent by the client is not read. The donation is created `pending`; no campaign or product progress moves until the payment is verified.',
  })
  @ApiBody({ type: CreateDonationDto })
  @ApiResponse({ status: 201, description: 'Created, with the Razorpay order to pay it' })
  @ApiResponse({
    status: 409,
    description: 'The campaign is closed, or units are no longer available',
  })
  @ApiResponse({ status: 422, description: 'The donation is not valid as composed' })
  create(
    @Body(new ZodValidationPipe(createDonationSchema)) body: never,
    @Req() request: Request,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    /*
      Optional `Idempotency-Key` (Phase 11): a retried request with the same
      key and body returns the donation already made instead of a second one.
      See DonationIdempotencyService for the rules.
    */
    return this.idempotency.run(idempotencyKey, body, () =>
      this.donations.create({
        ...(body as object),
        source: 'web',
        // Recorded for the FCRA guard: the organisation is not registered to
        // accept foreign contributions, so one received in error must be
        // identifiable and returnable.
        ipCountry: (request.headers['cf-ipcountry'] as string | undefined)?.slice(0, 2),
      } as never),
    );
  }

  /**
   * Verify a payment the browser says succeeded.
   *
   * THE FAST PATH, not the authoritative one. It exists so a donor sees a
   * result immediately instead of watching a spinner until Razorpay's webhook
   * lands. It performs the same verification the webhook does — signature,
   * then a fetch from Razorpay, then an amount comparison — and the two race
   * harmlessly because capture is idempotent.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('donations/:id/verify-payment')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify a completed checkout',
    description:
      'Checks the Checkout signature, then re-fetches the payment from Razorpay and compares its amount against the donation before anything is recorded. A success here and a webhook arriving later do not double-count: whichever is first does the work.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: VerifyPaymentDto })
  @ApiResponse({ status: 200, description: 'Verified and recorded, or already recorded' })
  @ApiResponse({
    status: 409,
    description: 'The payment has not completed, or the amount disagrees',
  })
  verify(
    @Param(new ZodValidationPipe(donationIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(verifyPaymentSchema))
    body: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
  ) {
    return this.verification.verifyCheckout({ donationId: params.id, ...body });
  }

  /**
   * A donation's public status, by its reference.
   *
   * What the status page polls while it waits for a webhook. Keyed on the
   * reference rather than the uuid because that is what the donor has, and it
   * returns no payment identifiers and no donor details beyond the name they
   * typed themselves.
   */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('donations/:reference')
  @ApiOperation({ summary: 'A donation’s status and items, by its public reference' })
  @ApiParam({ name: 'reference', example: 'DON-7K2MPQ4X' })
  get(@Param(new ZodValidationPipe(donationReferenceParam)) params: { reference: string }) {
    return this.donations.getByReference(params.reference);
  }

  /**
   * The receipt for a donation.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * THE REFERENCE IS A CAPABILITY. It is the only thing standing between a
   * request and somebody's receipt, so it is generated with enough entropy to
   * be unguessable and it is rate-limited here.
   *
   * That is the right trade for a guest donation: the alternative is requiring
   * an account to see a receipt the donor has already been emailed. The
   * response carries no payment identifiers and no donor address or phone.
   * ══════════════════════════════════════════════════════════════════════════
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('donations/:reference/receipt')
  @ApiOperation({
    summary: 'The receipt for a donation',
    description:
      'A transactional acknowledgement that money was received. NOT an 80G tax certificate — that is Form 10BE, issued by the Income Tax Department after the annual Form 10BD filing.',
  })
  @ApiParam({ name: 'reference', example: 'DON-7K2MPQ4X' })
  receipt(@Param(new ZodValidationPipe(donationReferenceParam)) params: { reference: string }) {
    return this.receipts.getByDonationReference(params.reference);
  }
}
