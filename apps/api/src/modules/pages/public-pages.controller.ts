import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator.js';
import { PagesService } from './pages.service.js';

/**
 * Composed pages, as the public reads them.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A SEPARATE CONTROLLER, like the blog's. Every route here is `@Public()`, so
 * a mistake is unauthenticated — and the service's public reads pin
 * `status = 'published'`, exclude soft-deleted rows, and compare
 * `scheduled_at` in SQL. None of them takes an argument that can widen that.
 *
 * The preview route is the one exception, and it is not an exception to the
 * rule: it returns an unpublished page ONLY for a correctly signed, unexpired
 * token naming that exact page.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('pages')
@Controller()
export class PublicPagesController {
  constructor(private readonly pages: PagesService) {}

  @Public()
  @Get('pages/:slug')
  @ApiOperation({
    summary: 'A published composed page',
    description:
      'A page scheduled for later is indistinguishable from one that does not exist, which is ' +
      'the point: a schedule must not leak what is coming.',
  })
  @ApiParam({ name: 'slug', example: 'home' })
  @ApiQuery({ name: 'preview', required: false, description: 'A signed preview token' })
  @ApiResponse({ status: 404, description: 'No such published page' })
  async get(@Param('slug') slug: string, @Query('preview') preview?: string) {
    if (preview) {
      const previewed = await this.pages.resolvePreview(preview);
      // The token must name THIS page. Otherwise one valid token would open
      // every unpublished page on the site.
      if (previewed && previewed.slug === slug) return previewed;
      throw new NotFoundException('That page does not exist.');
    }

    const page = await this.pages.getPublished(slug);
    if (!page) throw new NotFoundException('That page does not exist.');
    return page;
  }
}
