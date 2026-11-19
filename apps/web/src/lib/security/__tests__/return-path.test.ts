import { describe, expect, it } from 'vitest';

import { sameSitePath } from '../return-path';

/** Where a sign-in may send someone next: this site only, however it is spelled. */
describe('sameSitePath', () => {
  it('keeps a path on this site, with its query and fragment', () => {
    expect(sameSitePath('/dashboard')).toBe('/dashboard');
    expect(sameSitePath('/events/mela/register?step=2#form')).toBe(
      '/events/mela/register?step=2#form',
    );
    expect(sameSitePath('  /donate  ')).toBe('/donate');
  });

  it('refuses every spelling that leaves the site', () => {
    for (const attempt of [
      '//evil.example',
      '/\\evil.example',
      '/\\\\evil.example',
      '/\t/evil.example',
      '/\n/evil.example',
      'https://evil.example',
      'http:evil.example',
      'javascript:alert(1)',
      'evil.example',
      '',
    ]) {
      expect(sameSitePath(attempt), JSON.stringify(attempt)).toBeNull();
    }
  });

  it('refuses anything that is not a string', () => {
    expect(sameSitePath(null)).toBeNull();
    expect(sameSitePath(undefined)).toBeNull();
    expect(sameSitePath(['/dashboard'])).toBeNull();
  });
});
