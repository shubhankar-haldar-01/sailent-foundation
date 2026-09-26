import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthenticatedActor } from '@sailent/types';
import { CAMPAIGN_TRANSITIONS, PROGRAM_TRANSITIONS } from '@sailent/validation';

import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import {
  RequireAudience,
  RequirePermission,
  Sensitive,
} from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CampaignContentService } from './campaign-content.service.js';
import { CampaignsService } from './campaigns.service.js';
import { CategoriesService } from './categories.service.js';
import { ProgramsService } from './programs.service.js';
import {
  CreateCampaignDto,
  CreateProgramDto,
  StatusChangeDto,
  addGalleryItemSchema,
  campaignChildParams,
  campaignIdParam,
  campaignListQuerySchema,
  campaignStatusSchema,
  createCampaignSchema,
  createFaqSchema,
  createProgramSchema,
  createUpdateSchema,
  optionalReasonSchema,
  programListQuerySchema,
  publishFlagSchema,
  reorderSchema,
  updateCampaignSchema,
  updateFaqSchema,
  updateGalleryItemSchema,
  updateProgramSchema,
  updateUpdateSchema,
  uuidParam,
} from './dto/catalog.dto.js';

/**
 * Programme and campaign administration.
 *
 * Every route carries an explicit permission. The four that change what the
 * public can see — archiving, and adjusting a fulfilled quantity — are also
 * `@Sensitive()`, requiring a re-authentication within the last five minutes.
 *
 * Publishing is deliberately NOT sensitive: it is the routine act of this
 * phase, done many times a week, and a password prompt on every one would
 * train operators to keep a re-auth window permanently open, which defeats the
 * control everywhere it does matter.
 */
