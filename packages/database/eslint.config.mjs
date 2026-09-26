import config from '@sailent/config/eslint/node';

export default [
  ...config,
  {
    /**
     * The CLI scripts print for a living.
     *
     * `no-console` is right for library and server code, where a stray print
     * bypasses the logger and its redaction. A seed or migration script is a
     * command a person runs and watches: its stdout IS its interface, and
     * routing that through a structured logger would make it worse, not safer.
     */
    files: [
      'src/seed/**/*.ts',
      'src/migrate.ts',
      'src/harden.ts',
      'src/create-admin.ts',
      'src/prepare-e2e.ts',
      'src/rotate-admin-password.ts',
      'src/drizzle-guarded.ts',
    ],
    rules: { 'no-console': 'off' },
  },
];
