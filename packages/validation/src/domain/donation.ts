/**
 * What a donation is MADE OF, and what it comes to.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE implementation of the arithmetic, shared by the API that charges the
 * donor and the page that shows them the figure before they agree to it.
 *
 * The alternative — a total computed in the browser and a total computed on
 * the server — is not merely duplication. It is two answers to "what am I
 * paying", and the donor only ever sees one of them. Whichever is wrong, the
 * wrong one is the one they consented to.
 *
 * The server remains the authority. The client uses this to DISPLAY a figure;
 * the API recomputes from the same code before a payment order is created, and
 * the price it uses comes from the database, never from the request.
 *
 * Money is INTEGER PAISE throughout (decision A2). Nothing here divides, and
 * nothing produces a fraction. ₹1,234.56 is 123456.
 * ══════════════════════════════════════════════════════════════════════════
 */

/**
 * The three shapes a donation may take.
 *
 * There is no fourth, and in particular there is no recurring one. A donation
 * in this system is a single act — Phase 5 does not implement subscriptions,
 * auto-debit or any repeating plan, and the absence is deliberate rather than
 * pending.
 */
export type DonationType = 'custom' | 'product' | 'hybrid';

/** One product line a donor has chosen, before it becomes a database row. */
export interface DonationProductLine {
  /** The junction row — WHICH campaign is offering it. */
  campaignProductId: string;
  /** The catalogue entry, carried so history survives the offer being removed. */
  productId: string;
  /** Snapshotted at the moment of giving, never re-read from the product. */
  productName: string;
  /** Paise, per unit. */
  unitPrice: number;
  quantity: number;
}

export interface DonationLineTotal extends DonationProductLine {
  /** `unitPrice × quantity`, in paise. */
  totalAmount: number;
}

export interface DonationSummary {
  type: DonationType;
  lines: DonationLineTotal[];
  /** Paise across every product line. */
  productTotal: number;
  /** Paise given on top of the products, or as the whole gift. */
  customAmount: number;
  /** Paise. What the donor is charged. */
  total: number;
  /** Units across every line — "3 items", for the summary header. */
  itemCount: number;
}

/**
 * Classify a donation by what is in it.
 *
 * Derived, never sent by the client. A request that declared itself `custom`
 * while carrying product lines would be describing itself incorrectly, and
 * trusting the declaration means storing a donation whose type contradicts its
 * own contents.
 */
export function donationType(lineCount: number, customAmount: number): DonationType {
  const hasProducts = lineCount > 0;
  const hasCustom = customAmount > 0;

  if (hasProducts && hasCustom) return 'hybrid';
  if (hasProducts) return 'product';
  return 'custom';
}

/**
 * Total a donation.
 *
 * Quantities are floored at zero and truncated to whole units: half a school
 * kit is not a thing that can be provided, and a negative quantity is the
 * oldest trick in the basket — a line that SUBTRACTS from the total, turning a
 * ₹9,000 clinic day into a ₹1 donation. Truncating rather than rejecting is
 * safe here because `validateDonationComposition` rejects it separately with a
 * message; this function's job is to never return a number that is wrong.
 */
export function summariseDonation(
  productLines: DonationProductLine[],
  customAmount = 0,
): DonationSummary {
  const lines: DonationLineTotal[] = productLines.map((line) => {
    const quantity = Math.max(0, Math.trunc(line.quantity));
    const unitPrice = Math.max(0, Math.trunc(line.unitPrice));
    return { ...line, quantity, unitPrice, totalAmount: unitPrice * quantity };
  });

  const counted = lines.filter((line) => line.quantity > 0);
  const productTotal = counted.reduce((sum, line) => sum + line.totalAmount, 0);
  const custom = Math.max(0, Math.trunc(customAmount));

  return {
    type: donationType(counted.length, custom),
    lines,
    productTotal,
    customAmount: custom,
    total: productTotal + custom,
    itemCount: counted.reduce((sum, line) => sum + line.quantity, 0),
  };
}

export interface DonationCompositionIssue {
  field: string;
  code: string;
  message: string;
}

/**
 * What a donation must satisfy before it may become a payment order.
 *
 * Every rule here is also a database constraint or a service check — this is
 * the copy that produces a SENTENCE, so the donor is told which line is wrong
 * rather than shown a generic failure. It is not the enforcement point.
 */
