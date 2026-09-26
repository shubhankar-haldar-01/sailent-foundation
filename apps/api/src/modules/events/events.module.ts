import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module.js';
import { AdminEventsController } from './admin-events.controller.js';
import { EventRegistrationsController } from './event-registrations.controller.js';
import { EventRegistrationsService } from './event-registrations.service.js';
import { EventsService } from './events.service.js';

/**
 * Events: administration, and registration by the people attending.
 *
 * `CatalogModule` is imported for `SlugService` — the one implementation of
 * slug allocation and history, which events now use for the same reason
 * campaigns do: an event's URL ends up on a poster, and renaming it must not
 * quietly break the poster.
 *
 * `EventRegistrationsService` is exported because the donor dashboard reads it
 * through `/me/events`. That route belongs to `MeController`, which is where
 * every other "the signed-in donor's own X" route lives — splitting it off
 * here would give the dashboard two places to look.
 */
@Module({
  imports: [CatalogModule],
  controllers: [AdminEventsController, EventRegistrationsController],
  providers: [EventsService, EventRegistrationsService],
  exports: [EventsService, EventRegistrationsService],
})
export class EventsModule {}
