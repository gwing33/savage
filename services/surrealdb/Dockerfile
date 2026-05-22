# Thin wrapper around the official SurrealDB image.
#
# Running as root is required so the fly.io volume mounted at /data is
# writable. The official image defaults to uid 65532 (distroless nonroot),
# which cannot write to a root-owned volume mount.
#
# Credentials (SURREAL_USER, SURREAL_PASS) are injected at runtime via
# `fly secrets set` and read by the `start` command as env vars — they never
# appear in the image or in the process list.

FROM surrealdb/surrealdb:latest

USER root

# Storage path is the only thing that must be in CMD.
# SURREAL_USER / SURREAL_PASS come from fly secrets → env vars.
CMD ["start", "--log", "info", "surrealkv:/data/database"]
