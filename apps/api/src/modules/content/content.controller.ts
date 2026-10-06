import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { paginationQuerySchema } from '../../common/dto/pagination.dto.js';
import { z } from 'zod';
import { ContentService } from './content.service.js';
import { SlugService } from '../catalog/slug.service.js';

const campaignQuerySchema = paginationQuerySchema.extend({
  programSlug: z.string().max(200).optional(),
  /** Category display name. Kept for links already in the wild. */
  category: z.string().max(80).optional(),
  /** Category slug — the stable identifier, unaffected by a rename. */
  categorySlug: z.string().max(120).optional(),
  state: z.string().max(120).optional(),
  /**
   * `draft` and `archived` are absent by construction: a value the schema
   * does not accept cannot be smuggled past the service's filter.
   */
  status: z.enum(['active', 'paused', 'completed', 'all']).optional(),
});

const eventQuerySchema = paginationQuerySchema.extend({
  when: z.enum(['upcoming', 'past']).optional().default('upcoming'),
});

const redirectParamSchema = z.object({
  // Phase 9 added the last three. `SlugService` records history for all five,
  // so a team member renamed after a marriage or an event renamed after a venue
  // change redirects exactly as a campaign does.
  entity: z.enum(['program', 'campaign', 'team', 'event', 'impact']),
  slug: z
    .string()
    .min(1)
    .max(240)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug'),
});

/**
 * The donor-list query.
 *
 * `sort` is an ENUM, not a column name. A caller-supplied ordering column on an
 * endpoint that publishes names and amounts is a way to probe the table's shape;
 * two allowed values is the whole surface.
 */
const campaignDonorsQuerySchema = z.object({
  sort: z.enum(['recent', 'generous']).default('recent'),
  limit: z.coerce.number().int().min(1).max(25).default(5),
});

const slugParamSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(240)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug'),
});

/**
 * Public read API.
 *
 * Every route is `@Public()` — and each of those markings is a deliberate,
 * reviewable decision, because everything else in this API is deny-by-default.
 *
 * These endpoints return PUBLISHED content only, with admin-only and private
 * fields stripped in the service. There is no query parameter that changes that.
 */
@ApiTags('public')
@Controller()
export class ContentController {
  constructor(
    private readonly content: ContentService,
    private readonly slugs: SlugService,
  ) {}

  // --- Programmes ----------------------------------------------------------

