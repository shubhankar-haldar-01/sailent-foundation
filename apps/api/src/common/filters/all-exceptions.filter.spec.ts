import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const reportError = vi.fn();
vi.mock('../observability/error-reporting.js', () => ({
  reportError: (...args: unknown[]) => reportError(...args),
}));

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

  /*
    Phase 14: every 5xx — and only 5xx — goes to error tracking, tagged so it
    can be matched to the log line; the query string never travels.
  */
  describe('error reporting', () => {
    beforeEach(() => reportError.mockReset());

    it('reports an unexpected error with the request id, method and path without query', () => {
      const filter = new AllExceptionsFilter(true);
      const { host } = createHost('req-500');
      (host as unknown as { switchToHttp: () => { getRequest: () => Record<string, unknown> } })
        .switchToHttp()
        .getRequest().originalUrl = '/api/v1/me?token=abc';
      const error = new Error('database exploded');

      filter.catch(error, host);

      expect(reportError).toHaveBeenCalledTimes(1);
      const [reported, context] = reportError.mock.calls[0]!;
      expect(reported).toBe(error);
      expect(context.tags).toMatchObject({ requestId: 'req-500', method: 'GET', status: 500 });
      expect(JSON.stringify(context)).not.toContain('token=abc');
    });

    it('does not report a 4xx — a refusal is not an incident', () => {
      const filter = new AllExceptionsFilter(true);
      filter.catch(new NotFoundException('Campaign'), createHost().host);
      filter.catch(new ValidationException([]), createHost().host);
      expect(reportError).not.toHaveBeenCalled();
    });
  });

  /*
    The body parser throws `http-errors` objects, not HttpExceptions. They used
    to fall through to the 500 branch, so an oversized body from anyone was
    logged as a crash and sent to error tracking.
  */
  describe('the body parser’s refusals', () => {
    beforeEach(() => reportError.mockReset());

    /** The shape `body-parser` throws (`http-errors`), built by hand. */
    const parserError = (message: string, type: string, status: number) =>
      Object.assign(new Error(message), { type, status, statusCode: status, expose: status < 500 });

    it('answers an oversized body with 413, not a 500, and does not report it', () => {
      const filter = new AllExceptionsFilter(true);
      const { host, status, json } = createHost();

      filter.catch(parserError('request entity too large', 'entity.too.large', 413), host);

      expect(status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
      const body = json.mock.calls[0]?.[0] as { error: { code: string; message: string } };
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.message).toBe('That request is too large.');
      expect(reportError).not.toHaveBeenCalled();
    });

    it('answers a charset it cannot read with 415, in words that do not name the parser', () => {
      const filter = new AllExceptionsFilter(true);
      const { host, status, json } = createHost();

      filter.catch(parserError('unsupported charset "LATIN1"', 'charset.unsupported', 415), host);

      expect(status).toHaveBeenCalledWith(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
      const body = json.mock.calls[0]?.[0] as { error: { code: string; message: string } };
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.message).toBe('That format is not supported.');
      expect(reportError).not.toHaveBeenCalled();
    });

    it('still treats an error that merely carries a 4xx status as a 500', () => {
      // An SDK's error from an upstream call is our failure, not the client's.
      const filter = new AllExceptionsFilter(true);
      const { host, status } = createHost();

      filter.catch(Object.assign(new Error('upstream said 400'), { status: 400 }), host);

      expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(reportError).toHaveBeenCalledTimes(1);
    });

    it('still treats the parser’s own server-side failure as a 500', () => {
      const filter = new AllExceptionsFilter(true);
      const { host, status } = createHost();

      filter.catch(parserError('stream is not readable', 'stream.not.readable', 500), host);

      expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(reportError).toHaveBeenCalledTimes(1);
    });
  });
});
