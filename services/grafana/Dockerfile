# ─────────────────────────────────────────────────────────────────────────────
# Grafana — fly.io build
#
# Bakes the provisioning directory (datasources + dashboards) into the image
# so that InfluxDB is auto-configured on startup. Credentials are injected at
# runtime via `fly secrets set`.
#
# The /var/lib/grafana volume (dashboards, plugins, sqlite DB) is managed by
# a fly volume mount so it persists across deploys.
# ─────────────────────────────────────────────────────────────────────────────
FROM grafana/grafana:latest

COPY provisioning /etc/grafana/provisioning

EXPOSE 3000
