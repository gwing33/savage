#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Node-RED entrypoint for fly.io
#
# On first boot (empty /data volume) the flows are seeded from the image
# defaults baked in at /flows-default. Node-RED then persists any UI edits
# back to /data/flows.json across restarts.
#
# On subsequent boots the existing /data/flows.json is left untouched so that
# credentials and flow edits made via the UI survive redeploys.
#
# To reset flows to the version-controlled defaults:
#   fly ssh console -C "rm /data/flows.json /data/flows_cred.json"
#   fly machine restart
# ─────────────────────────────────────────────────────────────────────────────
set -e

if [ ! -f /data/flows.json ]; then
    echo "[savage] First boot — seeding flows from image defaults..."
    if [ -f /flows-default/flows.json ]; then
        cp /flows-default/flows.json /data/flows.json
        echo "[savage] flows.json seeded. Configure node credentials via the UI."
    else
        echo "[savage] No default flows found — Node-RED will start empty."
    fi
fi

exec node-red --settings /usr/src/node-red/settings-fly.js
