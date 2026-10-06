import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { SearchService } from './search.service.js';

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Type at least two characters').max(100),
});

@ApiTags('public: search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Search published campaigns, programmes, stories, events and articles',
    description: 'Never returns drafts, archived or deleted records. Up to five of each type.',
  })
  search(@Query(new ZodValidationPipe(searchQuerySchema)) query: { q: string }) {
    return this.searchService.search(query.q);
  }
}
