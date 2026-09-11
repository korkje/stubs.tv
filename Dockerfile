# syntax=docker/dockerfile:1
# Self-hosting image (ADR-0021, docs/SELF-HOSTING.md). Build from the repo
# root: `docker compose build` or
#   docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=… \
#                --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=… -t stubs-web .
#
# The three build args are baked into the bundle by Next (NEXT_PUBLIC_*
# values are inlined; SELF_HOSTED is read by prerendered pages), so the
# image is built per instance rather than pulled prebuilt.

FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- dependencies: only the manifests, so this layer caches across edits
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/metadata/package.json packages/metadata/
COPY packages/tvtime-import/package.json packages/tvtime-import/
RUN npm ci

# --- build
FROM base AS build
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG SELF_HOSTED=true
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    SELF_HOSTED=$SELF_HOSTED
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build -w web

# --- runtime: the standalone trace only, as the unprivileged node user
FROM base AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
