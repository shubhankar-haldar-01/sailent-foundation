import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { BlogService } from './blog.service.js';
import { publicBlogQuerySchema } from './dto/blog.dto.js';

/**
 * The blog, as the public reads it.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A SEPARATE CONTROLLER FROM THE ADMIN ONE, and separate service methods
 * underneath. Not tidiness: every route here is `@Public()`, so a mistake is
 * unauthenticated. Sharing a list function with the admin side and passing a
 * flag is how a draft ends up on the internet — a draft renders perfectly, so
 * nothing looks wrong until somebody reads it.
 *
 * The service's public reads pin `status = 'published'` in SQL and take no
 * argument that can widen it, and they select an explicit column list that
 * contains no id, no author email and no internal metadata.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('blog')
@Controller()
export class PublicBlogController {
  constructor(private readonly blog: BlogService) {}

  @Public()
  @Get('blog')
  @ApiOperation({ summary: 'List published blog posts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, description: 'Search title, summary and body' })
  @ApiQuery({ name: 'category', required: false, description: 'Category slug' })
  @ApiQuery({ name: 'tag', required: false, description: 'Tag slug' })
  @ApiResponse({ status: 200, description: 'Paginated published posts' })
  list(@Query(new ZodValidationPipe(publicBlogQuerySchema)) query: never) {
    return this.blog.listPublished(query);
  }

  @Public()
  @Get('blog/categories')
  @ApiOperation({
    summary: 'Categories that carry at least one published post',
    description: 'Derived from the posts, so the filter list never offers an empty category.',
  })
  categories() {
    return this.blog.publicCategories();
  }

  @Public()
  @Get('blog/:slug')
  @ApiOperation({
    summary: 'One published post',
    description:
      'A retired slug returns `{ redirectTo }` so the web app can issue a permanent redirect ' +
      'instead of a 404. Drafts and archived posts are indistinguishable from missing.',
  })
  @ApiParam({ name: 'slug', example: 'what-a-school-kit-costs' })
  @ApiResponse({ status: 404, description: 'No such published post' })
  get(@Param('slug') slug: string) {
    return this.blog.getPublished(slug);
  }
}
