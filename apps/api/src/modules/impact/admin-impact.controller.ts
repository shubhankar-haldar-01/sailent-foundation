import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
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
import {
  RequireAudience,
  RequirePermission,
} from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ImpactService } from './impact.service.js';
import {
  CreateImpactUpdateDto,
  createImpactSchema,
  impactIdParam,
  impactListQuerySchema,
  impactStatusSchema,
  updateImpactSchema,
} from './dto/impact.dto.js';
import { requestClientIp } from '../../common/security/internal-request.js';

/**
 * Impact record administration.
 *
 * `impact.publish` is a SEPARATE permission from `impact.create`, unlike the
 * team directory where the two are one. The asymmetry is deliberate: these
 * rows are the evidence behind public statistics, and the decision to stand
 * behind a figure is a different act from the decision to write it down.
 * Publication also stamps `verifiedBy` with the publisher's id, so the
 * permission boundary is what makes that attribution mean anything.
 */
@ApiTags('admin: impact')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class AdminImpactController {
  constructor(private readonly impact: ImpactService) {}

  private context(request: Request) {
    return {
      // The trusted client address (Phase 12), never a raw X-Forwarded-For.
      ipAddress: requestClientIp(request),
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string | undefined,
    };
  }

  @RequirePermission('impact.read')
  @Get('impact')
  @ApiOperation({ summary: 'List impact records, including drafts and archived' })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'published', 'archived', 'all'] })
  @ApiQuery({ name: 'programId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'campaignId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'eventId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'metricType', required: false })
  list(@Query(new ZodValidationPipe(impactListQuerySchema)) query: never) {
    return this.impact.list(query);
  }

  @RequirePermission('impact.read')
  @Get('impact/:id')
  @ApiOperation({ summary: 'One impact record with its parents and slug history' })
  @ApiParam({ name: 'id', format: 'uuid' })
  get(@Param(new ZodValidationPipe(impactIdParam)) params: { id: string }) {
    return this.impact.getById(params.id);
  }

  @RequirePermission('impact.create')
  @Post('impact')
  @ApiOperation({
    summary: 'Record an impact',
    description:
      'Always created as a draft. A record attached to a campaign inherits that campaign’s programme unless a programme is named explicitly.',
  })
  @ApiBody({ type: CreateImpactUpdateDto })
  @ApiResponse({ status: 201, description: 'Created, in draft' })
  @ApiResponse({ status: 422, description: 'No parent named, or a parent that does not exist' })
  create(
    @Body(new ZodValidationPipe(createImpactSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.impact.create(body, actor, this.context(request));
  }

  @RequirePermission('impact.update')
  @Patch('impact/:id')
  @ApiOperation({
    summary: 'Update an impact record',
    description:
      'Publication state and `verifiedBy` are server-controlled and are rejected rather than ignored.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @Param(new ZodValidationPipe(impactIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(updateImpactSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.impact.update(params.id, body, actor, this.context(request));
  }

  @RequirePermission('impact.publish')
  @Patch('impact/:id/status')
  @ApiOperation({
    summary: 'Publish, unpublish or archive',
    description:
      'Publishing stamps you as the verifier. A record claiming a figure cannot be published without a stated verification method (decision A14).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 422, description: 'A figure is claimed with no stated method' })
  @ApiResponse({ status: 409, description: 'Not a permitted transition' })
  setStatus(
    @Param(new ZodValidationPipe(impactIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(impactStatusSchema))
    body: { status: 'draft' | 'published' | 'archived'; reason?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.impact.setStatus(params.id, body.status, body.reason, actor, this.context(request));
  }
}
