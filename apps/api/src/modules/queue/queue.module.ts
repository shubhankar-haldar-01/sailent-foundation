import { Global, Module } from '@nestjs/common';

import { QueueController } from './queue.controller.js';
import { QueueService } from './queue.service.js';

@Global()
@Module({
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
