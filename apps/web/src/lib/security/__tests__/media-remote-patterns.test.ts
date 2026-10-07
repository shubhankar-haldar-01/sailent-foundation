import { describe, expect, it } from 'vitest';

import { mediaRemotePatterns } from '../media-remote-patterns';

describe('mediaRemotePatterns', () => {
  it('allows nothing when unset', () => {
    expect(mediaRemotePatterns(undefined, { production: true })).toEqual([]);
    expect(mediaRemotePatterns('', { production: true })).toEqual([]);
  });

  it('allows exactly the media host, and everything under its path', () => {
    expect(mediaRemotePatterns('https://media.sailent.org', { production: true })).toEqual([
      { protocol: 'https', hostname: 'media.sailent.org', pathname: '/**' },
    ]);
    expect(
      mediaRemotePatterns('https://pub-123.r2.dev/assets/', { production: true })[0],
    ).toMatchObject({ hostname: 'pub-123.r2.dev', pathname: '/assets/**' });
  });

  it.each([
    ['credentials', 'https://user:secret@media.sailent.org'],
    ['a query string', 'https://media.sailent.org/?key=abc'],
    ['a fragment', 'https://media.sailent.org/#x'],
    ['not a URL', 'media.sailent.org'],
    ['another scheme', 'ftp://media.sailent.org'],
  ])('refuses %s', (_label, value) => {
    expect(() => mediaRemotePatterns(value, { production: false })).toThrow(
      /MEDIA_PUBLIC_BASE_URL/,
    );
  });

  it('requires public https in production, and allows local http in development', () => {
    expect(() => mediaRemotePatterns('http://media.sailent.org', { production: true })).toThrow(
      /https/,
    );
    expect(() => mediaRemotePatterns('https://localhost:9000', { production: true })).toThrow();
    expect(mediaRemotePatterns('http://localhost:9000/media', { production: false })[0]).toEqual({
      protocol: 'http',
      hostname: 'localhost',
      port: '9000',
      pathname: '/media/**',
    });
  });

  it('never produces a wildcard host', () => {
    const [pattern] = mediaRemotePatterns('https://media.sailent.org', { production: true });
    expect(pattern?.hostname).not.toContain('*');
  });
});
