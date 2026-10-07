import { describe, expect, it, vi } from 'vitest';

import {
  MAX_EVENTS_PER_MINUTE,
  createErrorReporter,
  describeError,
  parseDsn,
  parseStack,
} from '../error-reporter.js';

const DSN = 'https://publickey123@o1.ingest.example.io/42';

function fakeFetch() {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response('{}', { status: 200 });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

interface SentEvent {
  level: string;
  environment: string;
  release?: string;
  server_name: string;
  tags: Record<string, string>;
  extra?: Record<string, unknown>;
  exception: {
    values: { type: string; value: string; stacktrace: { frames: unknown[] } }[];
  };
}

function eventOf(body: string) {
  const [, , event] = body.trim().split('\n');
  return JSON.parse(event!) as SentEvent;
}

describe('parseDsn', () => {
  it('builds the envelope URL and keeps the public key', () => {
    expect(parseDsn(DSN)).toEqual({
      url: 'https://o1.ingest.example.io/api/42/envelope/',
      publicKey: 'publickey123',
    });
    expect(parseDsn('https://k@host.example/sub/path/7')?.url).toBe(
      'https://host.example/sub/path/api/7/envelope/',
    );
  });

  it('refuses a malformed DSN', () => {
    for (const dsn of ['not a url', 'https://host/42', 'https://k@host/abc', 'ftp://k@host/1']) {
      expect(parseDsn(dsn), dsn).toBeNull();
    }
  });
});

describe('createErrorReporter', () => {
  it('is a silent no-op without a DSN', async () => {
    const { impl } = fakeFetch();
    const reporter = createErrorReporter({
      environment: 'development',
      service: 's',
      fetchImpl: impl,
    });
    reporter.capture(new Error('boom'));
    await reporter.flush();
    expect(reporter.enabled).toBe(false);
    expect(impl).not.toHaveBeenCalled();
  });

  it('sends one scrubbed envelope with the exception, service, environment and tags', async () => {
    const { impl, calls } = fakeFetch();
    const reporter = createErrorReporter({
      dsn: DSN,
      environment: 'production',
      release: 'web-2026-10-07',
      service: 'sailent-api',
      fetchImpl: impl,
    });
    const error = new Error('lookup failed for asha@example.org with ABCDE1234F');
    reporter.capture(error, {
      tags: { requestId: 'req-1', route: '/api/v1/me' },
      extra: { refreshToken: 'secret-refresh', note: 'retry' },
    });
    await reporter.flush();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://o1.ingest.example.io/api/42/envelope/');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['X-Sentry-Auth']).toContain('sentry_key=publickey123');
    const body = String(calls[0]!.init.body);
    expect(body).not.toContain('asha@example.org');
    expect(body).not.toContain('ABCDE1234F');
    expect(body).not.toContain('secret-refresh');

    const event = eventOf(body);
    expect(event).toMatchObject({
      level: 'error',
      environment: 'production',
      release: 'web-2026-10-07',
      server_name: 'sailent-api',
      tags: { service: 'sailent-api', requestId: 'req-1', route: '/api/v1/me' },
    });
    expect(event.exception.values[0]!.type).toBe('Error');
    expect(event.exception.values[0]!.value).toContain('[email]');
    expect(event.exception.values[0]!.stacktrace.frames.length).toBeGreaterThan(0);
    expect(event.extra).toEqual({ refreshToken: '[redacted]', note: 'retry' });
  });

  it('includes a cause chain, outermost last', async () => {
    const { impl, calls } = fakeFetch();
    const reporter = createErrorReporter({
      dsn: DSN,
      environment: 'e',
      service: 's',
      fetchImpl: impl,
    });
    reporter.capture(new Error('outer', { cause: new TypeError('inner') }));
    await reporter.flush();
    const values = eventOf(String(calls[0]!.init.body)).exception.values;
    expect(values.map((value: { type: string }) => value.type)).toEqual(['TypeError', 'Error']);
  });

  it(`caps sends at ${MAX_EVENTS_PER_MINUTE} a minute`, async () => {
    const { impl } = fakeFetch();
    let clock = 1_000_000;
    const reporter = createErrorReporter({
      dsn: DSN,
      environment: 'e',
      service: 's',
      fetchImpl: impl,
      now: () => clock,
    });
    for (let index = 0; index < MAX_EVENTS_PER_MINUTE + 10; index += 1)
      reporter.capture(new Error('x'));
    expect(impl).toHaveBeenCalledTimes(MAX_EVENTS_PER_MINUTE);
    clock += 61_000;
    reporter.capture(new Error('later'));
    expect(impl).toHaveBeenCalledTimes(MAX_EVENTS_PER_MINUTE + 1);
    await reporter.flush();
  });

  it('never throws, even when sending fails', async () => {
    const reporter = createErrorReporter({
      dsn: DSN,
      environment: 'e',
      service: 's',
      fetchImpl: (async () => {
        throw new Error('network down');
      }) as unknown as typeof fetch,
    });
    expect(() => reporter.capture(new Error('x'))).not.toThrow();
    await expect(reporter.flush()).resolves.toBeUndefined();
  });
});

describe('parseStack', () => {
  it('reads V8 frames oldest first and marks node_modules as not in-app', () => {
    const frames = parseStack(
      [
        'Error: x',
        '    at handler (/app/dist/modules/me/me.service.js:10:5)',
        '    at /app/node_modules/express/lib/router.js:3:1',
      ].join('\n'),
    );
    expect(frames[0]).toMatchObject({
      filename: '/app/node_modules/express/lib/router.js',
      in_app: false,
    });
    expect(frames[1]).toMatchObject({ function: 'handler', lineno: 10, colno: 5, in_app: true });
  });
});

describe('describeError', () => {
  it('is short and scrubbed', () => {
    expect(describeError(new Error('token eyJabcdefgh.eyJabcdefgh.sigsigsig for a@b.org'))).toBe(
      'Error: token [jwt] for [email]',
    );
  });
});
