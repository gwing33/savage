# IAQ Pico 2W — SEN66 → MQTT (Exhaust)

The **post-filter** SEN66 publisher for the vent hood. Pairs with the
[intake SEN66](../IAQ%20Pico%202W%20SEN66%20MQTT/) on the other side of the
filter so Grafana can compute filter efficiency
`(intake.pm2_5 - exhaust.pm2_5) / intake.pm2_5`.

## Same hardware, same firmware as the intake version

All hardware wiring, library install, troubleshooting, and the firmware itself
(`code.py`) are **identical** to the intake build. Refer to the intake folder's
README for those topics: [`../IAQ Pico 2W SEN66 MQTT/README.md`](../IAQ%20Pico%202W%20SEN66%20MQTT/README.md).

`code.py` in this folder is a verbatim copy of the intake firmware. If you edit
the intake's firmware, mirror the change here:

```bash
cp "../IAQ Pico 2W SEN66 MQTT/code.py" code.py
```

The two folders exist as separate deployment artifacts so the physical workflow
(open folder → flash to this specific Pico → seal up) stays simple. The cost is
one place to remember when updating the firmware. If that becomes annoying, the
two folders can be consolidated into a single shared firmware directory plus a
per-device `deployments/` subdirectory — see SENSOR_PLATFORM.md §6.

## What's different here

Only `settings.toml`. The differences from the intake template:

```toml
POSITION  = "exhaust"      # was "intake"
DEVICE_ID = "pico-exhaust"  # was "pico-intake"
```

Topic at boot: `sensors/venthood/exhaust/pico-exhaust/sen66`.

## Quick deploy

1. Copy `settings.toml.example` to `settings.toml` and fill in your real Wi-Fi
   credentials (everything else is already set correctly for an exhaust
   deployment).
2. Upload `code.py` and `settings.toml` to the Pico's `CIRCUITPY` drive.
3. Make sure the SEN66 CircuitPython libraries are present in
   `CIRCUITPY/lib/` — same `circup install adafruit_sen6x adafruit_minimqtt
   adafruit_connection_manager` as the intake build. If you flashed the intake
   Pico from this Mac already, the same `circup` run on the exhaust Pico's
   `CIRCUITPY` drive does the job.
4. Reset. Within ~5 s the device shows up in:
   - Grafana's *Snapshot* table as a new `pico-exhaust` column
   - The *PM size distribution*, *CO₂*, *Temperature*, *Humidity*, *VOC*,
     *NOx* time-series legends as new traces
   - The *Devices — last seen* table as a new row
   - The *Filter efficiency — PM2.5* stat starts producing real numbers
     (was "awaiting exhaust sensor" until this device came online)

## Verifying it's working from the Mac

```bash
# This device alone:
mosquitto_sub -h savage.local -p 1883 \
  -u mqttuser -P mqttpass \
  -t 'sensors/venthood/exhaust/pico-exhaust/sen66' -v

# Intake + exhaust side-by-side (subscribe to both SEN66s on the vent hood):
mosquitto_sub -h savage.local -p 1883 \
  -u mqttuser -P mqttpass \
  -t 'sensors/venthood/+/+/sen66' -v
```

You should see two JSON messages every ~5 s (one from each SEN66).

## File map

```
.
├── code.py               # identical to ../IAQ Pico 2W SEN66 MQTT/code.py
├── settings.toml         # gitignored; per-device WiFi/MQTT + identifiers
├── settings.toml.example # exhaust-position template (committed)
├── .gitignore
└── README.md             # this file
```

## Related

- [`../IAQ Pico 2W SEN66 MQTT/`](../IAQ%20Pico%202W%20SEN66%20MQTT/) — the intake counterpart with full hardware docs.
- [`../IAQ Pico ePaper SCD41/`](../IAQ%20Pico%20ePaper%20SCD41/) — the room/control sensor.
- [`../../SENSOR_PLATFORM.md`](../../SENSOR_PLATFORM.md) — canonical conventions.
