import { Module } from '@nestjs/common';

import { AdminDonationsController } from './admin-donations.controller.js';
import { AdminDonationsService } from './admin-donations.service.js';
import { DonationCaptureService } from './donation-capture.service.js';
import { DonationsService } from './donations.service.js';
import { PaymentVerificationService } from './payment-verification.service.js';
import { PublicDonationsController } from './public-donations.controller.js';
import { RazorpayClient } from './razorpay.client.js';
import { RazorpayWebhookController } from './razorpay-webhook.controller.js';
import { ReceiptsService } from './receipts.service.js';

/**
 * Money in.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE MODULE, not a `donations` module and a `payments` module.
 *
 * They would be circular the moment either was useful: creating a donation
 * needs the Razorpay client, and handling a webhook needs the capture
 * transaction, which needs donations. Splitting a single bounded context to
 * satisfy a naming instinct and then re-joining it with forward references is
 * a worse shape than admitting it is one thing.
 *
 * The ROUTES are still where the API map puts them — `/donations`,
 * `/payments/razorpay/webhook`, `/admin/donations` — because a Nest route is
 * declared by its controller, not by the module that holds it.
 *
 * The one-way dependencies inside are worth stating:
 *
 *   DonationsService            → RazorpayClient          (create an order)
 *   PaymentVerificationService  → RazorpayClient, Capture (verify, then record)
 *   DonationCaptureService      → ReceiptsService, Queue  (record, then notify)
 *
 * Nothing points back up. `ReceiptsService` in particular knows nothing about
 * payments, which is why its `issue` takes a transaction from its caller.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Module({
  controllers: [PublicDonationsController, RazorpayWebhookController, AdminDonationsController],
  providers: [
    RazorpayClient,
    DonationsService,
    DonationCaptureService,
    PaymentVerificationService,
    ReceiptsService,
    AdminDonationsService,
  ],
  exports: [ReceiptsService, DonationCaptureService],
})
export class DonationsModule {}
