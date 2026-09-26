import { Module } from '@nestjs/common';

import { AdminDocumentsController } from './admin-documents.controller.js';
import { DocumentsService } from './documents.service.js';

/**
 * Reports & documents.
 *
 * `StorageModule` is `@Global()`, so nothing is imported here — documents
 * depend on the storage ABSTRACTION, not on the provider behind it.
 *
 * NO PUBLIC CONTROLLER, and that is the module's defining property. §4.20:
 * "Nothing in this module is publicly reachable." The one public surface is a
 * campaign's own page, which reads its attached documents through
 * `campaign-content.service.ts` with `visibility = 'public'` in the WHERE
 * clause. Adding a public controller here would be adding the document library
 * the product does not have.
 */
@Module({
  controllers: [AdminDocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
