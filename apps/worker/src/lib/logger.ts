import pino from 'pino';

import { cloudLoggingSeverity, type WorkerEnv } from '@sailent/config';

export function createLogger(env: WorkerEnv) {
  return pino({
    level: env.APP_ENV === 'production' ? 'info' : 'debug',
    transport:
      env.APP_ENV === 'development'
        ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'HH:MM:ss' } }
        : undefined,
    base: { service: 'sailent-worker', environment: env.APP_ENV },
    // Cloud Logging reads `severity` (Phase 14). Not with pino-pretty.
    ...(env.APP_ENV === 'development'
      ? {}
      : {
          formatters: {
            level: (label: string, number: number) => ({
              level: number,
              severity: cloudLoggingSeverity(label),
            }),
          },
        }),
    // Same redaction contract as the API: secrets and donor PII never reach a log.
    redact: {
      paths: [
        '*.password',
        '*.token',
        '*.accessToken',
        '*.refreshToken',
        '*.taxIdNumber',
        '*.otp',
        '*.phone',
        '*.email',
        '*.secret',
        '*.confirmToken',
        '*.unsubscribeToken',
      ],
      censor: '[redacted]',
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
