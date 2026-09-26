import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedActor } from '@sailent/types';

import { ACTOR, type RequestWithActor } from '../guards/auth.guard.js';

/**
 * Inject the authenticated actor into a handler.
 *
 * Only populated after the guard chain has run, so a handler receiving one can
 * rely on it having been authenticated, audience-checked and permission-checked.
 */
export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedActor | undefined => {
    const request = context.switchToHttp().getRequest<RequestWithActor>();
    return request[ACTOR];
  },
);