export interface DonationCompositionRules {
  /** Paise. The campaign's own floor. */
  minimumAmount: number;
  /** Whether this campaign accepts an amount on top of, or instead of, products. */
  allowCustomAmount: boolean;
  /** Per-line ceilings, by `campaignProductId`. */
  maxPerDonation?: Record<string, number>;
}

export function validateDonationComposition(
  productLines: DonationProductLine[],
  customAmount: number,
  rules: DonationCompositionRules,
): DonationCompositionIssue[] {
  const issues: DonationCompositionIssue[] = [];
  const summary = summariseDonation(productLines, customAmount);

  productLines.forEach((line, index) => {
    if (!Number.isInteger(line.quantity)) {
      issues.push({
        field: `items.${index}.quantity`,
        code: 'not_integer',
        message: 'Choose a whole number of items.',
      });
    }

    if (line.quantity <= 0) {
      issues.push({
        field: `items.${index}.quantity`,
        code: 'not_positive',
        message: 'Choose at least one, or remove the item.',
      });
    }

    const ceiling = rules.maxPerDonation?.[line.campaignProductId];
    if (ceiling !== undefined && line.quantity > ceiling) {
      issues.push({
        field: `items.${index}.quantity`,
        code: 'above_max',
        message: `You can give at most ${ceiling} of these in one donation.`,
      });
    }
  });

  // The same product twice in one basket would produce two lines that each
  // pass the per-line ceiling while together exceeding it.
  const seen = new Set<string>();
  productLines.forEach((line, index) => {
    if (seen.has(line.campaignProductId)) {
      issues.push({
        field: `items.${index}.campaignProductId`,
        code: 'duplicate',
        message: 'This item is already in your donation. Change its quantity instead.',
      });
    }
    seen.add(line.campaignProductId);
  });

  if (customAmount > 0 && !rules.allowCustomAmount) {
    issues.push({
      field: 'customAmount',
      code: 'not_allowed',
      message: 'This campaign accepts gifts of listed items only.',
    });
  }

  if (!Number.isInteger(customAmount) || customAmount < 0) {
    issues.push({
      field: 'customAmount',
      code: 'invalid',
      message: 'Enter a whole amount in rupees.',
    });
  }

  if (summary.total <= 0) {
    issues.push({
      field: 'total',
      code: 'empty',
      message: 'Choose an item or enter an amount before continuing.',
    });
  } else if (summary.total < rules.minimumAmount) {
    issues.push({
      field: 'total',
      code: 'below_minimum',
      message: `The smallest donation to this campaign is ₹${(rules.minimumAmount / 100).toLocaleString('en-IN')}.`,
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Product lifecycle
// ---------------------------------------------------------------------------

/**
 * A catalogue product's three states.
 *
 *   active     offered, and may be added to campaigns
 *   inactive   temporarily withdrawn — out of season, supplier lapsed
 *   archived   retired for good
 *
 * ARCHIVED IS NOT DELETED. A product referenced by a donation from two years
 * ago must still resolve, or that donation's receipt has a hole in it — which
 * is why the foreign keys are `ON DELETE RESTRICT` and why there is no hard
 * delete anywhere in the product code path.
 */
export type ProductStatus = 'active' | 'inactive' | 'archived';

export const PRODUCT_TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
  active: ['inactive', 'archived'],
  inactive: ['active', 'archived'],
  // Recoverable, but only back to `inactive`: a product returning from the
  // archive is reviewed and turned on deliberately, not put straight back on
  // sale by the click that un-archived it.
  archived: ['inactive'],
};

export function canTransitionProduct(from: ProductStatus, to: ProductStatus): boolean {
  return PRODUCT_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Whether a product may be OFFERED on a campaign.
 *
 * Two flags, deliberately: a product is available when the catalogue says it
 * is active AND this campaign has it switched on. The catalogue answers "do we
 * do this at all", the junction answers "are we asking for it here" — so a
 * product withdrawn centrally disappears everywhere without anyone having to
 * visit each campaign, and a campaign can rest an item without withdrawing it
 * from the others.
 */
export function isProductOfferable(
  productStatus: ProductStatus,
  campaignProductActive: boolean,
): boolean {
  return productStatus === 'active' && campaignProductActive;
}
