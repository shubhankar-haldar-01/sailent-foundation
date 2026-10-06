import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { VolunteersService } from './volunteers.service.js';
import { VolunteerCertificatesService } from './volunteer-certificates.service.js';
import {
  ApplyAsVolunteerDto,
  applyAsVolunteerSchema,
  verificationCodeParam,
} from './dto/volunteers.dto.js';
import { requestClientIp } from '../../common/security/internal-request.js';

/**
 * The two volunteer routes that need no account.
 *
 * Applying, because applying is how somebody first appears; and verifying a
 * certificate, because the person checking it is an employer who has no
 * relationship with this organisation at all.
 */
@ApiTags('volunteers')
@Controller()
export class VolunteersController {
  constructor(
    private readonly volunteers: VolunteersService,
    private readonly certificates: VolunteerCertificatesService,
  ) {}

  private context(request: Request) {
    return {
      // The trusted client address (Phase 12), never a raw X-Forwarded-For.
      ipAddress: requestClientIp(request),
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string | undefined,
    };
  }

  @Public()
  @Post('volunteers/apply')
  @HttpCode(201)
  /**
   * Three an hour from one address.
   *
   * Tighter than the platform default because this endpoint WRITES a row that
   * a human then has to read. The cost of abuse is not load, it is a review
   * queue nobody can get through — and unlike a donation, there is no payment
   * step standing in the way.
   */
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @ApiOperation({
    summary: 'Apply to volunteer',
    description:
      'Open to anyone. The response carries an id and a status and nothing else — it never reveals whether the address or number was already known.',
  })
  @ApiBody({ type: ApplyAsVolunteerDto })
  @ApiResponse({ status: 201, description: 'Application received' })
  @ApiResponse({ status: 409, description: 'An application already exists for this number' })
  apply(@Body(new ZodValidationPipe(applyAsVolunteerSchema)) body: never, @Req() request: Request) {
    return this.volunteers.apply(body, this.context(request));
  }

  @Public()
  @Get('verify/certificate/:code')
  @ApiOperation({
    summary: 'Check whether a certificate is genuine',
    description:
      'Returns only what is already printed on the document: the name, the hours, the period and whether it still stands. A withdrawn certificate returns its details with `valid: false` rather than a 404 — "no such certificate" would imply a forgery.',
  })
  @ApiParam({ name: 'code', example: 'K7M2PQ9XRT' })
  @ApiResponse({ status: 404, description: 'No certificate carries that code' })
  verifyCertificate(@Param(new ZodValidationPipe(verificationCodeParam)) params: { code: string }) {
    return this.certificates.verify(params.code);
  }
}
