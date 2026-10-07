# syntax=docker/dockerfile:1.7
#
# Sailent Foundation web (Next.js) — production image for Google Cloud Run
# (Phase 14).
#
#   docker build -f apps/web/Dockerfile \
#     --build-arg APP_ENV=production \
#     --build-arg NEXT_PUBLIC_APP_URL=https://<site> \
#     --build-arg MEDIA_PUBLIC_BASE_URL=https://<public media host> \
#     -t sailent-web .                                          (from the repo root)
#
# THREE NON-SECRET VALUES ARE READ AT BUILD TIME, by Next.js itself:
#   APP_ENV                production turns on HSTS and upgrade-insecure-requests
#   NEXT_PUBLIC_APP_URL    inlined into browser code (canonical URLs, origin checks)
#   MEDIA_PUBLIC_BASE_URL  the one remote image host next/image may load
# so a web image belongs to ONE environment. Nothing secret is a build
# argument: INTERNAL_API_SECRET, API_URL and the rest are runtime variables.
#
# THE BUILD NEEDS NO API (Phase 14): content is fetched at request time
# (`scripts/check-web-build-isolation.mjs` proves it).
#
# Runtime: Next's standalone server — only the traced files, no package
# manager, unprivileged user, `node` as PID 1 — started through
# start-standalone.cjs, which refuses to start on an invalid environment.

ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS build
ARG APP_ENV=production
ARG NEXT_PUBLIC_APP_URL
ARG MEDIA_PUBLIC_BASE_URL
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    TURBO_TELEMETRY_DISABLED=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    NEXT_OUTPUT=standalone \
    APP_ENV=${APP_ENV} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    MEDIA_PUBLIC_BASE_URL=${MEDIA_PUBLIC_BASE_URL}
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch

COPY . .
RUN pnpm install --frozen-lockfile --offline
# The workspace packages the web app depends on…
RUN pnpm turbo run build --filter=@sailent/web^...
# …then Next directly, so the build arguments above reach it unfiltered.
RUN pnpm --filter=@sailent/web exec next build

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
# Validates the environment before serving (start-standalone.cjs explains why).
COPY --chown=node:node apps/web/start-standalone.cjs ./apps/web/start-standalone.cjs

USER node
EXPOSE 8080
CMD ["node", "apps/web/start-standalone.cjs"]
