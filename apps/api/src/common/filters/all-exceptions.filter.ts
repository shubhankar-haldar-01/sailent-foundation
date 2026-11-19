import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { API_ERROR_CODE, type ApiError, type ApiErrorDetail } from '@sailent/types';

import { AppException } from '../exceptions.js';
import { REQUEST_ID } from '../middleware/request-id.middleware.js';
import { reportError } from '../observability/error-reporting.js';

/**
 * Global exception filter.
 *
 * Two rules govern everything here:
 *   1. Every error leaves as the same envelope, carrying the requestId that
 *      correlates to the logs, Sentry (5xx only, scrubbed — Phase 14) and the
 *      audit trail.
 *   2. Internal detail NEVER reaches the client in production. A stack trace
 *      or a database message tells an attacker about our schema and tells a
 *      donor nothing useful.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request as Request & { [REQUEST_ID]?: string })[REQUEST_ID] ?? 'unknown';

    const { status, code, message, details } = this.normalise(exception);

    // Log the full detail internally, always — including the stack.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        {
          requestId,
          method: request.method,
          path: request.url,
          status,
          code,
          err:
            exception instanceof Error
              ? { message: exception.message, stack: exception.stack }
              : exception,
        },
        'Unhandled exception',
      );
      // Phase 14: to Sentry when configured, scrubbed. Path only, no query.
      reportError(exception, {
        tags: {
          requestId,
          method: request.method,
          route: (request.originalUrl ?? request.url).split('?')[0] ?? '',
          status,
          errorCode: code,
        },
      });
    } else {
      this.logger.warn(
        { requestId, method: request.method, path: request.url, status, code },
        message,
      );
    }

    const body: ApiError = {
      success: false,
      error: {
        code,
        // In production a 5xx is always the generic message: the real one may
        // contain a connection string, a query or a file path.
        message:
          this.isProduction && status >= HttpStatus.INTERNAL_SERVER_ERROR
            ? 'Something went wrong on our side. Please try again.'
            : message,
        ...(details ? { details } : {}),
        requestId,
      },
    };

    response.status(status).json(body);
  }

  private normalise(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  } {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (isRequestBodyError(exception)) {
      return {
        status: exception.status,
        code: API_ERROR_CODE.VALIDATION_FAILED,
        message: requestBodyMessage(exception),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const raw =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ?? exception.message);

      const message = Array.isArray(raw) ? raw.join(', ') : raw;

      return {
        status,
        code: statusToCode(status),
        // Framework exceptions carry framework wording. `ThrottlerException:
        // Too Many Requests` is accurate and useless — a donor does not know
        // what a throttler is, and the class name is our implementation detail.
        message: humanise(status, message),
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: API_ERROR_CODE.INTERNAL_ERROR,
      message: exception instanceof Error ? exception.message : 'Unexpected error',
    };
  }
}

/**
 * The body parser's refusals: a body that is too large, or in a charset or
 * encoding it does not read. (Broken JSON never gets here: Nest turns the
 * parser's SyntaxError into a 400 itself.)
 *
 * They are `http-errors` objects, not `HttpException`s, and Nest routes them
 * through this filter. Without this branch every one became a 500, logged as a
 * crash and sent to error tracking, so anyone could flood error tracking with
 * one oversized request after another and bury the real incidents. It also
 * told a client that sent a bad body that the server had failed.
 *
 * Recognised narrowly: an `Error` carrying the parser's `type`, marked safe to
 * expose, with a 4xx status. A library error that merely has a `status` field
 * (an SDK's error from an upstream call, say) is still a 500.
 */
interface RequestBodyError extends Error {
  type: string;
  expose: true;
  status: number;
}

function isRequestBodyError(exception: unknown): exception is RequestBodyError {
  if (!(exception instanceof Error)) return false;
  const candidate = exception as Partial<RequestBodyError>;
  return (
    typeof candidate.type === 'string' &&
    candidate.expose === true &&
    typeof candidate.status === 'number' &&
    candidate.status >= 400 &&
    candidate.status < 500
  );
}

/** The parser's own wording ("request entity too large") is not for a person. */
function requestBodyMessage(exception: RequestBodyError): string {
  if (exception.status === HttpStatus.PAYLOAD_TOO_LARGE) return 'That request is too large.';
  if (exception.status === HttpStatus.UNSUPPORTED_MEDIA_TYPE)
    return 'That format is not supported.';
  return 'The request could not be read.';
}

/**
 * Replace framework phrasing with something a person can act on.
 *
 * Only applied to exceptions raised by Nest itself — our own `AppException`
 * messages are written for the reader already and pass through untouched.
 */
function humanise(status: number, message: string): string {
  if (/^\w*(Exception|Error):/.test(message) || message === 'Too Many Requests') {
    switch (status) {
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Too many requests. Please wait a moment and try again.';
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return 'That file is too large.';
      case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
        return 'That format is not supported.';
      default:
        return message.replace(/^\w*(Exception|Error):\s*/, '');
    }
  }
  return message;
}

function statusToCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return API_ERROR_CODE.VALIDATION_FAILED;
    case HttpStatus.UNAUTHORIZED:
      return API_ERROR_CODE.UNAUTHENTICATED;
    case HttpStatus.FORBIDDEN:
      return API_ERROR_CODE.FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      return API_ERROR_CODE.NOT_FOUND;
    case HttpStatus.CONFLICT:
      return API_ERROR_CODE.CONFLICT;
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return API_ERROR_CODE.VALIDATION_FAILED;
    case HttpStatus.TOO_MANY_REQUESTS:
      return API_ERROR_CODE.RATE_LIMITED;
    case HttpStatus.SERVICE_UNAVAILABLE:
      return API_ERROR_CODE.SERVICE_UNAVAILABLE;
    default:
      return API_ERROR_CODE.INTERNAL_ERROR;
  }
}
