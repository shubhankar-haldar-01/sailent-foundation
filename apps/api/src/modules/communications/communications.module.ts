import { Module } from '@nestjs/common';

import { AdminCommunicationsController } from './admin-communications.controller.js';
import { CommunicationsService } from './communications.service.js';
import { PublicCommunicationsController } from './public-communications.controller.js';

/** Contact messages and newsletter subscriptions (Phase 13). */
@Module({
  controllers: [PublicCommunicationsController, AdminCommunicationsController],
  providers: [CommunicationsService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
