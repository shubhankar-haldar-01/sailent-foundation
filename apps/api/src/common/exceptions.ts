import { HttpException, HttpStatus } from '@nestjs/common';

import { API_ERROR_CODE, type ApiErrorCode, type ApiErrorDetail } from '@sailent/types';

/**
 * Domain exception.
 *
 * Carries a STABLE machine-readable code the client branches on, plus a
 * human-safe message. Throwing this rather than a bare HttpException is what
 * lets the exception filter produce a consistent envelope without guessing.
 */
export class AppException extends HttpException {
  constructor(
    readonly code: ApiErrorCode | string,
    message: string,
    status: HttpStatus,
    readonly details?: ApiErrorDetail[],
  ) {
    super({ code, message, details }, status);
  }
}

export class ValidationException extends AppException {
  constructor(details: ApiErrorDetail[], message = 'The submitted data is not valid.') {
    super(API_ERROR_CODE.VALIDATION_FAILED, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

export class UnauthenticatedException extends AppException {
  constructor(message = 'You need to sign in to do that.') {
    super(API_ERROR_CODE.UNAUTHENTICATED, message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenException extends AppException {
  /**
   * Deliberately says "you do not have access" rather than returning a 404.
   * A 404 that pretends the record does not exist wastes an operator's
   * afternoon (docs/design-system.md §7).
   */
  constructor(message = "You don't have access to this.") {
    super(API_ERROR_CODE.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }
}

/**
 * 403 with a different meaning: the permission is held, the session is stale.
 *
 * The client's correct response is to collect the password again and retry —
 * so it must be able to tell this apart from a flat refusal.
 */
export class ReauthRequiredException extends AppException {
  constructor(message = 'Confirm your password to continue. This action needs a recent sign-in.') {
    super(API_ERROR_CODE.REAUTH_REQUIRED, message, HttpStatus.FORBIDDEN);
  }
}

export class NotFoundException extends AppException {
  constructor(resource = 'Resource', message?: string) {
    super(API_ERROR_CODE.NOT_FOUND, message ?? `${resource} was not found.`, HttpStatus.NOT_FOUND);
  }
}

export class ConflictException extends AppException {
  constructor(message = 'That conflicts with the current state of the record.') {
    super(API_ERROR_CODE.CONFLICT, message, HttpStatus.CONFLICT);
  }
}

/**
 * A DEPENDENCY we need is unreachable or refused us — not the caller's fault.
 *
 * 503, not 500: the request may well succeed on a retry, and the difference
 * matters to a donor being told whether to try again. Every message returned
 * through this says explicitly whether money was taken, because that is the
 * only question the person on the other end has.
 */
export class ServiceUnavailableException extends AppException {
  constructor(message = 'That service is temporarily unavailable. Please try again shortly.') {
    super(API_ERROR_CODE.SERVICE_UNAVAILABLE, message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

export class RateLimitException extends AppException {
  constructor(message = 'Too many requests. Please wait a moment and try again.') {
    super(API_ERROR_CODE.RATE_LIMITED, message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
