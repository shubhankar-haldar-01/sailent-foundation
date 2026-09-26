import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'sailent:raw-response';

/**
 * Opt a handler out of the response envelope.
 *
 * Needed by the Razorpay webhook endpoint (Phase 5), which must return exactly
 * what the provider expects, and by file streams.
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
