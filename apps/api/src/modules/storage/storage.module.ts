import { Global, Module } from '@nestjs/common';

import { StorageService } from './storage.service.js';

/**
 * Object storage.
 *
 * `@Global()` because media is referenced by several content modules and none
 * of them should have to import a storage module to save a picture. The
 * provider stays behind `StorageService` regardless.
 */
@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
