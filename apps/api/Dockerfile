# syntax=docker/dockerfile:1.7
#
# Sailent Foundation API — production image for Google Cloud Run (Phase 14).
#
#   docker build -f apps/api/Dockerfile -t sailent-api .        (from the repo root)
#
# - Multi-stage: dependencies and the TypeScript build stay in `build`; the
#   runtime holds `dist/` and PRODUCTION dependencies only (`pnpm deploy --prod`).
# - Node 22: the API compiles to CommonJS and `require()`s the workspace's ES
#   modules, which needs Node >= 22.12. Pin the image digest when deploying.
# - No configuration is baked in: every variable and secret is supplied by
#   Cloud Run at runtime (DEPLOYMENT.md §15). No `.env` reaches the image
#   (.dockerignore).
# - Never runs migrations or seeds. Those are human-run, separately
#   (DEPLOYMENT.md §9–§10).
# - Runs as the unprivileged `node` user; `node` is PID 1 and receives SIGTERM
#   directly (exec form), which Nest turns into a graceful shutdown.

ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS build
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    TURBO_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /repo

# Dependencies first, from the lockfile alone, so source edits reuse this layer.
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch

COPY . .
RUN pnpm install --frozen-lockfile --offline
# The API and the workspace packages it depends on, from source.
RUN pnpm turbo run build --filter=@sailent/api...
# A self-contained copy with production dependencies only.
RUN pnpm --filter=@sailent/api deploy --prod /out

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_CA_CERT=/app/certs/supabase-prod-ca-2021.crt
WORKDIR /app

COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/dist ./dist
# Supabase's PUBLIC root CA, so the database certificate is verified. Not a secret.
COPY --chown=node:node infrastructure/certs/supabase-prod-ca-2021.crt ./certs/supabase-prod-ca-2021.crt

USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
