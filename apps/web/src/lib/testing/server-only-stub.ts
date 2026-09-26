/**
 * A stand-in for `server-only` under vitest.
 *
 * `server-only` exists to make a CLIENT bundle fail if it imports a server
 * module. Vitest is neither, and cannot resolve the real package, so a module
 * carrying the guard is untestable without this.
 *
 * Empty on purpose: the guard's whole behaviour is to exist or not resolve.
 * It is wired up only in `vitest.config.ts`, so production resolution — and
 * therefore the guarantee — is unchanged.
 */
export {};
