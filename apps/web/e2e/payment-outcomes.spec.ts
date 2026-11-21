import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * What a donor sees at each payment outcome, in a real browser (Phase 3 of the
 * UI feedback system, 2026-11-19).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A STAND-IN FOR RAZORPAY, NOT A DRIVE OF IT.
 *
 * `donations.spec.ts` stops before Checkout opens, for good reasons: Razorpay's
 * modal is a cross-origin iframe needing live credentials. These tests replace
 * Checkout's script with a stand-in that behaves like it (pay, fail, close)
 * and answer the site's own donation endpoints in the browser, so they run with
 * no Razorpay account and touch no money. What they check is the browser's
 * part: one donation per press, "cancelled" is not an error, the outcome comes
 * from the server, and the donor's details survive a retry.
 *
 * The server's side (signatures, capture, webhooks, idempotency) is the API's
 * integration suite, against a real database.
 * ══════════════════════════════════════════════════════════════════════════
 */

const CAMPAIGN = '/campaigns/school-kits-jharkhand';
const REFERENCE = 'DON-E2EPAY01';

type Outcome = 'paid' | 'failed' | 'dismiss';

/** Razorpay Checkout's shape, enough for `razorpay-checkout.ts`. */
const FAKE_CHECKOUT = `
  window.Razorpay = function (options) {
    var failed = [];
    return {
      on: function (event, handler) { if (event === 'payment.failed') failed.push(handler); },
      open: function () {
        var outcome = window.__razorpayOutcome || 'paid';
        setTimeout(function () {
          if (outcome === 'paid') {
            options.handler({ razorpay_order_id: options.order_id, razorpay_payment_id: 'pay_e2e', razorpay_signature: 'sig_e2e' });
          } else if (outcome === 'failed') {
            failed.forEach(function (h) { h({ error: { description: 'Your bank declined the payment.' } }); });
            options.modal.ondismiss();
          } else {
            options.modal.ondismiss();
          }
        }, 150);
      },
    };
  };
`;

interface Stubs {
  /** POSTs that would have created a donation. */
  creates: number;
  /** Statuses the server reports, one per poll; the last repeats. */
  statuses: string[];
}

async function stubPayments(page: Page, outcome: Outcome, statuses: string[] = ['successful']) {
  const stubs: Stubs = { creates: 0, statuses: [...statuses] };
  await page.addInitScript((value) => {
    (window as unknown as { __razorpayOutcome: string }).__razorpayOutcome = value;
  }, outcome);
  await page.route('https://checkout.razorpay.com/v1/checkout.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: FAKE_CHECKOUT }),
  );

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('**/api/bff/donations', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    stubs.creates += 1;
    return json(route, {
      success: true,
      data: {
        razorpayKeyId: 'rzp_test_e2e',
        razorpayOrderId: 'order_e2e',
        amount: 140_000,
        currency: 'INR',
        donationId: '00000000-0000-4000-8000-00000000e2e1',
        reference: REFERENCE,
        donor: { name: 'Asha Verma', email: 'asha@example.org', phone: '9876543210' },
      },
    });
  });
  await page.route('**/api/bff/donations/*/verify-payment', (route) =>
    json(route, { success: true, data: { status: 'successful' } }),
  );
  await page.route(`**/api/bff/donations/${REFERENCE}`, (route) => {
    const status = stubs.statuses.length > 1 ? stubs.statuses.shift()! : stubs.statuses[0]!;
    return json(route, {
      success: true,
      data: {
        reference: REFERENCE,
        status,
        amount: 140_000,
        donationType: 'hybrid',
        campaignSlug: 'school-kits-jharkhand',
        campaignTitle: 'School kits for Jharkhand',
        donorName: 'Asha',
        completedAt: status === 'successful' ? new Date().toISOString() : null,
        items: [
          {
            itemType: 'custom',
            itemName: 'Additional donation',
            quantity: 1,
            unitPrice: 140_000,
            totalPrice: 140_000,
          },
        ],
      },
    });
  });
  await page.route(`**/api/bff/donations/${REFERENCE}/receipt`, (route) =>
    json(route, {
      success: true,
      data: {
        receiptNumber: 'SFL-2026-E2E001',
        issuedAt: new Date().toISOString(),
        donorName: 'Asha Verma',
        programTitle: null,
      },
    }),
  );
  return stubs;
}

/** From the campaign page to the donor form, then fill it. */
async function reachCheckout(page: Page) {
  await page.goto(CAMPAIGN);
  const add = page.getByRole('button', { name: /Add one School kit/i }).first();
  await add.scrollIntoViewIfNeeded();
  await add.click();
  await page.waitForLoadState('networkidle');
  await page
    .getByRole('button', { name: /^(Donate( ₹[\d,.]+)?|Proceed to Donate|Continue)$/ })
    .locator('visible=true')
    .first()
    .click();
  await page.getByLabel(/Full name/i).fill('Asha Verma');
  await page.getByLabel(/^Email/i).fill('asha@example.org');
  await page.getByLabel(/Mobile number/i).fill('9876543210');
  return page.getByRole('button', { name: /^Pay ₹/ });
}

test.describe('payment outcomes', () => {
  test('success: the server confirms, then the success page', async ({ page }) => {
    await stubPayments(page, 'paid');
    await (await reachCheckout(page)).click();

    await expect(page).toHaveURL(new RegExp(`/donation/${REFERENCE}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thank you, Asha!');
    await expect(page.getByText('Payment successful').first()).toBeVisible();
  });

  test('pending: says it is confirming, and shows success once the server does', async ({
    page,
  }) => {
    await stubPayments(page, 'paid', ['pending', 'pending', 'successful']);
    await (await reachCheckout(page)).click();

    await expect(page.getByText('Confirming your payment').first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thank you, Asha!', {
      timeout: 15_000,
    });
  });

  test('failure: the reason and the reference, and the details are kept', async ({ page }) => {
    await stubPayments(page, 'failed');
    await (await reachCheckout(page)).click();

    const alert = page.getByRole('alert').filter({ hasText: 'Your bank declined the payment.' });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(REFERENCE);
    await expect(alert).not.toContainText(/refund/i);
    await expect(page.getByLabel(/Full name/i)).toHaveValue('Asha Verma');
    await expect(page.getByRole('button', { name: /^Pay ₹/ })).toBeEnabled();
  });

  test('cancellation: closing Razorpay is "cancelled", not an error', async ({ page }) => {
    await stubPayments(page, 'dismiss');
    await (await reachCheckout(page)).click();

    const notice = page.getByText(/Payment cancelled\./);
    await expect(notice).toBeVisible();
    // Information, not an error. (Next.js's route announcer is always role="alert".)
    await expect(page.locator('[role="status"]', { has: notice })).toHaveCount(1);
    await expect(
      page.locator('[role="alert"]', { hasText: /cancel|declined|could not|couldn’t/i }),
    ).toHaveCount(0);
    await expect(page.getByLabel(/^Email/i)).toHaveValue('asha@example.org');
  });

  test('double-click: one donation, however fast Pay is pressed', async ({ page }) => {
    const stubs = await stubPayments(page, 'dismiss');
    const pay = await reachCheckout(page);

    await pay.dblclick();

    await expect(page.getByText(/Payment cancelled\./)).toBeVisible();
    expect(stubs.creates).toBe(1);
  });
});
