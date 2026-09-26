import { Module } from '@nestjs/common';

import { AdminDonorsController } from './admin-donors.controller.js';
import { AdminDonorsService } from './admin-donors.service.js';

/**
 * Donor administration, for staff.
 *
 * Separate from `MeModule`, which is the donor's own account. Same tables, two
 * audiences, two authorization models — see the controller comment.
 */
@Module({
  controllers: [AdminDonorsController],
  providers: [AdminDonorsService],
  exports: [AdminDonorsService],
})
export class DonorsModule {}
