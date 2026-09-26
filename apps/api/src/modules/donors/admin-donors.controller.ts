import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthenticatedActor } from '@sailent/types';

import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import {
  RequireAudience,
  RequirePermission,
  Sensitive,
} from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { AdminDonorsService } from './admin-donors.service.js';
import {
  adminDonorListQuerySchema,
  donorIdParam,
  updateDonorSchema,
  UpdateDonorDto,
  type AdminDonorListQuery,
  type UpdateDonorInput,
} from './dto/donors.dto.js';

/**
 * Donor administration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS IS HOW STAFF READ DONORS. `/me` IS NOT.
 *
 * The donor-audience routes under `/me` scope every query to the session's own
 * donor id and refuse a staff token outright. Staff need to find a donor by
 * name to resend a receipt or correct a bounced email, and that is a different
 * job with a different authorization model: a permission, a re-authentication
 * for the sensitive parts, and an audit row for every change.
 *
 * Keeping them apart means neither has to carry a conditional that decides
 * whose data is being read.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * PII IS SPLIT ACROSS TWO PERMISSIONS, and the split is enforced in the query
 * rather than in a serialiser — see `AdminDonorsService`.
 *
 * THERE IS NO DELETE ROUTE. `donor.delete` exists in the permission catalogue
 * and means REDACTION, not deletion: a donor record is attached to receipts and
 * to a statutory Form 10BD filing, so removing the row would destroy financial
 * records the organisation is required to keep. Redaction — blanking the
 * identifying columns while preserving the donation history and the receipt —
 * is a real piece of design and is deliberately not half-built here.
 */
@ApiTags('Admin · Donors')
@ApiBearerAuth()
@RequireAudience('staff')
@Controller('admin')
export class AdminDonorsController {
  constructor(private readonly donors: AdminDonorsService) {}

  private context(request: Request) {
    const forwarded = request.headers['x-forwarded-for'];
    return {
      ipAddress: typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string | undefined,
    };
  }

  @RequirePermission('donor.read')
  @Get('donors')
  @ApiOperation({
    summary: 'Search donors',
    description:
      'Searches name, email, phone and donor code. PAN and address are deliberately NOT searchable at any permission level — a search that matched on them would confirm a value through the result count.',
  })
  @ApiQuery({ type: PaginationQueryDto })
  @ApiQuery({ name: 'hasDonated', required: false, enum: ['true', 'false', 'all'] })
  list(
    @Query(new ZodValidationPipe(adminDonorListQuerySchema)) query: AdminDonorListQuery,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.donors.list(query, {
      includeSensitive: actor.permissions.includes('donor.read_sensitive'),
    });
  }

  @RequirePermission('donor.read')
  @Get('donors/:id')
  @ApiOperation({
    summary: 'One donor, with their giving history',
    description:
      'PAN, address and internal notes require `donor.read_sensitive` and are omitted from the query entirely without it. `recomputed` re-derives the lifetime totals from the donations table, so a drift from the cached columns is visible rather than self-confirming.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 404, description: 'No such donor' })
  getById(
    @Param(new ZodValidationPipe(donorIdParam)) params: { id: string },
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.donors.getById(params.id, {
      includeSensitive: actor.permissions.includes('donor.read_sensitive'),
    });
  }

  /**
   * Correct a donor record.
   *
   * `@Sensitive()`, so it also needs a re-authentication within the last five
   * minutes (decision A9). Correcting somebody else's record is not a routine
   * edit, and the reason is mandatory rather than optional.
   */
  @RequirePermission('donor.update')
  @Sensitive()
  @Patch('donors/:id')
  @ApiOperation({
    summary: 'Correct a donor record',
    description:
      'Name, email, address, tax id and internal notes. Lifetime totals, donor code and phone number are server-controlled and are rejected rather than ignored. A reason is required and goes into the audit row.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateDonorDto })
  @ApiResponse({ status: 422, description: 'An unknown or server-controlled field was sent' })
  update(
    @Param(new ZodValidationPipe(donorIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(updateDonorSchema)) body: UpdateDonorInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.donors.update(params.id, body, actor.id, this.context(request));
  }
}
