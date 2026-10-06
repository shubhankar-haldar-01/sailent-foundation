import { Module } from '@nestjs/common';

import { AdminFaqsController, PublicFaqsController } from './faqs.controller.js';
import { FaqsService } from './faqs.service.js';

/** General FAQs (Phase 13). Campaign FAQs stay in the catalogue module. */
@Module({
  controllers: [PublicFaqsController, AdminFaqsController],
  providers: [FaqsService],
})
export class FaqsModule {}
