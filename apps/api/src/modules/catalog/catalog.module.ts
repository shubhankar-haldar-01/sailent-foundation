import { Module } from '@nestjs/common';

import { AdminCatalogController } from './admin-catalog.controller.js';
import { CampaignContentService } from './campaign-content.service.js';
import { CampaignsService } from './campaigns.service.js';
import { CategoriesService } from './categories.service.js';
import { ProgramsService } from './programs.service.js';
import { SlugService } from './slug.service.js';

/**
 * Programme and campaign management.
 *
 * The services are exported because the PUBLIC content module needs two of
 * them — `SlugService` to resolve a retired slug into a redirect, and
 * `CategoriesService` to translate a category slug in a query string into an
 * id. Nothing else crosses the boundary: the public read path has its own
 * service precisely so that a draft cannot leak through a shared method.
 */
@Module({
  controllers: [AdminCatalogController],
  providers: [
    SlugService,
    CategoriesService,
    ProgramsService,
    CampaignsService,
    CampaignContentService,
  ],
  exports: [SlugService, CategoriesService, CampaignContentService],
})
export class CatalogModule {}
