import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductsService } from './products.service.js';
import { ConflictException, ValidationException } from '../../common/exceptions.js';

/**
 * The product catalogue's guards.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * These tests are about ONE CLAIM, made repeatedly through the codebase and
 * asserted here: editing the catalogue does not rewrite what campaigns charge
 * or what donors have paid.
 *
 * The claim is easy to make in a comment and easy to break in a refactor — a
 * well-meaning "keep prices in sync" loop would do it — so the audit row
 * carries the fact as DATA and this file checks the data.
 * ══════════════════════════════════════════════════════════════════════════
 */

const actor = { id: 'user-1' } as never;
const context = { ipAddress: '10.0.0.1', userAgent: 'test', requestId: 'req-1' };

function makeService() {
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const update = vi.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) }));
  const insert = vi.fn();
  const select = vi.fn();
  const database = { db: { update, insert, select } } as never;
  const service = new ProductsService(database, audit as never);
  return { service, audit, update, insert, select };
}

/** The audit entry for a given action, or undefined. */
function entry(audit: { record: ReturnType<typeof vi.fn> }, action: string) {
  return audit.record.mock.calls.map((call) => call[0]).find((e) => e.action === action);
}

const baseProduct = {
  id: 'prod-1',
  name: 'School Kit',
  slug: 'school-kit',
  description: 'A kit.',
  defaultPrice: 90_000,
  unit: 'kit',
  status: 'active' as 'active' | 'inactive' | 'archived',
  campaigns: [] as {
    campaignTitle: string;
    campaignStatus: string;
    isActive: boolean;
  }[],
  campaignCount: 0,
};

describe('ProductsService.setStatus', () => {
  let harness: ReturnType<typeof makeService>;

  beforeEach(() => {
    harness = makeService();
  });

  function withProduct(overrides: Partial<typeof baseProduct> = {}) {
    const product = { ...baseProduct, ...overrides };
    vi.spyOn(harness.service, 'getById').mockResolvedValue(product as never);
    return product;
  }

  it('refuses a transition the lifecycle table does not permit', async () => {
    withProduct({ status: 'archived' });

    // An archived product returns as inactive and is turned on deliberately.
    // Straight back on sale is not a move the table allows.
    await expect(
      harness.service.setStatus('prod-1', 'active', 'back please', actor, context),
    ).rejects.toThrow(ConflictException);
  });

  it('refuses a no-op rather than writing a misleading audit row', async () => {
    withProduct({ status: 'active' });
    await expect(
      harness.service.setStatus('prod-1', 'active', undefined, actor, context),
    ).rejects.toThrow(/already active/i);
    expect(harness.audit.record).not.toHaveBeenCalled();
  });

  /**
   * Withdrawing a product from under appeals that are actively asking for it is
   * a decision to make campaign by campaign, not a side effect of one click on
   * a catalogue page. The refusal NAMES the campaigns, because "you cannot do
   * this" without saying why is an error an operator cannot act on.
   */
  it('refuses to archive while live campaigns still offer it, naming them', async () => {
    withProduct({
      campaigns: [
        { campaignTitle: 'Educate Rural Children', campaignStatus: 'active', isActive: true },
        { campaignTitle: 'Flood Relief', campaignStatus: 'published', isActive: true },
      ],
    });

    await expect(
      harness.service.setStatus('prod-1', 'archived', 'retired', actor, context),
    ).rejects.toThrow(/Educate Rural Children, Flood Relief/);
  });

  it('allows archiving when the only campaigns offering it are finished', async () => {
    withProduct({
      campaigns: [
        { campaignTitle: 'Old appeal', campaignStatus: 'completed', isActive: true },
        { campaignTitle: 'Shelved appeal', campaignStatus: 'active', isActive: false },
      ],
    });

    await harness.service.setStatus('prod-1', 'archived', 'No longer distributed', actor, context);

    expect(entry(harness.audit, 'product.archive')).toMatchObject({
      severity: 'critical',
      reason: 'No longer distributed',
      oldValues: { status: 'active' },
      newValues: { status: 'archived' },
    });
  });

  it('requires a reason to archive', async () => {
    withProduct();
    await expect(
      harness.service.setStatus('prod-1', 'archived', '   ', actor, context),
    ).rejects.toThrow(ValidationException);
  });

  it('does not require a reason to deactivate', async () => {
    withProduct();
    await harness.service.setStatus('prod-1', 'inactive', undefined, actor, context);
    expect(entry(harness.audit, 'product.deactivate')).toMatchObject({ severity: 'warning' });
  });
});

