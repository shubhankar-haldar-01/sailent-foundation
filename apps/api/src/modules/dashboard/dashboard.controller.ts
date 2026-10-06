import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedActor } from '@sailent/types';

import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import {
  AuthenticatedOnly,
  RequireAudience,
} from '../../common/decorators/permissions.decorator.js';
import { DashboardService } from './dashboard.service.js';

/**
 * The admin home page's figures (Phase 13). Any signed-in staff member may
 * call it; each section appears only for the permission that governs it.
 */
@ApiTags('admin: dashboard')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @AuthenticatedOnly()
  @Get('dashboard')
  @ApiOperation({
    summary: 'Headline counts and items needing attention',
    description:
      'Sections: campaigns, programs, donations, payments, donors, volunteers, events, messages, newsletter, notifications, activity — each present only with its read permission.',
  })
  @ApiResponse({ status: 401, description: 'Not signed in as staff' })
  summary(@CurrentActor() actor: AuthenticatedActor) {
    return this.dashboard.summary(actor);
  }
}
