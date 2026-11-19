/**
 * The PDF documents the platform sends and serves: the donation receipt, and
 * the drawing helpers and logo the event pass shares with it.
 *
 * Server-side only (pdf-lib). The web app must not import this package into
 * anything that reaches the browser.
 */
export {
  receiptLinesFrom,
  renderReceiptPdf,
  type ReceiptPdfDonor,
  type ReceiptPdfInput,
  type ReceiptPdfLine,
} from './receipt-pdf.js';
export {
  ORGANISATION_SETTING_KEYS,
  maskEmail,
  maskPhone,
  organisationFromSettings,
  type ReceiptPdfOrganisation,
} from './organisation.js';
export * from './pdf-kit.js';
export { SAILENT_LOGO_PNG, SAILENT_LOGO_SIZE } from './sailent-logo.js';
