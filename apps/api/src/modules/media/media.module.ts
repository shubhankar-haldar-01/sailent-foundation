import { Module } from '@nestjs/common';

import { AdminMediaController } from './admin-media.controller.js';
import { MediaService } from './media.service.js';

/**
 * The media library.
 *
 * `StorageModule` is `@Global()`, so nothing is imported here: media depends
 * on the storage ABSTRACTION, not on the provider behind it.
 */
@Module({
  controllers: [AdminMediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
