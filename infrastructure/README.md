# Infrastructure

## Local development

`docker-compose.yml` provides Postgres 17 and Redis 7. Applications run on the
host for fast feedback.

```bash
pnpm infra:up      # start Postgres + Redis
pnpm infra:down    # stop
pnpm infra:logs    # follow logs
```

Data persists in named volumes. To reset completely:

```bash
docker compose -f infrastructure/docker-compose.yml down -v
```

## Deployment targets

| Service | Target | Why |
|---|---|---|
| `apps/web` | Vercel | Edge network and image optimisation suit a photography-led public site |
| `apps/api` | Render / Railway | **Must be a persistent process** — decision A12 depends on a real connection pool and multi-statement transactions |
| `apps/worker` | Render / Railway | Long-running BullMQ consumer |
| Database | Supabase PostgreSQL | Production runs behind the **session pooler** (port 5432). The transaction pooler on 6543 cannot hold the session state DDL needs, so `db:migrate` refuses it. |
| Cache/queues | Upstash Redis | Managed, and the same protocol as the local container |
| Storage | Cloudflare R2 | Two buckets — `sailent-public` and `sailent-private`. Public access is per-bucket, not per-prefix, so there is no third. Credentials go on the **API service only**. |

**Do not move the API to serverless functions.** The HTTP serverless driver
cannot run multi-statement transactions, which would make the donation-capture
concurrency design in decision A6 impossible.

## Databases, per environment

| Environment | Variable | Database |
|---|---|---|
| Development | `DATABASE_URL` | `localhost:5432/sailent_dev` |
| API tests | `TEST_DATABASE_URL` | `localhost:5432/sailent_dev` |
| E2E | `E2E_DATABASE_URL` | `localhost:5432/sailent_e2e` |
| Production | `DATABASE_URL` | Supabase session pooler, configured in the production runtime only |

The application refuses to start when `APP_ENV` and `DATABASE_URL` disagree —
see `docs/environment.md`. **The production URL never belongs in a local
`.env`.**

## Not yet provisioned

Terraform/Pulumi definitions, backup automation, and the restore runbook land
alongside the modules that need them. Phase 0 specifies a 30-day PITR window,
daily logical backups to a separate region, and **quarterly restore tests** —
an untested backup is a hypothesis, not a backup.