@ApiTags('admin: catalog')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class AdminCatalogController {
  constructor(
    private readonly programs: ProgramsService,
    private readonly campaigns: CampaignsService,
    private readonly content: CampaignContentService,
    private readonly categories: CategoriesService,
  ) {}

  private context(request: Request) {
    const forwarded = request.headers['x-forwarded-for'];
    return {
      ipAddress: typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string | undefined,
    };
  }

  // =========================================================================
  // Categories
  // =========================================================================

  @RequirePermission('category.read')
  @Get('categories')
  @ApiOperation({ summary: 'The category catalogue, including deactivated entries' })
  @ApiQuery({ name: 'kind', required: false, enum: ['program', 'campaign'] })
  listCategories(@Query('kind') kind?: 'program' | 'campaign') {
    return this.categories.list({ kind, activeOnly: false });
  }

  // =========================================================================
  // Programmes
  // =========================================================================

  @RequirePermission('program.read')
  @Get('programs')
  @ApiOperation({ summary: 'List programmes, including drafts and archived' })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'published', 'archived', 'all'] })
  @ApiQuery({ name: 'categoryId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'q', required: false, description: 'Search title, description or URL' })
  @ApiQuery({ name: 'sort', required: false, example: 'displayOrder' })
  listPrograms(@Query(new ZodValidationPipe(programListQuerySchema)) query: never) {
    return this.programs.list(query);
  }

  @RequirePermission('program.read')
  @Get('programs/:id')
  @ApiOperation({ summary: 'One programme with its campaigns and slug history' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getProgram(@Param(new ZodValidationPipe(uuidParam)) params: { id: string }) {
    return this.programs.getById(params.id);
  }

  @RequirePermission('program.create')
  @Post('programs')
  @ApiOperation({
    summary: 'Create a programme',
    description: 'Always created as a draft. Publish it separately once it reads correctly.',
  })
  @ApiBody({ type: CreateProgramDto })
  @ApiResponse({ status: 201, description: 'Created, in draft' })
  createProgram(
    @Body(new ZodValidationPipe(createProgramSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.programs.create(body, actor, this.context(request));
  }

  @RequirePermission('program.update')
  @Patch('programs/:id')
  @ApiOperation({
    summary: 'Edit a programme',
    description:
      'Changing the URL retires the old one to slug history and leaves a permanent redirect behind it.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  updateProgram(
    @Param(new ZodValidationPipe(uuidParam)) params: { id: string },
    @Body(new ZodValidationPipe(updateProgramSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.programs.update(params.id, body, actor, this.context(request));
  }

  @RequirePermission('program.publish')
  @Post('programs/:id/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publish a programme' })
  @ApiParam({ name: 'id', format: 'uuid' })
  publishProgram(
    @Param(new ZodValidationPipe(uuidParam)) params: { id: string },
    @Body(new ZodValidationPipe(optionalReasonSchema)) body: { reason?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.programs.setStatus(
      params.id,
      'published',
      body.reason,
      actor,
      this.context(request),
    );
  }

  @RequirePermission('program.publish')
  @Post('programs/:id/unpublish')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Take a programme back to draft',
    description: 'How a programme that went out with a mistake comes off the site quickly.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  unpublishProgram(
    @Param(new ZodValidationPipe(uuidParam)) params: { id: string },
    @Body(new ZodValidationPipe(optionalReasonSchema)) body: { reason?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.programs.setStatus(params.id, 'draft', body.reason, actor, this.context(request));
  }

  @RequirePermission('program.archive')
  @Sensitive()
  @Post('programs/:id/archive')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Archive a programme',
    description:
      'Preferred over deletion: campaigns reference programmes, and financial history must stay attributable.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  archiveProgram(
    @Param(new ZodValidationPipe(uuidParam)) params: { id: string },
    @Body(new ZodValidationPipe(optionalReasonSchema)) body: { reason?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.programs.setStatus(
      params.id,
      'archived',
      body.reason,
      actor,
      this.context(request),
    );
  }

  @RequirePermission('program.update')
  @Post('programs/reorder')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reorder programmes. Applied in one transaction.' })
  reorderPrograms(
    @Body(new ZodValidationPipe(reorderSchema))
    body: { order: { id: string; displayOrder: number }[] },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.programs.reorder(body.order, actor, this.context(request));
  }

  // =========================================================================
  // Campaigns
  // =========================================================================

  @RequirePermission('campaign.read')
  @Get('campaigns')
  @ApiOperation({ summary: 'List campaigns, including drafts and archived' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['draft', 'published', 'active', 'paused', 'completed', 'archived', 'all'],
  })
  @ApiQuery({ name: 'programId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'categoryId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'q', required: false })
  listCampaigns(@Query(new ZodValidationPipe(campaignListQuerySchema)) query: never) {
    return this.campaigns.list(query);
  }

  @RequirePermission('campaign.read')
  @Get('campaigns/transitions')
  @ApiOperation({
    summary: 'The lifecycle transition tables',
    description:
      'The admin UI reads this to decide which status buttons to offer. The API validates every transition independently — this is a convenience, not the control.',
  })
  transitions() {
    return { campaign: CAMPAIGN_TRANSITIONS, program: PROGRAM_TRANSITIONS };
  }

  @RequirePermission('campaign.read')
  @Get('campaigns/:id')
  @ApiOperation({ summary: 'One campaign with progress, programme and slug history' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getCampaign(@Param(new ZodValidationPipe(uuidParam)) params: { id: string }) {
    return this.campaigns.getById(params.id);
  }

  @RequirePermission('campaign.create')
  @Post('campaigns')
  @ApiOperation({
    summary: 'Create a campaign',
    description:
      'Always created as a draft. `amountRaised` and `donorCount` cannot be set here or anywhere else through the API.',
  })
  @ApiBody({ type: CreateCampaignDto })
  createCampaign(
    @Body(new ZodValidationPipe(createCampaignSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.campaigns.create(body, actor, this.context(request));
  }

  @RequirePermission('campaign.update')
  @Patch('campaigns/:id')
  @ApiOperation({ summary: 'Edit a campaign' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({
    status: 422,
    description: 'Validation failed — e.g. a goal below the amount raised',
  })
  updateCampaign(
    @Param(new ZodValidationPipe(uuidParam)) params: { id: string },
    @Body(new ZodValidationPipe(updateCampaignSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.campaigns.update(params.id, body, actor, this.context(request));
  }

  @RequirePermission('campaign.publish')
  @Post('campaigns/:id/status')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Change a campaign’s status',
    description:
      'The general form. Validated against the transition table; pausing and completing require a reason.',
  })
  @ApiBody({ type: StatusChangeDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 409, description: 'That transition is not allowed' })
  changeCampaignStatus(
    @Param(new ZodValidationPipe(uuidParam)) params: { id: string },
    @Body(new ZodValidationPipe(campaignStatusSchema))
    body: {
      status: 'draft' | 'published' | 'active' | 'paused' | 'completed' | 'archived';
      reason?: string;
    },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.campaigns.setStatus(
      params.id,
      body.status,
      body.reason,
      actor,
      this.context(request),
    );
  }

  @RequirePermission('campaign.publish')
  @Post('campaigns/:id/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publish a campaign — visible, not yet taking donations' })
  @ApiParam({ name: 'id', format: 'uuid' })
  publishCampaign(
    @Param(new ZodValidationPipe(uuidParam)) params: { id: string },
    @Body(new ZodValidationPipe(optionalReasonSchema)) body: { reason?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.campaigns.setStatus(
      params.id,
      'published',
      body.reason,
      actor,
      this.context(request),
    );
  }

  @RequirePermission('campaign.activate')
  @Post('campaigns/:id/activate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Open a campaign for donations' })
  @ApiParam({ name: 'id', format: 'uuid' })
  activateCampaign(
    @Param(new ZodValidationPipe(uuidParam)) params: { id: string },
    @Body(new ZodValidationPipe(optionalReasonSchema)) body: { reason?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.campaigns.setStatus(params.id, 'active', body.reason, actor, this.context(request));
  }

  @RequirePermission('campaign.pause')
  @Post('campaigns/:id/pause')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Pause donations',
    description: 'A reason is required and is written to the audit log.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  pauseCampaign(
    @Param(new ZodValidationPipe(uuidParam)) params: { id: string },
    @Body(new ZodValidationPipe(optionalReasonSchema)) body: { reason?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.campaigns.setStatus(params.id, 'paused', body.reason, actor, this.context(request));
  }

  @RequirePermission('campaign.complete')
  @Post('campaigns/:id/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark a campaign complete. Stays publicly readable as history.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  completeCampaign(
    @Param(new ZodValidationPipe(uuidParam)) params: { id: string },
    @Body(new ZodValidationPipe(optionalReasonSchema)) body: { reason?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.campaigns.setStatus(
      params.id,
      'completed',
      body.reason,
      actor,
      this.context(request),
    );
  }

  @RequirePermission('campaign.archive')
  @Sensitive()
  @Post('campaigns/:id/archive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Archive a campaign — removed from public listings' })
  @ApiParam({ name: 'id', format: 'uuid' })
  archiveCampaign(
    @Param(new ZodValidationPipe(uuidParam)) params: { id: string },
    @Body(new ZodValidationPipe(optionalReasonSchema)) body: { reason?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.campaigns.setStatus(
      params.id,
      'archived',
      body.reason,
      actor,
      this.context(request),
    );
  }

  // =========================================================================
  // Campaign products — MOVED
  //
  // The product routes left this controller in Phase 5. `products` is now a
  // master entity with its own module, permissions and lifecycle, and the
  // campaign routes that pick from it live beside it in
  // `modules/products/admin-products.controller.ts`.
  //
  // Their paths are unchanged — `/admin/campaigns/:campaignId/products` still
  // answers — so nothing about the URL surface moved with them. What changed
  // is that adding a product to a campaign now names an existing catalogue
  // entry instead of typing a name and a description into a campaign-shaped
  // form, which is how three campaigns ended up with three different
  // descriptions of one School Kit.
  // =========================================================================

  // =========================================================================
  // FAQs
  // =========================================================================

  @RequirePermission('campaign.read')
  @Get('campaigns/:campaignId/faqs')
  @ApiOperation({ summary: 'FAQs for a campaign, including unpublished' })
  listFaqs(@Param(new ZodValidationPipe(campaignIdParam)) params: { campaignId: string }) {
    return this.content.listFaqs(params.campaignId);
  }

  @RequirePermission('campaign_faq.create')
  @Post('campaigns/:campaignId/faqs')
  @ApiOperation({ summary: 'Add an FAQ' })
  createFaq(
    @Param(new ZodValidationPipe(campaignIdParam)) params: { campaignId: string },
    @Body(new ZodValidationPipe(createFaqSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.content.createFaq(params.campaignId, body, actor, this.context(request));
  }

  @RequirePermission('campaign_faq.update')
  @Patch('campaigns/:campaignId/faqs/:childId')
  @ApiOperation({ summary: 'Edit, reorder, publish or unpublish an FAQ' })
  updateFaq(
    @Param(new ZodValidationPipe(campaignChildParams))
    params: { campaignId: string; childId: string },
    @Body(new ZodValidationPipe(updateFaqSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.content.updateFaq(
      params.campaignId,
      params.childId,
      body,
      actor,
      this.context(request),
    );
  }

  @RequirePermission('campaign_faq.delete')
  @Delete('campaigns/:campaignId/faqs/:childId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove an FAQ' })
  async deleteFaq(
    @Param(new ZodValidationPipe(campaignChildParams))
    params: { campaignId: string; childId: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    await this.content.deleteFaq(params.campaignId, params.childId, actor, this.context(request));
  }

  // =========================================================================
  // Gallery
  // =========================================================================

  @RequirePermission('campaign_gallery.manage')
  @Get('campaigns/:campaignId/gallery')
  @ApiOperation({ summary: 'Gallery images, including private ones' })
  listGallery(@Param(new ZodValidationPipe(campaignIdParam)) params: { campaignId: string }) {
    return this.content.listGallery(params.campaignId);
  }

  @RequirePermission('campaign_gallery.manage')
  @Post('campaigns/:campaignId/gallery')
  @ApiOperation({
    summary: 'Add an image',
    description: 'Alt text is required. Accepts JPEG, PNG, WebP or AVIF up to 10 MB.',
  })
  addGalleryItem(
    @Param(new ZodValidationPipe(campaignIdParam)) params: { campaignId: string },
    @Body(new ZodValidationPipe(addGalleryItemSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.content.addGalleryItem(params.campaignId, body, actor, this.context(request));
  }

  @RequirePermission('campaign_gallery.manage')
  @Patch('campaigns/:campaignId/gallery/:childId')
  @ApiOperation({ summary: 'Edit alt text, caption, order or visibility' })
  updateGalleryItem(
    @Param(new ZodValidationPipe(campaignChildParams))
    params: { campaignId: string; childId: string },
    @Body(new ZodValidationPipe(updateGalleryItemSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.content.updateGalleryItem(
      params.campaignId,
      params.childId,
      body,
      actor,
      this.context(request),
    );
  }

  @RequirePermission('campaign_gallery.manage')
  @Delete('campaigns/:campaignId/gallery/:childId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Remove an image from this gallery',
    description: 'The media record survives — it may be used elsewhere.',
  })
  removeGalleryItem(
    @Param(new ZodValidationPipe(campaignChildParams))
    params: { campaignId: string; childId: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.content.removeGalleryItem(
      params.campaignId,
      params.childId,
      actor,
      this.context(request),
    );
  }

  // =========================================================================
  // Progress updates
  // =========================================================================

  @RequirePermission('campaign.read')
  @Get('campaigns/:campaignId/updates')
  @ApiOperation({ summary: 'Progress updates, including drafts' })
  listUpdates(@Param(new ZodValidationPipe(campaignIdParam)) params: { campaignId: string }) {
    return this.content.listUpdates(params.campaignId);
  }

  @RequirePermission('campaign_update.create')
  @Post('campaigns/:campaignId/updates')
  @ApiOperation({ summary: 'Draft a progress update' })
  createUpdate(
    @Param(new ZodValidationPipe(campaignIdParam)) params: { campaignId: string },
    @Body(new ZodValidationPipe(createUpdateSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.content.createUpdate(params.campaignId, body, actor, this.context(request));
  }

  @RequirePermission('campaign_update.update')
  @Patch('campaigns/:campaignId/updates/:childId')
  @ApiOperation({ summary: 'Edit a progress update' })
  updateUpdate(
    @Param(new ZodValidationPipe(campaignChildParams))
    params: { campaignId: string; childId: string },
    @Body(new ZodValidationPipe(updateUpdateSchema)) body: Record<string, unknown>,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.content.updateUpdate(
      params.campaignId,
      params.childId,
      body,
      actor,
      this.context(request),
    );
  }

  @RequirePermission('campaign_update.publish')
  @Post('campaigns/:campaignId/updates/:childId/publish')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Publish or unpublish a progress update',
    description:
      'An update reporting a figure must state how that figure was counted before it can be published (decision A14).',
  })
  @ApiResponse({ status: 422, description: 'A reported figure has no stated basis' })
  publishUpdate(
    @Param(new ZodValidationPipe(campaignChildParams))
    params: { campaignId: string; childId: string },
    @Body(new ZodValidationPipe(publishFlagSchema)) body: { published: boolean },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.content.setUpdatePublished(
      params.campaignId,
      params.childId,
      body.published,
      actor,
      this.context(request),
    );
  }

  // =========================================================================
  // Documents
  // =========================================================================

  @RequirePermission('campaign_document.manage')
  @Get('campaigns/:campaignId/documents')
  @ApiOperation({ summary: 'Documents attached to a campaign, public and private' })
  listDocuments(@Param(new ZodValidationPipe(campaignIdParam)) params: { campaignId: string }) {
    return this.content.listDocuments(params.campaignId);
  }
}
