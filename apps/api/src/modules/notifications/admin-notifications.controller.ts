import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthenticatedActor } from '@sailent/types';
import {
  inboxQuerySchema,
  notificationLogQuerySchema,
  previewNotificationTemplateSchema,
  revertNotificationTemplateSchema,
  updateNotificationTemplateSchema,
} from '@sailent/validation';

import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import {
  RequireAudience,
  RequirePermission,
  Sensitive,
} from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Notifications — administration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE ROUTE IS `@Sensitive()`: THE RETRY.
 *
 * Reading the send log is not, and that is deliberate. An administrator
 * checking whether a receipt went out should not meet a password prompt, or
 * they will stop checking — and a log nobody opens is not the visibility
 * §4.21 asks for.
 *
 * Re-sending is different. It puts a message in a real person's inbox, and it
 * is the one action here with an effect outside this screen. `notification.send`
 * was already marked sensitive in the permission catalogue before this phase;
 * this is the route that finally uses it.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('admin: notifications')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class AdminNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  private context(request: Request) {
    return {
      ipAddress: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
      requestId: request.get('x-request-id') ?? undefined,
    };
  }

  // -------------------------------------------------------------------------
  // The inbox
  // -------------------------------------------------------------------------

  @RequirePermission('notification.read')
  @Get('notifications')
  @ApiOperation({
    summary: 'This administrator’s in-app notifications',
    description:
      'Scoped to the caller in the query. There is no id parameter, so one administrator ' +
      'cannot ask for another’s feed.',
  })
  inbox(
    @Query(new ZodValidationPipe(inboxQuerySchema))
    query: ReturnType<typeof inboxQuerySchema.parse>,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.notifications.inbox(actor, query);
  }

  @RequirePermission('notification.read')
  @Get('notifications/unread-count')
  @ApiOperation({ summary: 'How many unread, for the bell' })
  unreadCount(@CurrentActor() actor: AuthenticatedActor) {
    return this.notifications.unreadCount(actor);
  }

  @RequirePermission('notification.read')
  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Mark one notification read' })
  @ApiResponse({ status: 404, description: 'No such notification, or not this administrator’s' })
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: AuthenticatedActor) {
    return this.notifications.markRead(id, actor);
  }

  @RequirePermission('notification.read')
  @Post('notifications/read-all')
  @ApiOperation({ summary: 'Mark every unread notification read' })
  markAllRead(@CurrentActor() actor: AuthenticatedActor) {
    return this.notifications.markAllRead(actor);
  }

  // -------------------------------------------------------------------------
  // The send log
  // -------------------------------------------------------------------------

  @RequirePermission('notification.read')
  @Get('notifications/log')
  @ApiOperation({
    summary: 'Every send, and what happened to it',
    description: 'Filterable by status, channel and type. Recipients appear by id, never address.',
  })
  log(
    @Query(new ZodValidationPipe(notificationLogQuerySchema))
    query: ReturnType<typeof notificationLogQuerySchema.parse>,
  ) {
    return this.notifications.log(query);
  }

  @RequirePermission('notification.read')
  @Get('notifications/failures')
  @ApiOperation({ summary: 'How many email sends are sitting failed' })
  failureCount() {
    return this.notifications.failureCount();
  }

  @RequirePermission('notification.send')
  @Sensitive()
  @Post('notifications/log/:id/retry')
  @ApiOperation({
    summary: 'Try a failed send again',
    description:
      'Enqueues a fresh attempt and leaves the failed entry exactly as it is, so the history ' +
      'of what was tried stays readable. Requires a re-authentication.',
  })
  @ApiResponse({ status: 403, description: 'REAUTH_REQUIRED — confirm your password first' })
  @ApiResponse({ status: 409, description: 'Not failed, not an email, or not retryable' })
  retry(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.notifications.retry(id, actor, this.context(request));
  }

  // -------------------------------------------------------------------------
  // Templates
  // -------------------------------------------------------------------------

  @RequirePermission('notification.read')
  @Get('notification-templates')
  @ApiOperation({ summary: 'Every transactional email’s template' })
  listTemplates() {
    return this.notifications.listTemplates();
  }

  @RequirePermission('notification.read')
  @Get('notification-templates/:id')
  @ApiOperation({ summary: 'One template, its expected variables and its recent versions' })
  getTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.getTemplate(id);
  }

  @RequirePermission('notification.template.manage')
  @Patch('notification-templates/:id')
  @ApiOperation({
    summary: 'Save a new version of a template',
    description:
      'The previous content is snapshotted in the same transaction. The SLUG cannot be ' +
      'changed — a processor looks up by it.',
  })
  @ApiResponse({ status: 422, description: 'Invalid, or uses an unescaped placeholder' })
  updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateNotificationTemplateSchema))
    body: ReturnType<typeof updateNotificationTemplateSchema.parse>,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.notifications.updateTemplate(id, body, actor, this.context(request));
  }

  @RequirePermission('notification.template.manage')
  @Post('notification-templates/:id/revert')
  @ApiOperation({
    summary: 'Restore an earlier version, as a new version',
    description: 'History moves forward: nothing is lost by going back.',
  })
  revertTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(revertNotificationTemplateSchema))
    body: ReturnType<typeof revertNotificationTemplateSchema.parse>,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.notifications.revertTemplate(id, body, actor, this.context(request));
  }

  /**
   * Render without sending.
   *
   * POST because a body is being submitted, not because anything changes —
   * this writes nothing and enqueues nothing. It is the same renderer the
   * worker uses, which is the only reason it is worth trusting.
   */
  @RequirePermission('notification.template.manage')
  @Post('notification-templates/:id/preview')
  @ApiOperation({ summary: 'Render a draft body with sample values' })
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(previewNotificationTemplateSchema))
    body: ReturnType<typeof previewNotificationTemplateSchema.parse>,
  ) {
    const template = await this.notifications.getTemplate(id);
    return this.notifications.preview(template.slug, body, body.values);
  }
}
