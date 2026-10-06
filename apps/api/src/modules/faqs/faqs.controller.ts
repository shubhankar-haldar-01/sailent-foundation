import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';

import type { AuthenticatedActor } from '@sailent/types';
import { FAQ_CATEGORY_IDS } from '@sailent/validation';

import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import {
  RequireAudience,
  RequirePermission,
} from '../../common/decorators/permissions.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { requestClientIp } from '../../common/security/internal-request.js';
import { FaqsService, type FaqWriteInput } from './faqs.service.js';

const uuidParam = z.object({ id: z.string().uuid('Not a valid id') });

export const createGeneralFaqSchema = z
  .object({
    question: z.string().trim().min(1, 'Write the question').max(300),
    answer: z.string().trim().min(1, 'Write the answer').max(5000),
    category: z.enum(FAQ_CATEGORY_IDS),
    displayOrder: z.number().int().min(0).max(9999).optional(),
    isPublished: z.boolean().optional(),
  })
  .strict();

export const updateGeneralFaqSchema = createGeneralFaqSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

/** The public FAQ page's questions (Phase 13). Published only. */
@ApiTags('public: faqs')
@Controller('faqs')
export class PublicFaqsController {
  constructor(private readonly faqs: FaqsService) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({ summary: 'Published general FAQs, grouped by category' })
  list() {
    return this.faqs.listPublic();
  }
}

/** General FAQs for staff (Phase 13). SUPER_ADMIN holds both permissions. */
@ApiTags('admin: faqs')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin/faqs')
export class AdminFaqsController {
  constructor(private readonly faqs: FaqsService) {}

  private context(request: Request) {
    return {
      ipAddress: requestClientIp(request),
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string | undefined,
    };
  }

  @RequirePermission('faq.read')
  @Get()
  @ApiOperation({ summary: 'Every general FAQ, drafts included' })
  @ApiResponse({ status: 403, description: 'Missing faq.read' })
  list() {
    return this.faqs.listAdmin();
  }

  @RequirePermission('faq.read')
  @Get(':id')
  get(@Param(new ZodValidationPipe(uuidParam)) params: { id: string }) {
    return this.faqs.get(params.id);
  }

  @RequirePermission('faq.manage')
  @Post()
  @ApiOperation({ summary: 'Add a general FAQ (a draft unless isPublished is true)' })
  create(
    @Body(new ZodValidationPipe(createGeneralFaqSchema)) body: FaqWriteInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.faqs.create(body, actor, this.context(request));
  }

  @RequirePermission('faq.manage')
  @Patch(':id')
  update(
    @Param(new ZodValidationPipe(uuidParam)) params: { id: string },
    @Body(new ZodValidationPipe(updateGeneralFaqSchema)) body: Partial<FaqWriteInput>,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.faqs.update(params.id, body, actor, this.context(request));
  }

  @RequirePermission('faq.manage')
  @Delete(':id')
  @HttpCode(200)
  remove(
    @Param(new ZodValidationPipe(uuidParam)) params: { id: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.faqs.remove(params.id, actor, this.context(request));
  }
}
