/**
 * An amount in words, the way an Indian receipt writes it:
 * 2,51,000.50 → "Rupees Two Lakh Fifty One Thousand and Fifty Paise Only".
 *
 * Indian grouping (thousand, lakh, crore), because a receipt in lakhs written
 * in millions reads as an error to the person checking it.
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** 0–99. */
function belowHundred(n: number): string {
  if (n < 20) return ONES[n]!;
  const unit = n % 10;
  return `${TENS[Math.floor(n / 10)]}${unit ? ` ${ONES[unit]}` : ''}`;
}

/** 0–999. */
function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', rest ? belowHundred(rest) : '']
    .filter(Boolean)
    .join(' ');
}

/** A whole number in words, Indian grouping. */
export function numberInWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1_000);
  const rest = n % 1_000;
  return [
    crore ? `${numberInWords(crore)} Crore` : '',
    lakh ? `${belowHundred(lakh)} Lakh` : '',
    thousand ? `${belowHundred(thousand)} Thousand` : '',
    rest ? belowThousand(rest) : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Paise as a receipt's "amount in words". */
export function rupeesInWords(paise: number): string {
  const whole = Math.floor(paise / 100);
  const fraction = paise % 100;
  return `Rupees ${numberInWords(whole)}${fraction ? ` and ${belowHundred(fraction)} Paise` : ''} Only`;
}
