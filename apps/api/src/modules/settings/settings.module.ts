import { Module } from '@nestjs/common';

import { AdminSettingsController } from './admin-settings.controller.js';
import { PublicSettingsController } from './public-settings.controller.js';
import { SettingsService } from './settings.service.js';

/**
 * Organisation settings.
 *
 * No imports beyond the globals: `DatabaseModule` and `AuditModule` are
 * already global, and this module deliberately depends on nothing else — a
 * settings service that reached into the donation or catalogue modules would
 * invert the dependency, since those are what read settings.
 */
@Module({
  controllers: [AdminSettingsController, PublicSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
