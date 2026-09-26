import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignProductsService } from './campaign-products.service.js';
import { ConflictException, ValidationException } from '../../common/exceptions.js';

/**
 * The junction's guards.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THREE INVARIANTS, ONE FILE.
 *
 *   1. The campaign's price is COPIED from the catalogue, never read from it.
 *   2. `providedQuantity` moves only on a captured payment, or through the
 *      separate sensitive path with a reason.
 *   3. Nothing donors have funded is removed — only hidden.
 *
 * Each is stated in a comment somewhere in the service. Comments do not fail a
 * build; these do.
 * ══════════════════════════════════════════════════════════════════════════
 */

const actor = { id: 'user-1' } as never;
const context = { ipAddress: '10.0.0.1', userAgent: 'test', requestId: 'req-1' };

function makeService() {
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const setWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where: setWhere }));
  const update = vi.fn(() => ({ set }));
  const returning = vi.fn().mockResolvedValue([{ id: 'cp-new' }]);
  const values = vi.fn((_row: Record<string, unknown>) => ({ returning }));
  const insert = vi.fn(() => ({ values }));
  const select = vi.fn();
  const transaction = vi.fn(async (fn: (tx: unknown) => Promise<void>) => fn({ update }));
  const database = { db: { update, insert, select, transaction } } as never;
  return {
    service: new CampaignProductsService(database, audit as never),
    audit,
    set,
    values,
    select,
  };
}

function entry(audit: { record: ReturnType<typeof vi.fn> }, action: string) {
  return audit.record.mock.calls.map((call) => call[0]).find((e) => e.action === action);
}

/**
 * The per-field messages on a ValidationException.
 *
 * Its top-level `message` is the generic "The submitted data is not valid." —
 * the sentence an operator actually reads lives in `details`, beside the field
 * it belongs to. Asserting on `message` would pass for any validation failure
 * at all, which is the same as not asserting.
 */
async function detailsOf(promise: Promise<unknown>): Promise<string[]> {
  try {
    await promise;
    throw new Error('Expected the call to be refused, but it succeeded.');
  } catch (error) {
    const details = (error as { details?: { message?: string }[] }).details ?? [];
    if (details.length === 0) throw error;
    return details.map((detail) => detail.message ?? '');
  }
}

/** One `select().from()…limit()` result, in the order the service asks for them. */
function queueSelects(select: ReturnType<typeof vi.fn>, results: unknown[][]) {
  let call = 0;
  select.mockImplementation(() => {
    const rows = results[call++] ?? [];
    const terminal = {
      from: () => terminal,
      innerJoin: () => terminal,
      where: () => terminal,
      orderBy: () => Promise.resolve(rows),
      limit: () => Promise.resolve(rows),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(rows).then(resolve),
    };
    return terminal;
  });
}

const offering = {
  id: 'cp-1',
  productId: 'prod-1',
  name: 'School Kit',
  price: 90_000,
  defaultPrice: 90_000,
  targetQuantity: 500,
  providedQuantity: 0,
  maxPerDonation: 999,
  isActive: true,
};

