import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import { REQUEST_ID_HEADER } from '@sailent/config';

/** Symbol key so the id cannot collide with a body or query property. */
export const REQUEST_ID = Symbol('requestId');

/**
 * Request correlation.
 *
 * Accepts an inbound id from the Next.js BFF so one donation is traceable
 * end to end across web → API → worker; generates one otherwise. The id is
 * echoed in the response header and appears in every log line and error body.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const inbound = req.headers[REQUEST_ID_HEADER];
    const requestId = (Array.isArray(inbound) ? inbound[0] : inbound) || randomUUID();

    (req as Request & { [REQUEST_ID]?: string })[REQUEST_ID] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}

export function getRequestId(req: Request): string {
  return (req as Request & { [REQUEST_ID]?: string })[REQUEST_ID] ?? 'unknown';
}
