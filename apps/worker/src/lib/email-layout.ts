/**
 * The one HTML shell every email goes out in.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE LAYOUT, APPLIED AT THE LAST STEP, SO NO EMAIL CAN MISS IT.
 *
 * Each processor writes only its message: a short HTML fragment, and the
 * stored (admin-editable) templates are fragments too. `sendEmail` places
 * every fragment in this shell, so the brand, the width on a phone and the
 * footer are decided here once rather than in a dozen bodies that drift.
 *
 * It is written the way email clients need it, not the way a web page would
 * be: tables for structure, inline styles, a fixed 560px column that shrinks
 * on a phone, system fonts, and no images (a logo hosted on a development
 * machine is a broken image in every inbox). A full document — anything
 * that already has an `<html>` element — is left exactly as it is.
 *
 * Colours are the brand's (AGENTS.md §11 item 12): orange #EB6A1F only as a
 * fill or a rule, never as text; the wordmark in the footer's navy.
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface LayoutOptions {
  /** The email's subject; the document title. */
  subject: string;
  /** The wordmark at the top and the name in the footer. */
  brandName: string;
  /**
   * The inbox preview line, hidden in the body. Never a code, a token or an
   * address: lock screens show it to whoever is nearby.
   */
  preheader?: string;
  /** The public site, linked from the footer. */
  siteUrl?: string | null;
  /**
   * The logo, shown instead of the wordmark. It is an inline attachment of
   * the same message (`cid:`), so it shows in every inbox — including on a
   * development machine, where a hosted image would point at localhost.
   */
  logo?: { contentId: string; width: number; height: number } | null;
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const COLOUR = {
  page: '#f4f5f7',
  card: '#ffffff',
  border: '#e4e7ec',
  accent: '#EB6A1F',
  navy: '#19013E',
  ink: '#1f2933',
  muted: '#6b7280',
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Already a whole document: sent as it is, never wrapped twice. */
export function isFullDocument(html: string): boolean {
  return /<html[\s>]/i.test(html);
}

/** `https://example.org/` → `example.org`, for the footer link's label. */
function siteLabel(siteUrl: string): string | null {
  try {
    const url = new URL(siteUrl);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.host : null;
  } catch {
    return null;
  }
}

export function renderEmailLayout(content: string, options: LayoutOptions): string {
  if (isFullDocument(content)) return content;

  const brand = escapeHtml(options.brandName);
  const header = options.logo
    ? `<img src="cid:${escapeHtml(options.logo.contentId)}" width="${options.logo.width}" height="${options.logo.height}" alt="${brand}" style="display:block;border:0;outline:none;text-decoration:none">`
    : brand;
  const label = options.siteUrl ? siteLabel(options.siteUrl) : null;
  const siteLink =
    options.siteUrl && label
      ? ` &middot; <a href="${escapeHtml(options.siteUrl)}" style="color:${COLOUR.muted};text-decoration:underline">${escapeHtml(label)}</a>`
      : '';
  const preheader = options.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">${escapeHtml(options.preheader)}</div>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(options.subject)}</title>
<style>
  @media only screen and (max-width: 600px) {
    .sf-outer { padding: 0 !important; }
    .sf-card { border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
    .sf-pad { padding-left: 20px !important; padding-right: 20px !important; }
    /* Side-by-side cells that stack on a phone (e.g. a pass's QR above its details). */
    .sf-stack { display: block !important; width: 100% !important; box-sizing: border-box; }
    .sf-stack-first { padding-bottom: 0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${COLOUR.page};-webkit-text-size-adjust:100%">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOUR.page}">
  <tr>
    <td align="center" class="sf-outer" style="padding:24px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sf-card" style="max-width:560px;background-color:${COLOUR.card};border:1px solid ${COLOUR.border};border-radius:12px;overflow:hidden">
        <tr><td style="height:4px;line-height:4px;font-size:0;background-color:${COLOUR.accent}">&nbsp;</td></tr>
        <tr>
          <td class="sf-pad" style="padding:22px 32px 4px;font-family:${FONT};font-size:17px;font-weight:700;letter-spacing:-0.01em;color:${COLOUR.navy}">${header}</td>
        </tr>
        <tr>
          <td class="sf-pad" style="padding:8px 32px 28px;font-family:${FONT};font-size:15px;line-height:1.6;color:${COLOUR.ink}">
${content}
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
        <tr>
          <td class="sf-pad" style="padding:16px 32px;font-family:${FONT};font-size:12px;line-height:1.5;color:${COLOUR.muted};text-align:center">
            ${brand}${siteLink}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
