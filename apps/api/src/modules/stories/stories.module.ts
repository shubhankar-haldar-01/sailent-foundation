import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module.js';
import { AdminStoriesController } from './admin-stories.controller.js';
import { StoriesService } from './stories.service.js';

/**
 * Success stories.
 *
 * `CatalogModule` for `SlugService`: a story is a citable address, and one that
 * gets shared — so a renamed slug must 301 rather than 404, which is what the
 * shared slug history provides.
 */
@Module({
  imports: [CatalogModule],
  controllers: [AdminStoriesController],
  providers: [StoriesService],
  exports: [StoriesService],
})
export class StoriesModule {}
