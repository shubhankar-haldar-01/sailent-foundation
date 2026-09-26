import { Module } from '@nestjs/common';

import { AdminNotificationsController } from './admin-notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Notifications: the inbox, the send log and the templates.
 *
 * `QueueModule` is where a retry goes — this module enqueues, it does not
 * send. Delivery belongs to the worker, which already holds the Brevo
 * configuration, the retry policy and the fail-soft semantics; giving the API
 * a second mail client would mean two places for those rules to drift.
 *
 * NO PUBLIC CONTROLLER. Nothing here has a public surface: a donor's own
 * notification preferences live on the donor record, and the send log is
 * administrative by definition.
 */
@Module({
  controllers: [AdminNotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
