import { describe, expect, it } from 'vitest';

import {
  donorDisplayName,
  formatDayMonthYear,
  formatMonthYear,
  formatPhone,
  initialsOf,
} from '../format';

describe('dashboard dates', () => {
  it('writes a day as "08 Oct 2026", in Indian time', () => {
    // 23:30 UTC on 7 October is already 8 October in Kolkata.
    expect(formatDayMonthYear('2026-10-07T23:30:00Z')).toBe('08 Oct 2026');
  });

  it('spells September "Sep", not the Indian locale’s "Sept"', () => {
    expect(formatMonthYear('2026-09-19T10:00:00Z')).toBe('Sep 2026');
    expect(formatDayMonthYear('2026-09-19T10:00:00Z')).toBe('19 Sep 2026');
  });
});

describe('donorDisplayName', () => {
  it('joins the parts it has and never prints null', () => {
    expect(donorDisplayName({ firstName: 'Asha', lastName: 'Verma' })).toBe('Asha Verma');
    expect(donorDisplayName({ firstName: ' Asha ', lastName: null })).toBe('Asha');
    expect(donorDisplayName({ firstName: null, lastName: null })).toBe('');
  });
});

describe('initialsOf', () => {
  it('takes up to two initials, upper-cased, and falls back to ME', () => {
    expect(initialsOf('asha verma')).toBe('AV');
    expect(initialsOf('Asha Devi Verma')).toBe('AD');
    expect(initialsOf('Asha')).toBe('A');
    expect(initialsOf('')).toBe('ME');
  });
});

describe('formatPhone', () => {
  it('writes an Indian mobile as +91 98765 43210', () => {
    expect(formatPhone('9876543210')).toBe('+91 98765 43210');
    expect(formatPhone('+91 98765-43210')).toBe('+91 98765 43210');
    expect(formatPhone('919876543210')).toBe('+91 98765 43210');
  });

  it('leaves anything else exactly as stored', () => {
    expect(formatPhone('+44 20 7946 0958')).toBe('+44 20 7946 0958');
    expect(formatPhone('0123456789')).toBe('0123456789');
  });
});
