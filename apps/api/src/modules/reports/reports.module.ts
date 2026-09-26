import { Module } from '@nestjs/common';

import { AdminReportsController } from './admin-reports.controller.js';
import { ReportsService } from './reports.service.js';

/**
 * Reports and analytics.
 *
 * READ-ONLY ACROSS EVERY OTHER MODULE, which is why it imports none of them:
 * it queries the tables directly rather than going through services that would
 * apply their own pagination, their own scoping and their own idea of what a
 * caller may see. A report is an aggregate, and an aggregate assembled from
 * paginated service calls is an aggregate that is quietly wrong.
 *
 * The one thing it writes is an audit row per export.
 *
 * NO PUBLIC CONTROLLER. Every figure here is administrative; the public site's
 * own numbers come from the impact module, which enforces A14 separately.
 */
@Module({
  controllers: [AdminReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
