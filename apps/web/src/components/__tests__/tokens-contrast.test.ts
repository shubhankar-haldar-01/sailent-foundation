import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/*
  The colour tokens meet WCAG AA in light and dark mode (visual polish,
  Phase 2, 2026-11-21). Reads packages/ui/src/styles/tokens.css itself,
  resolves each token through its var() chain, and measures the pairs the
  site actually draws, so a palette edit that breaks one fails here.
*/

const css = readFileSync(
  resolve(__dirname, '../../../../../packages/ui/src/styles/tokens.css'),
  'utf8',
);

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block`);
  const body = css.slice(start, css.indexOf('\n}', start));
  const out: Record<string, string> = {};
  for (const match of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out[match[1]!] = match[2]!.replace(/\/\*.*?\*\//g, '').trim();
  }
  return out;
}

const root = block(':root');
const dark = { ...root, ...block('.dark') };

function value(tokens: Record<string, string>, name: string, depth = 0): string {
  const raw = tokens[name];
  if (!raw || depth > 10) throw new Error(`unresolved ${name}`);
  const ref = raw.match(/^var\((--[\w-]+)\)$/);
  return ref ? value(tokens, ref[1]!, depth + 1) : raw;
}

/** sRGB channels 0–1 from `#rrggbb` or `oklch(L C H)`. */
function rgb(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255) as [
      number,
      number,
      number,
    ];
  }
  const m = color.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!m) throw new Error(`unsupported colour ${color}`);
  const [L, C, H] = [Number(m[1]), Number(m[2]), (Number(m[3]) * Math.PI) / 180];
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  return linear.map((c) => {
    const x = Math.min(1, Math.max(0, c));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  }) as [number, number, number];
}

function luminance(color: string): number {
  const [r, g, b] = rgb(color).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(tokens: Record<string, string>, fg: string, bg: string): number {
  const [hi, lo] = [luminance(value(tokens, fg)), luminance(value(tokens, bg))].sort(
    (x, y) => y - x,
  );
  return (hi! + 0.05) / (lo! + 0.05);
}

const TEXT: [string, string][] = [
  ['--foreground', '--background'],
  ['--foreground', '--surface'],
  ['--muted-foreground', '--background'],
  ['--muted-foreground', '--surface'],
  ['--muted-foreground', '--muted'],
  ['--primary-foreground', '--primary'],
  ['--primary-ink', '--surface'],
  ['--primary-ink', '--background'],
  ['--accent-foreground', '--accent'],
  ['--info-action', '--surface'],
  ['--success', '--surface'],
  ['--success', '--success-subtle'],
  ['--destructive', '--surface'],
];

describe.each([
  ['light', root],
  ['dark', dark],
] as const)('colour tokens (%s)', (_mode, tokens) => {
  it.each(TEXT)('%s on %s meets 4.5:1', (fg, bg) => {
    expect(ratio(tokens, fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('control borders meet 3:1 on cards and the page (WCAG 1.4.11)', () => {
    expect(ratio(tokens, '--input', '--surface')).toBeGreaterThanOrEqual(3);
    expect(ratio(tokens, '--input', '--background')).toBeGreaterThanOrEqual(3);
  });

  it('the focus ring meets 3:1 against the page', () => {
    expect(ratio(tokens, '--ring', '--background')).toBeGreaterThanOrEqual(3);
  });
});

describe('the Donate orange', () => {
  it('is #EB6A1F with a white label at 3.18:1: the owner’s recorded exception', () => {
    expect(value(root, '--action')).toBe(value(dark, '--action'));
    expect(ratio(root, '--action-foreground', '--action')).toBeCloseTo(3.18, 1);
  });
});
