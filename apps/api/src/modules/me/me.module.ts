import { Module } from '@nestjs/common';

import { EventsModule } from '../events/events.module.js';
import { MeController } from './me.controller.js';
import { MeService } from './me.service.js';

/**
 * The donor account module.
 *
 * Deliberately separate from `DonationsModule`, which is staff- and
 * payment-facing. The two read some of the same tables, but they answer to
 * different audiences with different rules, and merging them would make it
 * possible to reach a staff service from a donor route by autocomplete.
 */
@Module({
  /*
    `EventsModule` for `EventRegistrationsService`, which backs `/me/events`.
    The import is one-way — the events module knows nothing about this one — so
    there is no cycle to unpick later.
  */
  imports: [EventsModule],
  controllers: [MeController],
  providers: [MeService],
  exports: [MeService],
})
export class MeModule {}
