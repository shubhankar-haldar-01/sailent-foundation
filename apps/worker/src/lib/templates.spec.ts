import { describe, expect, it } from 'vitest';

import { NOTIFICATION_TEMPLATE_SEED } from '@sailent/database';

import { isCustomised } from './templates.js';

/*
  An email laid out in code shows a template's body as "A note from…" only
  when an administrator wrote it. The version number cannot tell: reverting
  to the default, or a test saving and restoring a template, raises it.
*/
describe('isCustomised', () => {
  const shipped = NOTIFICATION_TEMPLATE_SEED.find((t) => t.slug === 'donation.confirmation')!;

  it('is false for the shipped wording, whatever the version', () => {
    expect(isCustomised('donation.confirmation', shipped.bodyHtml, shipped.bodyText)).toBe(false);
  });

  it('is false when only the spacing differs (an editor reflowed it)', () => {
    const reflowed = shipped.bodyHtml.replace(/\n\s*/g, '\n      ').replace(/> </g, '>  <');
    expect(isCustomised('donation.confirmation', reflowed, `  ${shipped.bodyText}\n`)).toBe(false);
  });

  it('is true once the body says something else', () => {
    expect(
      isCustomised(
        'donation.confirmation',
        `${shipped.bodyHtml}<p>Kits ship Monday.</p>`,
        shipped.bodyText,
      ),
    ).toBe(true);
    expect(isCustomised('donation.confirmation', shipped.bodyHtml, 'Different words.')).toBe(true);
  });

  it('is true for a template the code ships no wording for', () => {
    expect(isCustomised('no.such.template', '<p>x</p>', 'x')).toBe(true);
  });
});
