import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { faqs } from '@/lib/mock/faqs';
import { testimonials as homeTestimonials } from '@/lib/mock/home';
import { testimonials } from '@/lib/mock/testimonials';

/**
 * ONE-TIME DONATIONS ONLY (AGENTS.md §10) — a regression guard (Phase 13).
 *
 * The platform has never taken monthly or recurring payments, yet a dead
 * "Once / Monthly" donation widget, a "Monthly Donor" testimonial and an FAQ
 * answer promising monthly giving survived until Phase 13. These tests fail if
 * anything of the kind comes back.
 */
const IMPLIES_RECURRING =
  /monthly (giving|donation|donor|gift|plan)|give monthly|recurring (donation|gift|giving)|set up a (monthly|regular) (donation|gift)|subscription plan/i;

describe('one-time giving only', () => {
  it('no testimonial presents its author as a monthly or recurring donor', () => {
    for (const entry of homeTestimonials) {
      expect(`${entry.role} ${entry.quote}`, entry.id).not.toMatch(IMPLIES_RECURRING);
    }
    for (const entry of testimonials) {
      expect(`${entry.authorRole} ${entry.quote}`, entry.id).not.toMatch(IMPLIES_RECURRING);
    }
  });

  it('no FAQ answer offers monthly or recurring giving', () => {
    for (const faq of faqs) {
      const offers = IMPLIES_RECURRING.test(faq.answer) && !/we do not take/i.test(faq.answer);
      expect(offers, faq.question).toBe(false);
    }
  });

  it('no component or page offers a giving frequency', () => {
    const root = path.resolve(import.meta.dirname, '../..');
    const offenders: string[] = [];
    const walk = (directory: string) => {
      for (const name of readdirSync(directory)) {
        const full = path.join(directory, name);
        if (statSync(full).isDirectory()) {
          if (name !== '__tests__' && name !== 'mock') walk(full);
        } else if (/\.(tsx?|jsx?)$/.test(name)) {
          const source = readFileSync(full, 'utf8');
          // A frequency control or parameter, in any form it has taken before.
          if (
            /type\s+Frequency\b|['"]monthly['"]|[?&]frequency=|donationPresets\.monthly/.test(
              source,
            )
          ) {
            offenders.push(path.relative(root, full));
          }
        }
      }
    };
    for (const directory of ['app', 'components', 'lib']) walk(path.join(root, directory));
    expect(offenders).toEqual([]);
  });
});
