import { Module } from '@nestjs/common';

import { AdminProductsController } from './admin-products.controller.js';
import { CampaignProductsService } from './campaign-products.service.js';
import { ProductsService } from './products.service.js';

/**
 * The product catalogue and the campaign offerings built from it.
 *
 * A module of its own rather than part of `CatalogModule`, because a product is
 * not a child of a campaign. It outlives every campaign that offers it, is
 * edited by different people, and carries its own permission family. Filing it
 * under campaigns would reproduce in the code the exact confusion the Phase 5
 * schema change removed from the database.
 *
 * `CampaignProductsService` is exported because the PUBLIC content module needs
 * the read path — and only the read path. Nothing else crosses the boundary.
 */
@Module({
  controllers: [AdminProductsController],
  providers: [ProductsService, CampaignProductsService],
  exports: [ProductsService, CampaignProductsService],
})
export class ProductsModule {}
