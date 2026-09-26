# Backend development

How the NestJS API is put together, and how to add to it without breaking the guarantees the rest of the platform depends on.

For the endpoint map and REST conventions, see [`api-development.md`](api-development.md). For authentication and authorization specifically, see [`authentication.md`](authentication.md) and [`rbac-implementation.md`](rbac-implementation.md).

---

## 1. Shape

A **modular monolith** (decision A1). One deployable process, organised into modules that own their own slice of the domain and talk to each other through services rather than HTTP.

This is a deliberate choice, not a stage on the way to microservices. Capturing a donation has to atomically write the donation, its line items, the payment record and the campaign's derived counter. In one process that is a transaction. Across services it is a distributed transaction, which is a saga, a compensation path and a class of bug that only appears under load — bought for an NGO platform that will run comfortably on one container.

```
apps/api/src/
├── main.ts                 bootstrap: helmet, CORS, prefix, filters, Swagger
├── app.module.ts           module graph + the two global guards
├── config/                 typed, validated environment
├── common/                 the cross-cutting contract
│   ├── decorators/         @Public, @RequirePermission, @Sensitive, @CurrentActor
│   ├── dto/                pagination, sorting, the sort allow-list
│   ├── filters/            the single exception filter
│   ├── guards/             the authorization chain
│   ├── interceptors/       the response envelope
│   ├── middleware/         request id
│   ├── pipes/              Zod validation
│   └── exceptions.ts       domain exceptions with stable codes
└── modules/
    ├── database/           the Drizzle client, provided as DATABASE
    ├── redis/              connection + cache with a lock
    ├── queue/              BullMQ producers
    ├── auth/               sessions, tokens, TOTP, passwords
    ├── audit/              append-only audit log
    ├── content/            the public read API
    ├── users/              staff accounts, roles, permissions
    └── health/             liveness and readiness
```

---

## 2. Cross-cutting behaviour, and where it lives

Each of these is implemented **once**, globally. The pattern to follow when adding a module is to rely on them rather than to re-implement them locally.

### The response envelope

`ResponseInterceptor` wraps every successful response:

```json
{ "success": true, "data": … , "meta": { "requestId": "…" } }
```

`AllExceptionsFilter` wraps every failure in the mirror shape, with a stable `code`. A handler therefore returns its data and nothing else — no wrapping, no status juggling.

Two rules the filter enforces:

1. Every error carries the `requestId`, which correlates the response a user is looking at with the log line, the Sentry event and the audit row.
2. In production a 5xx message is always generic. The real one may contain a connection string, a query or a file path.

It also rewrites framework phrasing. `ThrottlerException: Too Many Requests` is accurate and useless: a donor does not know what a throttler is, and the class name is our implementation detail.

### Validation

One pipe, `ZodValidationPipe`, using the **same schemas from `@sailent/validation` that the web app validates with**. The client validates for a fast, humane experience; the server validates because the client cannot be trusted. Sharing the schema is what stops the two disagreeing about what is valid.

Zod strips undeclared keys, which makes mass assignment a non-issue: a client that posts `{"status":"active","passwordHash":"…"}` to the invite endpoint has both fields discarded before the handler sees the body. `test/rbac.spec.ts` asserts this.

Errors are reported per field, all at once. One problem at a time turns form completion into a guessing game.

### Pagination and sorting

`common/dto/pagination.dto.ts`. `limit` is capped at **100** by the schema, and a request above it is *rejected* rather than clamped — clamping lets a caller believe they asked for 5000 and got it.

Sorting goes through an **allow-list**:

```ts
const USER_SORT_COLUMNS = { createdAt: users.createdAt, email: users.email, … } as const;
const { column, direction } = resolveSort(query.sort, USER_SORT_COLUMNS, 'createdAt');
```

Never interpolate a column name from a request into SQL. Anything not on the list falls back to the default, so `?sort=-passwordHash` and `?sort=-notacolumn` return byte-identical responses and a caller cannot probe the schema by guessing.

### Logging and redaction

Pino, via `nestjs-pino`, with the redaction list declared once in `app.module.ts`: authorization headers, cookies, webhook signatures, passwords, tokens, OTP codes, PAN, donor email and phone. Enforced centrally rather than at each call site, because the one call site that forgets is the one that matters.

