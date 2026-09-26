import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { AuthenticatedActor, TokenAudience } from '@sailent/types';

import { AuthService } from '../../modules/auth/auth.service.js';
import {
  ForbiddenException,
  ReauthRequiredException,
  UnauthenticatedException,
} from '../exceptions.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import {
  AUDIENCE_KEY,
  AUTHENTICATED_ONLY_KEY,
  PERMISSIONS_KEY,
  SENSITIVE_KEY,
} from '../decorators/permissions.decorator.js';

export const ACTOR = Symbol('actor');

export interface RequestWithActor extends Request {
  [ACTOR]?: AuthenticatedActor;
}

/**
 * The authorization chain (decision A9).
 *
 * Order matters and is deliberate:
 *
 *   1. @Public()     — explicitly marked, and every such marking is reviewed.
 *   2. Authenticated — a valid, unexpired, correctly-signed token whose session
 *                      is still live.
 *   3. Audience      — a donor token dies at a staff route HERE, before any
 *                      permission lookup. The two families are not
 *                      interchangeable in either direction (decision A8).
 *   4. Permission    — DENY BY DEFAULT. A route with none of @Public(),
 *                      @AuthenticatedOnly() or a permission requirement is
 *                      unreachable by anyone.
 *   5. Freshness     — @Sensitive() routes additionally require a
 *                      re-authentication within the last five minutes, so a
 *                      session someone walked away from cannot move money or
 *                      grant permissions.
 *
 * That last point is the important one. Forgetting to protect a route produces
 * a 403 for everybody, not an open endpoint — the failure mode is a bug report
 * rather than a breach.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithActor>();
    const token = extractBearer(request);

    const requiredAudience =
      this.reflector.getAllAndOverride<TokenAudience>(AUDIENCE_KEY, targets) ?? 'staff';
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, targets) ?? [];

    if (!token) {
      throw new UnauthenticatedException('You need to sign in to do that.');
    }

    const actor = await this.auth.resolveActor(token, requiredAudience);

    if (!actor) {
      throw new UnauthenticatedException('Your session is not valid. Sign in again.');
    }

    if (!this.auth.matchesAudience(actor, requiredAudience)) {
      throw new ForbiddenException("You don't have access to this.");
    }

    /**
     * Deny by default. No declared permission on a non-public staff route means
     * the route is unreachable — a missing decorator fails closed, so the bug
     * surfaces as a support ticket rather than as an open endpoint.
     *
     * `@AuthenticatedOnly()` is the deliberate, reviewable exception for routes
     * where a valid session genuinely is the whole requirement.
     */
    const authenticatedOnly = this.reflector.getAllAndOverride<boolean>(
      AUTHENTICATED_ONLY_KEY,
      targets,
    );

    if (requiredAudience === 'staff' && requiredPermissions.length === 0 && !authenticatedOnly) {
      throw new ForbiddenException("You don't have access to this.");
    }

    for (const permission of requiredPermissions) {
      if (!this.auth.hasPermission(actor, permission)) {
        throw new ForbiddenException(
          "You don't have access to this. Ask an administrator if you need it.",
        );
      }
    }

    /**
     * Sensitive operations need a FRESH re-authentication, checked last so
     * that a caller who lacks the permission outright is told that, rather
     * than being sent to re-enter a password for something they still
     * could not do.
     */
    if (this.reflector.getAllAndOverride<boolean>(SENSITIVE_KEY, targets)) {
      if (!this.auth.hasFreshReauth(actor)) {
        throw new ReauthRequiredException();
      }
    }

    request[ACTOR] = actor;
    return true;
  }
}

function extractBearer(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}
