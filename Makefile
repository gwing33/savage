# ─────────────────────────────────────────────────────────────────────────────
# savage – Makefile
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: dev clean rebuild logs ps shell-node-red shell-influxdb help

# ── Colours ──────────────────────────────────────────────────────────────────
CYAN  := \033[0;36m
RESET := \033[0m

# Read INFLUX_TOKEN from .env (falls back to the default if .env doesn't exist yet).
# This keeps flows_cred.json in sync with whatever token InfluxDB was initialised with.
INFLUX_TOKEN := $(shell grep -m1 '^INFLUX_TOKEN=' .env 2>/dev/null | cut -d= -f2 | tr -d '"' || echo 'savage-influx-token')

# ── dev ───────────────────────────────────────────────────────────────────────
## Start all services (builds images if needed). Seeds .env on first run.
dev:
	@# Seed .env from the example template if it doesn't exist yet.
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(CYAN)Created .env from .env.example – review credentials before going to production.$(RESET)"; \
	fi
	@# Always sync settings.js into the data dir so config changes take effect.
	@cp services/node-red/settings.js services/node-red/data/settings.js
	@echo "$(CYAN)Synced  settings.js   → services/node-red/data/$(RESET)"
	@# Seed the starter flow only on a fresh data directory (Node-RED owns it after that).
	@if [ ! -f services/node-red/data/flows.json ]; then \
		cp services/node-red/flows.json services/node-red/data/flows.json; \
		echo "$(CYAN)Seeded  flows.json    → services/node-red/data/$(RESET)"; \
	fi
	@# Always regenerate flows_cred.json from the current INFLUX_TOKEN so the
	@# credential file stays in sync with InfluxDB. credentialSecret:false in
	@# settings.js tells Node-RED to read this file as plain JSON (no encryption).
	@printf '{\n  "cfg-influxdb": { "token": "%s" }\n}\n' "$(INFLUX_TOKEN)" \
		> services/node-red/data/flows_cred.json
	@echo "$(CYAN)Generated flows_cred.json (token=$(INFLUX_TOKEN))$(RESET)"
	docker compose up --build -d
	@# Force-restart Node-RED so it re-reads settings.js and flows_cred.json.
	@# `docker compose up` skips restart when only volume contents change.
	@echo "$(CYAN)Restarting Node-RED to apply updated settings and credentials...$(RESET)"
	@docker compose restart node-red
	@echo ""
	@echo "$(CYAN)  Services are starting up:$(RESET)"
	@echo "  Node-RED   →  http://localhost:1880"
	@echo "  Grafana    →  http://localhost:3000  (default: admin / admin)"
	@echo "  InfluxDB   →  http://localhost:8086  (UI + API)"
	@echo "  MQTT       →  localhost:1883  (WebSocket: localhost:9001)"
	@echo ""
	@echo "  Run 'make logs' to tail all service logs."

# ── clean ─────────────────────────────────────────────────────────────────────
## Stop and remove all containers, volumes, and runtime data.
clean:
	docker compose down -v --remove-orphans
	@echo "Removing runtime data from service directories..."
	@rm -rf \
		services/node-red/data/* \
		services/influxdb/data/* \
		services/grafana/data/* \
		services/mosquitto/data/* \
		services/mosquitto/log/*
	@# Restore .gitkeep sentinels so git doesn't remove the directories.
	@touch \
		services/node-red/data/.gitkeep \
		services/influxdb/data/.gitkeep \
		services/grafana/data/.gitkeep \
		services/mosquitto/data/.gitkeep \
		services/mosquitto/log/.gitkeep
	@echo "$(CYAN)Clean complete.$(RESET)"

# ── rebuild ───────────────────────────────────────────────────────────────────
## Full clean + dev cycle (wipes all data and restarts fresh).
rebuild: clean dev

# ── logs ──────────────────────────────────────────────────────────────────────
## Tail logs from all services (Ctrl-C to stop).
logs:
	docker compose logs -f

# ── ps ────────────────────────────────────────────────────────────────────────
## Show status of all savage containers.
ps:
	docker compose ps

# ── shell-node-red ────────────────────────────────────────────────────────────
## Open a shell inside the running Node-RED container.
shell-node-red:
	docker compose exec node-red /bin/sh

# ── shell-influxdb ────────────────────────────────────────────────────────────
## Open the influx CLI inside the running InfluxDB container.
shell-influxdb:
	docker compose exec influxdb influx

# ── help ──────────────────────────────────────────────────────────────────────
## Print this help message.
help:
	@echo ""
	@echo "$(CYAN)savage – available make targets$(RESET)"
	@echo ""
	@echo "  dev              Start all services (builds images if needed)"
	@echo "  clean            Stop containers, remove volumes and all runtime data"
	@echo "  rebuild          Full clean + dev cycle (start fresh)"
	@echo "  logs             Tail logs from all services  (Ctrl-C to stop)"
	@echo "  ps               Show status of all savage containers"
	@echo "  shell-node-red   Open a shell in the Node-RED container"
	@echo "  shell-influxdb   Open the influx CLI in the InfluxDB container"
	@echo "  help             Print this message"
	@echo ""
