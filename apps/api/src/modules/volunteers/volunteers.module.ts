import { Module } from '@nestjs/common';

import { AdminVolunteersController } from './admin-volunteers.controller.js';
import { MyVolunteeringController } from './my-volunteering.controller.js';
import { MyVolunteeringService } from './my-volunteering.service.js';
import { VolunteerCertificatesService } from './volunteer-certificates.service.js';
import { VolunteerWorkService } from './volunteer-work.service.js';
import { VolunteersController } from './volunteers.controller.js';
import { VolunteersService } from './volunteers.service.js';

/**
 * Volunteer management.
 *
 * Three controllers, three audiences, and the split is deliberate:
 *
 *   `VolunteersController`       public — applying, and verifying a certificate
 *   `MyVolunteeringController`   the volunteer's own record, ownership from the session
 *   `AdminVolunteersController`  staff, behind permissions
 *
 * One file per audience means a route cannot drift into the wrong one by
 * autocomplete, and the guard decorator sits on the class rather than on
 * individual handlers where it can be forgotten.
 */
@Module({
  controllers: [VolunteersController, MyVolunteeringController, AdminVolunteersController],
  providers: [
    VolunteersService,
    VolunteerWorkService,
    VolunteerCertificatesService,
    MyVolunteeringService,
  ],
  exports: [VolunteersService, VolunteerWorkService],
})
export class VolunteersModule {}
