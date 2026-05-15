# IAQ Pico ePaper SCD41 — with WiFi + MQTT

MicroPython firmware for a Raspberry Pi Pico W that drives a Waveshare 2.9"
e-paper display showing CO2 (Sensirion SCD41) and temperature / humidity /
pressure (Bosch BME280), plus publishes the readings to MQTT every 5 s.

Follows the savage sensor-platform conventions in
[`../../SENSOR_PLATFORM.md`](../../SENSOR_PLATFORM.md). Same firmware on every
unit; per-device identity is set in `config.py` (PROJECT / POSITION /
DEVICE_ID).

Sibling to the [SEN66 publisher](../IAQ%20Pico%202W%20SEN66%20MQTT/) — share
the same broker, same topic scheme, and field names line up where they
overlap so cross-sensor comparison is trivial.

## MQTT topics

Derived at boot from the identifiers in `config.py`:

| Topic                                                              | What           | Retain |
|--------------------------------------------------------------------|----------------|--------|
| `sensors/{project}/{position}/{device_id}/scd41`                   | telemetry JSON | no     |
| `status/{project}/{device_id}`                                     | `"online"` / `"offline"` (LWT) | yes |
| `meta/{project}/{device_id}`                                       | firmware / IP / sensor list at boot | yes |

With defaults: telemetry publishes to `sensors/venthood/intake/pico-01/scd41`.
(For a typical vent-hood deployment you'd more likely run this device at
`position=ambient` as the control sensor, leaving the SEN66s on the
intake/exhaust positions.)

## Telemetry payload

One publish per cycle. Flat JSON. Identifiers are NOT in the payload — they
live in the topic. Fields the sensor hasn't produced yet are simply omitted.

```json
{
  "fw": "0.4.0",
  "uptime_s": 12345,
  "co2_ppm":       612,
  "temperature_c": 22.8,
  "humidity_rh":   41.2,
  "pressure_hpa":  1013.4
}
```

Field names overlap deliberately with the SEN66 publisher (`co2_ppm`,
`temperature_c`, `humidity_rh`), so subscribers can diff the readings directly
(see `SENSOR_PLATFORM.md` §5.B for the dashboard pattern). `pressure_hpa` is
an SCD41-specific field; the SEN66 doesn't measure pressure.

`co2_ppm` is omitted entirely for roughly the first 5 seconds after boot
while the SCD41 warms up.

## Display

The two screens (cycle with the button on GP14) get a small `W` / `M`
indicator in the top strip: filled black when WiFi or MQTT is up, outlined
only when it's down. So you can tell from across the room whether the device
is talking to the broker.

## Hardware

- Raspberry Pi Pico W (the original RP2040 + CYW43439 board, not Pico 2 W)
- Sensirion SCD41 (I2C)
- Bosch BME280 (I2C, optional — device boots fine without it)
- Waveshare 2.9" e-Paper V2 (SPI)
- Momentary button to GND on GP14

### Wiring

| Part        | Pico W pin            | Notes                  |
|-------------|-----------------------|------------------------|
| SCD41 SDA   | GP4                   | I2C0 SDA               |
| SCD41 SCL   | GP5                   | I2C0 SCL               |
| BME280 SDA  | GP4                   | shares I2C0 with SCD41 |
| BME280 SCL  | GP5                   | shares I2C0 with SCD41 |
| ePaper DIN  | GP11                  | SPI1 MOSI              |
| ePaper CLK  | GP10                  | SPI1 SCK               |
| ePaper CS   | GP9                   |                        |
| ePaper DC   | GP8                   |                        |
| ePaper RST  | GP12                  |                        |
| ePaper BUSY | GP13                  |                        |
| Button      | GP14 + GND            | internal pull-up       |

BME280 boards usually live at I2C address `0x76` or `0x77`; the firmware
probes both.

## First-time setup

### 1. Flash MicroPython

1. Download the latest stable MicroPython `.uf2` for the Raspberry Pi Pico W
   from <https://micropython.org/download/RPI_PICO_W/>.
2. Hold BOOTSEL on the Pico, plug it in via USB. It mounts as `RPI-RP2`.
3. Drag the `.uf2` onto that drive. The Pico reboots running MicroPython.

### 2. Install `umqtt.simple`

`umqtt.simple` ships in `micropython-lib` and needs to be installed onto the
Pico once. From a host machine with `mpremote`:

```bash
pip install mpremote
mpremote connect auto mip install umqtt.simple
```

Or from a REPL on the Pico (after WiFi is up):

```python
import mip
mip.install("umqtt.simple")
```

Either path drops `umqtt/simple.py` into the Pico's filesystem.

