import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import {
  RequireAudience,
  RequirePermission,
} from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { paginationQuerySchema } from '../../common/dto/pagination.dto.js';
import { AuditService } from './audit.service.js';

const auditQuerySchema = paginationQuerySchema.extend({
  entityType: z.string().max(48).optional(),
  entityId: z.string().uuid().optional(),
  action: z.string().max(64).optional(),
});

/**
 * The audit log, read-only.
 *
 * There is no POST, PATCH or DELETE here and there never will be: an audit
 * trail that can be written to through the API is not evidence of anything
 * (decision A10). Rows are written by services as a side effect of the
 * operations they record.
 *
 * Sensitive values are redacted at WRITE time in `AuditService`, so a reader
 * cannot recover a password hash or a PAN from this endpoint even with
 * `audit.read` — the data was never stored.
 */
@ApiTags('admin: audit')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @RequirePermission('audit.read')
  @Get('audit-logs')
  @ApiOperation({ summary: 'Read the audit log, newest first' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max 100' })
  @ApiQuery({ name: 'entityType', required: false, example: 'user' })
  @ApiQuery({ name: 'entityId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'action', required: false, example: 'user.assign_role' })
  @ApiResponse({ status: 200, description: 'Paginated audit entries' })
  @ApiResponse({ status: 403, description: 'Missing audit.read' })
  list(@Query(new ZodValidationPipe(auditQuerySchema)) query: never) {
    return this.audit.list(query);
  }
}
