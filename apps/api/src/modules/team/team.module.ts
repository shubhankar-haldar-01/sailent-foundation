import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module.js';
import { AdminTeamController } from './admin-team.controller.js';
import { TeamService } from './team.service.js';

/**
 * The public team directory.
 *
 * `CatalogModule` for `SlugService` — a team member's page is linked to from
 * annual reports and press coverage, and a name correction must not break
 * those links. The public read path stays in `ContentModule` with every other
 * public read.
 */
@Module({
  imports: [CatalogModule],
  controllers: [AdminTeamController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
