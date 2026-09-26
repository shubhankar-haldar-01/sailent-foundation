import pino from 'pino';

import { type WorkerEnv } from '@sailent/config';

export function createLogger(env: WorkerEnv) {
  return pino({
    level: env.APP_ENV === 'production' ? 'info' : 'debug',
    transport:
      env.APP_ENV === 'development'
        ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'HH:MM:ss' } }
        : undefined,
    base: { service: 'sailent-worker', environment: env.APP_ENV },
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
      ],
      censor: '[redacted]',
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
