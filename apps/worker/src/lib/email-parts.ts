/**
 * Building blocks for the transactional email bodies (the event confirmation,
 * the donation receipt), so every email is made of the same parts.
 *
 * Email-safe only: tables, inline styles, a table-based button. They sit
 * inside the shared shell (`lib/email-layout.ts`).
 *
 * Colours follow AGENTS.md §11 item 12: orange #EB6A1F only as a fill (the
 * button, with a white label); orange TEXT is the darker #B3450E.
 */

export const FONT_MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

export const C = {
  navy: '#19013E',
  ink: '#1f2933',
  muted: '#52606d',
  faint: '#6b7280',
  line: '#e4e7ec',
  rule: '#eef0f3',
  panel: '#f8fafc',
  orangeFill: '#EB6A1F',
  orangeText: '#B3450E',
  orangeSoft: '#FFF7ED',
  orangeLine: '#FED7AA',
  green: '#047857',
  greenSoft: '#ECFDF5',
} as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Paise as rupees: 150000 → "₹1,500", 251050 → "₹2,510.50". */
export function rupees(paise: number): string {
  const digits = paise % 100 === 0 ? 0 : 2;
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function heading(text: string): string {
  return `<h2 style="margin:30px 0 10px;font-size:17px;line-height:1.3;color:${C.navy}">${escapeHtml(text)}</h2>`;
}

/** A label and a value in a two-column details table. `valueHtml` is already escaped. */
export function detailRow(label: string, valueHtml: string): string {
  return `<tr>
      <td style="padding:6px 18px 6px 0;color:${C.faint};font-size:14px;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td>
      <td style="padding:6px 0;color:${C.ink};font-size:14px;font-weight:600;vertical-align:top">${valueHtml}</td>
    </tr>`;
}

export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px">
    <tr><td style="border-radius:8px;background-color:${C.orangeFill}">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

/** The green pill at the top of a confirmation, e.g. "✓ BOOKING CONFIRMED". */
export function statusPill(label: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:6px 0 4px">
      <span style="display:inline-block;padding:6px 14px;border-radius:999px;background-color:${C.greenSoft};color:${C.green};font-size:12px;font-weight:700;letter-spacing:0.06em">&#10003; ${escapeHtml(label)}</span>
    </td></tr>
  </table>`;
}

/**
 * An administrator's own wording, in a tinted box. `html` is the rendered
 * template body (its placeholders were escaped by the template renderer).
 */
export function noteBox(title: string, html: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:26px;background-color:${C.orangeSoft};border:1px solid ${C.orangeLine};border-radius:12px;border-collapse:separate">
    <tr><td style="padding:16px 18px;font-size:14px;color:${C.ink}">
      <div style="margin-bottom:6px;font-weight:700;color:${C.navy}">${escapeHtml(title)}</div>
      ${html}
    </td></tr>
  </table>`;
}

export interface ContactDetails {
  email: string | null;
  phone: string | null;
}

/** "email <a>…</a> or call <a>…</a>", or null when the organisation entered neither. */
export function contactLinksHtml(contact: ContactDetails): string | null {
  const parts = [
    contact.email
      ? `email <a href="mailto:${escapeHtml(contact.email)}" style="color:${C.orangeText}">${escapeHtml(contact.email)}</a>`
      : null,
    contact.phone
      ? `call <a href="tel:${escapeHtml(contact.phone.replace(/[^\d+]/g, ''))}" style="color:${C.orangeText};white-space:nowrap">${escapeHtml(contact.phone)}</a>`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' or ') : null;
}

/** "Email x or call y", or null. */
export function contactLinksText(contact: ContactDetails): string | null {
  const parts = [
    contact.email ? `email ${contact.email}` : null,
    contact.phone ? `call ${contact.phone}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' or ') : null;
}
