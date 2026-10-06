import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthenticatedActor } from '@sailent/types';

import { CurrentActor } from '../../common/decorators/actor.decorator.js';
import {
  RequireAudience,
  RequirePermission,
  Sensitive,
} from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ValidationException } from '../../common/exceptions.js';
import { MediaService } from './media.service.js';
import {
  MAX_UPLOAD_BYTES,
  mediaListQuerySchema,
  updateMediaSchema,
  uploadMediaSchema,
  type UpdateMediaInput,
} from './dto/media.dto.js';
import { requestClientIp } from '../../common/security/internal-request.js';

/**
 * The media library — administration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * DELETE IS `@Sensitive()`. UPLOAD IS NOT.
 *
 * Deletion is irreversible: `media` has no `deleted_at`, so there is no
 * archived state to recover from, and the object goes too. That deserves a
 * recent password.
 *
 * Uploading does not. An administrator adding a dozen images to a story is
 * doing ordinary work, and asking for a password on each would teach them to
 * keep the sensitive window permanently open — worse for security than not
 * asking. A bad upload is also trivially undone by deleting it.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('admin: media')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class AdminMediaController {
  constructor(private readonly media: MediaService) {}

  private context(request: Request) {
    return {
      // The trusted client address (Phase 12), never a raw X-Forwarded-For.
      ipAddress: requestClientIp(request),
      userAgent: request.headers['user-agent'],
      requestId: request.headers['x-request-id'] as string | undefined,
    };
  }

  @RequirePermission('media.read')
  @Get('media')
  @ApiOperation({ summary: 'List media, newest first' })
  @ApiResponse({ status: 200, description: 'Paginated media' })
  @ApiResponse({ status: 403, description: 'Missing media.read' })
  list(@Query(new ZodValidationPipe(mediaListQuerySchema)) query: never) {
    return this.media.list(query);
  }

  @RequirePermission('media.read')
  @Get('media/:id')
  @ApiOperation({
    summary: 'One media item, with where it is used',
    description: 'Returns `references`, so the UI can explain why deletion is unavailable.',
  })
  @ApiResponse({ status: 404, description: 'No such media' })
  get(@Param('id') id: string) {
    return this.media.getById(id);
  }

  /**
   * Upload an image.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * THE SIZE LIMIT IS ENFORCED TWICE, FOR TWO DIFFERENT REASONS.
   *
   * `multer` refuses a larger body here, before it is ever buffered, so a
   * hundred-megabyte upload cannot be used to exhaust the process's memory.
   * `MediaService` checks the buffer again, because the limit is also a rule
   * about what belongs in the library — and a service that trusts its caller
   * to have checked is a service that stops being safe the moment somebody
   * calls it from somewhere new.
   *
   * `memoryStorage` is deliberate: nothing is written to the container's disk,
   * so there is no temporary file to leak, clean up, or have its path guessed.
   * Ten megabytes in memory is a cost worth paying for that.
   * ══════════════════════════════════════════════════════════════════════════
   */
  @RequirePermission('media.create')
  @Post('media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'altText'],
      properties: {
        file: { type: 'string', format: 'binary' },
        altText: { type: 'string' },
        caption: { type: 'string' },
        visibility: { type: 'string', enum: ['public', 'private'] },
      },
    },
  })
  @ApiOperation({ summary: 'Upload an image (JPEG, PNG or WebP)' })
  @ApiResponse({ status: 201, description: 'The stored media item' })
  @ApiResponse({
    status: 422,
    description: 'Not an accepted image, too large, or alt text missing',
  })
  upload(
    @UploadedFile() file: { buffer: Buffer; mimetype?: string; size?: number } | undefined,
    @Body() body: Record<string, unknown>,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    if (!file?.buffer) {
      throw new ValidationException([
        { code: 'required', field: 'file', message: 'Choose an image to upload.' },
      ]);
    }

    /*
      The text fields arrive as multipart strings, so they are parsed here
      rather than by a pipe — a `@Body()` pipe would run before the interceptor
      has populated them. The schema is the same one the rest of the module
      uses, so the rules do not fork.
    */
    const parsed = uploadMediaSchema.safeParse({
      altText: body.altText,
      ...(body.caption !== undefined && body.caption !== '' ? { caption: body.caption } : {}),
      ...(body.visibility !== undefined && body.visibility !== ''
        ? { visibility: body.visibility }
        : {}),
    });

    if (!parsed.success) {
      throw new ValidationException(
        parsed.error.issues.map((issue) => ({
          code: issue.code,
          field: String(issue.path[0] ?? 'file'),
          message: issue.message,
        })),
      );
    }

    return this.media.upload(file, parsed.data, actor, this.context(request));
  }

  @RequirePermission('media.update')
  @Patch('media/:id')
  @ApiOperation({
    summary: 'Edit alt text, caption or visibility',
    description:
      'Changing visibility MOVES the object between the public and private buckets — the two ' +
      'differ in whether they have a public hostname, so the column alone would not make an ' +
      'image private.',
  })
  @ApiResponse({ status: 200, description: 'The updated media item' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMediaSchema)) body: UpdateMediaInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.media.update(id, body, actor, this.context(request));
  }

  @RequirePermission('media.delete')
  @Sensitive()
  @Delete('media/:id')
  @ApiOperation({
    summary: 'Delete media and its object',
    description:
      'Irreversible — there is no archived state. Refused with 409 when the image is in use, ' +
      'because deleting it would leave a broken image on a public page.',
  })
  @ApiResponse({ status: 200, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Missing media.delete, or REAUTH_REQUIRED' })
  @ApiResponse({ status: 409, description: 'In use — remove the references first' })
  remove(
    @Param('id') id: string,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.media.remove(id, actor, this.context(request));
  }
}
