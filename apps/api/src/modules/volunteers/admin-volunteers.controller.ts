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
import { ASSIGNMENT_TRANSITIONS, VOLUNTEER_TRANSITIONS } from '@sailent/validation';

import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import {
  RequireAudience,
  RequirePermission,
  Sensitive,
} from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { VolunteersService } from './volunteers.service.js';
import { VolunteerWorkService } from './volunteer-work.service.js';
import { VolunteerCertificatesService } from './volunteer-certificates.service.js';
import {
  RecordAttendanceDto,
  ReviewDecisionDto,
  assignmentParams,
  assignmentStatusSchema,
  createAssignmentSchema,
  issueCertificateSchema,
  recordAttendanceSchema,
  revokeCertificateSchema,
  reviewDecisionSchema,
  updateVolunteerSchema,
  volunteerIdParam,
  volunteerListQuerySchema,
  verifyAttendanceSchema,
} from './dto/volunteers.dto.js';

/**
 * Volunteer administration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * FOUR ROUTES ARE `@Sensitive()`, AND THE CHOICE OF WHICH FOUR IS THE POINT.
 *
 * Re-authentication has a cost: prompt for it too often and operators learn to
 * keep a window permanently open, which defeats it everywhere it matters. So
 * it guards the four acts that are hard to undo or that expose a person:
 *
 *   • the decision      — approving or rejecting changes what somebody may do
 *                          on behalf of the organisation, and allocates a
 *                          permanent identifier
 *   • reading a record  — name, phone, address and emergency contact together
 *   • issuing           — a document a future employer will rely on
 *   • withdrawing one   — after somebody may already have shown it
 *
 * Recording attendance and creating an assignment are NOT sensitive. They are
 * the daily work of the phase, done at a venue on a phone, and are correctable.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('admin: volunteers')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class AdminVolunteersController {
  constructor(
    private readonly volunteers: VolunteersService,
    private readonly work: VolunteerWorkService,
    private readonly certificates: VolunteerCertificatesService,
  ) {}

  private context(request: Request) {
    const forwarded = request.headers['x-forwarded-for'];
    return {
      ipAddress: typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string | undefined,
    };
  }

  // =========================================================================
  // The review queue
  // =========================================================================

  @RequirePermission('volunteer.read')
  @Get('volunteers')
  @ApiOperation({
    summary: 'List volunteers and applications',
    description:
      'The list omits phone, address, emergency contact and internal notes. Finding somebody is a different act from reading their record, and only the second needs those.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'applied', 'under_review', 'approved', 'active', 'rejected', 'all'],
  })
  @ApiQuery({ name: 'skill', required: false })
  @ApiQuery({ name: 'q', required: false, description: 'Name, email or VOL- identifier' })
  list(@Query(new ZodValidationPipe(volunteerListQuerySchema)) query: never) {
    return this.volunteers.list(query);
  }

  @RequirePermission('volunteer.read')
  @Get('volunteers/transitions')
  @ApiOperation({ summary: 'The permitted volunteer and assignment transitions' })
  transitions() {
    return { volunteer: VOLUNTEER_TRANSITIONS, assignment: ASSIGNMENT_TRANSITIONS };
  }

  @RequirePermission('volunteer.read')
  @Get('volunteers/pending-count')
  @ApiOperation({ summary: 'How many applications await a decision' })
  pendingCount() {
    return this.volunteers.pendingCount().then((count) => ({ count }));
  }

  @RequirePermission('volunteer.read')
  @Sensitive()
  @Get('volunteers/:id')
  @ApiOperation({
    summary: 'One volunteer, in full',
    description:
      'Includes phone, address, emergency contact, internal notes and the frozen application. Requires a re-authentication within the last five minutes.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  get(@Param(new ZodValidationPipe(volunteerIdParam)) params: { id: string }) {
    return this.volunteers.getById(params.id);
  }

  @RequirePermission('volunteer.approve')
  @Sensitive()
  @Patch('volunteers/:id/decision')
  @ApiOperation({
    summary: 'Approve, reject, activate, suspend or archive',
    description:
      'Approval allocates the permanent VOL- identifier inside the same transaction. A rejection requires a reason, which is recorded and audited and never shown to the applicant.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: ReviewDecisionDto })
  @ApiResponse({ status: 409, description: 'Not a permitted transition' })
  decide(
    @Param(new ZodValidationPipe(volunteerIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(reviewDecisionSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.volunteers.decide(params.id, body, actor, this.context(request));
  }

  @RequirePermission('volunteer.update')
  @Patch('volunteers/:id')
  @ApiOperation({
    summary: 'Correct a volunteer record',
    description:
      'Status, the VOL- identifier and the hour counters are server-controlled and are rejected rather than ignored.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @Param(new ZodValidationPipe(volunteerIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(updateVolunteerSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.volunteers.update(params.id, body, actor, this.context(request));
  }

  // =========================================================================
  // Assignments
  // =========================================================================

  @RequirePermission('volunteer.read')
  @Get('volunteers/:id/assignments')
  @ApiOperation({ summary: 'Everything this volunteer has been assigned' })
  @ApiParam({ name: 'id', format: 'uuid' })
  listAssignments(@Param(new ZodValidationPipe(volunteerIdParam)) params: { id: string }) {
    return this.work.listAssignments(params.id);
  }

  @RequirePermission('volunteer.assign')
  @Post('volunteers/:id/assignments')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Give a volunteer work',
    description: 'Only an ACTIVE volunteer can be assigned — see the service for why.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 409, description: 'The volunteer is not active' })
  createAssignment(
    @Param(new ZodValidationPipe(volunteerIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(createAssignmentSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.work.createAssignment(params.id, body, actor, this.context(request));
  }

  @RequirePermission('volunteer.assign')
  @Patch('volunteers/:id/assignments/:assignmentId')
  @ApiOperation({ summary: 'Confirm, complete, cancel or mark a no-show' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'assignmentId', format: 'uuid' })
  setAssignmentStatus(
    @Param(new ZodValidationPipe(assignmentParams))
    params: { id: string; assignmentId: string },
    @Body(new ZodValidationPipe(assignmentStatusSchema))
    body: {
      status: 'assigned' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
      reason?: string;
    },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.work.setAssignmentStatus(
      params.assignmentId,
      body.status,
      body.reason,
      actor,
      this.context(request),
    );
  }

  // =========================================================================
  // Attendance
  // =========================================================================

  @RequirePermission('volunteer.read')
  @Get('volunteers/:id/attendance')
  @ApiOperation({ summary: 'Every attendance record for this volunteer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  listAttendance(@Param(new ZodValidationPipe(volunteerIdParam)) params: { id: string }) {
    return this.work.listAttendance(params.id);
  }

  @RequirePermission('volunteer.attendance')
  @Post('volunteers/:id/assignments/:assignmentId/attendance')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Record what was worked',
    description:
      'Minutes, not hours. Upserts on (assignment, date), so a register submitted twice corrects rather than doubles. The hour counters are recomputed in the same transaction.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'assignmentId', format: 'uuid' })
  @ApiBody({ type: RecordAttendanceDto })
  recordAttendance(
    @Param(new ZodValidationPipe(assignmentParams))
    params: { id: string; assignmentId: string },
    @Body(new ZodValidationPipe(recordAttendanceSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.work.recordAttendance(params.assignmentId, body, actor, this.context(request));
  }

  @RequirePermission('volunteer.attendance')
  @Post('volunteers/:id/attendance/verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify or unverify attendance',
    description:
      'A separate act from recording — only verified hours reach a certificate. Refuses the whole batch if any record belongs to another volunteer.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  verifyAttendance(
    @Param(new ZodValidationPipe(volunteerIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(verifyAttendanceSchema))
    body: { attendanceIds: string[]; verified: boolean },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.work.setAttendanceVerified(
      params.id,
      body.attendanceIds,
      body.verified,
      actor,
      this.context(request),
    );
  }

  @RequirePermission('volunteer.update')
  @Post('volunteers/:id/recount')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Rebuild the hour counters from the attendance rows',
    description:
      'Should always be a no-op — they are recomputed inside every write. It exists because a wrong verified-hours figure ends up printed on a certificate.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  recount(
    @Param(new ZodValidationPipe(volunteerIdParam)) params: { id: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.work.reconcile(params.id, actor, this.context(request));
  }

  // =========================================================================
  // Certificates
  // =========================================================================

  @RequirePermission('volunteer.read')
  @Get('volunteers/:id/certificates')
  @ApiOperation({ summary: 'Certificates issued to this volunteer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  listCertificates(@Param(new ZodValidationPipe(volunteerIdParam)) params: { id: string }) {
    return this.certificates.listFor(params.id);
  }

  @RequirePermission('volunteer.approve')
  @Sensitive()
  @Post('volunteers/:id/certificates')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Issue a certificate of service',
    description:
      'Hours come from VERIFIED attendance in the period and are frozen at issue. Refused when the period holds under an hour of verified work.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 409, description: 'Not enough verified hours, or not approved' })
  issueCertificate(
    @Param(new ZodValidationPipe(volunteerIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(issueCertificateSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.certificates.issue(params.id, body, actor, this.context(request));
  }

  @RequirePermission('volunteer.approve')
  @Sensitive()
  @Patch('certificates/:id/revoke')
  @ApiOperation({
    summary: 'Withdraw a certificate',
    description:
      'The record stays and the verification page reports it as withdrawn. Deleting it would make a document somebody is holding look like a forgery.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  revokeCertificate(
    @Param(new ZodValidationPipe(volunteerIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(revokeCertificateSchema)) body: { reason: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.certificates.revoke(params.id, body.reason, actor, this.context(request));
  }
}
