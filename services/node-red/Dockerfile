# ─────────────────────────────────────────────────────────────────────────────
# Node-RED Service
#
# Base : official Node-RED image (multi-arch, arm64-compatible)
# Adds : node-red-contrib-influxdb – InfluxDB v2 read/write nodes
#
# NOTE: settings.js is NOT copied here.  The /data directory is a Docker
# volume mount (see docker-compose.yml), so any COPY into /data would be
# silently shadowed by the host bind-mount.  Instead, settings.js is mounted
# as a read-only file overlay directly in docker-compose.yml.
# ─────────────────────────────────────────────────────────────────────────────
FROM --platform=linux/arm64 nodered/node-red:latest

# ── Install custom nodes as root, then restore the node-red user ──────────────
# /usr/src/node-red is the app directory — not bind-mounted, so changes here
# survive container restarts and don't get shadowed.
USER root

RUN npm install \
    --unsafe-perm \
    --no-update-notifier \
    --no-fund \
    --prefix /usr/src/node-red \
    node-red-contrib-influxdb

# ── Drop back to the least-privilege user ────────────────────────────────────
USER node-red
