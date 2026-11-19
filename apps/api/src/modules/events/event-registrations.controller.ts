import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import type { AuthenticatedActor } from '@sailent/types';

import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import { RequireAudience } from '../../common/decorators/permissions.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { EventRegistrationsService } from './event-registrations.service.js';
import {
  CreateEventOrderDto,
  RegisterForEventDto,
  RequestEventOtpDto,
  VerifyEventOtpDto,
  cancelRegistrationSchema,
  createEventOrderSchema,
  eventIdParam,
  registerForEventSchema,
  requestEventOtpSchema,
  verifyEventOtpSchema,
  type CreateEventOrderInput,
  type RegisterForEventInput,
  type RequestEventOtpInput,
  type VerifyEventOtpInput,
} from './dto/events.dto.js';
import { requestClientIp } from '../../common/security/internal-request.js';

/**
 * Registering for an event, as the person attending.
 *
 * Supports both verified donor registrations and public attendee registrations.
 * A unique authentication pass code (`SF-EVT-...`) is issued on confirmation.
 */
@ApiTags('Event registration')
@ApiBearerAuth()
@Controller('events')
export class EventRegistrationsController {
  constructor(private readonly registrations: EventRegistrationsService) {}

  private context(request: Request) {
    return {
      // The trusted client address (Phase 12), never a raw X-Forwarded-For.
      ipAddress: requestClientIp(request),
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string | undefined,
    };
  }

  @Post(':id/register')
  @RequireAudience('donor')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Register for an event (donor)',
    description:
      'Capacity, the deadline and the event’s state are all checked under a row lock, so two people racing for the last place cannot both succeed. The email address is read from your account if not supplied.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: RegisterForEventDto, required: false })
  @ApiResponse({ status: 201, description: 'Registered' })
  @ApiResponse({
    status: 409,
    description: 'Already registered, full, closed, cancelled, or past the deadline',
  })
  @ApiResponse({ status: 404, description: 'No such event, or it is not published' })
  register(
    @Param(new ZodValidationPipe(eventIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(registerForEventSchema)) body: RegisterForEventInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.registrations.register(params.id, actor.id, body, this.context(request));
  }

  /*
    PER-CLIENT LIMITS on the public registration routes (2026-11-19). Without
    them only the global 100 a minute applied: one client could have codes
    emailed to ~100 different addresses a minute (the per-address limit in the
    service does not stop a spray across addresses), spamming strangers and
    spending the provider's daily quota that sign-in codes depend on. Close to
    the donor sign-in limits, a little looser for people sharing a venue's
    Wi-Fi. Proven in test/rate-limit.spec.ts.
  */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post(':id/public-register')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Register for an event (public attendee)',
    description:
      'Capacity, the deadline and the event’s state are all checked under a row lock. Generates an authentic entry pass number.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: RegisterForEventDto })
  @ApiResponse({ status: 201, description: 'Registered' })
  @ApiResponse({
    status: 409,
    description: 'Already registered, full, closed, cancelled, or past the deadline',
  })
  @ApiResponse({ status: 404, description: 'No such event, or it is not published' })
  publicRegister(
    @Param(new ZodValidationPipe(eventIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(registerForEventSchema)) body: RegisterForEventInput,
    @Req() request: Request,
  ) {
    return this.registrations.register(params.id, null, body, this.context(request));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post(':id/order')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create a Razorpay order for paid event registration',
    description:
      'Validates event capacity, deadline, and paid status before issuing a Razorpay order ID.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: CreateEventOrderDto, required: false })
  @ApiResponse({ status: 200, description: 'Order created with Razorpay details' })
  @ApiResponse({ status: 409, description: 'Event not paid, full, closed, or already registered' })
  createOrder(
    @Param(new ZodValidationPipe(eventIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(createEventOrderSchema)) body: CreateEventOrderInput,
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Req() request: Request,
  ) {
    return this.registrations.createRegistrationOrder(
      params.id,
      actor?.audience === 'donor' ? actor.id : null,
      body,
      this.context(request),
    );
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @Post(':id/otp/request')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Request email verification OTP for event registration',
    description: 'Dispatches a 6-digit OTP code to the provided email address.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: RequestEventOtpDto })
  @ApiResponse({ status: 200, description: 'OTP sent to email' })
  @ApiResponse({ status: 409, description: 'Event full, closed or unavailable' })
  requestOtp(
    @Param(new ZodValidationPipe(eventIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(requestEventOtpSchema)) body: RequestEventOtpInput,
    @Req() request: Request,
  ) {
    return this.registrations.requestEventOtp(
      params.id,
      body.email,
      body.name,
      this.context(request),
    );
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post(':id/otp/verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify email OTP for event registration',
    description: 'Validates the 6-digit code sent to the email.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: VerifyEventOtpDto })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  verifyOtp(
    @Param(new ZodValidationPipe(eventIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(verifyEventOtpSchema)) body: VerifyEventOtpInput,
    @Req() request: Request,
  ) {
    return this.registrations.verifyEventOtp(
      params.id,
      body.email,
      body.code,
      this.context(request),
    );
  }

  @Get(':id/registration')
  @RequireAudience('donor')
  @ApiOperation({
    summary: 'Your registration for this event',
    description: 'Includes entry pass and details. A cancelled registration gets no link.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 404, description: 'You have no registration for this event' })
  mine(
    @Param(new ZodValidationPipe(eventIdParam)) params: { id: string },
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.registrations.myRegistration(params.id, actor.id);
  }

  @Delete(':id/registration')
  @RequireAudience('donor')
  @ApiOperation({
    summary: 'Cancel your registration',
    description:
      'Frees the seat under the same lock registration takes. Refused once attendance has been recorded — that is a record of what happened, not a booking.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 409, description: 'Already cancelled, or attendance has been recorded' })
  cancel(
    @Param(new ZodValidationPipe(eventIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(cancelRegistrationSchema)) body: { reason?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.registrations.cancelMine(params.id, actor.id, body?.reason, this.context(request));
  }
}
