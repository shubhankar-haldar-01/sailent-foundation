import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module.js';

import { ContentController } from './content.controller.js';
import { ContentService } from './content.service.js';

@Module({
  imports: [CatalogModule],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