### 3. Copy the project onto the Pico

Use `mpremote`, Thonny, or any MicroPython-aware editor to copy these files
to the root of the Pico's filesystem:

- `main.py`
- `config.py`            (your filled-in copy — see `config.py.example`)
- `lib/epaper_2in9.py`

Make sure the e-paper driver lands at `lib/epaper_2in9.py` on the Pico
(MicroPython auto-searches `lib/` on the device).

### 4. Edit `config.py`

Copy `config.py.example` to `config.py` and fill in:

```python
WIFI_SSID = "..."
WIFI_PASSWORD = "..."

MQTT_BROKER = "savage.local"   # or the broker's IP if mDNS is flaky
MQTT_PORT = 1883
MQTT_USERNAME = "mqttuser"
MQTT_PASSWORD = "mqttpass"

# The four-identifier model from SENSOR_PLATFORM.md. The MQTT topic is built
# from these at boot: sensors/{PROJECT}/{POSITION}/{DEVICE_ID}/scd41
PROJECT   = "venthood"
POSITION  = "ambient"      # "intake" / "exhaust" / "ambient" / "duct" / "room"
DEVICE_ID = "pico-03"      # stable hardware ID, stickered on the board

PUBLISH_INTERVAL_S = 5
```

If `config.py` is missing or `umqtt.simple` isn't installed, the device boots
in display-only mode and prints a note to USB serial — useful as a fallback
while you're still wiring things up.

## Verifying it's working

From any machine on the LAN with `mosquitto-clients` installed:

```bash
# Just this device (substitute your DEVICE_ID + POSITION):
mosquitto_sub -h savage.local -p 1883 \
  -u mqttuser -P mqttpass \
  -t 'sensors/venthood/ambient/pico-03/scd41' -v

# Every sensor in the same position (e.g. compare two ambient probes):
mosquitto_sub -h savage.local -p 1883 \
  -u mqttuser -P mqttpass \
  -t 'sensors/venthood/ambient/+/+' -v

# Lifecycle / health (online/offline per device):
mosquitto_sub -h savage.local -p 1883 \
  -u mqttuser -P mqttpass \
  -t 'status/venthood/+' -v
```

You should see one telemetry JSON line every 5 seconds.

The on-device W/M indicator gives the same signal at a glance: both pips
solid means the link is up.

## Comparing against the SEN66

Once both publishers are running, a quick way to diff CO2 / temperature /
humidity over a window:

```bash
mosquitto_sub -h savage.local -p 1883 -u mqttuser -P mqttpass \
  -t 'sensors/venthood/intake/+' -v \
  | tee /tmp/iaq.log
```

Then split by topic. Expect the SCD41 and SEN66 CO2 numbers to track each
other within a few tens of ppm in a steady environment, with the SCD41
slightly noisier per-sample (no internal averaging) and the SEN66 slightly
warmer in temperature reading (it has internal heat sources from PM laser
and fan).

## Troubleshooting

**`ImportError: no module named 'umqtt'`.** Step 2 above wasn't completed.
Run `mpremote connect auto mip install umqtt.simple`.

**`OSError: -2` or `EHOSTUNREACH` on MQTT connect.** Usually mDNS lookup of
`savage.local` failed. Replace `MQTT_BROKER` in `config.py` with the
broker's IP.

**WiFi never connects.** Double-check the SSID + password are exact-match
(spaces matter — `"Pearly Head"`). Watch USB serial output for the
`WiFi: connecting to ...` line.

**Display works, no publishes.** USB serial will show why — most likely
`MQTT connect failed: ...` with a reason. The W/M pips on the display also
tell you which layer is down.

**Sensor numbers look wrong vs. SEN66.** Expected for the first 30–60 seconds
(SCD41 self-calibration baseline). Long-term: SCD41 uses ASC (automatic
self-calibration) which assumes the room reaches outdoor-ish CO2 once a
week; if your room never gets that low, expect drift relative to the SEN66.

## Related

- [`../../SENSOR_PLATFORM.md`](../../SENSOR_PLATFORM.md) — canonical conventions for topics, payloads, tags, dashboards.
- Sibling device firmware: [`../IAQ Pico 2W SEN66 MQTT/`](../IAQ%20Pico%202W%20SEN66%20MQTT/).

## File map

```
.
├── main.py               # MicroPython entry point (auto-runs at boot)
├── config.py             # WiFi + MQTT secrets (gitignored)
├── config.py.example     # template without secrets
├── lib/
│   └── epaper_2in9.py    # Waveshare e-paper driver
├── backups/              # earlier revisions kept for reference
├── .gitignore
└── README.md
```
