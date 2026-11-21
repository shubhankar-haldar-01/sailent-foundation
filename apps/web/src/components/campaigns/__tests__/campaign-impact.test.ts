import { describe, expect, it } from 'vitest';

import { repeatsPeopleReached } from '../campaign-impact';

/**
 * "The difference your support can make" must not repeat the people-reached
 * count that "Your impact" already shows.
 */
describe('repeatsPeopleReached', () => {
  it('drops a people figure equal to the reached count', () => {
    expect(repeatsPeopleReached({ label: 'People reached', value: 354 }, 354)).toBe(true);
    expect(repeatsPeopleReached({ label: 'Children supported', value: 354 }, 354)).toBe(true);
  });

  it('keeps outcomes that are not the reached count', () => {
    expect(repeatsPeopleReached({ label: 'Districts covered', value: 354 }, 354)).toBe(false);
    expect(repeatsPeopleReached({ label: 'Kits provided', value: 354 }, 354)).toBe(false);
    expect(repeatsPeopleReached({ label: 'Families reached', value: 120 }, 354)).toBe(false);
  });

  it('keeps everything when nobody has been counted yet', () => {
    expect(repeatsPeopleReached({ label: 'People reached', value: 0 }, 0)).toBe(false);
  });
});