describe('CampaignProductsService.add', () => {
  let harness: ReturnType<typeof makeService>;

  beforeEach(() => {
    harness = makeService();
    vi.spyOn(harness.service, 'getOne').mockResolvedValue(offering as never);
  });

  /**
   * THE COPY, not the reference.
   *
   * "School Kit at ₹1,500 in the monsoon appeal and ₹1,200 in the winter one"
   * is correct, and stays correct when the catalogue default moves to ₹999.
   */
  it('copies the catalogue default when no price is given', async () => {
    queueSelects(harness.select, [
      [{ id: 'camp-1', title: 'Educate Rural Children', status: 'active' }],
      [{ id: 'prod-1', name: 'School Kit', status: 'active', defaultPrice: 90_000 }],
      [],
    ]);

    await harness.service.add('camp-1', { productId: 'prod-1' }, actor, context);

    expect(harness.values).toHaveBeenCalledWith(expect.objectContaining({ price: 90_000 }));
    expect(entry(harness.audit, 'campaign_product.add')).toMatchObject({
      newValues: expect.objectContaining({ price: 90_000, priceSource: 'catalogue_default' }),
    });
  });

  it('uses the campaign’s own price when one is given, and says so in the log', async () => {
    queueSelects(harness.select, [
      [{ id: 'camp-1', title: 'Winter Appeal', status: 'active' }],
      [{ id: 'prod-1', name: 'School Kit', status: 'active', defaultPrice: 90_000 }],
      [],
    ]);

    await harness.service.add('camp-1', { productId: 'prod-1', price: 120_000 }, actor, context);

    expect(harness.values).toHaveBeenCalledWith(expect.objectContaining({ price: 120_000 }));
    expect(entry(harness.audit, 'campaign_product.add')).toMatchObject({
      newValues: expect.objectContaining({ price: 120_000, priceSource: 'explicit' }),
    });
  });

  /** `providedQuantity` is absent BY CONSTRUCTION, not merely defaulted. */
  it('never writes providedQuantity on insert', async () => {
    queueSelects(harness.select, [
      [{ id: 'camp-1', title: 'C', status: 'active' }],
      [{ id: 'prod-1', name: 'P', status: 'active', defaultPrice: 1_000 }],
      [],
    ]);

    await harness.service.add('camp-1', { productId: 'prod-1' }, actor, context);

    expect(harness.values.mock.calls[0]?.[0]).not.toHaveProperty('providedQuantity');
  });

  it.each(['inactive', 'archived'])('refuses a %s catalogue product', async (status) => {
    queueSelects(harness.select, [
      [{ id: 'camp-1', title: 'C', status: 'active' }],
      [{ id: 'prod-1', name: 'School Kit', status, defaultPrice: 1_000 }],
    ]);

    await expect(
      harness.service.add('camp-1', { productId: 'prod-1' }, actor, context),
    ).rejects.toThrow(ValidationException);
  });

  it('refuses a product the campaign already offers, pointing at editing instead', async () => {
    queueSelects(harness.select, [
      [{ id: 'camp-1', title: 'Educate Rural Children', status: 'active' }],
      [{ id: 'prod-1', name: 'School Kit', status: 'active', defaultPrice: 1_000 }],
      [{ id: 'cp-1', deletedAt: null }],
    ]);

    await expect(
      harness.service.add('camp-1', { productId: 'prod-1' }, actor, context),
    ).rejects.toThrow(/already offers .*Edit its price/s);
  });

  /**
   * A product removed earlier left a soft-deleted row that the unique index
   * still covers. A plain insert would fail with a constraint error for what is
   * really "you had this before, put it back".
   */
  it('restores a previously removed offering rather than inserting a duplicate', async () => {
    queueSelects(harness.select, [
      [{ id: 'camp-1', title: 'C', status: 'active' }],
      [{ id: 'prod-1', name: 'P', status: 'active', defaultPrice: 1_000 }],
      [{ id: 'cp-old', deletedAt: new Date('2026-01-01') }],
    ]);

    await harness.service.add('camp-1', { productId: 'prod-1' }, actor, context);

    expect(harness.values).not.toHaveBeenCalled();
    expect(harness.set).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: null }));
    expect(entry(harness.audit, 'campaign_product.add')).toMatchObject({
      entityId: 'cp-old',
      newValues: expect.objectContaining({ restored: true }),
    });
  });

  it('refuses a product that does not exist', async () => {
    queueSelects(harness.select, [[{ id: 'camp-1', title: 'C', status: 'active' }], []]);

    await expect(
      harness.service.add('camp-1', { productId: 'ghost' }, actor, context),
    ).rejects.toThrow(ValidationException);
  });
});

describe('CampaignProductsService.update', () => {
  let harness: ReturnType<typeof makeService>;

  beforeEach(() => {
    harness = makeService();
  });

  it('refuses a target below what has already been provided', async () => {
    vi.spyOn(harness.service, 'getOne').mockResolvedValue({
      ...offering,
      providedQuantity: 354,
    } as never);

    await expect(
      detailsOf(harness.service.update('camp-1', 'cp-1', { targetQuantity: 100 }, actor, context)),
    ).resolves.toContainEqual(expect.stringContaining('cannot be below the 354 already provided'));
  });

  it('raises a separate warning entry for a price change, stating history is untouched', async () => {
    vi.spyOn(harness.service, 'getOne').mockResolvedValue(offering as never);

    await harness.service.update('camp-1', 'cp-1', { price: 120_000 }, actor, context);

    expect(entry(harness.audit, 'campaign_product.price_changed')).toMatchObject({
      severity: 'warning',
      oldValues: { price: 90_000 },
      newValues: expect.objectContaining({ price: 120_000, affectsHistoricalDonations: false }),
    });
  });

  it('never writes providedQuantity, whatever the caller passes', async () => {
    vi.spyOn(harness.service, 'getOne').mockResolvedValue(offering as never);

    await harness.service.update(
      'camp-1',
      'cp-1',
      { price: 95_000, providedQuantity: 9999 } as never,
      actor,
      context,
    );

    expect(harness.set).toHaveBeenCalledWith(
      expect.not.objectContaining({ providedQuantity: expect.anything() }),
    );
  });
});

