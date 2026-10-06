import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import type { ContactSubmission } from '@sailent/validation';

import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { requestClientIp } from '../../common/security/internal-request.js';
import { CommunicationsService } from './communications.service.js';
import {
  contactSubmissionSchema,
  newsletterSubscribeSchema,
  newsletterTokenBodySchema,
} from './communications.dto.js';

/**
 * The public contact form and newsletter sign-up (Phase 13).
 *
 * Rate limits are per client (the Phase 11 trusted address), tighter than the
 * platform default because each request writes a row a person must read or
 * sends an email to somebody's inbox.
 */
@ApiTags('public: contact and newsletter')
@Controller()
export class PublicCommunicationsController {
  constructor(private readonly communications: CommunicationsService) {}

  private context(request: Request) {
    return {
      ipAddress: requestClientIp(request),
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string | undefined,
    };
  }

  @Public()
  @Post('contact')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Send a message to the organisation' })
  @ApiResponse({ status: 202, description: 'Stored; the organisation is emailed' })
  @ApiResponse({ status: 422, description: 'A field failed validation' })
  @ApiResponse({ status: 429, description: 'Too many messages from this client' })
  contact(
    @Body(new ZodValidationPipe(contactSubmissionSchema)) body: ContactSubmission,
    @Req() request: Request,
  ) {
    return this.communications.submitContact(body, this.context(request));
  }

  @Public()
  @Post('newsletter/subscribe')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({
    summary: 'Ask to join the newsletter',
    description:
      'Sends a confirmation link to the address. The answer is identical whether the address is new, pending or already subscribed.',
  })
  @ApiResponse({ status: 202, description: '`{ status: "check_inbox" }`' })
  subscribe(
    @Body(new ZodValidationPipe(newsletterSubscribeSchema))
    body: { email: string; website?: string },
    @Req() request: Request,
  ) {
    return this.communications.subscribe(body, this.context(request));
  }

  @Public()
  @Post('newsletter/confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 900_000 } })
  @ApiOperation({ summary: 'Confirm a subscription from the emailed link' })
  @ApiResponse({ status: 422, description: 'Expired, used or unknown link' })
  confirm(
    @Body(new ZodValidationPipe(newsletterTokenBodySchema)) body: { token: string },
    @Req() request: Request,
  ) {
    return this.communications.confirm(body.token, this.context(request));
  }

  @Public()
  @Post('newsletter/unsubscribe')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 900_000 } })
  @ApiOperation({ summary: 'Unsubscribe from the emailed link (idempotent)' })
  @ApiResponse({ status: 422, description: 'Unknown link' })
  unsubscribe(
    @Body(new ZodValidationPipe(newsletterTokenBodySchema)) body: { token: string },
    @Req() request: Request,
  ) {
    return this.communications.unsubscribe(body.token, this.context(request));
  }
}