  @Public()
  @Get('programs')
  @ApiOperation({ summary: 'List published programmes' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max 100' })
  @ApiQuery({ name: 'sort', required: false, example: 'displayOrder' })
  @ApiResponse({ status: 200, description: 'Paginated programmes' })
  listPrograms(@Query(new ZodValidationPipe(paginationQuerySchema)) query: never) {
    return this.content.listPrograms(query);
  }

  @Public()
  @Get('programs/:slug')
  @ApiOperation({ summary: 'A programme with its campaigns, stories and impact' })
  @ApiParam({ name: 'slug', example: 'education' })
  @ApiResponse({ status: 404, description: 'Programme not found or not published' })
  getProgram(@Param(new ZodValidationPipe(slugParamSchema)) params: { slug: string }) {
    return this.content.getProgramBySlug(params.slug);
  }

  // --- Campaigns -----------------------------------------------------------

  @Public()
  @Get('campaigns')
  @ApiOperation({ summary: 'List campaigns' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max 100' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'completed', 'all'] })
  @ApiQuery({ name: 'programSlug', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'q', required: false, description: 'Free-text search' })
  @ApiQuery({
    name: 'sort',
    required: false,
    example: '-amountRaised',
    description:
      '`featured` puts the campaigns marked featured first, in their featured order, then the rest by deadline.',
  })
  listCampaigns(@Query(new ZodValidationPipe(campaignQuerySchema)) query: never) {
    return this.content.listCampaigns(query);
  }

  @Public()
  @Get('campaigns/:slug')
  @ApiOperation({ summary: 'A campaign with its products and related stories' })
  @ApiParam({ name: 'slug', example: 'school-kits-jharkhand' })
  @ApiResponse({ status: 404, description: 'Campaign not found or not published' })
  getCampaign(@Param(new ZodValidationPipe(slugParamSchema)) params: { slug: string }) {
    return this.content.getCampaignBySlug(params.slug);
  }

  @Public()
  @Get('campaigns/:slug/products')
  @ApiOperation({ summary: 'Active products for a campaign' })
  @ApiParam({ name: 'slug', example: 'school-kits-jharkhand' })
  getCampaignProducts(@Param(new ZodValidationPipe(slugParamSchema)) params: { slug: string }) {
    return this.content.getCampaignProductsBySlug(params.slug);
  }

  // --- Stories -------------------------------------------------------------

  @Public()
  @Get('campaigns/:slug/faqs')
  @ApiOperation({ summary: 'Published FAQs for a campaign' })
  @ApiParam({ name: 'slug' })
  campaignFaqs(@Param(new ZodValidationPipe(slugParamSchema)) params: { slug: string }) {
    return this.content.publicCampaignFaqs(params.slug);
  }

  @Public()
  @Get('campaigns/:slug/gallery')
  @ApiOperation({
    summary: 'Public gallery images for a campaign',
    description: 'Images marked private are filtered out in the query, not after it.',
  })
  @ApiParam({ name: 'slug' })
  campaignGallery(@Param(new ZodValidationPipe(slugParamSchema)) params: { slug: string }) {
    return this.content.publicCampaignGallery(params.slug);
  }

  @Public()
  @Get('campaigns/:slug/donors')
  @ApiOperation({
    summary: 'People who recently gave to a campaign',
    description:
      'Confirmed donations only. An anonymous gift returns the literal "Anonymous Donor" — the name is never read out of the database, not filtered out afterwards. Either the donation-level flag or the donor\'s standing preference hides it. No email, phone, donor id or donation reference is returned at any point.',
  })
  @ApiParam({ name: 'slug' })
  @ApiQuery({ name: 'sort', required: false, enum: ['recent', 'generous'] })
  @ApiQuery({ name: 'limit', required: false, description: '1–25, default 5' })
  campaignDonors(
    @Param(new ZodValidationPipe(slugParamSchema)) params: { slug: string },
    @Query(new ZodValidationPipe(campaignDonorsQuerySchema))
    query: { sort: 'recent' | 'generous'; limit: number },
  ) {
    return this.content.publicCampaignDonors(params.slug, query);
  }

  @Public()
  @Get('campaigns/:slug/updates')
  @ApiOperation({ summary: 'Published progress updates for a campaign' })
  @ApiParam({ name: 'slug' })
  campaignUpdates(@Param(new ZodValidationPipe(slugParamSchema)) params: { slug: string }) {
    return this.content.publicCampaignUpdates(params.slug);
  }

  @Public()
  @Get('campaigns/:slug/documents')
  @ApiOperation({
    summary: 'Public documents attached to a campaign',
    description: 'Private and restricted documents are never listed, and never carry a URL.',
  })
  @ApiParam({ name: 'slug' })
  campaignDocuments(@Param(new ZodValidationPipe(slugParamSchema)) params: { slug: string }) {
    return this.content.publicCampaignDocuments(params.slug);
  }

  @Public()
  @Get('categories')
  @ApiOperation({
    summary: 'Categories that have at least one public record',
    description:
      'Empty categories are omitted — a filter leading to an empty page is worse than no filter.',
  })
  @ApiQuery({ name: 'kind', required: false, enum: ['program', 'campaign'] })
  categories(@Query('kind') kind: 'program' | 'campaign' = 'campaign') {
    return this.content.listPublicCategories(kind === 'program' ? 'program' : 'campaign');
  }

  @Public()
  @Get('redirects/:entity/:slug')
  @ApiOperation({
    summary: 'Resolve a retired slug',
    description:
      'Returns the record’s current slug when this one was used before, so the web app can issue a 301 (docs/seo-strategy.md). Null means the slug never existed — a real 404.',
  })
  @ApiParam({ name: 'entity', enum: ['program', 'campaign', 'team', 'event', 'impact'] })
  @ApiParam({ name: 'slug' })
  async redirect(
    @Param(new ZodValidationPipe(redirectParamSchema))
    params: {
      entity: 'program' | 'campaign' | 'team' | 'event' | 'impact';
      slug: string;
    },
  ) {
    return { slug: await this.slugs.resolveRedirect(params.entity, params.slug) };
  }

  @Public()
  @Get('stories')
  @ApiOperation({ summary: 'List published success stories' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listStories(@Query(new ZodValidationPipe(paginationQuerySchema)) query: never) {
    return this.content.listStories(query);
  }

  @Public()
  @Get('stories/:slug')
  @ApiOperation({ summary: 'A success story' })
  @ApiParam({ name: 'slug', example: 'sunita-finished-school' })
  getStory(@Param(new ZodValidationPipe(slugParamSchema)) params: { slug: string }) {
    return this.content.getStoryBySlug(params.slug);
  }

  // --- Events --------------------------------------------------------------

  @Public()
  @Get('events')
  @ApiOperation({ summary: 'List published events' })
  @ApiQuery({ name: 'when', required: false, enum: ['upcoming', 'past'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listEvents(@Query(new ZodValidationPipe(eventQuerySchema)) query: never) {
    return this.content.listEvents(query);
  }

  @Public()
  @Get('events/:slug')
  @ApiOperation({
    summary: 'An event',
    description: 'The online joining link is withheld — it is released to registrants only.',
  })
  @ApiParam({ name: 'slug', example: 'volunteer-orientation-october' })
  getEvent(@Param(new ZodValidationPipe(slugParamSchema)) params: { slug: string }) {
    return this.content.getEventBySlug(params.slug);
  }

  // --- Team and impact -----------------------------------------------------

  @Public()
  @Get('team')
  @ApiOperation({ summary: 'Public team directory, ordered for display' })
  listTeam() {
    return this.content.listTeam();
  }

  @Public()
  @Get('team/:slug')
  @ApiOperation({
    summary: 'One team member',
    description:
      'Requires both `status = published` and `isPublic` — the same pair the directory listing requires, so the two can never disagree about who is on the team.',
  })
  @ApiParam({ name: 'slug', example: 'dr-anjali-menon' })
  getTeamMember(@Param(new ZodValidationPipe(slugParamSchema)) params: { slug: string }) {
    return this.content.getTeamMemberBySlug(params.slug);
  }

  @Public()
  @Get('impact')
  @ApiOperation({
    summary: 'Impact aggregates and dated updates',
    description:
      'Totals are computed live from the database. Nothing here is a stored claim (decision A14).',
  })
  getImpact() {
    return this.content.getImpact();
  }

  @Public()
  @Get('impact/:slug')
  @ApiOperation({
    summary: 'One impact record',
    description:
      'Includes the verification method. A figure published without the evidence behind it is the arrangement decision A14 exists to prevent.',
  })
  @ApiParam({ name: 'slug', example: 'reading-corners-installed-across-fourteen-schools' })
  getImpactRecord(@Param(new ZodValidationPipe(slugParamSchema)) params: { slug: string }) {
    return this.content.getImpactBySlug(params.slug);
  }
}
