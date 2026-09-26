import { Logger } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditService } from './audit.service.js';

/**
 * The audit log is a second copy of the database with weaker access control and
 * a longer retention period. These tests exist to make sure nothing sensitive
 * ever lands in it — and that a logging failure never takes down the operation
 * it was recording.
 */
describe('AuditService', () => {
  const values = vi.fn();
  const insert = vi.fn(() => ({ values }));
  const database = { db: { insert } } as never;

  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    values.mockReset().mockResolvedValue(undefined);
    insert.mockClear();
  });

  function written() {
    return values.mock.calls[0]?.[0] as Record<string, unknown>;
  }

  it('records the actor, action and entity', async () => {
    await new AuditService(database).record({
      action: 'user.suspend',
      entityType: 'user',
      entityId: 'user-2',
      userId: 'user-1',
      reason: 'Left the organisation',
    });

    expect(written()).toMatchObject({
      action: 'user.suspend',
      entityType: 'user',
      entityId: 'user-2',
      userId: 'user-1',
      reason: 'Left the organisation',
      actorType: 'user',
      severity: 'info',
    });
  });

  it.each([
    'password',
    'passwordHash',
    'password_hash',
    'totpSecret',
    'backupCodes',
    'accessToken',
    'refreshToken',
    'tokenHash',
    'codeHash',
    'otp',
    'taxIdNumber',
    'pan',
    'cardNumber',
    'cvv',
  ])('redacts `%s` before it reaches the table', async (key) => {
    await new AuditService(database).record({
      action: 'user.update',
      entityType: 'user',
      newValues: { [key]: 'the-actual-secret', firstName: 'Priya' },
    });

    const row = written();
    expect(JSON.stringify(row.newValues)).not.toContain('the-actual-secret');
    expect((row.newValues as Record<string, unknown>)[key]).toBe('[redacted]');
    // Non-sensitive fields must survive, or the log records nothing useful.
    expect((row.newValues as Record<string, unknown>).firstName).toBe('Priya');
  });

  it('redacts regardless of case, because call sites are inconsistent', async () => {
    await new AuditService(database).record({
      action: 'x',
      entityType: 'user',
      newValues: { PasswordHash: 'secret', TOTPSECRET: 'secret' },
    });

    expect(JSON.stringify(written().newValues)).not.toContain('secret');
  });

  it('redacts inside nested objects', async () => {
    // A diff of a whole record nests. Redacting only the top level would let a
    // hash through in the one shape it is most likely to arrive in.
    await new AuditService(database).record({
      action: 'user.update',
      entityType: 'user',
      oldValues: { profile: { contact: { pan: 'ABCDE1234F' }, name: 'Priya' } },
    });

    const old = written().oldValues as Record<string, Record<string, Record<string, unknown>>>;
    expect(old.profile?.contact?.pan).toBe('[redacted]');
    expect(old.profile?.name).toBe('Priya');
  });

  it('preserves shape so a diff is still readable after redaction', async () => {
    await new AuditService(database).record({
      action: 'x',
      entityType: 'user',
      newValues: { email: 'a@b.org', passwordHash: 'x', roles: ['ADMIN'] },
    });

    expect(Object.keys(written().newValues as object).sort()).toEqual([
      'email',
      'passwordHash',
      'roles',
    ]);
  });

  it('NEVER throws when the insert fails', async () => {
    // Losing a log line is bad. Losing a donation because logging it failed is
    // worse, so this must not roll back the operation it was recording.
    values.mockRejectedValue(new Error('relation "audit_logs" does not exist'));

    await expect(
      new AuditService(database).record({ action: 'donation.capture', entityType: 'donation' }),
    ).resolves.toBeUndefined();
  });

  it('defaults optional fields to null rather than undefined', async () => {
    await new AuditService(database).record({ action: 'x', entityType: 'user' });
    const row = written();

    expect(row.entityId).toBeNull();
    expect(row.oldValues).toBeNull();
    expect(row.newValues).toBeNull();
    expect(row.ipAddress).toBeNull();
  });

  it('carries an explicit severity through', async () => {
    await new AuditService(database).record({
      action: 'user.assign_role',
      entityType: 'user',
      severity: 'critical',
    });
    expect(written().severity).toBe('critical');
  });

  it('exposes no update or delete method at all', () => {
    // Decision A10: an audit trail that can be edited is not one. This asserts
    // the ABSENCE of a write path, which is easy to add back by accident.
    const service = new AuditService(database) as unknown as Record<string, unknown>;
    for (const forbidden of ['update', 'delete', 'remove', 'edit', 'purge']) {
      expect(service[forbidden]).toBeUndefined();
    }
  });
});
