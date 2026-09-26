import { Module } from '@nestjs/common';

import { AdminPagesController } from './admin-pages.controller.js';
import { PublicPagesController } from './public-pages.controller.js';
import { PagesService } from './pages.service.js';

/**
 * The section composer.
 *
 * No `CatalogModule`: a page's slug names an existing route rather than being
 * a citable address of its own, so there is no slug history to keep and
 * nothing to redirect. No `StorageModule` either — sections carry no uploads;
 * the components they render fetch their own data.
 */
@Module({
  controllers: [AdminPagesController, PublicPagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}
