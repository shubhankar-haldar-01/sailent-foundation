/**
 * The organisation as a receipt prints it, read from the settings rows the
 * organisation enters in Admin → Settings.
 *
 * Pure, so the worker (emailed receipts) and the API (downloaded receipts)
 * read the same rows the same way. Every value is what was entered or null:
 * never a placeholder, never demo data. A receipt that printed an invented
 * PAN or 80G number would be a false statement to a donor (AGENTS.md §10).
 */

export interface ReceiptPdfOrganisation {
  name: string;
  /** "12 Gandhi Road, Motihari 845401, Bihar", or null. */
  addressLine: string | null;
  email: string | null;
  phone: string | null;
  pan: string | null;
  section80G: string | null;
  section12A: string | null;
}

/** The settings keys this reads. */
export const ORGANISATION_SETTING_KEYS = [
  'organization_name',
  'organization_contact',
  'registration_details',
] as const;

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export function organisationFromSettings(
  rows: { key: string; value: unknown }[],
): ReceiptPdfOrganisation {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const contact = record(byKey.get('organization_contact'));
  const address = record(contact.address);
  const registration = record(byKey.get('registration_details'));

  const cityLine = [text(address.city), text(address.postalCode)].filter(Boolean).join(' ');
  const addressLine =
    [text(address.line1), text(address.line2), cityLine || null, text(address.state)]
      .filter(Boolean)
      .join(', ') || null;

  return {
    name: text(byKey.get('organization_name')) ?? 'Sailent Foundation',
    addressLine,
    email: text(contact.email),
    phone: text(contact.phone),
    pan: text(registration.pan),
    section80G: text(registration.section80G),
    section12A: text(registration.section12A),
  };
}

/**
 * An email address as a receipt shows it: the first letters of the name and
 * the domain, `shubhankar@gmail.com` → `shu•••••@gmail.com`.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '•••••';
  const local = email.slice(0, at);
  const keep = local.length > 4 ? 3 : 1;
  return `${local.slice(0, keep)}•••••${email.slice(at)}`;
}

/** A phone number with only its last four digits: `+91 98765 43210` → `+91 •••••• 3210`. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '••••••';
  const indian =
    phone.trim().startsWith('+91') || (digits.length === 12 && digits.startsWith('91'));
  return `${indian ? '+91 ' : ''}•••••• ${digits.slice(-4)}`;
}
