import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedActor } from '@sailent/types';

import { ACTOR, AuthGuard } from './auth.guard.js';
import {
  AUDIENCE_KEY,
  AUTHENTICATED_ONLY_KEY,
  PERMISSIONS_KEY,
  SENSITIVE_KEY,
} from '../decorators/permissions.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * The authorization chain is the single most security-relevant piece of code in
 * the API, so it is tested against its failure modes rather than its happy path.
 *
 * The property that matters most: a route nobody remembered to protect must be
 * UNREACHABLE, not open. Every "forgot the decorator" case below asserts a
 * refusal.
 */

type Metadata = Partial<
  Record<
    | typeof IS_PUBLIC_KEY
    | typeof AUDIENCE_KEY
    | typeof PERMISSIONS_KEY
    | typeof SENSITIVE_KEY
    | typeof AUTHENTICATED_ONLY_KEY,
    unknown
  >
>;

function createContext(metadata: Metadata, headers: Record<string, string> = {}) {
  const request: Record<string | symbol, unknown> = { headers };

  const context = {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;

  const reflector = {
    getAllAndOverride: (key: string) => metadata[key as keyof Metadata],
  } as unknown as Reflector;

  return { context, reflector, request };
}

const STAFF_ACTOR: AuthenticatedActor = {
  id: 'user-1',
  audience: 'staff',
  permissions: ['campaign.read', 'content.update'],
  sessionId: 'session-1',
  reauthenticatedAt: null,
};

describe('AuthGuard', () => {
  const resolveActor = vi.fn();

  function auth(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      resolveActor,
      matchesAudience: (actor: AuthenticatedActor | null, required: string) =>
        actor !== null && actor.audience === required,
      hasPermission: (actor: AuthenticatedActor | null, permission: string) =>
        actor?.permissions.includes(permission) ?? false,
      hasFreshReauth: () => false,
      ...overrides,
    } as never;
  }

  beforeEach(() => {
    resolveActor.mockReset().mockResolvedValue(STAFF_ACTOR);
  });

  it('lets a @Public() route through without a token', async () => {
    const { context, reflector } = createContext({ [IS_PUBLIC_KEY]: true });
    await expect(new AuthGuard(reflector, auth()).canActivate(context)).resolves.toBe(true);
    expect(resolveActor).not.toHaveBeenCalled();
  });

  it('REFUSES a staff route that declares no permission — the forgotten-decorator case', async () => {
    // This is the whole point of deny-by-default. A route someone forgot to
    // annotate fails closed, so the bug arrives as a support ticket rather than
    // as an open endpoint nobody noticed for six months.
    const { context, reflector } = createContext(
      { [PERMISSIONS_KEY]: [] },
      { authorization: 'Bearer valid' },
    );

    await expect(new AuthGuard(reflector, auth()).canActivate(context)).rejects.toMatchObject({
      response: { code: 'FORBIDDEN' },
    });
  });

  it('allows a route that declares @AuthenticatedOnly() deliberately', async () => {
    const { context, reflector } = createContext(
      { [PERMISSIONS_KEY]: [], [AUTHENTICATED_ONLY_KEY]: true },
      { authorization: 'Bearer valid' },
    );

    await expect(new AuthGuard(reflector, auth()).canActivate(context)).resolves.toBe(true);
  });

  it('rejects a request with no Authorization header', async () => {
    const { context, reflector } = createContext({ [PERMISSIONS_KEY]: ['campaign.read'] });
    await expect(new AuthGuard(reflector, auth()).canActivate(context)).rejects.toMatchObject({
      response: { code: 'UNAUTHENTICATED' },
    });
  });

  it.each([
    ['a malformed scheme', { authorization: 'Basic abc' }],
    ['an empty bearer', { authorization: 'Bearer ' }],
    ['the literal word Bearer', { authorization: 'Bearer' }],
  ])('rejects %s', async (_label, headers) => {
    const { context, reflector } = createContext({ [PERMISSIONS_KEY]: ['campaign.read'] }, headers);
    await expect(new AuthGuard(reflector, auth()).canActivate(context)).rejects.toMatchObject({
      response: { code: 'UNAUTHENTICATED' },
    });
  });

  it('rejects a token the auth service cannot resolve', async () => {
    resolveActor.mockResolvedValue(null);
    const { context, reflector } = createContext(
      { [PERMISSIONS_KEY]: ['campaign.read'] },
      { authorization: 'Bearer revoked' },
    );

    await expect(new AuthGuard(reflector, auth()).canActivate(context)).rejects.toMatchObject({
      response: { code: 'UNAUTHENTICATED' },
    });
  });

  it('rejects a donor token at a staff route, BEFORE any permission lookup', async () => {
    const hasPermission = vi.fn(() => true);
    resolveActor.mockResolvedValue({ ...STAFF_ACTOR, audience: 'donor' });

    const { context, reflector } = createContext(
      { [PERMISSIONS_KEY]: ['campaign.read'] },
      { authorization: 'Bearer donor-token' },
    );

    await expect(
      new AuthGuard(reflector, auth({ hasPermission })).canActivate(context),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });

    // Order matters: the audience gate must close before permissions are even
    // considered, so the two token families can never be interchanged.
    expect(hasPermission).not.toHaveBeenCalled();
  });

  it('allows a staff actor holding the required permission', async () => {
    const { context, reflector, request } = createContext(
      { [PERMISSIONS_KEY]: ['campaign.read'] },
      { authorization: 'Bearer valid' },
    );

    await expect(new AuthGuard(reflector, auth()).canActivate(context)).resolves.toBe(true);
    // The handler receives the actor only after the whole chain has passed.
    expect(request[ACTOR]).toMatchObject({ id: 'user-1' });
  });

  it('refuses when ANY of several required permissions is missing', async () => {
    const { context, reflector } = createContext(
      { [PERMISSIONS_KEY]: ['campaign.read', 'donation.export'] },
      { authorization: 'Bearer valid' },
    );

    await expect(new AuthGuard(reflector, auth()).canActivate(context)).rejects.toMatchObject({
      response: { code: 'FORBIDDEN' },
    });
  });

  it('requires a FRESH re-authentication for a @Sensitive() route', async () => {
    const { context, reflector } = createContext(
      { [PERMISSIONS_KEY]: ['campaign.read'], [SENSITIVE_KEY]: true },
      { authorization: 'Bearer valid' },
    );

    await expect(new AuthGuard(reflector, auth()).canActivate(context)).rejects.toMatchObject({
      response: { code: 'REAUTH_REQUIRED' },
    });
  });

  it('allows a @Sensitive() route once re-authentication is fresh', async () => {
    const { context, reflector } = createContext(
      { [PERMISSIONS_KEY]: ['campaign.read'], [SENSITIVE_KEY]: true },
      { authorization: 'Bearer valid' },
    );

    await expect(
      new AuthGuard(reflector, auth({ hasFreshReauth: () => true })).canActivate(context),
    ).resolves.toBe(true);
  });

  it('reports a missing permission before asking for a password again', async () => {
    // Sending someone to re-enter their password for an action they could not
    // perform anyway is a small cruelty and a needless password prompt.
    const { context, reflector } = createContext(
      { [PERMISSIONS_KEY]: ['donation.export'], [SENSITIVE_KEY]: true },
      { authorization: 'Bearer valid' },
    );

    await expect(
      new AuthGuard(reflector, auth({ hasFreshReauth: () => true })).canActivate(context),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
  });

  it('defaults to the staff audience when a route does not say', async () => {
    resolveActor.mockResolvedValue({ ...STAFF_ACTOR, audience: 'donor' });
    const { context, reflector } = createContext(
      { [PERMISSIONS_KEY]: ['campaign.read'] },
      { authorization: 'Bearer donor' },
    );

    await expect(new AuthGuard(reflector, auth()).canActivate(context)).rejects.toMatchObject({
      response: { code: 'FORBIDDEN' },
    });
    // The default is the RESTRICTIVE one: omitting @RequireAudience does not
    // quietly widen a route to donors.
    expect(resolveActor).toHaveBeenCalledWith('donor', 'staff');
  });

  it('honours an explicit donor audience', async () => {
    resolveActor.mockResolvedValue({ ...STAFF_ACTOR, audience: 'donor', permissions: [] });
    const { context, reflector } = createContext(
      { [AUDIENCE_KEY]: 'donor' },
      { authorization: 'Bearer donor' },
    );

    // A donor route carries no permissions, and deny-by-default applies only
    // to the staff audience — donors hold no permission strings at all.
    await expect(new AuthGuard(reflector, auth()).canActivate(context)).resolves.toBe(true);
  });
});
