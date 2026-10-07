import { Injectable } from '@nestjs/common';

import { apiEnvSchema, type ApiEnv, loadEnv } from '@sailent/config';

/**
 * Typed application configuration.
 *
 * The environment is validated ONCE at boot and frozen. Nothing in the
 * application reads `process.env` directly — a typo in a variable name is
 * then a compile error rather than a silent `undefined` (docs/architecture.md §6).
 */
@Injectable()
export class AppConfig {
  readonly env: ApiEnv;

  constructor() {
    this.env = loadEnv(apiEnvSchema, 'api');
  }

  get isProduction(): boolean {
    return this.env.APP_ENV === 'production';
  }

  get isDevelopment(): boolean {
    return this.env.APP_ENV === 'development';
  }

  /** Cloud Run's `PORT` when set (Phase 14), otherwise `API_PORT`. */
  get port(): number {
    return this.env.PORT ?? this.env.API_PORT;
  }

  /** Database connections per instance (Phase 14: `DATABASE_POOL_MAX`). */
  get databasePoolMax(): number {
    return this.env.DATABASE_POOL_MAX ?? (this.isProduction ? 20 : 5);
  }

  get host(): string {
    return this.env.API_HOST;
  }

  get corsOrigins(): string[] {
    return this.env.CORS_ORIGINS;
  }

  get swaggerEnabled(): boolean {
    return this.env.SWAGGER_ENABLED;
  }

  /**
   * Is demo/mock behaviour on?
   *
   * READ THIS, NEVER `process.env.FEATURE_MOCK_DATA`. The variable is a string
   * and the schema accepts four spellings of it — `true`, `false`, `1`, `0` —
   * so a raw `process.env.FEATURE_MOCK_DATA !== 'false'` test treats the
   * perfectly valid production value `0` as though mock data were ENABLED. That
   * is how the donor OTP logger came to print plaintext codes on a correctly
   * configured production box.
   *
   * `isProduction` is ANDed in as a second, independent floor. The schema
   * already refuses to boot production with this flag on, so the two cannot
   * disagree — which is the point: a future change to one does not quietly
   * unlock the other.
   */
  get mockDataEnabled(): boolean {
    return this.env.FEATURE_MOCK_DATA && !this.isProduction;
  }
}
