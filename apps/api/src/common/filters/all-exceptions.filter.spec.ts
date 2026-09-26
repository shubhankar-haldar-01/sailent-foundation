import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { NotFoundException, ValidationException } from '../exceptions.js';
import { REQUEST_ID } from '../middleware/request-id.middleware.js';

function createHost(requestId = 'req-test-1') {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const response = { status };
  const request = { method: 'GET', url: '/api/v1/test', [REQUEST_ID]: requestId };

  return {
    json,
    status,
    host: {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as never,
  };
}

describe('AllExceptionsFilter', () => {
  // The filter logs full detail internally by design; these tests deliberately
  // throw, so silence the logger to keep CI output readable.
  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  it('returns the standard envelope with a stable code and the request id', () => {
    const filter = new AllExceptionsFilter(false);
    const { host, status, json } = createHost();

    filter.catch(new NotFoundException('Campaign'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Campaign was not found.',
        requestId: 'req-test-1',
      },
    });
  });

  it('includes per-field details for a validation failure', () => {
    const filter = new AllExceptionsFilter(false);
    const { host, json } = createHost();

    filter.catch(
      new ValidationException([
        { field: 'phone', code: 'invalid_string', message: 'Enter a mobile number' },
      ]),
      host,
    );

    const body = json.mock.calls[0]?.[0] as { error: { details?: unknown[] } };
    expect(body.error.details).toHaveLength(1);
  });

  it('hides internal detail from a 500 in production', () => {
    // The real message may contain a connection string, a query or a file path.
    const filter = new AllExceptionsFilter(true);
    const { host, json } = createHost();

    filter.catch(new Error('password authentication failed for user "sailent"'), host);

    const body = json.mock.calls[0]?.[0] as { error: { message: string } };
    expect(body.error.message).toBe('Something went wrong on our side. Please try again.');
    expect(body.error.message).not.toContain('password');
  });

  it('surfaces the real message for a 500 outside production, to aid debugging', () => {
    const filter = new AllExceptionsFilter(false);
    const { host, json } = createHost();

    filter.catch(new Error('something specific broke'), host);

    const body = json.mock.calls[0]?.[0] as { error: { message: string } };
    expect(body.error.message).toBe('something specific broke');
  });

  it('maps a framework HttpException onto the same envelope', () => {
    const filter = new AllExceptionsFilter(false);
    const { host, status, json } = createHost();

    filter.catch(new HttpException('Nope', HttpStatus.FORBIDDEN), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    const body = json.mock.calls[0]?.[0] as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });
});
