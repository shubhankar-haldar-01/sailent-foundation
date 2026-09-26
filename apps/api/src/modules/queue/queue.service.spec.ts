import { describe, expect, it } from 'vitest';

import { jobKey } from './queue.service.js';

/**
 * `jobKey` exists because BullMQ throws on a colon in a custom job id, and the
 * one place that threw had its enqueue wrapped in a `.catch()` — so the throw
 * became a warning and every donor confirmation email was discarded.
 *
 * These tests are about that failure, not about string joining.
 */
describe('jobKey', () => {
  it('never produces a colon, whatever it is given', () => {
    expect(jobKey('event-cancelled', 'abc', '2026-09-20T21:11')).not.toContain(':');
    expect(jobKey('donation-confirmation', 'SFL:2026:0001')).not.toContain(':');
  });

  it('keeps the characters BullMQ accepts', () => {
    expect(jobKey('donation-confirmation', 'SFL-2026-0001')).toBe(
      'donation-confirmation--SFL-2026-0001',
    );
    expect(jobKey('a_b.c-d', 1)).toBe('a_b.c-d--1');
  });

  it('replaces anything else rather than dropping it, so two ids stay distinct', () => {
    // `a:b` and `a b` must not both collapse to `ab` — a silently shared id
    // makes the second job a no-op, which is the failure this guards against.
    expect(jobKey('a:b')).toBe('a-b');
    expect(jobKey('a b')).toBe('a-b');
    expect(jobKey('ab')).toBe('ab');
    expect(jobKey('a:b')).not.toBe(jobKey('ab'));
  });

  it('skips empty parts instead of leaving a dangling separator', () => {
    expect(jobKey('prefix', '', 'suffix')).toBe('prefix--suffix');
    expect(jobKey('prefix')).toBe('prefix');
  });

  it('accepts numbers, which is what a seat count is', () => {
    expect(jobKey('event-registration', 'id', 3)).toBe('event-registration--id--3');
  });
});
