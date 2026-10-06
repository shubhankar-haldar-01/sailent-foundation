import { Global, Module } from '@nestjs/common';

import { FieldEncryptionService } from './field-encryption.service.js';

/** Cross-cutting security services (Phase 12). Global, like auditing. */
@Global()
@Module({ providers: [FieldEncryptionService], exports: [FieldEncryptionService] })
export class SecurityModule {}
