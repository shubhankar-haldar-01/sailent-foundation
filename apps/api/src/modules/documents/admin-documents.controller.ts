import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
import { DocumentsService } from './documents.service.js';
import { requestClientIp } from '../../common/security/internal-request.js';
import {
  ChangeDocumentVisibilityDto,
  MAX_DOCUMENT_UPLOAD_BYTES,
  UpdateDocumentDto,
  changeDocumentVisibilitySchema,
  createDocumentSchema,
  deleteDocumentSchema,
  documentListQuerySchema,
  updateDocumentSchema,
} from './dto/documents.dto.js';

/**
 * Reports & documents — administration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE ROUTE IS `@Sensitive()`, AND WHICH ONE IS THE POINT.
 *
 * §4.20 — "changing a document's visibility requires re-authentication and
 * writes an audit row." Not uploading, not editing a title: the action that
 * can turn an internal audited statement into a public URL.
 *
 * Uploading is deliberately NOT sensitive. An upload lands PRIVATE by default,
 * so the worst an unattended session can do is put a file somewhere only staff
 * can reach — and making editors re-enter a password to add a file teaches
 * them to keep a re-auth window open, which is worse for security than not
 * asking.
 *
 * DELETION (Phase 13) is `document.delete`, sensitive, with a reason. It
 * removes the stored file and then the row; the audit entry keeps the title,
 * type and visibility, so the record that the document existed survives it.
 * Withdrawal without deletion is still a visibility change.
 * ══════════════════════════════════════════════════════════════════════════
 */
@ApiTags('admin: documents')
@ApiBearerAuth('staff')
@RequireAudience('staff')
@Controller('admin')
export class AdminDocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  private context(request: Request) {
    return {
      // The trusted client address (Phase 12), as every other controller.
      ipAddress: requestClientIp(request),
      userAgent: request.get('user-agent') ?? undefined,
      requestId: request.get('x-request-id') ?? undefined,
    };
  }

  @RequirePermission('document.read')
  @Get('documents')
  @ApiOperation({
    summary: 'List documents',
    description:
      'Private and admin-only documents are excluded unless the caller holds ' +
      '`document.read_private`. The filter is applied in the query, so their titles and ' +
      'their existence are never disclosed.',
  })
  list(
    @Query(new ZodValidationPipe(documentListQuerySchema))
    query: ReturnType<typeof documentListQuerySchema.parse>,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.documents.list(query, actor);
  }

  @RequirePermission('document.read')
  @Get('documents/:id')
  @ApiOperation({ summary: 'One document' })
  @ApiResponse({ status: 404, description: 'No such document, or not visible to this caller' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: AuthenticatedActor) {
    return this.documents.getById(id, actor);
  }

  @RequirePermission('document.manage')
  @Post('documents')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_UPLOAD_BYTES, files: 1 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title'],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        description: { type: 'string' },
        documentType: { type: 'string' },
        visibility: { type: 'string', enum: ['public', 'private', 'admin_only'] },
        financialYear: { type: 'string', example: '2025-2026' },
        relatedType: { type: 'string', enum: ['campaign'] },
        relatedId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload a document (PDF, or a JPEG/PNG/WebP scan)',
    description: 'Lands PRIVATE unless a visibility is given. Type is decided from the bytes.',
  })
  @ApiResponse({ status: 201, description: 'The stored document' })
  @ApiResponse({ status: 422, description: 'Not an accepted type, too large, or invalid metadata' })
  upload(
    @UploadedFile() file: { buffer: Buffer; mimetype?: string; originalname?: string } | undefined,
    @Body() body: Record<string, unknown>,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    if (!file?.buffer) {
      throw new ValidationException([
        { code: 'required', field: 'file', message: 'Choose a document to upload.' },
      ]);
    }

    /*
      Multipart text fields are parsed here rather than by a pipe: a `@Body()`
      pipe runs before the interceptor has populated them. The schema is the
      shared one, so the rules do not fork between here and the admin UI.

      Empty strings are dropped rather than passed through — an untouched
      optional `<input>` posts `""`, and `""` is not a financial year.
    */
    const present = (key: string) =>
      body[key] !== undefined && body[key] !== '' ? { [key]: body[key] } : {};

    const parsed = createDocumentSchema.safeParse({
      title: body.title,
      ...present('description'),
      ...present('documentType'),
      ...present('visibility'),
      ...present('financialYear'),
      ...present('relatedType'),
      ...present('relatedId'),
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

    return this.documents.upload(file, parsed.data, actor, this.context(request));
  }

  @RequirePermission('document.manage')
  @Patch('documents/:id')
  @ApiOperation({ summary: 'Edit a document’s metadata' })
  @ApiBody({ type: UpdateDocumentDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateDocumentSchema))
    body: ReturnType<typeof updateDocumentSchema.parse>,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.documents.update(id, body, actor, this.context(request));
  }

  /**
   * The one sensitive route. §4.20's acceptance criterion, exactly.
   */
  @RequirePermission('document.change_visibility')
  @Sensitive()
  @Patch('documents/:id/visibility')
  @ApiOperation({
    summary: 'Change a document’s visibility',
    description:
      'Requires a re-authentication within the last five minutes, moves the object between ' +
      'the public and private buckets, and writes an audit row carrying the reason.',
  })
  @ApiBody({ type: ChangeDocumentVisibilityDto })
  @ApiResponse({ status: 403, description: 'REAUTH_REQUIRED — confirm your password first' })
  @ApiResponse({ status: 409, description: 'Already at that visibility' })
  changeVisibility(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(changeDocumentVisibilitySchema))
    body: ReturnType<typeof changeDocumentVisibilitySchema.parse>,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.documents.changeVisibility(id, body, actor, this.context(request));
  }

  /**
   * A link to the bytes.
   *
   * POST, not GET, because it has effects: it issues a credential, increments
   * a counter and writes an audit row. A GET that does those things gets
   * prefetched by a browser and retried by a proxy.
   */
  @RequirePermission('document.read')
  @Post('documents/:id/download')
  @ApiOperation({
    summary: 'Issue a link to a document',
    description:
      'A private document yields a signed URL valid for five minutes. A public one yields its ' +
      'CDN URL. Every issue is audited.',
  })
  @ApiResponse({ status: 201, description: 'A URL, a filename and how long it lasts' })
  download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.documents.issueDownload(id, actor, this.context(request));
  }

  @RequirePermission('document.delete')
  @Sensitive()
  @Delete('documents/:id')
  @ApiOperation({
    summary: 'Delete a document and its stored file',
    description:
      'Requires a re-authentication within the last five minutes and a reason. The file is ' +
      'deleted first; if that fails the document is left unchanged (503). A private document ' +
      'the caller cannot read answers 404.',
  })
  @ApiResponse({ status: 200, description: '`{ deleted: true }`' })
  @ApiResponse({ status: 403, description: 'Missing document.delete, or REAUTH_REQUIRED' })
  @ApiResponse({ status: 404, description: 'No such document, or not visible to this caller' })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(deleteDocumentSchema)) body: { reason: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: Request,
  ) {
    return this.documents.delete(id, body, actor, this.context(request));
  }
}
