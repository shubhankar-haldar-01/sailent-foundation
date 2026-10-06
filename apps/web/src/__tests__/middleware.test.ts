import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { middleware } from '../middleware';

const visit = (path: string, cookie?: string) =>
  middleware(
    new NextRequest(`http://localhost:3000${path}`, {
      headers: cookie ? { cookie: `${cookie}=x` } : {},
    }),
  );

/**
 * Phase 13: the invitation and password pages are reached by somebody who
 * cannot sign in yet, so they must not bounce to sign-in — and nothing else
 * under /admin may become reachable without a session.
 */
describe('middleware', () => {
  it.each([
    '/admin/accept-invite',
    '/admin/forgot-password',
    '/admin/reset-password',
    '/admin/login',
  ])('%s is reachable without a session', (path) => {
    expect(visit(path).headers.get('location')).toBeNull();
  });

  it.each(['/admin', '/admin/messages', '/admin/accept-invite-x', '/admin/reset-password/extra'])(
    '%s still needs a session',
    (path) => {
      expect(visit(path).headers.get('location')).toContain('/admin/login');
    },
  );

  it('lets a signed-in staff member through', () => {
    expect(visit('/admin/messages', 'sailent_staff_session').headers.get('location')).toBeNull();
  });
});
