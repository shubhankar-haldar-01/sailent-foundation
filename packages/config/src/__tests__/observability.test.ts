import { describe, expect, it } from 'vitest';

import {
  REDACTED,
  cloudLoggingSeverity,
  isSensitiveKey,
  redactDeep,
  redactSensitiveText,
  scrubErrorEvent,
} from '../observability.js';

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiYXVkIjoic3RhZmYifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('isSensitiveKey', () => {
  it.each([
    'password',
    'passwordHash',
    'refreshToken',
    'access_token',
    'taxIdNumber',
    'pan',
    'otp',
    'code',
    'authorization',
    'Cookie',
    'x-razorpay-signature',
    'razorpay_signature',
    'apiKey',
    'R2_SECRET_ACCESS_KEY',
    'INTERNAL_API_SECRET',
    'email',
    'phone',
    'ipAddress',
    'cardNumber',
  ])('treats %s as sensitive', (key) => {
    expect(isSensitiveKey(key)).toBe(true);
  });

  it.each(['company', 'span_id', 'footprint', 'campaignTitle', 'status', 'errorCode', 'requestId'])(
    'leaves %s alone',
    (key) => {
      expect(isSensitiveKey(key)).toBe(false);
    },
  );
});

describe('redactSensitiveText', () => {
  it('masks JWTs, bearer tokens, Razorpay keys, PANs and email addresses', () => {
    const text = `token ${JWT} Bearer abc.def-123 key rzp_live_AbC123xyz pan ABCDE1234F mail asha@example.org`;
    const result = redactSensitiveText(text);
    for (const secret of [
      JWT,
      'abc.def-123',
      'rzp_live_AbC123xyz',
      'ABCDE1234F',
      'asha@example.org',
    ]) {
      expect(result).not.toContain(secret);
    }
    expect(result).toContain('[jwt]');
    expect(result).toContain('[pan]');
    expect(result).toContain('[email]');
  });
});

describe('redactDeep', () => {
  it('redacts by key at any depth and by content in every string', () => {
    const result = redactDeep({
      job: { name: 'staff.invite', data: { userId: 'u1', token: 'T'.repeat(43) } },
      donor: { taxIdNumber: 'ABCDE1234F', note: 'contact asha@example.org' },
      list: [{ password: 'hunter2hunter2' }],
    }) as {
      job: { data: Record<string, unknown> };
      donor: Record<string, unknown>;
      list: Record<string, unknown>[];
    };
    expect(result.job.data.token).toBe(REDACTED);
    expect(result.job.data.userId).toBe('u1');
    expect(result.donor.taxIdNumber).toBe(REDACTED);
    expect(result.donor.note).toBe('contact [email]');
    expect(result.list[0]!.password).toBe(REDACTED);
  });

  it('survives cycles', () => {
    const loop: Record<string, unknown> = { name: 'x' };
    loop.self = loop;
    expect(() => redactDeep(loop)).not.toThrow();
  });
});

describe('scrubErrorEvent', () => {
  const event = {
    message: `failed for asha@example.org with ${JWT}`,
    exception: {
      values: [{ type: 'Error', value: 'PAN ABCDE1234F rejected for rzp_test_123abc' }],
    },
    request: {
      method: 'POST',
      url: 'https://api.example.org/api/v1/auth/staff/password/reset?token=abc&email=a@b.org',
      headers: {
        authorization: `Bearer ${JWT}`,
        cookie: 'sailent_staff_session=secret',
        'x-sailent-internal-auth': 'internal-secret-value-0123456789abcdef',
        'x-razorpay-signature': 'sig',
        'user-agent': 'Mozilla/5.0',
        'x-request-id': 'req-1',
      },
      data: { token: 'T'.repeat(43), password: 'new-password-123' },
      cookies: { sailent_staff_session: 'secret' },
      query_string: 'token=abc',
    },
    user: { email: 'asha@example.org', ip_address: '203.0.113.9' },
    breadcrumbs: [{ message: 'console.log asha@example.org' }],
    extra: { otp: '123456', note: 'retry', refreshToken: 'r' },
    tags: { errorCode: 'INTERNAL_ERROR', route: '/api/v1/me' },
  };

  it('drops the body, cookies, query, user and breadcrumbs, and keeps only safe headers', () => {
    const scrubbed = scrubErrorEvent(event) as typeof event;
    const json = JSON.stringify(scrubbed);
    for (const secret of [
      JWT,
      'new-password-123',
      'sailent_staff_session',
      'internal-secret-value',
      'asha@example.org',
      '203.0.113.9',
      'ABCDE1234F',
      'rzp_test_123abc',
      '123456',
      'token=abc',
      'a@b.org',
    ]) {
      expect(json, secret).not.toContain(secret);
    }
    expect(scrubbed.request.url).toBe('https://api.example.org/api/v1/auth/staff/password/reset');
    expect(Object.keys(scrubbed.request.headers).sort()).toEqual(['user-agent', 'x-request-id']);
    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.breadcrumbs).toBeUndefined();
    expect(scrubbed.tags).toEqual({ errorCode: 'INTERNAL_ERROR', route: '/api/v1/me' });
    expect(scrubbed.extra.note).toBe('retry');
  });

  it('does not modify the event it was given', () => {
    scrubErrorEvent(event);
    expect(event.request.data.password).toBe('new-password-123');
  });
});

describe('cloudLoggingSeverity', () => {
  it('maps pino levels to Cloud Logging severities', () => {
    expect(cloudLoggingSeverity('warn')).toBe('WARNING');
    expect(cloudLoggingSeverity('error')).toBe('ERROR');
    expect(cloudLoggingSeverity('fatal')).toBe('CRITICAL');
    expect(cloudLoggingSeverity('info')).toBe('INFO');
  });
});
