# IAQ Pico 2W — SEN66 → MQTT

CircuitPython firmware for a Raspberry Pi Pico 2 W that reads a Sensirion SEN66
air-quality sensor over I2C and publishes its 9 values as a single JSON payload
to an MQTT broker every 5 seconds.

Follows the savage sensor-platform conventions in
[`../../SENSOR_PLATFORM.md`](../../SENSOR_PLATFORM.md). The same firmware powers
every SEN66 in the deployment — the only per-device change is the three
identifiers in `settings.toml` (PROJECT / POSITION / DEVICE_ID).

Targeted use: vent-hood filter monitoring. Deploy at minimum two of these
(`position=intake` and `position=exhaust`) so you can compute filter
efficiency, plus a third (`position=ambient`) elsewhere in the room as a
control baseline.

## MQTT topics

Derived at boot from the identifiers in `settings.toml`:

| Topic                                                              | What           | Retain |
|--------------------------------------------------------------------|----------------|--------|
| `sensors/{project}/{position}/{device_id}/sen66`                   | telemetry JSON | no     |
| `status/{project}/{device_id}`                                     | `"online"` / `"offline"` (LWT) | yes |
| `meta/{project}/{device_id}`                                       | firmware / IP / sensor list at boot | yes |

With defaults: telemetry publishes to `sensors/venthood/intake/pico-01/sen66`.

## Telemetry payload

One publish per cycle. Flat JSON. Identifiers are NOT in the payload — they
live in the topic.

```json
{
  "fw": "0.4.0",
  "uptime_s": 12345,
  "pm1_0":         4.2,
  "pm2_5":         6.7,
  "pm4_0":         8.1,
  "pm10":          9.4,
  "voc_index":     102,
  "nox_index":     1,
  "co2_ppm":       612,
  "temperature_c": 22.8,
  "humidity_rh":   41.2
}
```

During sensor warm-up (CO2 ~5–6 s, NOx ~10–11 s) the corresponding fields are
simply omitted from the JSON rather than sent as `null` — missing-from-JSON
is the right signal to InfluxDB.

## Hardware

- Raspberry Pi Pico 2 W (RP2350 + CYW43439)
- Sensirion SEN66 — works on Sensirion's own SEK-SEN66 board, or breakouts
  from Adafruit (PID 6331, STEMMA QT) or similar

### Wiring

| SEN66 pin | Pico 2 W pin | Notes |
|-----------|--------------|-------|
| VDD       | 3V3 (OUT, pin 36) | 3.3 V; SEN66 datasheet allows 3.0–5.5 V |
| GND       | GND          |       |
| SDA       | GP4 (pin 6)  | I2C0 SDA |
| SCL       | GP5 (pin 7)  | I2C0 SCL |
| SEL       | GND          | **Only relevant on the bare Sensirion module** — ties the sensor into I2C mode. Adafruit's STEMMA QT breakout already does this for you. |

Pull-ups: the Adafruit SEN66 STEMMA QT breakout has 10 kΩ pull-ups on SDA/SCL
on-board. If you're wiring the bare Sensirion module, add external 4.7 kΩ
pull-ups from SDA → 3V3 and SCL → 3V3.

> Heads-up on RP2350 A2 erratum E9: the silicon in current Pico 2 W boards has
> a quirk affecting high-impedance inputs / internal pulldowns. For I2C with
> proper external pull-ups (which you have) this is a non-issue. Just don't
> rely on the RP2350's *internal* pulls for anything in this project.

## First-time setup

### 1. Flash CircuitPython on the Pico 2 W

1. Download the latest stable CircuitPython UF2 for the Pico 2 W from
   <https://circuitpython.org/board/raspberry_pi_pico2_w/> (the "Raspberry Pi
   Pico 2 W" board, not plain "Pico 2").
2. Hold BOOTSEL on the Pico, plug it in via USB. It mounts as `RPI-RP2350`.
3. Drag the `.uf2` file onto that drive. The Pico reboots and remounts as
   `CIRCUITPY`.

### 2. Install the required CircuitPython libraries

Easiest path is `circup`:

```bash
pip install circup
circup install adafruit_sen6x adafruit_minimqtt adafruit_connection_manager
```

`circup` finds your connected Pico's `CIRCUITPY` drive and copies the right
versions into `CIRCUITPY/lib/`. After it runs, `CIRCUITPY/lib/` should contain:

```
lib/
├── adafruit_sen6x.mpy
├── adafruit_minimqtt/
├── adafruit_connection_manager.mpy
└── adafruit_bus_device/        (pulled in as a dep)
```

