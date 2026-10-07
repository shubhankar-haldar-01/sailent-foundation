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

## Deployment targets (Phase 14 — prepared, NOT deployed)

| Service | Target | Why |
|---|---|---|
| `apps/web` | Google Cloud Run `sailent-web` (public) | Request-time rendering; standalone Next.js image |
| `apps/api` | Google Cloud Run `sailent-api` (public) | **Must be a persistent process** — decision A12 depends on a real connection pool and multi-statement transactions |
| `apps/worker` | Google Cloud Run `sailent-worker` (internal, 1 instance, CPU always allocated) | Long-running BullMQ consumer |
| Database | Supabase PostgreSQL | Production runs behind the **session pooler** (port 5432). The transaction pooler on 6543 cannot hold the session state DDL needs, so `db:migrate` refuses it. |
| Cache/queues | Memorystore for Redis (private VPC) | Same protocol as the local container; BullMQ needs `noeviction` |
| Storage | Cloudflare R2 | Two buckets — `sailent-public` and `sailent-private`. Public access is per-bucket, not per-prefix, so there is no third. Credentials go on the **API service only**. |

Images: `apps/*/Dockerfile`. Service templates and the build-only Cloud Build
file: [`cloud-run/`](cloud-run/README.md). The procedures — release, secrets,
sizing, monitoring, backups, rollback — are in `DEPLOYMENT.md` §8 and §11–§21.

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

Nothing in Google Cloud exists yet, and there is no Terraform/Pulumi: the
Cloud Run templates are applied by hand (`DEPLOYMENT.md` §12). Backups and the
restore procedure are documented in `DEPLOYMENT.md` §19 (Supabase backups and
PITR, an independent `pg_dump`, R2 copies, quarterly restore drills) and are
human work — an untested backup is a hypothesis, not a backup.