Health probes are excluded from request logging or they dominate the volume.

### Auditing

`AuditService.record()` writes the actor, action, entity, before/after diff, reason, IP, user agent and severity. Two properties are load-bearing:

- **It never throws.** An audit failure must not roll back the operation it was recording. Losing a log line is bad; losing a donation because logging it failed is worse.
- **It redacts at write time**, from a central key list, recursively. A reader with `audit.read` cannot recover a password hash or a PAN from the log because the value was never stored.

There is no `update` or `delete` method on the service, and there never will be (decision A10). A unit test asserts their absence.

---

## 3. Adding a module

1. `modules/<name>/` with `<name>.module.ts`, `<name>.service.ts`, `<name>.controller.ts`, `dto/<name>.dto.ts`.
2. Inject the database with `@Inject(DATABASE) private readonly database: DatabaseClient`.
3. Register the module in `app.module.ts`.
4. Every route gets **either** `@Public()` **or** `@RequirePermission(…)`. A staff route with neither is unreachable — see [`rbac-implementation.md`](rbac-implementation.md).
5. Document it: `@ApiTags`, `@ApiOperation`, `@ApiResponse` for each status the route actually returns.
6. Project columns **explicitly**. Do not `select()` a whole row and delete fields afterwards; the delete is the step someone forgets.

That last point is worth a concrete pattern. `UsersService` defines its projection once:

```ts
const PUBLIC_USER_COLUMNS = {
  id: users.id, email: users.email, firstName: users.firstName, …
} as const;   // no passwordHash, no totpSecret, no backupCodes
```

Every query in the service goes through it, so a secret cannot reach a response by someone adding a query that forgets to strip it — the column is simply not in the shape.

---

## 4. Redis and queues

`CacheService` **fails open**: a Redis outage degrades to slower responses, not to an error page. `withLock` **fails closed**: if the lock cannot be acquired, the work does not run. Caching is an optimisation; a lock is a correctness control, and they must fail in opposite directions.

Locks release with a Lua compare-and-delete so a slow holder cannot delete a lock that has since been acquired by someone else.

Queues are BullMQ. The API is a **producer only** — it enqueues and returns. The worker (`apps/worker`) consumes. Nothing in a request path waits for a job.

---

## 5. Configuration

`AppConfig` parses `process.env` through a Zod schema at boot and **refuses to start** if a required variable is missing or malformed. A misconfigured process that starts and fails later, under load, in production, is the worse outcome.

Two things worth knowing:

- Blank variables (`KEY=`) parse as `''`, which is not nullish. The config uses an `optional()` helper that maps `''` to `undefined`, and `||` rather than `??` where blank means unset.
- `FEATURE_MOCK_DATA` **cannot be enabled in production**. The schema rejects it. That refusal is what makes the web app's development fallback safe.

---

## 6. Testing

```bash
pnpm --filter @sailent/api test
```

184 tests: unit specs beside the code, integration specs in `apps/api/test/` running the **real application against real Postgres and Redis**.

Two things about the integration harness are worth knowing before you add to it.

**Rate limiting is off by default.** Login is capped at five attempts a minute; a suite exercising authorization needs more sessions than that. `createTestApp()` replaces the throttler's *storage* — `overrideGuard(ThrottlerGuard)` looks like the obvious move and silently does nothing, because the guard is bound through the `APP_GUARD` token and the override matches on the class token. The limits themselves are proven in `test/rate-limit.spec.ts`, which passes `{ throttling: true }`.

**Vitest needs the SWC transform.** `vitest.config.ts` uses `unplugin-swc` because esbuild does not implement `emitDecoratorMetadata`, without which Nest cannot resolve a constructor dependency from its type and every DI test fails with an error that looks like a broken test rather than a broken transform.

---

## 7. Running it

```bash
pnpm --filter @sailent/api dev     # watch mode
pnpm --filter @sailent/api build && pnpm --filter @sailent/api start
```

- API: `http://localhost:4000/api/v1`
- OpenAPI: `http://localhost:4000/api/v1/docs`
- Readiness: `http://localhost:4000/api/v1/health/ready`
