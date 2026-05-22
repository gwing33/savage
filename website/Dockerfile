# syntax=docker/dockerfile:1

# ── Stage 1: install production dependencies ──────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
# --omit=dev strips devDependencies; remix is a production dep so it's kept.
RUN npm ci --omit=dev

# ── Stage 2: lean production image ────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

# node:24-alpine ships with a built-in 'node' user (uid 1000).
# Create the data directory now so it exists even without a volume mount
# (e.g. local `docker run`). When fly.io mounts a volume at /data the mount
# takes precedence, so we chown it in an entrypoint instead.
RUN mkdir -p /data

COPY --from=deps /app/node_modules ./node_modules
# Copy application source (node_modules excluded via .dockerignore)
COPY . .

# Drop to unprivileged user for the runtime process.
RUN chown -R node:node /app /data
USER node

ENV NODE_ENV=production
# Fly.io proxy routes external HTTPS → internal HTTP on this port.
ENV PORT=8080

EXPOSE 8080

# Remix v3 is bundler-free: run source directly via the node-tsx loader.
CMD ["node", "--import", "remix/node-tsx", "server.tsx"]
