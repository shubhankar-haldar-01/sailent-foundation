/**
 * Test identities, with NO side effects.
 *
 * Separate from `harness.ts` because that file asserts a disposable database,
 * rewrites `REDIS_URL` and imports the whole `AppModule` the moment it loads.
 * The global setup needs these two constants before any of that happens, and
 * importing the harness to get them would boot the application inside the
 * setup step.
 *
 * `.test` is reserved by RFC 6761 §6.2 and can never be delegated, so these
 * addresses cannot belong to anybody and cannot be mistaken for a real
 * administrator account.
 */
export const TEST_PASSWORD = 'harness-only-Nb7$kQ2vLx9m';

export const TEST_USERS = {
  superAdmin: 'super-admin@sailent.test',
  staff: 'staff@sailent.test',
} as const;
