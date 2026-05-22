#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Mosquitto entrypoint — fly.io
#
# Generates the password file from MQTT_USER / MQTT_PASS secrets on every
# container start, then execs the broker. Running as root is intentional so
# the passwd file can be written before dropping privileges via the daemon.
# ─────────────────────────────────────────────────────────────────────────────
set -e

if [ -z "$MQTT_USER" ] || [ -z "$MQTT_PASS" ]; then
    echo "ERROR: MQTT_USER and MQTT_PASS must be set via 'fly secrets set'" >&2
    exit 1
fi

echo "[savage] Generating mosquitto password file..."
mosquitto_passwd -b -c /mosquitto/config/passwd "$MQTT_USER" "$MQTT_PASS"
chown mosquitto:mosquitto /mosquitto/config/passwd
chmod 600 /mosquitto/config/passwd

exec mosquitto -c /mosquitto/config/mosquitto.conf
