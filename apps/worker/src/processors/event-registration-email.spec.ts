import { describe, expect, it } from 'vitest';

import { registrationEmail, type RegistrationEmailData } from './event-registration-email.js';

const DATA: RegistrationEmailData = {
  name: 'Asha Verma',
  eventTitle: 'Champaran Mahotsav',
  date: 'Friday, 20 November 2026',
  time: '10:00 am – 8:00 pm',
  venueName: 'Ramson Plaza',
  venueLine: 'Chhatauni Colony, Motihari, Bihar',
  functionName: 'Dance',
  joiningUrl: null,
  eventUrl: 'https://sailent.example/events/champaran-mahotsav',
  bookingReference: 'SF-EVT-AAAA0001',
  bookedOn: '18 November 2026 at 10:55 pm',
  passes: [
    { fullName: 'Asha Verma', passNumber: 'SF-EVT-AAAA0001-1', qrContentId: 'pass-1' },
    { fullName: 'Deep Kumar', passNumber: 'SF-EVT-AAAA0001-2', qrContentId: 'pass-2' },
  ],
  pdfAttached: true,
  payment: {
    total: 10_200,
    perPass: 5_100,
    reference: 'pay_ABC123',
    paidOn: '18 November 2026 at 10:55 pm',
  },
  contact: { email: null, phone: null },
  replyable: false,
  customMessage: null,
};

/** The confirmation's body: sections in the order ticketing emails use. */
describe('registrationEmail', () => {
  it('confirms, then shows the event, the passes, the payment, what to bring and help', () => {
    const { html, text, preheader } = registrationEmail(DATA);

    const order = [
      'BOOKING CONFIRMED',
      'going to Champaran Mahotsav',
      '>Event details</div>',
      '>Payment summary</h2>',
      '>Before you go</h2>',
      '>Need help?</h2>',
    ].map((marker) => html.indexOf(marker));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain('View event details');
    expect(text).toContain('Entry passes x 2 (₹51 each): ₹102');
    expect(text).toContain('Total paid: ₹102');
    expect(text).toContain('Payment method: Online (Razorpay)');
    expect(text).toContain('Payment reference: pay_ABC123');
    expect(preheader).toBe(
      '2 passes for Champaran Mahotsav on Friday, 20 November 2026 · payment received',
    );
  });

  it('leaves the passes to the attached PDF, and says so', () => {
    const { html, text } = registrationEmail(DATA);

    expect(html).not.toContain('>Your entry passes</h2>');
    expect(html).not.toContain('Booking reference');
    expect(html).not.toContain('cid:pass-');
    expect(html).not.toContain('SF-EVT-AAAA0001-1');
    expect(text).not.toContain('YOUR ENTRY PASSES');
    expect(text).not.toContain('SF-EVT-AAAA0001-1');
    expect(html).toContain('attached to this email as a PDF');
    expect(html).toContain('from the attached PDF at the entrance');
    expect(text).toContain('Your entry passes are attached as a PDF.');
  });

  it('lists the passes, with their QR codes, only when there is no PDF', () => {
    const { html, text } = registrationEmail({ ...DATA, pdfAttached: false });

    expect(html).toContain('>Your entry passes</h2>');
    expect(html).toContain('src="cid:pass-1"');
    expect(html).toContain('src="cid:pass-2"');
    expect(html).toContain('Your entry passes are below.');
    expect(html).not.toContain('attached PDF');
    expect(text).toContain('Pass 1 of 2: Asha Verma, SF-EVT-AAAA0001-1');
    expect(text).toContain('Pass 2 of 2: Deep Kumar, SF-EVT-AAAA0001-2');
  });

  it('leaves the payment out of a free booking', () => {
    const { html, text } = registrationEmail({ ...DATA, payment: null });
    expect(html).not.toContain('Payment summary');
    expect(text).not.toContain('PAYMENT SUMMARY');
    expect(html).not.toContain('payment has been received');
  });

  it('shows the total without a per-pass price when it does not divide evenly', () => {
    const { text } = registrationEmail({
      ...DATA,
      payment: { ...DATA.payment!, total: 10_001, perPass: null },
    });
    expect(text).toContain('Entry passes x 2: ₹100.01');
  });

  it('offers only the contact details on record', () => {
    expect(registrationEmail(DATA).html).toContain(
      'See the <a href="https://sailent.example/events/champaran-mahotsav"',
    );

    const withContact = registrationEmail({
      ...DATA,
      contact: { email: 'help@sailent.example', phone: '+91 90000 00000' },
    });
    expect(withContact.html).toContain('mailto:help@sailent.example');
    expect(withContact.html).toContain('tel:+919000000000');

    expect(registrationEmail({ ...DATA, replyable: true }).html).toContain(
      'Just reply to this email',
    );
  });

  it('escapes what people typed', () => {
    const { html } = registrationEmail({
      ...DATA,
      pdfAttached: false,
      name: '<script>x</script>',
      passes: [{ fullName: '<b>Eve</b>', passNumber: 'SF-EVT-AAAA0001', qrContentId: null }],
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>Eve</b>');
    expect(html).toContain('&lt;b&gt;Eve&lt;/b&gt;');
  });

  it('shows an administrator’s own wording as a note from the organisers', () => {
    const { html, text } = registrationEmail({
      ...DATA,
      customMessage: { html: '<p>Bring a water bottle.</p>', text: 'Bring a water bottle.' },
    });
    expect(html).toContain('A note from the organisers');
    expect(html).toContain('<p>Bring a water bottle.</p>');
    expect(text).toContain('A NOTE FROM THE ORGANISERS');
  });
});