describe('CampaignProductsService.remove', () => {
  let harness: ReturnType<typeof makeService>;

  beforeEach(() => {
    harness = makeService();
  });

  /**
   * Removing something people have already funded is refused, and the refusal
   * points at deactivating — which takes it off the page and keeps the
   * progress figure donors were shown.
   */
  it('refuses once donation lines cite it', async () => {
    vi.spyOn(harness.service, 'getOne').mockResolvedValue(offering as never);
    queueSelects(harness.select, [[{ value: 7 }]]);

    await expect(
      harness.service.remove('camp-1', 'cp-1', undefined, actor, context),
    ).rejects.toThrow(/7 donation lines.*Deactivate it instead/s);
  });

  it('refuses when a quantity has been provided even with no donation lines', async () => {
    // An offline distribution recorded through the adjustment path leaves a
    // provided count with no donation rows behind it. Still not removable.
    vi.spyOn(harness.service, 'getOne').mockResolvedValue({
      ...offering,
      providedQuantity: 12,
    } as never);
    queueSelects(harness.select, [[{ value: 0 }]]);

    await expect(
      harness.service.remove('camp-1', 'cp-1', undefined, actor, context),
    ).rejects.toThrow(ConflictException);
  });

  it('soft-deletes an unfunded offering rather than removing the row', async () => {
    vi.spyOn(harness.service, 'getOne').mockResolvedValue(offering as never);
    queueSelects(harness.select, [[{ value: 0 }]]);

    const result = await harness.service.remove('camp-1', 'cp-1', 'Wrong appeal', actor, context);

    expect(result).toEqual({ removed: true, id: 'cp-1' });
    expect(harness.set).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
    );
    expect(entry(harness.audit, 'campaign_product.remove')).toMatchObject({
      severity: 'warning',
      reason: 'Wrong appeal',
    });
  });
});

describe('CampaignProductsService.adjustProvided', () => {
  let harness: ReturnType<typeof makeService>;

  beforeEach(() => {
    harness = makeService();
    vi.spyOn(harness.service, 'getOne').mockResolvedValue({
      ...offering,
      providedQuantity: 100,
    } as never);
  });

  /**
   * This is the one hand-edit to a number that is supposed to be a consequence
   * of money received. It is audited as CRITICAL so it surfaces in a review
   * without anyone having to go looking for it.
   */
  it('writes a critical audit row carrying the reason and both values', async () => {
    await harness.service.adjustProvided(
      'camp-1',
      'cp-1',
      120,
      'Offline distribution on 12 March',
      actor,
      context,
    );

    expect(entry(harness.audit, 'campaign_product.adjust_provided')).toMatchObject({
      severity: 'critical',
      reason: 'Offline distribution on 12 March',
      oldValues: { providedQuantity: 100 },
      newValues: expect.objectContaining({ providedQuantity: 120 }),
    });
  });

  it.each([-1, 1.5])('refuses %s', async (value) => {
    await expect(
      harness.service.adjustProvided('camp-1', 'cp-1', value, 'reason', actor, context),
    ).rejects.toThrow(ValidationException);
  });

  it('permits zero, which is how an erroneous count is undone', async () => {
    await harness.service.adjustProvided('camp-1', 'cp-1', 0, 'Counted twice', actor, context);
    expect(harness.set).toHaveBeenCalledWith(expect.objectContaining({ providedQuantity: 0 }));
  });
});

describe('CampaignProductsService.reorder', () => {
  it('refuses an id belonging to another campaign', async () => {
    const harness = makeService();
    queueSelects(harness.select, [
      [{ id: 'camp-1', title: 'C', status: 'active' }],
      // Two ids asked for, one owned: the payload mixed in someone else's row.
      [{ id: 'cp-1' }],
    ]);

    await expect(
      detailsOf(
        harness.service.reorder(
          'camp-1',
          [
            { id: 'cp-1', sortOrder: 10 },
            { id: 'cp-other', sortOrder: 20 },
          ],
          actor,
          context,
        ),
      ),
    ).resolves.toContainEqual(expect.stringContaining('not on this campaign'));
  });
});
