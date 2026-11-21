import { describe, expect, it } from 'vitest';

import { DIRECTIONS, contrast } from '../design-directions';

/*
  The /dev/design proposal states contrast ratios for each direction (visual
  polish brief, Phase 1). These keep those statements true.
*/

describe('contrast', () => {
  it('matches the WCAG formula at the ends of the scale', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
    expect(contrast('#FFFFFF', '#EB6A1F')).toBeCloseTo(3.17, 1); // the recorded orange
    expect(contrast('#FFFFFF', '#C2410C')).toBeGreaterThanOrEqual(4.5); // the darker option shown
  });
});

describe('both directions', () => {
  for (const direction of DIRECTIONS) {
    for (const mode of ['light', 'dark'] as const) {
      const p = direction[mode];
      it(`${direction.id} (${mode}) meets AA for text and controls`, () => {
        expect(contrast(p.text, p.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.textMuted, p.page)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.brand, p.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.brandInk, p.brandTint)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.borderStrong, p.surface)).toBeGreaterThanOrEqual(3);
      });
    }
    it(`${direction.id}: the label on a brand button meets AA in both modes`, () => {
      expect(contrast(direction.light.brandOn, direction.light.brand)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(direction.dark.brandOn, direction.dark.brand)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
