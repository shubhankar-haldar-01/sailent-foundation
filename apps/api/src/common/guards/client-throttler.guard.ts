import { Inject, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { AppConfig } from '../../config/app.config.js';
import { trustedClientIp } from '../security/internal-request.js';

/**
 * The throttler, keyed on the REAL client.
 *
 * The stock guard keys on `req.ip`, which behind the Next.js server is that
 * server's address for every visitor — so every limit was site-wide. This one
 * uses the address the web server vouched for (`trustedClientIp`), and falls
 * back to `req.ip` exactly as before when there is none.
 *
 * Trusted and untrusted keys are kept in separate namespaces, so a forwarded
 * address can never share a bucket with — or be used to drain — the bucket of
 * a direct connection that happens to have the same address.
 *
 * The limits themselves are unchanged: every `@Throttle()` means what it said,
 * now per donor rather than for everyone.
 */
@Injectable()
export class ClientThrottlerGuard extends ThrottlerGuard {
  // Property injection: the parent's constructor already takes the throttler's
  // own dependencies, and re-declaring them here would couple this class to
  // that library's internals.
  @Inject(AppConfig) private readonly appConfig!: AppConfig;

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req.headers ?? {}) as Record<string, string | string[] | undefined>;
    const forwarded = trustedClientIp(headers, this.appConfig.env.INTERNAL_API_SECRET);
    if (forwarded) return `client:${forwarded}`;
    return `direct:${String(req.ip ?? 'unknown')}`;
  }
}
