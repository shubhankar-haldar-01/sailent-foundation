import { Module } from '@nestjs/common';

import { CommunicationsModule } from '../communications/communications.module.js';
import { DonationsModule } from '../donations/donations.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

/** The admin home page (Phase 13): reads from the modules it summarises. */
@Module({
  imports: [DonationsModule, CommunicationsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
