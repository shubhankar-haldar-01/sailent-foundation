import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
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
import { SettingsService } from './settings.service.js';
import { updateSettingsSchema, type UpdateSettingsInput } from './dto/settings.dto.js';

/**
 * Site settings — staff only, and nothing here is public.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NOT TO BE CONFUSED WITH `/me/settings`.
 *
 * That route is a DONOR's own preferences — email opt-in, and so on — on the
 * donor token audience. These are the organisation's settings on the staff
 * audience, and the two must never share a path, a permission or a service.
 * They are different data belonging to different people, and the only thing
 * they have in common is the word.
 *
 * `settings.read` is not public: `registration_details` holds the
 * organisation's PAN, which is a statutory identifier and not something to
 * hand out unauthenticated.
 *
 * THE UPDATE IS `@Sensitive()`. `settings.update` is already marked sensitive
 * in the permission catalogue, and these values are the organisation's name on
 * every receipt and the 80G numbers a donor claims tax relief against — a
 * session somebody walked away from must not be able to change them.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('admin: settings')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  private context(request: Request) {
    const forwarded = request.headers['x-forwarded-for'];
    return {
      ipAddress: typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string | undefined,
    };
  }

  @RequirePermission('settings.read')
  @Get('settings')
  @ApiOperation({ summary: 'The organisation settings' })
  @ApiResponse({ status: 200, description: 'All four settings with their current values' })
  @ApiResponse({ status: 403, description: 'Missing settings.read' })
  read() {
    return this.settings.read();
  }

  @RequirePermission('settings.update')
  @Sensitive()
  @Patch('settings')
  @ApiOperation({
    summary: 'Change one or more settings',
    description:
      'Requires a re-authentication within the last five minutes. Only the four known keys are ' +
      'accepted; each value is validated against its own shape.',
  })
  @ApiResponse({ status: 200, description: 'The settings after the change' })
  @ApiResponse({ status: 403, description: 'Missing settings.update, or REAUTH_REQUIRED' })
  @ApiResponse({ status: 422, description: 'A value failed validation' })
  update(
    @Body(new ZodValidationPipe(updateSettingsSchema)) body: UpdateSettingsInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.settings.update(body, actor, this.context(request));
  }
}
