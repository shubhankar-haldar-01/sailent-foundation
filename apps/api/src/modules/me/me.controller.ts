import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthenticatedActor } from '@sailent/types';

import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import { RequireAudience } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { paginationQuerySchema, type PaginationQuery } from '../../common/dto/pagination.dto.js';
import { MeService } from './me.service.js';
import { EventRegistrationsService } from '../events/event-registrations.service.js';
import { myEventsQuerySchema, type MyEventsQuery } from '../events/dto/events.dto.js';
import {
  campaignIdParam,
  donationIdParam,
  emailChangeRequestSchema,
  emailChangeVerifySchema,
  myDonationsQuerySchema,
  saveCampaignSchema,
  SaveCampaignDto,
  updateProfileSchema,
  UpdateProfileDto,
  updateSettingsSchema,
  UpdateSettingsDto,
  type MyDonationsQuery,
  type UpdateProfileInput,
  type UpdateSettingsInput,
} from './dto/me.dto.js';
import { requestClientIp } from '../../common/security/internal-request.js';

/**
 * The donor's own account.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * `@RequireAudience('donor')` ON THE CONTROLLER, SO IT CANNOT BE FORGOTTEN
 * ON A ROUTE.
 *
 * Staff tokens are a different audience and are refused here — not because
 * staff are untrusted, but because `actor.id` means something different in each
 * one. On a donor token it is a `donors.id`; on a staff token it is a
 * `users.id`. A staff token reaching these handlers would scope every query to
 * a donor id that happens to be a user id, and the only reason it would return
 * nothing is that the two id spaces do not collide. That is luck, not a
 * boundary. Staff read donors through `/admin/donors`, which is built for it
 * and requires a permission.
 *
 * THERE IS NO `donorId` PARAMETER ANYWHERE IN THIS FILE. Every handler passes
 * `actor.id`, which the guard resolved from a session row in the database. A
 * donor cannot address another donor's data because there is no syntax for it.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('Donor account')
@ApiBearerAuth()
@RequireAudience('donor')
@Controller('me')
export class MeController {
  constructor(
    private readonly me: MeService,
    /**
     * Read through the events module rather than reimplemented here.
     *
     * "The signed-in donor's own X" routes all live on this controller, so the
     * dashboard has one place to look — but the rules about a registration
     * belong with registration, and a second copy of the ownership filter is a
     * second place for it to be got wrong.
     */
    private readonly registrations: EventRegistrationsService,
  ) {}

  private context(request: Request) {
    return {
      // The trusted client address (Phase 12), never a raw X-Forwarded-For.
      ipAddress: requestClientIp(request),
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string | undefined,
    };
  }

  // -------------------------------------------------------------------------

  @Get()
  @ApiOperation({
    summary: 'The signed-in donor',
    description: 'Profile and lifetime totals. Totals are maintained by payment capture, not here.',
  })
  profile(@CurrentActor() actor: AuthenticatedActor) {
    return this.me.profile(actor.id);
  }

  @Patch()
  @ApiOperation({
    summary: 'Update the signed-in donor',
    description:
      'Name, email, address and tax id only. Amounts, statuses, donor code and lifetime totals are server-controlled and are rejected rather than ignored.',
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 422, description: 'An unknown or server-controlled field was sent' })
  updateProfile(
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.me.updateProfile(actor.id, body, this.context(request));
  }

  /**
   * Change the account's email address, in two verified steps (Phase 12).
   * A code goes to the NEW address; the address changes only when it returns.
   */
  @Post('email/change')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  @ApiOperation({
    summary: 'Start an email change',
    description:
      'Sends a six-digit code to the new address. The address does not change until `POST /me/email/verify` is called with that code. Says nothing about whether the new address already has an account.',
  })
  requestEmailChange(
    @Body(new ZodValidationPipe(emailChangeRequestSchema)) body: { email: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.me.requestEmailChange(actor.id, body.email, this.context(request));
  }

  @Post('email/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @ApiOperation({
    summary: 'Finish an email change',
    description:
      'Applies the new address once the code sent to it is entered. 409 if the address belongs to another account.',
  })
  verifyEmailChange(
    @Body(new ZodValidationPipe(emailChangeVerifySchema)) body: { email: string; code: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.me.verifyEmailChange(actor.id, body.email, body.code, this.context(request));
  }

  @Get('overview')
  @ApiOperation({ summary: 'Everything the dashboard landing page shows, in one request' })
  overview(@CurrentActor() actor: AuthenticatedActor) {
    return this.me.overview(actor.id);
  }

  // -------------------------------------------------------------------------

  @Get('donations')
  @ApiOperation({
    summary: 'This donor’s giving history',
    description: 'Scoped to the session. There is no donor filter to pass.',
  })
  donations(
    @Query(new ZodValidationPipe(myDonationsQuerySchema)) query: MyDonationsQuery,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.me.donations(actor.id, query);
  }

  @Get('donations/:id')
  @ApiOperation({
    summary: 'One of this donor’s donations',
    description:
      'A donation belonging to another donor returns 404, not 403 — 403 would confirm that the id exists.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 404, description: 'No such donation for this donor' })
  donation(
    @Param(new ZodValidationPipe(donationIdParam)) params: { id: string },
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.me.donation(actor.id, params.id);
  }

  @Get('donations/:id/receipt')
  @ApiOperation({
    summary: 'The receipt for one of this donor’s donations',
    description:
      'A receipt acknowledges a payment. It is not an 80G certificate — that is Form 10BE, issued by the Income Tax Department after the annual Form 10BD filing.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 404, description: 'No receipt, or not this donor’s donation' })
  receipt(
    @Param(new ZodValidationPipe(donationIdParam)) params: { id: string },
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.me.receipt(actor.id, params.id);
  }

  // -------------------------------------------------------------------------

  @Get('campaigns')
  @ApiOperation({
    summary: 'Campaigns this donor has funded',
    description: 'Confirmed donations only, with this donor’s own contribution to each.',
  })
  supportedCampaigns(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.me.supportedCampaigns(actor.id, query);
  }

  @Get('saved-campaigns')
  @ApiOperation({ summary: 'Campaigns this donor has saved' })
  savedCampaigns(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.me.savedCampaigns(actor.id, query);
  }

  @Post('saved-campaigns')
  @ApiOperation({
    summary: 'Save a campaign',
    description: 'Idempotent. Saving one already saved succeeds and changes nothing.',
  })
  @ApiBody({ type: SaveCampaignDto })
  @ApiResponse({ status: 404, description: 'No such campaign' })
  saveCampaign(
    @Body(new ZodValidationPipe(saveCampaignSchema)) body: { campaignId: string },
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.me.saveCampaign(actor.id, body.campaignId);
  }

  @Delete('saved-campaigns/:campaignId')
  @ApiOperation({
    summary: 'Remove a saved campaign',
    description: 'Also idempotent. Removing one that is not saved succeeds.',
  })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  unsaveCampaign(
    @Param(new ZodValidationPipe(campaignIdParam)) params: { campaignId: string },
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.me.unsaveCampaign(actor.id, params.campaignId);
  }

  // -------------------------------------------------------------------------

  @Get('impact')
  @ApiOperation({
    summary: 'What this donor’s giving bought',
    description:
      'Summed from this donor’s own confirmed donation lines. No multipliers and no apportioned share of a campaign total (decision A14).',
  })
  impact(@CurrentActor() actor: AuthenticatedActor) {
    return this.me.impact(actor.id);
  }

  @Get('updates')
  @ApiOperation({
    summary: 'Published impact updates from campaigns this donor funded',
  })
  updates(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.me.updates(actor.id, query);
  }

  // -------------------------------------------------------------------------

  @Get('events')
  @ApiOperation({
    summary: 'Events the signed-in donor has registered for',
    description:
      'Cancelled registrations are included and labelled — “I cancelled this” is something a person needs to be able to confirm.',
  })
  @ApiQuery({ name: 'when', required: false, enum: ['upcoming', 'past'] })
  events(
    @Query(new ZodValidationPipe(myEventsQuerySchema)) query: MyEventsQuery,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.registrations.myEvents(actor.id, query);
  }

  // -------------------------------------------------------------------------

  @Get('settings')
  @ApiOperation({ summary: 'Notification and visibility preferences' })
  settings(@CurrentActor() actor: AuthenticatedActor) {
    return this.me.settings(actor.id);
  }

  @Patch('settings')
  @ApiOperation({
    summary: 'Update notification and visibility preferences',
    description: 'Consent changes are audited — they are the answer to “prove I agreed”.',
  })
  @ApiBody({ type: UpdateSettingsDto })
  updateSettings(
    @Body(new ZodValidationPipe(updateSettingsSchema)) body: UpdateSettingsInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.me.updateSettings(actor.id, body, this.context(request));
  }
}
