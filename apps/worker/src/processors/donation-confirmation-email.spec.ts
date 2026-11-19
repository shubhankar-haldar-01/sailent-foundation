import { describe, expect, it } from 'vitest';

import { donationEmail, type DonationEmailData } from './donation-confirmation-email.js';

const data = (overrides: Partial<DonationEmailData> = {}): DonationEmailData => ({
  greetingName: 'Asha',
  donorName: 'Asha Verma',
  campaignTitle: 'School kits for Ward 12',
  programTitle: null,
  amount: 150_000,
  lines: [
    { itemName: 'School kit', itemType: 'product', quantity: 2, totalPrice: 100_000 },
    { itemName: 'Where it is needed most', itemType: 'custom', quantity: 1, totalPrice: 50_000 },
  ],
  receiptNumber: 'SFL-2026-000123',
  donationReference: 'DON-7K2MPQ4X',
  paymentReference: 'pay_TEST123',
  paidOn: '18 November 2026, 2:15 am IST',
  statusUrl: 'https://sailent.example/donation/DON-7K2MPQ4X',
  pdfAttached: true,
  contact: { email: null, phone: null },
  replyable: false,
  customMessage: null,
  ...overrides,
});

describe('donationEmail', () => {
  it('states the figures exactly: each line, the total and every reference', () => {
    const { html, text, preheader } = donationEmail(data());

    for (const body of [html, text]) {
      expect(body).toContain('₹1,500');
      expect(body).toContain('₹1,000');
      expect(body).toContain('₹500');
      expect(body).toContain('SFL-2026-000123');
      expect(body).toContain('DON-7K2MPQ4X');
      expect(body).toContain('pay_TEST123');
      expect(body).toContain('18 November 2026, 2:15 am IST');
      expect(body).toContain('Asha Verma');
    }
    // A product line shows its quantity; an amount the donor chose does not.
    expect(text).toContain('School kit x 2: ₹1,000');
    expect(text).toContain('Where it is needed most: ₹500');
    expect(preheader).toBe(
      'Receipt SFL-2026-000123 for your ₹1,500 donation to School kits for Ward 12',
    );
  });

  it('writes paise as two decimals', () => {
    const { html } = donationEmail(data({ amount: 251_050, lines: [] }));

    expect(html).toContain('₹2,510.50');
  });

  it('says a receipt, never a certificate', () => {
    const { html, text } = donationEmail(data());

    expect(text).toContain('It is not a tax-exemption certificate.');
    expect(html).toContain('It is <strong>not</strong> a tax-exemption certificate.');
    for (const body of [html, text]) {
      expect(body).not.toMatch(/80G (certificate|receipt)|tax[- ]deductible|tax benefit/i);
    }
  });

  it('escapes everything a person typed', () => {
    const { html } = donationEmail(
      data({
        donorName: '<img src=x onerror=alert(1)>',
        greetingName: '<b>Asha</b>',
        campaignTitle: 'Kits & "books" <script>',
        lines: [{ itemName: '<i>kit</i>', itemType: 'custom', quantity: 1, totalPrice: 150_000 }],
      }),
    );

    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<i>kit</i>');
    expect(html).toContain('&lt;b&gt;Asha&lt;/b&gt;');
    expect(html).toContain('Kits &amp; &quot;books&quot; &lt;script&gt;');
  });

  it('points to help only through contacts the organisation entered', () => {
    const entered = donationEmail(
      data({ contact: { email: 'help@example.org', phone: '+91 90000 00000' } }),
    );
    expect(entered.html).toContain('mailto:help@example.org');
    expect(entered.html).toContain('tel:+919000000000');
    expect(entered.text).toContain('email help@example.org or call +91 90000 00000');

    const replyable = donationEmail(data({ replyable: true }));
    expect(replyable.html).toContain('Just reply to this email');
    expect(replyable.html).not.toContain('mailto:');

    const neither = donationEmail(data());
    expect(neither.html).toContain('https://sailent.example/donation/DON-7K2MPQ4X');
    expect(neither.html).not.toMatch(/mailto:|tel:/);
  });

  it('shows an administrator’s note only when there is one', () => {
    expect(donationEmail(data()).html).not.toContain('A note from our team');

    const noted = donationEmail(
      data({
        customMessage: {
          html: '<p>Kits reach Ward 12 next week.</p>',
          text: 'Kits reach Ward 12 next week.',
        },
      }),
    );
    expect(noted.html).toContain('A note from our team');
    expect(noted.html).toContain('<p>Kits reach Ward 12 next week.</p>');
    expect(noted.text).toContain('A NOTE FROM OUR TEAM\nKits reach Ward 12 next week.');
  });

  it('says the receipt is attached only when it is', () => {
    expect(donationEmail(data()).html).toContain('attached to this email as a PDF');

    const without = donationEmail(data({ pdfAttached: false }));
    expect(without.html).not.toContain('attached');
    expect(without.text).not.toContain('attached as a PDF');
  });
});