describe('ProductsService.update', () => {
  let harness: ReturnType<typeof makeService>;

  beforeEach(() => {
    harness = makeService();
  });

  /**
   * THE CENTRAL CLAIM OF PHASE 5, asserted as data rather than prose.
   *
   * "I changed the price and the campaigns did not update" is the question this
   * design will be asked most often. The audit row answers it at the moment the
   * change is made, so nobody has to take a comment's word for it a year later.
   */
  it('records that a default-price change affects neither campaigns nor history', async () => {
    vi.spyOn(harness.service, 'getById').mockResolvedValue({
      ...baseProduct,
      campaignCount: 4,
    } as never);

    await harness.service.update('prod-1', { defaultPrice: 120_000 }, actor, context);

    expect(entry(harness.audit, 'product.default_price_changed')).toMatchObject({
      severity: 'warning',
      oldValues: { defaultPrice: 90_000 },
      newValues: {
        defaultPrice: 120_000,
        affectsExistingCampaignPrices: false,
        affectsHistoricalDonations: false,
        campaignsOffering: 4,
      },
    });
  });

  it('does not raise a price-change entry when the price is unchanged', async () => {
    vi.spyOn(harness.service, 'getById').mockResolvedValue(baseProduct as never);

    await harness.service.update('prod-1', { defaultPrice: 90_000, name: 'Kit' }, actor, context);

    expect(entry(harness.audit, 'product.default_price_changed')).toBeUndefined();
    expect(entry(harness.audit, 'product.update')).toBeDefined();
  });

  it('refuses to edit an archived product until it is restored', async () => {
    vi.spyOn(harness.service, 'getById').mockResolvedValue({
      ...baseProduct,
      status: 'archived',
    } as never);

    await expect(harness.service.update('prod-1', { name: 'X' }, actor, context)).rejects.toThrow(
      /archived/i,
    );
  });
});

describe('ProductsService.remove', () => {
  /**
   * There is no delete, and the refusal is the feature.
   *
   * A product cited by a donation from two years ago must still resolve, or
   * that donation's receipt has a hole in it. An operator who reaches for
   * delete is told what the product is holding up and what to do instead —
   * better than a route that is simply missing, which reads as broken.
   */
  it('always refuses, naming the campaigns, the donation lines and the alternative', async () => {
    const harness = makeService();
    vi.spyOn(harness.service, 'getById').mockResolvedValue({
      ...baseProduct,
      campaignCount: 3,
    } as never);
    harness.select.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ value: 12 }]) }),
    });

    await expect(harness.service.remove('prod-1')).rejects.toThrow(
      /3 campaigns and cited by 12 donation lines/,
    );
    await expect(harness.service.remove('prod-1')).rejects.toThrow(/Archive it instead/);
  });

  it('refuses even when nothing references the product', async () => {
    const harness = makeService();
    vi.spyOn(harness.service, 'getById').mockResolvedValue(baseProduct as never);
    harness.select.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ value: 0 }]) }),
    });

    // Not "delete when unused". The rule is that the catalogue is append-only
    // in shape, so that a reference added tomorrow is safe today.
    await expect(harness.service.remove('prod-1')).rejects.toThrow(ConflictException);
  });
});
