import { Module } from '@nestjs/common';

import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

/** Public site search over published content (Phase 13). */
@Module({ controllers: [SearchController], providers: [SearchService] })
export class SearchModule {}
