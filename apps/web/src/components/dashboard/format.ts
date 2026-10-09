import type { DonorProfile } from '@/lib/donor/api';

/**
 * Dates the way the dashboard design writes them: "08 Oct 2026" on a row,
 * "Oct 2024" for "Member since". Composed from parts, because the Indian
 * locale spells September "Sept" and no locale gives day-month-year with a
 * three-letter month on its own. Indian time zone, like the site's
 * `formatDate`.
 */
const PARTS = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

function parts(value: string | Date): { day: string; month: string; year: string } {
  const date = typeof value === 'string' ? new Date(value) : value;
  const found = Object.fromEntries(
    PARTS.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return { day: found.day ?? '', month: found.month ?? '', year: found.year ?? '' };
}

export function formatDayMonthYear(value: string | Date): string {
  const { day, month, year } = parts(value);
  return `${day} ${month} ${year}`;
}

export function formatMonthYear(value: string | Date): string {
  const { month, year } = parts(value);
  return `${month} ${year}`;
}

/** "Asha Verma", "Asha", or nothing — never "null null". */
export function donorDisplayName(profile: Pick<DonorProfile, 'firstName' | 'lastName'>): string {
  return [profile.firstName, profile.lastName]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
}

/** Up to two initials for the avatar disc; "ME" when there is no name yet. */
export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'ME'
  );
}

/**
 * An Indian mobile number the way the design writes it: "+91 98765 43210".
 * Only a ten-digit number starting 6–9 (with or without +91) is reformatted;
 * anything else is shown exactly as stored, so a number from elsewhere is
 * never given India's code.
 */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (local.length === 10 && /^[6-9]/.test(local)) {
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return raw;
}
