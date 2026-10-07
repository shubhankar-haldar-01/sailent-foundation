# Cloud Run configuration (Phase 14)

Templates for the three Google Cloud Run services and a Cloud Build file that
builds and pushes the images. **Nothing here deploys anything on its own**, and
nothing here contains a secret or a project id.

| File | What it is |
|---|---|
| `api.service.yaml` | The API: public, 1–3 instances, startup probe on `/api/v1/health/ready` |
| `web.service.yaml` | The Next.js site: public, 1–5 instances, probes on `/api/health` |
| `worker.service.yaml` | The queue worker: internal, exactly 1 instance, CPU always allocated |
| `cloudbuild.yaml` | Builds and pushes the three images — no deploy step |

The procedure, the variable list, the Secret Manager names, sizing, backups
and rollback are in [`DEPLOYMENT.md`](../../DEPLOYMENT.md) §8 and §11–§21. Every
production action is performed by a human with the owner's approval.

`node --test scripts/check-deploy-config.test.mjs` (from the repo root) checks
these files and the Dockerfiles for the rules they must keep.
