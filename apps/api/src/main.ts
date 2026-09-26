import 'reflect-metadata';

import { loadRootEnvFile } from '@sailent/config/dotenv';

// Must run before any module reads the environment, so it sits above the other
// imports by intent. In production this is a no-op — the platform injects vars.
loadRootEnvFile();

import { Logger as NestLogger, VersioningType } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';

import { API_PREFIX } from '@sailent/config';

import { AppModule } from './app.module.js';
import { AppConfig } from './config/app.config.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // The raw body is retained so the Razorpay webhook (Phase 5) can verify its
    // HMAC signature against the EXACT bytes received. Re-serialising parsed
    // JSON changes the byte sequence and the signature will not match — this
    // has to be set at bootstrap, not retrofitted (decision A4).
    rawBody: true,
  });

  const config = app.get(AppConfig);
  app.useLogger(app.get(Logger));

  // ---- Security headers ----------------------------------------------------
  app.use(
    helmet({
      // The API serves JSON, not documents; a page CSP belongs on the web app.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: config.isProduction
        ? { maxAge: 63_072_000, includeSubDomains: true, preload: true }
        : false,
    }),
  );

  // ---- CORS ----------------------------------------------------------------
  // Closed to browser origins by design: the only callers are the Next.js
  // server, the worker, and Razorpay's webhook (decision A1).
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'Idempotency-Key'],
    exposedHeaders: ['x-request-id'],
    maxAge: 86_400,
  });

  // ---- Routing -------------------------------------------------------------
  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: false as never });

  // ---- Cross-cutting -------------------------------------------------------
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new AllExceptionsFilter(config.isProduction));
  app.enableShutdownHooks();

  // ---- OpenAPI -------------------------------------------------------------
  if (config.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Sailent Foundation API')
        .setDescription(
          'REST API for the Sailent Foundation platform. ' +
            'Consumed server-side by the Next.js BFF, by the worker, and by payment webhooks. ' +
            'The browser never calls this API directly (decision A1).',
        )
        .setVersion('1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'staff')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'donor')
        .addTag('public', 'Published content. No authentication, no private fields.')
        .addTag('auth', 'Staff and donor sessions, token rotation, re-authentication')
        .addTag('admin: users', 'Staff accounts, roles and the permission catalogue')
        .addTag('admin: audit', 'The append-only audit log, read-only')
        .addTag('health', 'Liveness and readiness probes')
        .addTag('development', 'Development-only utilities. Refused in production.')
        .build(),
    );
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(config.port, config.host);

  const logger = new NestLogger('Bootstrap');
  logger.log(`API listening on http://${config.host}:${config.port}/${API_PREFIX}`);
  if (config.swaggerEnabled) {
    logger.log(`OpenAPI docs at http://${config.host}:${config.port}/${API_PREFIX}/docs`);
  }
}

bootstrap().catch((error: unknown) => {
  console.error('[api] failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
