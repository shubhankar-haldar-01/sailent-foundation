import { createHash } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { donations, type DatabaseClient } from '@sailent/database';

import { ConflictException, ValidationException } from '../../common/exceptions.js';
import { DATABASE } from '../database/database.module.js';
import { RedisService } from '../redis/redis.service.js';

/** As long as a pending donation holds stock (`HOLD_MINUTES` in donations.service). */
export const IDEMPOTENCY_TTL_SECONDS = 30 * 60;

/** What a client may send: an opaque token, e.g. a UUID. */
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

interface Stored<T> {
  /** SHA-256 of the request body the key was first used with. */
  fingerprint: string;
  state: 'in_progress' | 'done';
  response?: T;
}

/**
 * `Idempotency-Key` for creating a donation (Phase 11).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A RETRIED REQUEST GETS THE SAME DONATION, NOT A SECOND ONE.
 *
 * The checkout sends one key per basket attempt. A double click, a network
 * retry, or pressing Donate again after closing the payment window, all with
 * the same key and body, return the donation and Razorpay order already made
 * — while it is still waiting to be paid. Without a key nothing changes: two
 * separate donations from the same donor are two donations, as they should be.
 *
 *   same key, same body, not yet paid    → the original response, again
 *     (pending, or failed — Razorpay lets a failed order be paid on retry)
 *   same key while the first is running  → 409, try again in a moment
 *   same key, different body             → 422, a key belongs to one request
 *   same key, donation paid or cancelled → 409, start a new donation
 *
 * HELD IN REDIS for `IDEMPOTENCY_TTL_SECONDS`, which the API already depends
 * on; no schema change. If Redis is unreachable the request proceeds without
 * idempotency — the behaviour before this existed — rather than refusing to
 * take a donation over a cache.
 *
 * The stored response is what the client was already sent (the order, the
 * amount, the donor's own name and contact), kept no longer than the TTL.
 * ══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class DonationIdempotencyService {
  private readonly logger = new Logger(DonationIdempotencyService.name);

  constructor(
    private readonly redis: RedisService,
    @Inject(DATABASE) private readonly database: DatabaseClient,
  ) {}

  async run<T extends { donationId: string }>(
    key: string | undefined,
    body: unknown,
    create: () => Promise<T>,
  ): Promise<T> {
    if (key === undefined || key === '') return create();

    if (!KEY_PATTERN.test(key)) {
      throw new ValidationException([
        {
          field: 'Idempotency-Key',
          code: 'invalid',
          message: 'Idempotency-Key must be 16–128 letters, digits, hyphens or underscores.',
        },
      ]);
    }

    const redisKey = `idem:donation:${sha256(key)}`;
    const fingerprint = sha256(JSON.stringify(body ?? null));
    const client = this.redis.getClient();

    let claimed: string | null;
    try {
      claimed = await client.set(
        redisKey,
        JSON.stringify({ fingerprint, state: 'in_progress' } satisfies Stored<T>),
        'EX',
        IDEMPOTENCY_TTL_SECONDS,
        'NX',
      );
    } catch (error) {
      this.logger.warn(
        `Idempotency unavailable, creating without it: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return create();
    }

    if (claimed === 'OK') {
      try {
        const response = await create();
        await client
          .set(
            redisKey,
            JSON.stringify({ fingerprint, state: 'done', response } satisfies Stored<T>),
            'EX',
            IDEMPOTENCY_TTL_SECONDS,
          )
          .catch(() => undefined);
        return response;
      } catch (error) {
        // Nothing was created that the key should point at; let it be retried.
        await client.del(redisKey).catch(() => undefined);
        throw error;
      }
    }

    const raw = await client.get(redisKey).catch(() => null);
    // Expired between the two calls: proceed as a request without a key.
    if (!raw) return create();

    const stored = JSON.parse(raw) as Stored<T>;

    if (stored.fingerprint !== fingerprint) {
      throw new ValidationException(
        [
          {
            field: 'Idempotency-Key',
            code: 'reused',
            message: 'This Idempotency-Key was already used for a different donation.',
          },
        ],
        'This Idempotency-Key belongs to a different donation.',
      );
    }

    if (stored.state === 'in_progress' || !stored.response) {
      throw new ConflictException(
        'This donation is already being started. Please wait a moment and try again.',
      );
    }

    const [current] = await this.database.db
      .select({ status: donations.status })
      .from(donations)
      .where(eq(donations.id, stored.response.donationId))
      .limit(1);

    if (current && ['pending', 'processing', 'failed'].includes(current.status)) {
      return stored.response;
    }

    throw new ConflictException(
      'This donation has already been completed or cancelled. Please start a new donation.',
    );
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
