# syntax=docker/dockerfile:1.7
#
# Sailent Foundation worker — production image for Google Cloud Run (Phase 14).
#
#   docker build -f apps/worker/Dockerfile -t sailent-worker .   (from the repo root)
#
# Consumes the BullMQ queues (email, payments) and schedules payment
# reconciliation. It serves only /health and /ready on $PORT, which Cloud Run
# requires; deploy it with CPU always allocated and one minimum instance
# (DEPLOYMENT.md §13).
#
# Same rules as the API image: multi-stage, production dependencies only, no
# configuration or `.env` baked in, no migrations or seeds, unprivileged user,
# `node` as PID 1 so SIGTERM reaches the graceful shutdown in src/main.ts.

ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS build
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    TURBO_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch

COPY . .
RUN pnpm install --frozen-lockfile --offline
RUN pnpm turbo run build --filter=@sailent/worker...
RUN pnpm --filter=@sailent/worker deploy --prod /out

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_CA_CERT=/app/certs/supabase-prod-ca-2021.crt
WORKDIR /app

COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/dist ./dist
COPY --chown=node:node infrastructure/certs/supabase-prod-ca-2021.crt ./certs/supabase-prod-ca-2021.crt

USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
