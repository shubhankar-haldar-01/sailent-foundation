import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module.js';
import { AdminBlogController } from './admin-blog.controller.js';
import { PublicBlogController } from './public-blog.controller.js';
import { BlogService } from './blog.service.js';

/**
 * The blog.
 *
 * `CatalogModule` for `SlugService`: an article is a citable address and the
 * kind of thing people link to, so a renamed slug must 301 rather than 404 —
 * which is what the shared slug history already provides.
 *
 * NO STORAGE MODULE. Featured images are references to rows the media library
 * already owns; this module never uploads, and there is no second R2 path.
 */
@Module({
  imports: [CatalogModule],
  controllers: [AdminBlogController, PublicBlogController],
  providers: [BlogService],
  exports: [BlogService],
})
export class BlogModule {}