Manual alternative: download the matching CircuitPython library bundle from
<https://circuitpython.org/libraries>, then copy those same folders into
`CIRCUITPY/lib/`.

### 3. Copy this project onto the Pico

Copy these files to the root of the `CIRCUITPY` drive:

- `code.py`
- `settings.toml`

The Pico will reboot and start running. Open a USB-serial console
(`screen /dev/tty.usbmodem* 115200` on macOS, or use the Mu editor / Thonny)
to watch it boot — you should see WiFi connect, MQTT connect, then publishes
every 10 s.

## Verifying it's working

From any machine on the LAN with `mosquitto-clients` installed:

```bash
# Just this device:
mosquitto_sub -h savage.local -p 1883 \
  -u mqttuser -P mqttpass \
  -t 'sensors/venthood/intake/pico-01/sen66' -v

# Every SEN66 on the vent hood (intake + exhaust + any new ones):
mosquitto_sub -h savage.local -p 1883 \
  -u mqttuser -P mqttpass \
  -t 'sensors/venthood/+/+/sen66' -v

# Everything from a particular board:
mosquitto_sub -h savage.local -p 1883 \
  -u mqttuser -P mqttpass \
  -t 'sensors/+/+/pico-01/+' -v

# Lifecycle / health (online/offline per device):
mosquitto_sub -h savage.local -p 1883 \
  -u mqttuser -P mqttpass \
  -t 'status/venthood/+' -v
```

You should see one telemetry JSON line every 5 seconds.

## Troubleshooting

**WiFi doesn't connect.** SSID and password are exact-match. Spaces matter
("Pearly Head"). Check the USB-serial console for a `ConnectionError`.

**`gaierror` or hostname lookup failure when connecting to MQTT.** CircuitPython
on the Pico 2 W resolves `.local` (mDNS) names via the underlying CYW43 stack,
but this can be flaky on some networks. If you see this, replace
`MQTT_BROKER = "savage.local"` in `settings.toml` with the broker's IP address
(e.g. `MQTT_BROKER = "192.168.1.50"`).

**`bad_username_or_password` from broker.** Mosquitto needs the user to exist
in `mosquitto_passwd` and to be allowed in the ACL. Quick test from the broker
host: `mosquitto_pub -h localhost -u mqttuser -P mqttpass -t test -m hi`.

**All PM/CO2/VOC values are `null` for the first few cycles.** Expected.
CO2 takes ~5–6 s to leave its sentinel state and NOx takes ~10–11 s; PM, RH,
and T should be live by the first publish. After about 15 s everything should
populate.

**The script crashes and the Pico goes silent.** It shouldn't — the top-level
`try/except` calls `microcontroller.reset()` after 10 seconds on any fatal
error. If it really wedges, unplug and replug. If you want to disable the
crash-restart while developing, comment out `microcontroller.reset()` in
`code.py`.

## Adding more devices (exhaust / ambient / additional intakes)

Flash the same `code.py` to each new Pico. The ONLY per-device changes are
three lines in its `settings.toml`:

```toml
PROJECT   = "venthood"
POSITION  = "exhaust"        # or "ambient", "room", etc.
DEVICE_ID = "pico-exhaust"   # stable hardware ID, stickered on the board
```

The firmware derives the topic at boot:
`sensors/venthood/exhaust/pico-exhaust/sen66`. No code change needed.

**The exhaust deployment already exists** as its own folder:
[`../IAQ Pico 2W SEN66 MQTT - Exhaust/`](../IAQ%20Pico%202W%20SEN66%20MQTT%20-%20Exhaust/). That folder contains a verbatim copy of
this `code.py` plus an exhaust-flavoured `settings.toml.example`. The two
folders being separate is a deployment-clarity choice, not a firmware-fork —
when `code.py` changes here, mirror it there.

A subscriber can grab all SEN66s on the hood with `sensors/venthood/+/+/sen66`
and compute live filter efficiency as
`(intake.pm2_5 - exhaust.pm2_5) / intake.pm2_5` (see `SENSOR_PLATFORM.md` §5.C
for the dashboard pattern — the Vent Hood IAQ dashboard already has a
Filter Efficiency stat that picks this up automatically once both devices are
publishing).

## File map

```
.
├── code.py               # main program (boots automatically)
├── settings.toml         # WiFi + MQTT + identifiers (gitignored)
├── settings.toml.example # template without secrets
├── .gitignore
└── README.md
```

## Related

- [`../../SENSOR_PLATFORM.md`](../../SENSOR_PLATFORM.md) — canonical conventions for topics, payloads, tags, dashboards.
- Sibling device firmware: [`../IAQ Pico ePaper SCD41/`](../IAQ%20Pico%20ePaper%20SCD41/).
