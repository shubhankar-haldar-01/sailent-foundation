import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthenticatedActor } from '@sailent/types';

import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import {
  RequireAudience,
  RequirePermission,
  Sensitive,
} from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { StoriesService } from './stories.service.js';
import {
  createStorySchema,
  storyListQuerySchema,
  storyStatusSchema,
  updateStorySchema,
  type CreateStoryInput,
  type StoryStatusInput,
  type UpdateStoryInput,
} from './dto/stories.dto.js';

/**
 * Success stories — administration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE ROUTE IS `@Sensitive()`, AND THE CHOICE IS THE POINT.
 *
 * The status change is, because publishing puts a named person's account of
 * their own life on a public website. Drafting and editing are not: an editor
 * writes a story over several sittings, and forcing a password re-entry to fix
 * a paragraph would teach them to keep the window open, which is worse for
 * security than not asking.
 *
 * Archiving shares the route, and shares the gate. Taking a story down is as
 * consequential as putting it up — somebody may have asked for it.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('admin: stories')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class AdminStoriesController {
  constructor(private readonly stories: StoriesService) {}

  private context(request: Request) {
    const forwarded = request.headers['x-forwarded-for'];
    return {
      ipAddress: typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string | undefined,
    };
  }

  @RequirePermission('story.read')
  @Get('stories')
  @ApiOperation({
    summary: 'List success stories, including drafts',
    description:
      'Drafts are visible here and nowhere else. A draft about a named beneficiary who has not ' +
      'yet consented is precisely what the publish gate exists to keep off the public site.',
  })
  @ApiResponse({ status: 200, description: 'Paginated stories' })
  @ApiResponse({ status: 403, description: 'Missing story.read' })
  list(@Query(new ZodValidationPipe(storyListQuerySchema)) query: never) {
    return this.stories.list(query);
  }

  @RequirePermission('story.read')
  @Get('stories/:id')
  @ApiOperation({
    summary: 'One story, with the reasons it cannot be published',
    description:
      'Returns `publishBlockers`, so the editor sees what is missing before attempting to publish.',
  })
  @ApiResponse({ status: 404, description: 'No such story' })
  get(@Param('id') id: string) {
    return this.stories.getById(id);
  }

  @RequirePermission('story.create')
  @Post('stories')
  @ApiOperation({
    summary: 'Draft a new story',
    description: 'Always created as a draft. Publishing is a separate, permissioned decision.',
  })
  @ApiResponse({ status: 201, description: 'The created draft' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  create(
    @Body(new ZodValidationPipe(createStorySchema)) body: CreateStoryInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.stories.create(body, actor, this.context(request));
  }

  @RequirePermission('story.update')
  @Patch('stories/:id')
  @ApiOperation({ summary: 'Edit a story' })
  @ApiResponse({ status: 200, description: 'The updated story' })
  @ApiResponse({
    status: 422,
    description: 'Validation failed, or the edit would leave a published story unpublishable',
  })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStorySchema)) body: UpdateStoryInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.stories.update(id, body, actor, this.context(request));
  }

  @RequirePermission('story.publish')
  @Sensitive()
  @Patch('stories/:id/status')
  @ApiOperation({
    summary: 'Publish, unpublish or archive',
    description:
      'Requires a re-authentication within the last five minutes. Publishing is refused with a ' +
      'field error when the consent requirements are not met — the same rule the database ' +
      'constraint enforces, stated before it fires.',
  })
  @ApiResponse({ status: 200, description: 'The story at its new status' })
  @ApiResponse({ status: 403, description: 'Missing story.publish, or REAUTH_REQUIRED' })
  @ApiResponse({ status: 422, description: 'Not ready to publish — see the field errors' })
  setStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(storyStatusSchema)) body: StoryStatusInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.stories.setStatus(id, body, actor, this.context(request));
  }
}
