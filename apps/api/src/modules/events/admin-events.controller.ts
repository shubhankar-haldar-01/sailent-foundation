import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
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
import { EVENT_LIFECYCLE_TRANSITIONS, EVENT_PUBLISH_TRANSITIONS } from '@sailent/validation';

import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import {
  RequireAudience,
  RequirePermission,
  Sensitive,
} from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { EventRegistrationsService } from './event-registrations.service.js';
import { EventsService } from './events.service.js';
import {
  AttendanceDto,
  CreateEventDto,
  attendanceSchema,
  createEventSchema,
  eventIdParam,
  eventLifecycleSchema,
  eventListQuerySchema,
  eventPublishSchema,
  registrationListQuerySchema,
  updateEventSchema,
} from './dto/events.dto.js';
import { requestClientIp } from '../../common/security/internal-request.js';

/**
 * Event administration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO STATE ROUTES, NOT ONE, because an event has two states that answer
 * different questions (see `@sailent/validation`'s `event.ts`):
 *
 *   PATCH :id/status     draft ⇄ published → archived    — can anyone see it?
 *   PATCH :id/lifecycle  open ⇄ closed, cancelled, …     — what is happening?
 *
 * Cancelling is on the second because a cancelled event MUST STAY VISIBLE.
 * Everyone holding a registration needs to land on that page and read the
 * notice, and `archived` is a 404 to the public.
 *
 * The attendee list is `@Sensitive()`: it is the only route that returns the
 * names, emails and phone numbers of everyone attending in one response, and
 * `event.registration.read` is marked sensitive in the permission catalogue for
 * that reason. Publishing and opening registration are deliberately NOT
 * sensitive — they are the routine acts of this phase, and a re-auth prompt on
 * every one trains operators to keep a window permanently open, which defeats
 * the control everywhere it does matter.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('admin: events')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class AdminEventsController {
  constructor(
    private readonly events: EventsService,
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

  // =========================================================================
  // Events
  // =========================================================================

  @RequirePermission('event.read')
  @Get('events')
  @ApiOperation({ summary: 'List events, including drafts and archived' })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'published', 'archived', 'all'] })
  @ApiQuery({
    name: 'lifecycle',
    required: false,
    enum: ['open', 'closed', 'full', 'cancelled', 'completed'],
  })
  @ApiQuery({ name: 'when', required: false, enum: ['upcoming', 'past'] })
  @ApiQuery({ name: 'q', required: false, description: 'Search title, summary, city or URL' })
  list(@Query(new ZodValidationPipe(eventListQuerySchema)) query: never) {
    return this.events.list(query);
  }

  /**
   * The transition tables, served rather than duplicated in the admin UI.
   *
   * One table, two readers — the same arrangement as the catalogue. The UI uses
   * it to decide which buttons to render; the server re-checks every request
   * regardless, because a served rule is a convenience, not a control.
   */
  @RequirePermission('event.read')
  @Get('events/transitions')
  @ApiOperation({ summary: 'The permitted publication and lifecycle transitions' })
  transitions() {
    return { status: EVENT_PUBLISH_TRANSITIONS, lifecycle: EVENT_LIFECYCLE_TRANSITIONS };
  }

  @RequirePermission('event.read')
  @Get('events/:id')
  @ApiOperation({ summary: 'One event with its counts and slug history' })
  @ApiParam({ name: 'id', format: 'uuid' })
  get(@Param(new ZodValidationPipe(eventIdParam)) params: { id: string }) {
    return this.events.getById(params.id);
  }

  @RequirePermission('event.manage')
  @Post('events')
  @ApiOperation({
    summary: 'Create an event',
    description:
      'Always created as a draft with registration closed. Publish and open it separately once the date and venue read correctly.',
  })
  @ApiBody({ type: CreateEventDto })
  @ApiResponse({ status: 201, description: 'Created, in draft' })
  create(
    @Body(new ZodValidationPipe(createEventSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.events.create(body, actor, this.context(request));
  }

  @RequirePermission('event.manage')
  @Patch('events/:id')
  @ApiOperation({
    summary: 'Update an event',
    description:
      'Counters, publication status and lifecycle are server-controlled and are rejected rather than ignored.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 422, description: 'Dates out of order, or a cap below the seats taken' })
  update(
    @Param(new ZodValidationPipe(eventIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(updateEventSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.events.update(params.id, body, actor, this.context(request));
  }

  @RequirePermission('event.manage')
  @Patch('events/:id/status')
  @ApiOperation({
    summary: 'Publish, unpublish or archive',
    description:
      'Archiving is refused while live registrations exist — it would remove the page from everyone holding a place without telling them. Cancel it first.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({
    status: 409,
    description: 'Not a permitted transition, or registrations are live',
  })
  setStatus(
    @Param(new ZodValidationPipe(eventIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(eventPublishSchema))
    body: { status: 'draft' | 'published' | 'archived'; reason?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.events.setPublishStatus(
      params.id,
      body.status,
      body.reason,
      actor,
      this.context(request),
    );
  }

  @RequirePermission('event.manage')
  @Patch('events/:id/lifecycle')
  @ApiOperation({
    summary: 'Open or close registration, cancel, or complete',
    description:
      'Cancelling emails everyone holding a registration, so it requires a reason — the reason is quoted to them.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 409, description: 'Not a permitted transition' })
  setLifecycle(
    @Param(new ZodValidationPipe(eventIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(eventLifecycleSchema))
    body: { lifecycle: 'open' | 'closed' | 'full' | 'cancelled' | 'completed'; reason?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.events.setLifecycle(
      params.id,
      body.lifecycle,
      body.reason,
      actor,
      this.context(request),
    );
  }

  // =========================================================================
  // Registrations and attendance
  // =========================================================================

  @RequirePermission('event.registration.read')
  @Sensitive()
  @Get('events/:id/registrations')
  @ApiOperation({
    summary: 'The attendee list',
    description:
      'Names, emails and phone numbers. Requires a re-authentication within the last five minutes. Cancellations are excluded unless asked for by status.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['registered', 'confirmed', 'attended', 'no_show', 'cancelled', 'all'],
  })
  listRegistrations(
    @Param(new ZodValidationPipe(eventIdParam)) params: { id: string },
    @Query(new ZodValidationPipe(registrationListQuerySchema)) query: never,
  ) {
    return this.registrations.listRegistrations(params.id, query);
  }

  @RequirePermission('event.attendance')
  @Post('events/:id/attendance')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Record who turned up',
    description:
      'One transaction for the whole register — a half-applied sheet cannot be told apart from an unapplied one. Only `attended` and `no_show` may be set here.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: AttendanceDto })
  @ApiResponse({ status: 409, description: 'The event has not started, or a row was cancelled' })
  recordAttendance(
    @Param(new ZodValidationPipe(eventIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(attendanceSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.registrations.recordAttendance(params.id, body, actor, this.context(request));
  }

  @RequirePermission('event.manage')
  @Post('events/:id/recount')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Recompute the seat count from the registration rows',
    description:
      'The counter is written inside every registration and cancellation, so this should always be a no-op. It exists because “should always” is not a guarantee, and a drifted counter on a capped event quietly admits an extra person.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  recount(
    @Param(new ZodValidationPipe(eventIdParam)) params: { id: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.registrations.reconcile(params.id, actor, this.context(request));
  }
}
