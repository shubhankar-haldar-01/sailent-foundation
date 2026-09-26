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
import { PRODUCT_TRANSITIONS } from '@sailent/validation';

import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import {
  RequireAudience,
  RequirePermission,
  Sensitive,
} from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CampaignProductsService } from './campaign-products.service.js';
import { ProductsService } from './products.service.js';
import {
  AddCampaignProductDto,
  CreateProductDto,
  ProductStatusDto,
  addCampaignProductSchema,
  adjustProvidedSchema,
  campaignIdOnlyParam,
  campaignProductParams,
  createProductSchema,
  optionalReasonSchema,
  productIdParam,
  productListQuerySchema,
  productStatusSchema,
  reorderCampaignProductsSchema,
  setActiveSchema,
  updateCampaignProductSchema,
  updateProductSchema,
} from './dto/products.dto.js';

/**
 * Product catalogue and campaign offerings, for staff.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO RESOURCES, TWO PERMISSION FAMILIES, ONE CONTROLLER.
 *
 * `product.*` governs the catalogue: what a School Kit IS. `campaign_product.*`
 * governs an offering: what THIS appeal charges for one. They are separated
 * because they are genuinely different jobs — a Campaign Manager sets prices on
 * their own campaigns without being able to archive a product out from under
 * everybody else's.
 *
 * TWO ROUTES ARE `@Sensitive()`, requiring a re-authentication within the last
 * five minutes:
 *
 *   • Archiving a catalogue product — it withdraws the product from every
 *     future campaign at once.
 *   • Correcting a provided quantity by hand — it edits a number that is
 *     supposed to be a consequence of money received.
 *
 * Adding a product to a campaign is deliberately NOT sensitive. It is the
 * routine act of this phase, done many times a week, and a password prompt on
 * every one would train operators to keep a re-auth window permanently open —
 * which defeats the control everywhere it does matter.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('admin: products')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class AdminProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly campaignProducts: CampaignProductsService,
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
  // The catalogue
  // =========================================================================

  @RequirePermission('product.view')
  @Get('products')
  @ApiOperation({
    summary: 'The product catalogue',
    description:
      'Archived products are excluded unless `status` says otherwise. Pass `notInCampaignId` to list only what a campaign does not already offer — that is what the campaign picker uses, so a duplicate cannot be chosen.',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive', 'archived', 'all'] })
  @ApiQuery({ name: 'notInCampaignId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'q', required: false, description: 'Search name, URL or description' })
  @ApiQuery({ name: 'sort', required: false, example: 'name' })
  listProducts(@Query(new ZodValidationPipe(productListQuerySchema)) query: never) {
    return this.products.list(query);
  }

  @RequirePermission('product.view')
  @Get('products/:id')
  @ApiOperation({
    summary: 'One product, with every campaign that offers it',
    description:
      'The campaign list answers “what will I affect if I change this” — each entry carries that campaign’s own price, which a change here does not touch.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  getProduct(@Param(new ZodValidationPipe(productIdParam)) params: { id: string }) {
    return this.products.getById(params.id);
  }

  @RequirePermission('product.create')
  @Post('products')
  @ApiOperation({
    summary: 'Add a product to the catalogue',
    description:
      'Created active and available to every campaign. `defaultPrice` is a suggestion copied when the product is added to a campaign — it is never read again after that.',
  })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 409, description: 'Another product already uses that URL' })
  createProduct(
    @Body(new ZodValidationPipe(createProductSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.products.create(body, actor, this.context(request));
  }

  @RequirePermission('product.update')
  @Patch('products/:id')
  @ApiOperation({
    summary: 'Edit a catalogue product',
    description:
      'Changing `defaultPrice` does NOT change what any campaign currently charges, and does not touch a single historical donation. Both facts are recorded on the audit row.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  updateProduct(
    @Param(new ZodValidationPipe(productIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(updateProductSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.products.update(params.id, body, actor, this.context(request));
  }

  @RequirePermission('product.activate')
  @Post('products/:id/status')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Activate or deactivate a catalogue product',
    description: `Permitted transitions: ${JSON.stringify(PRODUCT_TRANSITIONS)}. Archiving goes through its own route because it requires re-authentication.`,
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: ProductStatusDto })
  setProductStatus(
    @Param(new ZodValidationPipe(productIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(productStatusSchema))
    body: { status: 'active' | 'inactive' | 'archived'; reason?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.products.setStatus(
      params.id,
      body.status,
      body.reason,
      actor,
      this.context(request),
    );
  }

  @RequirePermission('product.archive')
  @Sensitive()
  @Post('products/:id/archive')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Archive a catalogue product',
    description:
      'Retires the product everywhere. Nothing is deleted: donations that cite it keep resolving, and campaigns that offered it keep their record. Refused while a live campaign still offers it — that is a decision to make campaign by campaign.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 409, description: 'A live campaign still offers this product' })
  archiveProduct(
    @Param(new ZodValidationPipe(productIdParam)) params: { id: string },
    @Body(new ZodValidationPipe(optionalReasonSchema)) body: { reason?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.products.setStatus(
      params.id,
      'archived',
      body.reason,
      actor,
      this.context(request),
    );
  }

  @RequirePermission('product.archive')
  @Sensitive()
  @Delete('products/:id')
  @ApiOperation({
    summary: 'Not supported — products are archived, never deleted',
    description:
      'Always answers 409, naming the campaigns and donation lines that cite the product and pointing at archiving. The route exists so an operator who reaches for delete is told why it is absent rather than left wondering whether it is broken.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 409, description: 'Always. Archive instead.' })
  deleteProduct(@Param(new ZodValidationPipe(productIdParam)) params: { id: string }) {
    return this.products.remove(params.id);
  }

  // =========================================================================
  // Campaign offerings
  // =========================================================================

  @RequirePermission('campaign_product.view')
  @Get('campaigns/:campaignId/products')
  @ApiOperation({
    summary: 'The products a campaign offers',
    description:
      'Each row carries the campaign’s own price alongside the catalogue’s default, so an operator can see where the two have diverged and decide whether that is intentional.',
  })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  listCampaignProducts(
    @Param(new ZodValidationPipe(campaignIdOnlyParam)) params: { campaignId: string },
  ) {
    return this.campaignProducts.list(params.campaignId);
  }

  @RequirePermission('campaign_product.add')
  @Post('campaigns/:campaignId/products')
  @ApiOperation({
    summary: 'Offer a catalogue product on this campaign',
    description:
      'Takes an existing `productId`. This endpoint cannot create a product, which is how duplicates stay impossible. Omit `price` to copy the catalogue default at this moment; the two are unrelated numbers from then on.',
  })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiBody({ type: AddCampaignProductDto })
  @ApiResponse({ status: 201, description: 'Added' })
  @ApiResponse({ status: 409, description: 'This campaign already offers that product' })
  addCampaignProduct(
    @Param(new ZodValidationPipe(campaignIdOnlyParam)) params: { campaignId: string },
    @Body(new ZodValidationPipe(addCampaignProductSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.campaignProducts.add(params.campaignId, body, actor, this.context(request));
  }

  @RequirePermission('campaign_product.update')
  @Patch('campaigns/:campaignId/products/:productId')
  @ApiOperation({
    summary: 'Change this campaign’s price or target for a product',
    description:
      'A price change affects the NEXT donation only. Historical lines snapshot what was charged and are never rewritten.',
  })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiParam({ name: 'productId', format: 'uuid', description: 'The campaign_product id' })
  updateCampaignProduct(
    @Param(new ZodValidationPipe(campaignProductParams))
    params: { campaignId: string; productId: string },
    @Body(new ZodValidationPipe(updateCampaignProductSchema)) body: never,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.campaignProducts.update(
      params.campaignId,
      params.productId,
      body,
      actor,
      this.context(request),
    );
  }

  @RequirePermission('campaign_product.activate', 'campaign_product.deactivate')
  @Post('campaigns/:campaignId/products/:productId/active')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Show or hide a product on this campaign',
    description:
      'Deactivating takes it off the public page while keeping the progress figure donors were shown. This is the alternative the remove route points at.',
  })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  setCampaignProductActive(
    @Param(new ZodValidationPipe(campaignProductParams))
    params: { campaignId: string; productId: string },
    @Body(new ZodValidationPipe(setActiveSchema)) body: { isActive: boolean; reason?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.campaignProducts.setActive(
      params.campaignId,
      params.productId,
      body.isActive,
      body.reason,
      actor,
      this.context(request),
    );
  }

  @RequirePermission('campaign_product.update')
  @Post('campaigns/:campaignId/products/reorder')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reorder the products on a campaign' })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  reorderCampaignProducts(
    @Param(new ZodValidationPipe(campaignIdOnlyParam)) params: { campaignId: string },
    @Body(new ZodValidationPipe(reorderCampaignProductsSchema))
    body: { order: { id: string; sortOrder: number }[] },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.campaignProducts.reorder(
      params.campaignId,
      body.order,
      actor,
      this.context(request),
    );
  }

  @RequirePermission('campaign_product.adjust_provided')
  @Sensitive()
  @Patch('campaigns/:campaignId/products/:productId/provided')
  @ApiOperation({
    summary: 'Correct a provided quantity by hand',
    description:
      'Deliberately separate from the ordinary edit form, with a mandatory reason and a critical audit row. This number is meant to be a consequence of donations received; every hand edit is an exception somebody can be asked about.',
  })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  adjustProvided(
    @Param(new ZodValidationPipe(campaignProductParams))
    params: { campaignId: string; productId: string },
    @Body(new ZodValidationPipe(adjustProvidedSchema))
    body: { providedQuantity: number; reason: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.campaignProducts.adjustProvided(
      params.campaignId,
      params.productId,
      body.providedQuantity,
      body.reason,
      actor,
      this.context(request),
    );
  }

  @RequirePermission('campaign_product.remove')
  @Delete('campaigns/:campaignId/products/:productId')
  @ApiOperation({
    summary: 'Stop offering a product on this campaign',
    description:
      'Soft delete. Refused once anything has been funded — the 409 points at deactivating instead, which keeps the record of what donors gave.',
  })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiResponse({ status: 409, description: 'Already funded — deactivate instead' })
  removeCampaignProduct(
    @Param(new ZodValidationPipe(campaignProductParams))
    params: { campaignId: string; productId: string },
    @Body(new ZodValidationPipe(optionalReasonSchema)) body: { reason?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.campaignProducts.remove(
      params.campaignId,
      params.productId,
      body.reason,
      actor,
      this.context(request),
    );
  }
}
