import { Global, Logger, Module, type OnModuleDestroy } from '@nestjs/common';

import {
  announceConnection,
  assertRuntimeDatabaseTarget,
  createDatabaseClient,
  describeRuntimeTarget,
  type DatabaseClient,
} from '@sailent/database';

import { AppConfig } from '../../config/app.config.js';

export const DATABASE = Symbol('DATABASE');

/**
 * Database module.
 *
 * Provides one pooled client for the whole process (decision A12). The pool is
 * created at boot and closed on shutdown so a redeploy does not strand
 * connections against the provider's ceiling.
 */
@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [AppConfig],
      useFactory: (config: AppConfig): DatabaseClient => {
        /*
          ══════════════════════════════════════════════════════════════════
          DOES `APP_ENV` AGREE WITH THE DATABASE? Asked BEFORE the client is
          built, so an unsafe pairing stops the boot instead of serving.

          This is not hypothetical. A local `.env` held the production Supabase
          URL while `APP_ENV=development`; the API started, served, and wrote
          to production, and a draft written in a local admin UI landed in the
          live database. Nothing was wrong with either value alone — only with
          the two of them together, which is the one thing no single-value
          check can see.

          It throws rather than correcting the URL: connecting somewhere the
          operator did not configure is the same surprise in the other
          direction. The message carries host, database and environment, and
          never the connection string.
          ══════════════════════════════════════════════════════════════════
        */
        const target = assertRuntimeDatabaseTarget({
          appEnv: config.env.APP_ENV,
          connectionString: config.env.DATABASE_URL,
        });

        new Logger('Database').log(`Target ${describeRuntimeTarget(target, config.env.APP_ENV)}`);

        const client = createDatabaseClient({
          connectionString: config.env.DATABASE_URL,
          /**
           * Pool size.
           *
           * Kept well under the provider's ceiling because the ceiling is
           * shared. Supabase's session pooler allows far more client
           * connections than a direct one, but they are still finite and the
           * worker holds its own pool — two processes at 20 each is the number
           * that matters, not 20.
           */
          maxConnections: config.isProduction ? 20 : 5,
          // Statement logging can contain PII, so it is development-only.
          logger: config.isDevelopment,
          insecureTls: config.env.DATABASE_INSECURE_TLS,
        });

        /**
         * Say what we connected to, and whether it answered.
         *
         * ══════════════════════════════════════════════════════════════════
         * This used to log `Connected to …` right here, which was not true.
         * `new pg.Pool()` is LAZY — nothing has been dialled at this point — so
         * the line printed identically with a wrong password, an unreachable
         * host or a rejected certificate, and the real failure surfaced later
         * as a 500 on the first request.
         *
         * `announceConnection` pings first and reports what actually happened.
         *
         * NOT AWAITED. Blocking the factory would hold the whole boot on a
         * round trip that takes half a second to a pooler in another region,
         * and would make an unreachable database stop the health endpoint from
         * ever existing — which is precisely what the platform reads to decide
         * whether to send traffic. The report lands a moment after boot; the
         * readiness check is the thing that gates traffic.
         * ══════════════════════════════════════════════════════════════════
         */
        const logger = new Logger('Database');
        void announceConnection(client, {
          info: (message) => logger.log(message),
          warn: (message) => logger.warn(message),
          error: (message) => logger.error(message),
        });

        return client;
      },
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor() {}

  async onModuleDestroy(): Promise<void> {
    // The client is disposed by the Nest container via the provider below.
  }
}
