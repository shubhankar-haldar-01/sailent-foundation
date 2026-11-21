/**
 * The design tokens' colours as plain values, for output that cannot read a
 * CSS variable:
 *   • canvas drawings (the downloadable event pass);
 *   • Razorpay's checkout, which takes a hex for its theme;
 *   • `app/global-error.tsx`, which renders its own <html> without the
 *     stylesheet.
 *
 * Everything else uses the tokens in `packages/ui/src/styles/tokens.css`
 * (light theme values mirrored here; visual polish Phase 2, 2026-11-21).
 * Change a colour there first, then here.
 */
export const BRAND_COLOURS = {
  /** The brand green (`--brand-600`). */
  brand: '#1E7B24',
  /** `--brand-700`. */
  brandHover: '#18661D',
  /** `--brand-800`: brand text on the tint. */
  brandInk: '#155A19',
  /** `--brand-50`. */
  brandTint: '#F0FAF0',
  /** `--brand-200`. */
  brandTintStrong: '#BDE9BD',
  /** The Donate orange (`--action`): Donate and the one conversion step only. */
  action: '#EB6A1F',
  /** `--foreground`. */
  text: '#111827',
  /** `--muted-foreground`. */
  textMuted: '#4B5563',
  /** `--neutral-500`: captions and icons. */
  textSubtle: '#6B7280',
  /** `--neutral-400`: faint marks only, never text. */
  textFaint: '#9CA3AF',
  /** `--neutral-700`. */
  textStrong: '#374151',
  /** `--border`. */
  border: '#E5E7EB',
  /** `--border-strong`. */
  borderStrong: '#D1D5DB',
  /** `--background`. */
  page: '#F9FAFB',
  /** `--muted`. */
  sunken: '#F3F4F6',
  /** `--surface`. */
  surface: '#FFFFFF',
  /** `--success` (teal). */
  success: '#0F766E',
  /** `--success-subtle`. */
  successTint: '#E2F9F6',
  successBorder: '#A3E7DD',
  /** `--warning-subtle`. */
  warningTint: '#FEF3C7',
} satisfies Record<string, string>;
