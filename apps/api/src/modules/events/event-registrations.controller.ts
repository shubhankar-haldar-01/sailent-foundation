import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthenticatedActor } from '@sailent/types';

import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import { RequireAudience } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { EventRegistrationsService } from './event-registrations.service.js';
import {
  RegisterForEventDto,
  cancelRegistrationSchema,
  eventIdParam,
  registerForEventSchema,
} from './dto/events.dto.js';
import { requestClientIp } from '../../common/security/internal-request.js';

/**
 * Registering for an event, as the person attending.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * `@RequireAudience('donor')` ON THE CONTROLLER, SO IT CANNOT BE FORGOTTEN ON
 * A ROUTE — the same rule, for the same reason, as `MeController`.
 *
 * REGISTRATION REQUIRES A SIGNED-IN ACCOUNT, and that is a decision rather than
 * an oversight. §49 says a person may create, view and cancel their OWN
 * registration and nobody else's, and ownership has to be anchored to
 * something the server established. A guest registration identified by an
 * email typed into a form is owned by whoever types that email: anyone could
 * cancel a stranger's place, and the cancellation notice would go to the
 * stranger.
 *
 * The cost of requiring an account is low here, because the account is the
 * existing passwordless one — an email address and a six-digit code, no
 * password to invent or forget. Nothing new was built for this.
 *
 * THERE IS NO `donorId` PARAMETER IN THIS FILE. Every handler passes
 * `actor.id`, resolved by the guard from a session row, so there is no syntax
 * by which one donor could address another's registration.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('Event registration')
@ApiBearerAuth()
@RequireAudience('donor')
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
  @HttpCode(201)
  @ApiOperation({
    summary: 'Register for an event',
    description:
      'Capacity, the deadline and the event’s state are all checked under a row lock, so two people racing for the last place cannot both succeed. The email address is read from your account, never from this body.',
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
    @Body(new ZodValidationPipe(registerForEventSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.registrations.register(params.id, actor.id, body, this.context(request));
  }

  @Get(':id/registration')
  @ApiOperation({
    summary: 'Your registration for this event',
    description:
      'Includes the online joining link, which no public endpoint returns. A cancelled registration gets no link.',
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
