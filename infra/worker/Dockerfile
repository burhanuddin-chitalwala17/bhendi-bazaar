# The worker's image (worker-foundation trd D7, ADR-0038 D3, D5).
#
# One stage installs from the lockfile and generates the Prisma client; the runtime stage
# carries only what `worker/main.ts` reaches — server/, prisma/ and node_modules — and runs it
# with tsx, the same way `npm run worker` does on a laptop. No web app, no build step, no host
# name anywhere in here: the machine is a deployment fact (ADR-0037).
# Installs natively, picking the target's native packages by --cpu (QEMU took 8.5 min); safe since no
# install script runs and the Prisma client is WebAssembly (docs/OPERATIONS.md).
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS deps
ARG TARGETARCH
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# `postinstall` runs `prisma generate`, and prisma.config.ts refuses to load without a database
# URL. A placeholder satisfies the loader; nothing connects at build time.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN cpu=$([ "$TARGETARCH" = amd64 ] && echo x64 || echo "$TARGETARCH") \
  && npm ci --ignore-scripts --os=linux --cpu="$cpu" && npx prisma generate

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# ffmpeg transcodes hosted video (ADR-0039, video-hosting trd D3): an OS package, pinned by the
# Debian release, not an npm dependency.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates ffmpeg && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY server ./server
COPY worker ./worker
# Stamped by CI with the image tag; the heartbeat reports it (spec R5).
ARG WORKER_VERSION=dev
ENV WORKER_VERSION=$WORKER_VERSION
USER node
CMD ["node", "--import", "tsx", "worker/main.ts"]
