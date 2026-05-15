# ─────────────────────────────────────────────────────────────────────────────
# savage – Makefile
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: dev clean rebuild logs ps shell-node-red shell-influxdb help

# ── Colours ──────────────────────────────────────────────────────────────────
CYAN  := \033[0;36m
RESET := \033[0m

# Read credentials from .env. Uses recursive `=` (not `:=`) so the values are
# re-evaluated AFTER the .env seed step runs inside the `dev` recipe — otherwise
# they'd be locked in at make startup, before .env exists on a fresh checkout.
# There are deliberately NO silent fallback defaults here: an empty value triggers
# a hard failure in the validation step below (paired with the `${VAR:?}` strict
# refs in docker-compose.yml). The whole point is that a missing or partial .env
# fails loudly instead of silently coming up with documented "default" creds.
INFLUX_TOKEN = $(shell grep -m1 '^INFLUX_TOKEN=' .env 2>/dev/null | cut -d= -f2 | tr -d '"')
MQTT_USER    = $(shell grep -m1 '^MQTT_USER='    .env 2>/dev/null | cut -d= -f2 | tr -d '"')
MQTT_PASS    = $(shell grep -m1 '^MQTT_PASS='    .env 2>/dev/null | cut -d= -f2 | tr -d '"')

# ── dev ───────────────────────────────────────────────────────────────────────
## Start all services (builds images if needed). Seeds .env on first run.
dev:
	@# 1. Seed .env from the example template if it doesn't exist yet.
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(CYAN)Created .env from .env.example — review credentials before going to production.$(RESET)"; \
	fi
	@# 2. Validate required credentials are present. We refuse to silently fall
	@#    back to documented default values — that's basically equivalent to
	@#    anonymous auth for anyone with repo access.
	@MISSING=""; \
	 [ -z "$(INFLUX_TOKEN)" ] && MISSING="$$MISSING INFLUX_TOKEN"; \
	 [ -z "$(MQTT_USER)" ]    && MISSING="$$MISSING MQTT_USER"; \
	 [ -z "$(MQTT_PASS)" ]    && MISSING="$$MISSING MQTT_PASS"; \
	 if [ -n "$$MISSING" ]; then \
		echo ""; \
		echo "ERROR: missing required values in .env:$$MISSING"; \
		echo "       Refer to .env.example for the full set."; \
		echo ""; \
		exit 1; \
	 fi
	@# 3. Sync settings.js into the data dir only if it actually changed, and
	@#    regenerate flows_cred.json only when the underlying creds changed.
	@#    Tracking changes lets us avoid a no-op Node-RED restart at the end,
	@#    and preserves edits made through the Node-RED UI between make runs.
	@#    NB: shell-level `#` comments inside this block would be interpreted
	@#    by Make as starting a new recipe line, which breaks `@`-suppression
	@#    of recipe echoing. All explanatory comments must live OUT here.
	@set -e; \
	 NR_CHANGED=0; \
	 if ! cmp -s services/node-red/settings.js services/node-red/data/settings.js 2>/dev/null; then \
		cp services/node-red/settings.js services/node-red/data/settings.js; \
		echo "$(CYAN)Synced  settings.js   → services/node-red/data/$(RESET)"; \
		NR_CHANGED=1; \
	 fi; \
	 DESIRED="$(INFLUX_TOKEN)|$(MQTT_USER)|$(MQTT_PASS)"; \
	 LAST=$$(cat services/node-red/data/.creds-stash 2>/dev/null || true); \
	 if [ "$$DESIRED" != "$$LAST" ] || [ ! -f services/node-red/data/flows_cred.json ]; then \
		printf '{\n  "cfg-influxdb": { "token": "%s" },\n  "cfg-mqtt": { "user": "%s", "password": "%s" }\n}\n' \
			"$(INFLUX_TOKEN)" "$(MQTT_USER)" "$(MQTT_PASS)" \
			> services/node-red/data/flows_cred.json; \
		printf '%s' "$$DESIRED" > services/node-red/data/.creds-stash; \
		echo "$(CYAN)Regenerated data/flows_cred.json (creds changed)$(RESET)"; \
		NR_CHANGED=1; \
	 else \
		echo "$(CYAN)Node-RED creds unchanged — keeping flows_cred.json (preserves UI edits)$(RESET)"; \
	 fi; \
	 echo "$$NR_CHANGED" > services/node-red/data/.dev-action
	@# 4. Regenerate the Mosquitto password file only when MQTT creds changed.
	@#    --user 0 + explicit chown is for cross-platform compatibility: Docker
	@#    Desktop on macOS transparently translates bind-mount UIDs, but on a
	@#    Linux/Pi host the eclipse-mosquitto image's default UID 1883 can't
	@#    write into a directory owned by the host's regular user. Running the
	@#    one-shot as root and then chown'ing back to 1883:1883 + chmod 600
	@#    works identically on both, and is what mosquitto's strict file-perms
	@#    check expects when reading password_file at startup.
	@set -e; \
	 MQ_CHANGED=0; \
	 DESIRED="$(MQTT_USER):$(MQTT_PASS)"; \
	 LAST=$$(cat services/mosquitto/config/.creds-stash 2>/dev/null || true); \
	 if [ "$$DESIRED" != "$$LAST" ] || [ ! -f services/mosquitto/config/passwd ]; then \
		docker run --rm --user 0 \
			-v "$(CURDIR)/services/mosquitto/config:/mosquitto/config" \
			eclipse-mosquitto:2 \
			sh -c 'set -e; rm -f /mosquitto/config/passwd; mosquitto_passwd -b -c /mosquitto/config/passwd "$(MQTT_USER)" "$(MQTT_PASS)"; chown 1883:1883 /mosquitto/config/passwd; chmod 600 /mosquitto/config/passwd' \
			> /dev/null; \
		printf '%s' "$$DESIRED" > services/mosquitto/config/.creds-stash; \
		echo "$(CYAN)Regenerated mosquitto/config/passwd for user '$(MQTT_USER)'$(RESET)"; \
		MQ_CHANGED=1; \
	 else \
		echo "$(CYAN)MQTT creds unchanged — keeping mosquitto/config/passwd$(RESET)"; \
	 fi; \
	 echo "$$MQ_CHANGED" > services/mosquitto/config/.dev-action
	docker compose up --build -d
	@# 5. Only restart services whose config actually changed. Avoids unnecessary
	@#    broker churn on every iteration (and the SEN66 Pico's hard-reset on
	@#    MAX_CONSECUTIVE_ERRORS that long disconnects can trigger).
	@if [ "$$(cat services/mosquitto/config/.dev-action 2>/dev/null)" = "1" ]; then \
		echo "$(CYAN)Restarting Mosquitto to pick up new password file...$(RESET)"; \
		docker compose restart mosquitto; \
	fi
	@if [ "$$(cat services/node-red/data/.dev-action 2>/dev/null)" = "1" ]; then \
		echo "$(CYAN)Restarting Node-RED to apply updated settings / credentials...$(RESET)"; \
		docker compose restart node-red; \
	fi
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
		services/mosquitto/log/* \
		services/mosquitto/config/passwd \
		services/mosquitto/config/.creds-stash \
		services/mosquitto/config/.dev-action
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
