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
import { BlogService } from './blog.service.js';
import {
  blogListQuerySchema,
  blogStatusSchema,
  createBlogPostSchema,
  updateBlogPostSchema,
  type BlogStatusInput,
  type CreateBlogPostInput,
  type UpdateBlogPostInput,
} from './dto/blog.dto.js';

/**
 * Blog — administration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE ROUTE IS `@Sensitive()`, THE SAME ONE AS ON STORIES.
 *
 * Writing and editing are ordinary work and gated on the permission alone;
 * demanding a password every time somebody fixes a typo teaches people to keep
 * a re-authentication warm, which is worse than not asking.
 *
 * CHANGING THE STATUS is different in kind. Publishing puts the
 * organisation's name behind an article on a public website, and archiving
 * takes down something that may already be linked and cited. Both are the
 * moment a walked-away-from session would do real damage, so both sit behind a
 * re-authentication in the last five minutes.
 *
 * THERE IS NO DELETE ROUTE, and no `blog.delete` permission to imply one.
 * Archiving keeps the row, its audit trail and its slug, so a URL that was
 * once live never becomes a lie.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('admin: blog')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class AdminBlogController {
  constructor(private readonly blog: BlogService) {}

  private context(request: Request) {
    const forwarded = request.headers['x-forwarded-for'];
    return {
      ipAddress: typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string | undefined,
    };
  }

  @RequirePermission('blog.read')
  @Get('blog')
  @ApiOperation({
    summary: 'List blog posts, including drafts',
    description: 'Drafts are visible here and nowhere else.',
  })
  @ApiResponse({ status: 200, description: 'Paginated posts' })
  @ApiResponse({ status: 403, description: 'Missing blog.read' })
  list(@Query(new ZodValidationPipe(blogListQuerySchema)) query: never) {
    return this.blog.list(query);
  }

  @RequirePermission('blog.read')
  @Get('blog/:id')
  @ApiOperation({ summary: 'One post, with its tags and any publish blockers' })
  @ApiResponse({ status: 404, description: 'No such post' })
  get(@Param('id') id: string) {
    return this.blog.getById(id);
  }

  @RequirePermission('blog.create')
  @Post('blog')
  @ApiOperation({
    summary: 'Draft a post',
    description: 'Always created as a draft — publishing is a separate call and permission.',
  })
  @ApiResponse({ status: 201, description: 'The draft' })
  @ApiResponse({ status: 403, description: 'Missing blog.create' })
  create(
    @Body(new ZodValidationPipe(createBlogPostSchema)) body: CreateBlogPostInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.blog.create(body, actor, this.context(request));
  }

  @RequirePermission('blog.update')
  @Patch('blog/:id')
  @ApiOperation({
    summary: 'Edit a post',
    description:
      'Changing the slug retires the old one into `slug_history`, so the previous URL ' +
      'permanently redirects rather than breaking.',
  })
  @ApiResponse({ status: 422, description: 'A published post cannot be left incomplete' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBlogPostSchema)) body: UpdateBlogPostInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.blog.update(id, body, actor, this.context(request));
  }

  @RequirePermission('blog.publish')
  @Sensitive()
  @Patch('blog/:id/status')
  @ApiOperation({
    summary: 'Publish, unpublish or archive',
    description:
      'Requires a re-authentication within the last five minutes. Publishing is refused with ' +
      'field errors when the post has no body or no summary.',
  })
  @ApiResponse({ status: 200, description: 'The post at its new status' })
  @ApiResponse({ status: 403, description: 'Missing blog.publish, or REAUTH_REQUIRED' })
  @ApiResponse({ status: 422, description: 'Not ready to publish — see the field errors' })
  setStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(blogStatusSchema)) body: BlogStatusInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.blog.setStatus(id, body, actor, this.context(request));
  }
}
