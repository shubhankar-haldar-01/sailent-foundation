import { describe, expect, it } from 'vitest';

import { numberInWords, rupeesInWords } from '../domain/amount-in-words.js';

describe('amount in words (Indian grouping)', () => {
  it.each([
    [0, 'Zero'],
    [1, 'One'],
    [15, 'Fifteen'],
    [40, 'Forty'],
    [99, 'Ninety Nine'],
    [100, 'One Hundred'],
    [115, 'One Hundred Fifteen'],
    [1_000, 'One Thousand'],
    [10_001, 'Ten Thousand One'],
    [99_999, 'Ninety Nine Thousand Nine Hundred Ninety Nine'],
    [1_00_000, 'One Lakh'],
    [2_51_000, 'Two Lakh Fifty One Thousand'],
    [10_00_000, 'Ten Lakh'],
    [1_00_00_000, 'One Crore'],
    [12_34_56_789, 'Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine'],
    [150_00_00_000, 'One Hundred Fifty Crore'],
  ])('%i → %s', (value, words) => {
    expect(numberInWords(value)).toBe(words);
  });

  it('writes paise as a receipt does', () => {
    expect(rupeesInWords(150_000)).toBe('Rupees One Thousand Five Hundred Only');
    expect(rupeesInWords(25_100_050)).toBe(
      'Rupees Two Lakh Fifty One Thousand and Fifty Paise Only',
    );
    expect(rupeesInWords(1)).toBe('Rupees Zero and One Paise Only');
  });
});
