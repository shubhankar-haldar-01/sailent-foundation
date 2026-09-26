import { Body, Controller, Get, Header, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import type { AuthenticatedActor } from '@sailent/types';
import {
  exportRequestSchema,
  reportRangeSchema,
  taxReadinessQuerySchema,
} from '@sailent/validation';

import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import {
  RequireAudience,
  RequirePermission,
  Sensitive,
} from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ReportsService } from './reports.service.js';

/**
 * Reports and analytics — administration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * READING IS NOT SENSITIVE. EXPORTING IS.
 *
 * A report is a page of numbers that stays on the screen; an export is a file
 * that leaves the building, gets emailed around and is opened on a laptop in a
 * café. Only one of those deserves a password prompt, and making somebody
 * re-authenticate to look at a chart teaches them to keep a re-auth window
 * open — which is worse for security than not asking.
 *
 * `POST` for the export, not `GET`, because it has effects: it writes an audit
 * row carrying the row count. A GET that did that would be prefetched by a
 * browser and retried by a proxy, and the audit log would fill with accesses
 * nobody made.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('admin: reports')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  private context(request: Request) {
    return {
      ipAddress: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
      requestId: request.get('x-request-id') ?? undefined,
    };
  }

  @RequirePermission('reports.read')
  @Get('reports/donations')
  @ApiOperation({
    summary: 'Donations over a range, broken down by payment state',
    description: 'Totals, per status, per campaign and per day. Amounts are integer paise.',
  })
  donations(
    @Query(new ZodValidationPipe(reportRangeSchema))
    query: ReturnType<typeof reportRangeSchema.parse>,
  ) {
    return this.reports.donations(query);
  }

  @RequirePermission('reports.read')
  @Get('reports/campaigns')
  @ApiOperation({
    summary: 'Campaigns, with what each raised inside the range',
    description: 'Includes campaigns that raised nothing — those are the ones worth seeing.',
  })
  campaigns(
    @Query(new ZodValidationPipe(reportRangeSchema))
    query: ReturnType<typeof reportRangeSchema.parse>,
  ) {
    return this.reports.campaigns(query);
  }

  @RequirePermission('reports.read')
  @Get('reports/volunteers')
  @ApiOperation({ summary: 'Volunteers who applied in the range, and the standing picture' })
  volunteers(
    @Query(new ZodValidationPipe(reportRangeSchema))
    query: ReturnType<typeof reportRangeSchema.parse>,
  ) {
    return this.reports.volunteers(query);
  }

  @RequirePermission('reports.read')
  @Get('reports/impact')
  @ApiOperation({ summary: 'Impact records in the range, by metric' })
  impact(
    @Query(new ZodValidationPipe(reportRangeSchema))
    query: ReturnType<typeof reportRangeSchema.parse>,
  ) {
    return this.reports.impact(query);
  }

  @RequirePermission('reports.read')
  @Get('reports/reconciliation')
  @ApiOperation({
    summary: 'What is stuck',
    description:
      'Donations still pending, the oldest first, and the invariants a captured donation ' +
      'should satisfy. Answers one question: what needs a human?',
  })
  reconciliation(
    @Query(new ZodValidationPipe(reportRangeSchema))
    query: ReturnType<typeof reportRangeSchema.parse>,
  ) {
    return this.reports.reconciliation(query);
  }

  @RequirePermission('reports.read')
  @Get('reports/tax-readiness')
  @ApiOperation({
    summary: 'Form 10BD readiness for a financial year',
    description:
      'How many captured donations could go on the return, and how many could not because no ' +
      'donor tax ID is on file. Files nothing.',
  })
  taxReadiness(
    @Query(new ZodValidationPipe(taxReadinessQuerySchema))
    query: ReturnType<typeof taxReadinessQuerySchema.parse>,
  ) {
    return this.reports.taxReadiness(query.financialYear);
  }

  /**
   * A CSV.
   *
   * `reports.export` is necessary and not always sufficient: a dataset with
   * its own permission needs that too, checked in the service. Without it this
   * route would be a way to read donor records without `donor.export`.
   */
  @RequirePermission('reports.export')
  @Sensitive()
  @Post('reports/export')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Export a dataset as CSV',
    description:
      'Requires a re-authentication, and a dataset-specific permission where one exists. ' +
      'Every export writes an audit row carrying the row count.',
  })
  @ApiResponse({ status: 403, description: 'REAUTH_REQUIRED, or the dataset needs more' })
  @ApiResponse({ status: 422, description: 'Bad range, or too many rows — narrow the period' })
  async exportCsv(
    @Body(new ZodValidationPipe(exportRequestSchema))
    body: ReturnType<typeof exportRequestSchema.parse>,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const result = await this.reports.exportCsv(body, actor, this.context(request));

    /*
      Sent as a FILE, not inside the JSON envelope every other route uses.

      A CSV base64'd into a JSON field would have to be decoded by the caller
      before it was a file, and the browser would have to build the download
      itself. `Content-Disposition` is what makes this arrive as a download in
      every client, and the filename is sanitised in `csvFilename`.
    */
    response
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
      .setHeader('X-Row-Count', String(result.rowCount))
      .send(result.csv);
  }
}
