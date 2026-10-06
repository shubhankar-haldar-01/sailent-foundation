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
import { PagesService } from './pages.service.js';
import {
  createPageSchema,
  pageListQuerySchema,
  pageStatusSchema,
  revertPageSchema,
  updatePageSchema,
  type CreatePageInput,
  type PageStatusInput,
  type RevertPageInput,
  type UpdatePageInput,
} from './dto/pages.dto.js';
import { requestClientIp } from '../../common/security/internal-request.js';

/**
 * The section composer — administration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * `@Sensitive()` ON STATUS AND REVERT, and on nothing else.
 *
 * Editing a draft is ordinary work. CHANGING WHAT THE HOMEPAGE SHOWS is not:
 * it is the most-read surface the organisation has, a scheduled publish goes
 * live with nobody present, and a revert silently replaces what visitors see
 * with something older. Those three sit behind a re-authentication.
 *
 * THERE IS NO DELETE ROUTE. A page is archived at most; its revisions are the
 * record of who changed the homepage and to what, and that record is worth
 * more than a tidy table.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('admin: pages')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class AdminPagesController {
  constructor(private readonly pages: PagesService) {}

  private context(request: Request) {
    return {
      // The trusted client address (Phase 12), never a raw X-Forwarded-For.
      ipAddress: requestClientIp(request),
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string | undefined,
    };
  }

  @RequirePermission('page.read')
  @Get('pages')
  @ApiOperation({ summary: 'List composed pages, including drafts' })
  list(@Query(new ZodValidationPipe(pageListQuerySchema)) query: never) {
    return this.pages.list(query);
  }

  @RequirePermission('page.read')
  @Get('pages/:id')
  @ApiOperation({ summary: 'One page, with its recent revisions' })
  @ApiResponse({ status: 404, description: 'No such page' })
  get(@Param('id') id: string) {
    return this.pages.getById(id);
  }

  @RequirePermission('page.read')
  @Post('pages/:id/preview')
  @ApiOperation({
    summary: 'A signed link that shows this page unpublished',
    description:
      'Valid for thirty minutes and for this page only. It grants no session and no other access.',
  })
  preview(@Param('id') id: string) {
    return this.pages.createPreviewToken(id);
  }

  @RequirePermission('page.create')
  @Post('pages')
  @ApiOperation({
    summary: 'Create a page',
    description: 'Always a draft. Sections are validated against the approved registry.',
  })
  @ApiResponse({ status: 409, description: 'A page already exists for that slug' })
  @ApiResponse({ status: 422, description: 'A section type is not approved' })
  create(
    @Body(new ZodValidationPipe(createPageSchema)) body: CreatePageInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.pages.create(body, actor, this.context(request));
  }

  @RequirePermission('page.update')
  @Patch('pages/:id')
  @ApiOperation({
    summary: 'Edit a page’s sections, order and metadata',
    description: 'Every save takes a numbered snapshot, so any version can be restored.',
  })
  @ApiResponse({ status: 422, description: 'A section type is not approved' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePageSchema)) body: UpdatePageInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.pages.update(id, body, actor, this.context(request));
  }

  @RequirePermission('page.publish')
  @Sensitive()
  @Patch('pages/:id/status')
  @ApiOperation({
    summary: 'Publish, schedule, unpublish or archive',
    description:
      'Requires a re-authentication within the last five minutes. A future `scheduledAt` keeps ' +
      'the page invisible until that moment — enforced on every public read, not by a job.',
  })
  @ApiResponse({ status: 403, description: 'Missing page.publish, or REAUTH_REQUIRED' })
  @ApiResponse({ status: 422, description: 'A page with no sections cannot be published' })
  setStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(pageStatusSchema)) body: PageStatusInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.pages.setStatus(id, body, actor, this.context(request));
  }

  @RequirePermission('page.update')
  @Sensitive()
  @Post('pages/:id/revert')
  @ApiOperation({
    summary: 'Restore an earlier version',
    description:
      'A new save of old content, not a rewind: it takes the next version number and leaves its ' +
      'own revision, so the history stays append-only.',
  })
  @ApiResponse({ status: 404, description: 'No such version' })
  @ApiResponse({ status: 422, description: 'That version uses a retired section' })
  revert(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(revertPageSchema)) body: RevertPageInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.pages.revert(id, body, actor, this.context(request));
  }
}
