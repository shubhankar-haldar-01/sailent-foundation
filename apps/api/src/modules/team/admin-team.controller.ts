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
import { TeamService } from './team.service.js';
import {
  CreateTeamMemberDto,
  createTeamMemberSchema,
  teamIdParam,
  teamListQuerySchema,
  teamReorderSchema,
  teamStatusSchema,
  updateTeamMemberSchema,
} from './dto/team.dto.js';

/**
 * Team directory administration.
 *
 * Two permissions, `team.read` and `team.manage`, rather than the five a
 * create/update/publish/archive/reorder split would give. Publishing and
 * archiving a team member are status changes on a record the caller is already
 * allowed to edit — somebody who can rewrite a biography can already change
 * what the public reads, so a separate permission for the last step would be
 * ceremony rather than control.
 */
@ApiTags('admin: team')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class AdminTeamController {
  constructor(private readonly team: TeamService) {}

  private context(request: Request) {
    const forwarded = request.headers['x-forwarded-for'];
    return {
      ipAddress: typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string | undefined,
    };
  }

  @RequirePermission('team.read')
  @Get('team')
  @ApiOperation({ summary: 'List team members, including drafts and archived' })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'published', 'archived', 'all'] })
  @ApiQuery({
    name: 'memberType',
    required: false,
    enum: ['staff', 'trustee', 'advisor', 'board'],
  })
  @ApiQuery({ name: 'department', required: false })
  @ApiQuery({ name: 'q', required: false, description: 'Search name, designation or department' })
  list(@Query(new ZodValidationPipe(teamListQuerySchema)) query: never) {
    return this.team.list(query);
  }

  @RequirePermission('team.read')
  @Get('team/:id')
  @ApiOperation({ summary: 'One team member with their slug history' })
  @ApiParam({ name: 'id', format: 'uuid' })
  get(@Param(new ZodValidationPipe(teamIdParam)) params: { id: string }) {
    return this.team.getById(params.id);
  }

  @RequirePermission('team.manage')
  @Post('team')
  @ApiOperation({
    summary: 'Add a team member',
    description:
      'Always created as a draft and not public. This is a real person’s name and photograph — publish it deliberately, once it reads correctly.',
  })
  @ApiBody({ type: CreateTeamMemberDto })
  @ApiResponse({ status: 201, description: 'Created, in draft' })
  create(
    @Body(new ZodValidationPipe(createTeamMemberSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.team.create(body, actor, this.context(request));
  }

  @RequirePermission('team.manage')
  @Patch('team/reorder')
  @ApiOperation({
    summary: 'Reorder the directory',
    description: 'Applied in one transaction — a partial reorder leaves two people in one place.',
  })
  reorder(
    @Body(new ZodValidationPipe(teamReorderSchema))
    body: { order: { id: string; displayOrder: number }[] },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.team.reorder(body.order, actor, this.context(request));
  }

  @RequirePermission('team.manage')
  @Patch('team/:id')
  @ApiOperation({
    summary: 'Update a team member',
    description: 'Publication state is server-controlled and is rejected rather than ignored.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @Param(new ZodValidationPipe(teamIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(updateTeamMemberSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.team.update(params.id, body, actor, this.context(request));
  }

  @RequirePermission('team.manage')
  @Patch('team/:id/status')
  @ApiOperation({
    summary: 'Publish, unpublish or archive',
    description: 'Moves `status` and `isPublic` together — both are required for a public listing.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 409, description: 'Not a permitted transition' })
  setStatus(
    @Param(new ZodValidationPipe(teamIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(teamStatusSchema))
    body: { status: 'draft' | 'published' | 'archived'; reason?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.team.setStatus(params.id, body.status, body.reason, actor, this.context(request));
  }
}
