import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';
import type { Request } from 'express';

import type { ApiSuccess } from '@sailent/types';

import { getRequestId } from '../middleware/request-id.middleware.js';
import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator.js';

/**
 * Wraps every successful response in the standard envelope.
 *
 * Handlers return plain data; this adds `{ success: true, data }`. A handler
 * that returns `{ data, meta }` has its meta lifted into the envelope so
 * pagination does not end up nested inside `data`.
 *
 * `@RawResponse()` opts out — required for the Razorpay webhook endpoint,
 * which must reply with exactly what the provider expects, and for any future
 * file stream.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isRaw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isRaw) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      map((payload: unknown): ApiSuccess<unknown> => {
        if (isEnvelopeShaped(payload)) {
          return { success: true, data: payload.data, meta: payload.meta };
        }
        return { success: true, data: payload ?? null, meta: { requestId: getRequestId(request) } };
      }),
    );
  }
}

function isEnvelopeShaped(
  payload: unknown,
): payload is { data: unknown; meta: Record<string, unknown> } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'data' in payload &&
    'meta' in payload &&
    Object.keys(payload).length === 2
  );
}
