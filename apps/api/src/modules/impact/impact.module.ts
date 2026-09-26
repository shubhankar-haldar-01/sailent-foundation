import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module.js';
import { AdminImpactController } from './admin-impact.controller.js';
import { ImpactService } from './impact.service.js';

/**
 * Impact records — the evidence behind the public numbers (decision A14).
 *
 * `CatalogModule` for `SlugService`: `/impact/[slug]` is a citable address,
 * and an impact record is exactly the kind of page an annual report links to.
 */
@Module({
  imports: [CatalogModule],
  controllers: [AdminImpactController],
  providers: [ImpactService],
  exports: [ImpactService],
})
export class ImpactModule {}
