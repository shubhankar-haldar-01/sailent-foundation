import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthenticatedActor } from '@sailent/types';

import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import { RequireAudience } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { MyVolunteeringService } from './my-volunteering.service.js';
import { updateMyVolunteerProfileSchema } from './dto/volunteers.dto.js';
import { requestClientIp } from '../../common/security/internal-request.js';

/**
 * A volunteer's own record.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * `@RequireAudience('donor')` ON THE CONTROLLER, and the audience name is now
 * a misnomer worth explaining rather than renaming.
 *
 * Phase 8 made `donors` the general public account: one row per person,
 * whether they have donated, volunteered, both or neither. The token audience
 * is still called `donor` because renaming it means reissuing every live
 * session, and the name is internal. What it means is "a member of the
 * public", and a volunteer who has never given a rupee holds one.
 *
 * THERE IS NO VOLUNTEER ID IN ANY ROUTE HERE. The service resolves the record
 * from the session, so there is no syntax by which one person could address
 * another's hours, assignments or certificates.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('My volunteering')
@ApiBearerAuth()
@RequireAudience('donor')
@Controller('me/volunteering')
export class MyVolunteeringController {
  constructor(private readonly mine: MyVolunteeringService) {}

  private context(request: Request) {
    return {
      // The trusted client address (Phase 12), never a raw X-Forwarded-For.
      ipAddress: requestClientIp(request),
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string | undefined,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'The signed-in volunteer’s own record',
    description:
      'Returns `{ isVolunteer: false }` for an account with no volunteer record — that is a legitimate answer, not an error. Internal notes and status reasons are never included.',
  })
  overview(@CurrentActor() actor: AuthenticatedActor) {
    return this.mine.overview(actor.id);
  }

  @Get('assignments')
  @ApiOperation({ summary: 'Work this volunteer has been given' })
  @ApiResponse({ status: 404, description: 'This account has no volunteer record' })
  assignments(@CurrentActor() actor: AuthenticatedActor) {
    return this.mine.assignments(actor.id);
  }

  @Get('attendance')
  @ApiOperation({
    summary: 'Attendance recorded for this volunteer',
    description:
      'READ ONLY. Certificates count verified hours, so attendance a volunteer could edit would make the organisation’s signature on that document worthless.',
  })
  attendance(@CurrentActor() actor: AuthenticatedActor) {
    return this.mine.attendance(actor.id);
  }

  @Get('certificates')
  @ApiOperation({ summary: 'Certificates issued to this volunteer, including withdrawn ones' })
  certificates(@CurrentActor() actor: AuthenticatedActor) {
    return this.mine.certificatesFor(actor.id);
  }

  @Patch()
  @ApiOperation({
    summary: 'Update your own volunteer profile',
    description:
      'Contact details, skills, interests, availability and the emergency contact. Not your name, status, hours or identifier.',
  })
  updateProfile(
    @Body(new ZodValidationPipe(updateMyVolunteerProfileSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.mine.updateProfile(actor.id, body, this.context(request));
  }
}
