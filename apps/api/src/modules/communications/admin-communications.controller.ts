import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthenticatedActor } from '@sailent/types';
import type { ContactMessageStatus } from '@sailent/validation';

import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import {
  RequireAudience,
  RequirePermission,
} from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { requestClientIp } from '../../common/security/internal-request.js';
import { CommunicationsService } from './communications.service.js';
import {
  contactListQuerySchema,
  contactStatusSchema,
  newsletterListQuerySchema,
  uuidParam,
} from './communications.dto.js';

/**
 * Contact messages and newsletter subscriptions, for staff (Phase 13).
 * SUPER_ADMIN holds every permission here; nothing is public.
 */
@ApiTags('admin: contact and newsletter')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class AdminCommunicationsController {
  constructor(private readonly communications: CommunicationsService) {}

  private context(request: Request) {
    return {
      ipAddress: requestClientIp(request),
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string | undefined,
    };
  }

  @RequirePermission('contact.read')
  @Get('contact-messages')
  @ApiOperation({ summary: 'Contact-form messages, newest first (default: new only)' })
  @ApiResponse({ status: 403, description: 'Missing contact.read' })
  listContact(@Query(new ZodValidationPipe(contactListQuerySchema)) query: never) {
    return this.communications.listContact(query);
  }

  @RequirePermission('contact.read')
  @Get('contact-messages/:id')
  @ApiOperation({ summary: 'One message, in full' })
  @ApiResponse({ status: 404, description: 'No such message' })
  getContact(@Param(new ZodValidationPipe(uuidParam)) params: { id: string }) {
    return this.communications.getContact(params.id);
  }

  @RequirePermission('contact.manage')
  @Patch('contact-messages/:id')
  @ApiOperation({ summary: 'Mark a message new, handled or archived' })
  @ApiResponse({ status: 403, description: 'Missing contact.manage' })
  setContactStatus(
    @Param(new ZodValidationPipe(uuidParam)) params: { id: string },
    @Body(new ZodValidationPipe(contactStatusSchema)) body: { status: ContactMessageStatus },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.communications.setContactStatus(
      params.id,
      body.status,
      actor,
      this.context(request),
    );
  }

  @RequirePermission('newsletter.read')
  @Get('newsletter/subscribers')
  @ApiOperation({ summary: 'Newsletter subscriptions (default: confirmed only), with counts' })
  @ApiResponse({ status: 403, description: 'Missing newsletter.read' })
  listSubscribers(@Query(new ZodValidationPipe(newsletterListQuerySchema)) query: never) {
    return this.communications.listSubscribers(query);
  }
}
