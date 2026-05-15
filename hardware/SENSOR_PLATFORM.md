# Sensor Platform Conventions

Reference for the range hood monitoring stack: Pico 2W → MQTT → Node-RED → InfluxDB → Grafana. (Stack lives in the [`savage`](../) repo: Mosquitto, InfluxDB 2.x, Node-RED, Grafana — all in `docker-compose.yml`.)

This doc defines the conventions every new device and dashboard should follow so that adding sensors, comparing positions, and deploying to new environments all stay easy.

---

## 1. Naming dimensions

Every reading is described by four identifiers. Pin these down before you flash a new device.

| Dimension     | Meaning                                       | Examples                              |
|---------------|-----------------------------------------------|---------------------------------------|
| `project`     | What the device is part of                    | `venthood`, `airquality`, `hvac`      |
| `position`    | Where on/in the project the sensor sits       | `intake`, `exhaust`, `ambient`, `duct`|
| `device_id`   | The microcontroller itself (stable, unique)   | `pico-01`, `pico-02`                  |
| `sensor_type` | Which sensor module is reporting              | `sen66`, `bme680`, `scd41`, `thermo`  |

Keep `device_id` tied to the physical board (sticker on it), not its current job. If you move pico-01 from intake to exhaust, only `position` changes.

`position` should come from a small, agreed vocabulary — `intake`, `exhaust`, `ambient`, `duct`, `room`. Add new ones deliberately, not ad-hoc, so dashboards stay groupable.

> **No `site` dimension.** Each deployment runs its own self-contained stack (broker + Influx + Grafana on a local network, no internet). The deployment *is* the site. If you ever need to consolidate data across multiple deployments, add `site` later — it's a clean prefix that doesn't break anything else.

---

## 2. MQTT topic structure

```
sensors/{project}/{position}/{device_id}/{sensor_type}
```

Examples:

```
sensors/venthood/intake/pico-01/sen66
sensors/venthood/exhaust/pico-02/sen66
sensors/venthood/ambient/pico-03/sen66
sensors/venthood/intake/pico-04/scd41
```

This is a small expansion of the current `sensors/venthood/intake/sen66` — adding `device_id` before `sensor_type`. Worth doing because it unlocks the wildcard subscriptions you'll want in Node-RED and prevents collisions when two sensors share a position.

### Wildcards you get for free

| Subscription                              | Meaning                                       |
|-------------------------------------------|-----------------------------------------------|
| `sensors/venthood/intake/+/sen66`         | Every intake SEN66 (regardless of device)     |
| `sensors/venthood/+/+/sen66`              | Every SEN66 on the vent hood                  |
| `sensors/venthood/+/+/+`                  | Everything from the vent hood                 |
| `sensors/+/+/pico-01/+`                   | Everything pico-01 publishes                  |
| `sensors/#`                               | Firehose                                      |

### Status / lifecycle topics

Use a parallel namespace, not extra levels under `sensors/...`, so subscribers don't accidentally pull lifecycle messages into telemetry pipelines.

```
status/{project}/{device_id}        retained, "online" / "offline" via LWT
meta/{project}/{device_id}          retained, JSON: fw version, ip, sensor list, build hash
```

---

## 3. JSON payload schema

One JSON message per device per sensor reading, published to the device's `sensor_type` topic. Flat structure — identifiers and readings live at the same level.

Identifiers (`project`, `position`, `device_id`, `sensor_type`) are **NOT** in the payload — they're already in the topic, and Node-RED parses them from `msg.topic`. Single source of truth, smaller messages, simpler device code.

Full SEN66 example:

```json
{
  "fw": "0.3.1",
  "uptime_s": 12345,
  "pm1_0":         0.1,
  "pm2_5":         0.2,
  "pm4_0":         0.3,
  "pm10":          0.4,
  "voc_index":     46,
  "nox_index":     1,
  "co2_ppm":       711,
  "temperature_c": 26.47,
  "humidity_rh":   31.51
}
```

Published to topic: `sensors/venthood/intake/pico-01/sen66`

Partial-sensor example (SCD41 — note it can also report T/RH from its onboard sensor if you choose to read them):

```json
{
  "fw": "0.1.0",
  "co2_ppm": 712
}
```

Published to topic: `sensors/venthood/ambient/pico-05/scd41`

Rules of the road:

- **Flat structure.** All readings at the top level. Keeps the Node-RED parser trivial.
- **No identifiers in payload.** They're in the topic — single source of truth. Saves bytes and simplifies the device. (If you later need self-describing payloads for some reason, easy to add back; but for one Node-RED ingester on a LAN, the topic-only approach is enough.)
- **Only publish keys the sensor actually has.** A device with an SCD41 publishes `co2_ppm` (and optionally `temperature_c`, `humidity_rh`) and nothing else. Don't pad with nulls or zeros — missing-from-JSON is the right signal to InfluxDB.
- **Omit `ts`.** Let Node-RED/Influx stamp on receive (which is what the influxdb-out node does when no timestamp is supplied). Only add `ts` back if you wire up NTP and have a reason to care about sub-broker-latency precision. The current `2025.82` value should be removed from the publish loop — see §9.
- **`fw` is optional but recommended.** Becomes a tag in InfluxDB so you can correlate sensor behavior changes with firmware versions.
- **`uptime_s` is optional.** Useful for spotting reboots in the time series.
- **All numeric field names carry their unit** (`co2_ppm`, `temperature_c`, `humidity_rh`). Never a bare `temperature` whose units depend on context.
- **Same quantity → same field name across sensor types.** A BME680 and an SEN66 both report `temperature_c` — don't rename one to `temp_c`. This is what makes cross-sensor Grafana queries possible.

### QoS, retain, frequency

- QoS **0** for telemetry. The next reading is seconds away; retransmits aren't worth it.
- `retain: false` for telemetry. Retain only on `status/...` (LWT) and `meta/...`.
- Default publish cadence: **5 seconds**. Slower (30 s) for ambient room sensors, faster (1 s) only when actively profiling.

---

## 4. InfluxDB mapping (via Node-RED)

Ingestion is handled by the Node-RED flow in `services/node-red/`. One generic flow can handle the entire `sensors/#` firehose because the JSON shape is uniform.

| Influx role  | Source                                                              |
|--------------|---------------------------------------------------------------------|
| measurement  | `sensor_type` from payload (one measurement per sensor family — `sen66`, `scd41`, `bme680`) |
| tags         | `project`, `position`, `device_id`, `fw`                            |
| fields       | every numeric reading present in the payload (`pm2_5`, `co2_ppm`, …), plus `uptime_s` |
| timestamp    | omitted in payload → InfluxDB uses receive time (recommended)       |

Why one measurement per `sensor_type`: the field set differs per sensor (SEN66 has PM, SCD41 doesn't), and Influx is happiest when a measurement has a stable schema. Cross-sensor comparisons in Grafana still work — they just join on tags.

Tags above are the searchable axes — keep cardinality bounded. `device_id` is the highest-cardinality tag and that's fine; don't add anything per-message-unique (timestamps, sequence numbers) as a tag.

### Node-RED flow shape

Replace the current single-topic, single-measurement flow with a generic one. (See [`services/node-red/flows/flows.next.json`](../services/node-red/flows/flows.next.json) for the working version — drop-in replacement for `flows.json` once you've migrated the device firmware.)

1. **MQTT in** — topic `sensors/+/+/+/+`, datatype `json`. Wildcard count enforces topic shape; bare `sensors/#` would also accept malformed topics.
2. **Function: route + tag** — parse `msg.topic`, build the InfluxDB line-protocol object:
   ```js
   const parts = (msg.topic || "").split("/");
   if (parts.length !== 5 || parts[0] !== "sensors") {
       node.warn(`Skipping non-sensor topic: ${msg.topic}`);
       return null;
   }
   const [, project, position, device_id, sensor_type] = parts;

   const d = msg.payload || {};
   const fields = {};
   for (const [k, v] of Object.entries(d)) {
       if (k === "fw") continue;                     // fw becomes a tag
       if (typeof v === "number" && Number.isFinite(v)) fields[k] = v;
   }
   if (Object.keys(fields).length === 0) return null;

   const tags = { project, position, device_id };
   if (typeof d.fw === "string" && d.fw.length > 0) tags.fw = d.fw;

   msg.payload = [{
       measurement: sensor_type,                     // sen66 / scd41 / bme680 / …
       tags,
       fields
       // no timestamp → InfluxDB stamps on receive
   }];
   return msg;
   ```
3. **InfluxDB out** — same `cfg-influxdb` config you have today; leave the node's `measurement` field blank so the per-message `measurement` from the function takes effect.

That single flow then handles every current and future sensor type without changes.

---

## 5. Grafana view patterns

Three primary view types fall out of the schema cleanly. Build one dashboard per pattern, parameterize with Grafana variables.

### A. Single-device deep dive
- Variables: `$device_id`
- Each panel: one metric over time, filtered to that device
- Use case: "what is pico-01 seeing right now"
- Closest to your current `Keith SEN66 Air Quality` dashboard — just add the `$device_id` variable and a `r.device_id == "${device_id}"` filter to each query.

### B. Same-position, multi-device comparison
- Variables: `$position`, `$metric`
- One panel, group by `device_id`
- Use case: sanity-check that two sensors in the same spot agree; spot a drifting sensor

### C. Pre/post filter (and ambient) comparison
- Variables: `$device_id` multi-select (the set of devices on this hood)
- Panels group by `position`
- Add a derived panel for filter efficiency:
  `efficiency_pct = (intake - exhaust) / intake * 100` per metric (PM2.5 is the headline)
- Use case: prove the filter is doing something; watch efficiency degrade as the filter loads

Variable query (Flux, for `$device_id` populated from the SEN66 measurement):
```flux
import "influxdata/influxdb/schema"
schema.tagValues(bucket: "timeseries", tag: "device_id", predicate: (r) => r._measurement == "sen66")
```

Same idea for `$position`, `$project`. For a cross-sensor `$metric` variable, use `schema.fieldKeys`.

Add the equivalent filter to every panel query, e.g.:
```flux
|> filter(fn: (r) => r._measurement == "sen66")
|> filter(fn: (r) => r.device_id == "${device_id}")
|> filter(fn: (r) => r._field == "pm2_5" or r._field == "pm10")
```

---

## 6. Quick-start: adding a new sensor device

1. **Assign identifiers.** Pick `project`, `position`, `device_id`, `sensor_type`. Write `device_id` on a sticker, put it on the board.
2. **Flash MicroPython** on the Pico 2W (latest stable).
3. **Copy the device template** (see §7) and edit only `config.py`:
   - WiFi SSID/password
   - MQTT broker host/port/credentials
   - The four identifiers from step 1
   - Sensor pin assignments
4. **Wire the sensor.** SEN66 is I2C — pick a pair of GPIO pins for SDA/SCL and record them in `config.py`.
5. **Power on, verify telemetry.** Subscribe from a laptop:
   ```
   mosquitto_sub -h <broker> -t 'sensors/<project>/<position>/<device_id>/#' -v
   ```
   You should see a JSON payload every ~5 s.
6. **Verify ingestion.** In Influx Data Explorer (Flux):
   ```flux
   import "influxdata/influxdb/schema"
   schema.tagValues(bucket: "timeseries", tag: "device_id",
                    predicate: (r) => r._measurement == "<sensor_type>")
   ```
   Your new `device_id` should appear within a minute.
7. **Verify Grafana.** Open the relevant dashboard, the new `device_id` should show in the variable dropdown (assuming you've built dashboards along §5 patterns).
8. **Optional — publish a `meta/...` message** at boot with firmware version, IP, and sensor list, retained.

---

## 7. Device template (skeleton)

Suggested layout for a new device repo/folder:

```
device-firmware/
  main.py            # boot → connect WiFi → connect MQTT → loop: read + publish
  config.py          # all per-device settings (gitignored or per-device branch)
  config.example.py  # checked-in template
  drivers/
    sen66.py
    <other_sensor>.py
  lib/
    mqtt_client.py   # thin wrapper: connect, LWT, publish_json
    payload.py       # build_payload(readings, status) -> dict
```

`config.example.py`:

```python
WIFI_SSID = ""
WIFI_PASS = ""

MQTT_HOST = ""
MQTT_PORT = 1883
MQTT_USER = ""
MQTT_PASS = ""

PROJECT     = "venthood"
POSITION    = "intake"
DEVICE_ID   = "pico-01"
SENSOR_TYPE = "sen66"

PUBLISH_INTERVAL_S = 5

# I2C pins for SEN66
I2C_SDA = 4
I2C_SCL = 5
```

Topic and LWT are derived once at boot:

```python
TELEMETRY_TOPIC = f"sensors/{PROJECT}/{POSITION}/{DEVICE_ID}/{SENSOR_TYPE}"
STATUS_TOPIC    = f"status/{PROJECT}/{DEVICE_ID}"   # LWT: "offline", retained
META_TOPIC      = f"meta/{PROJECT}/{DEVICE_ID}"     # publish once at boot, retained
```

---

## 8. Checklist when introducing a new sensor *type*

When adding e.g. an SCD41 or BME680 alongside the existing SEN66:

- [ ] Pick a short, lowercase `sensor_type` slug (`scd41`, `bme680`).
- [ ] Reuse existing field names for shared quantities (`temperature_c`, `humidity_rh`, `co2_ppm`). Only invent new field names for genuinely new quantities.
- [ ] If you used the generic Node-RED flow from §4, no flow change is needed — the new `sensor_type` automatically becomes a new InfluxDB measurement.
- [ ] Confirm: new measurement appears in InfluxDB (`schema.measurements(bucket: "timeseries")`).
- [ ] If a single Pico publishes both sensors, it publishes **two messages** to two topics — one per `sensor_type`. Don't merge them into a single payload. (Example: the `IAQ Pico ePaper SCD41` firmware publishes co2 under `.../scd41` and T/RH/P under `.../bme280`.)

---

## 8a. Sensor accuracy & known quirks

Fair-warning notes about the specific sensors currently in this repo. Useful when interpreting the cross-sensor panels in Grafana — small offsets between sensors at the same position are usually a sensor characteristic, not a calibration failure.

### Typical accuracy (manufacturer datasheets, at room conditions)

| Sensor                 | Temperature   | Humidity      | Pressure  | CO₂           | PM       |
|------------------------|---------------|---------------|-----------|---------------|----------|
| **Sensirion SEN66** (built-in SHT40) | ±0.2 °C       | ±2 % RH       | —         | ±50 ppm + 5 % | ±10 µg/m³ typ |
| **Bosch BME280**       | ±0.5 °C       | ±3 % RH       | ±1 hPa    | —             | —        |
| **Sensirion SCD41**    | ±0.8 °C       | ±6 % RH       | —         | ±(40 ppm + 5 %) | —     |

Ranking for T/RH alone: **SEN66's SHT40 ≥ BME280 > SCD41**.

### Self-heating biases (don't be surprised)

- **SEN66:** runs a PM laser + sample-flow fan continuously. The SHT40 sits right next to those heat sources, so SEN66 temperature consistently reads ~0.5–1.5 °C above true ambient in a tight enclosure. Sensirion ships a software correction in their SEN6x SDK; the open-source `adafruit_sen6x` driver doesn't apply it.
- **SCD41:** the periodic IR CO₂ measurement cycle pulses an IR source, which warms the SCD41's internal T/RH element by ~1–2 °C. This is why the `IAQ Pico ePaper SCD41` firmware reads T/RH from a separate **BME280** rather than the SCD41's own onboard sensor.

### Practical implications for the dashboard

- In the **cross-sensor Temperature panel**, expect a persistent ~1–2 °C offset where the SEN66 trace runs warmer than the BME280 trace. That's the SEN66 self-heating, not real disagreement about the room.
- In the **cross-sensor Humidity panel**, the same offset shows up inverted: SEN66 reads slightly drier because its sensor is warmer. Again, real.
- For absolute T/RH, trust the BME280 (or SHT40-equivalent external probe) more than the SCD41's internal element. The SEN66 will become trustworthy too once someone wires Sensirion's compensation correction into the driver.

---

## 9. Migration from current scheme (resolved)

The migration described in earlier revisions of this section is **complete**
in the device firmware and the Node-RED flow:

- **Topic:** both `IAQ Pico 2W SEN66 MQTT` and `IAQ Pico ePaper SCD41` now
  build their telemetry topic from the four identifiers at boot:
  `sensors/{PROJECT}/{POSITION}/{DEVICE_ID}/{sensor_type}`.
- **Payload:** identifiers (`device_id`, `project`, `position`) have been
  removed from the JSON — they're in the topic. `ts` has been dropped
  (Node-RED stamps on receive). `fw` and `uptime_s` are now included.
- **Node-RED:** `services/node-red/flows/flows.json` is the generic
  ingester (subscribes to `sensors/+/+/+/+`, derives measurement / tags from
  the topic). The previous single-topic flow is kept on disk as
  `flows.json.legacy` for reference and can be deleted once everyone is
  confident in the new flow.

What that means in practice for an existing board: re-flash with the updated
firmware (`code.py` / `main.py`), set `PROJECT` / `POSITION` / `DEVICE_ID`
in its `settings.toml` or `config.py`, and you're done. Historical Influx
data from before the migration keeps its old shape and won't appear in
dashboards that filter on the new tags — fine for a prototype.

---

## 10. Known repo inconsistencies

Things in the `savage/` repo that don't match what's actually running. Worth
fixing or at least being aware of.

### Mosquitto auth (resolved)
The broker now requires username/password (no anonymous). Credentials are
stored in `.env` as `MQTT_USER` / `MQTT_PASS`, hashed into
`services/mosquitto/config/passwd` by `make dev`, and propagated into
Node-RED via the regenerated `flows_cred.json`. Each device's
`settings.toml` / `config.py` must use the same `mqttuser` / `mqttpass` to
connect.

### Generic Node-RED flow (resolved)
The active `services/node-red/flows/flows.json` is now the generic
ingester: subscribes to `sensors/+/+/+/+`, derives measurement from
`sensor_type` in the topic, tags rows with `project` / `position` /
`device_id` (+ `fw` when present). Adding a new sensor type or device
requires **zero** Node-RED changes. The previous single-topic flow is kept
on disk as `flows.json.legacy` for reference; safe to delete eventually.

The stale `services/node-red/flows/.flows.json.backup` (which subscribed
to the long-defunct `sen-66-data` topic) can be deleted whenever; it's not
referenced by anything.

### Status / lifecycle topics moved out of `sensors/...` (resolved)
Both devices now publish:

- retained `"online"` to `status/{project}/{device_id}` at connect,
- LWT `"offline"` (retained) registered with the broker so the broker
  flips it automatically if the device disappears,
- one retained `meta/{project}/{device_id}` JSON at boot with firmware,
  IP, and the list of sensors on the board.

No more `sensors/.../status` topics polluting wildcard subscriptions.

### Three-way field-name drift (partially resolved)
The same quantities had three different names in earlier revisions:

| Quantity      | Live device payload (now) | Stale `flows.json.legacy` | Provisioned `sen66.json` |
|---------------|---------------------------|---------------------------|--------------------------|
| PM10          | `pm10` ✅                 | `pm10_0`                  | `pm10_0`                 |
| Humidity      | `humidity_rh` ✅          | `humidity`                | `humidity`               |
| Temperature   | `temperature_c` ✅        | `temperature`             | `temperature`            |
| CO₂           | `co2_ppm` ✅              | `co2`                     | `co2`                    |

Devices and the active flow are aligned. The provisioned
`services/grafana/provisioning/dashboards/sen66.json` may still reference
the old names — verify it post-migration and either rewrite the queries
or replace the dashboard.

### `allowUiUpdates: true` enabled (resolved)
`services/grafana/provisioning/dashboards/dashboard.yaml` has
`allowUiUpdates: true`. Grafana will let you edit and save provisioned
dashboards through the UI; changes persist back to the JSON file on disk.

### Data-source reference style
Your custom dashboard JSON uses `"datasource": { "name": "influxdb" }`. The
provisioned data source has `uid: "influxdb"`. Grafana prefers UID
references — `{ "type": "influxdb", "uid": "influxdb" }` — for portability.
The `name`-based reference still works but is deprecated in newer Grafana
versions. Consider switching if you commit the dashboard.

### Per-device MQTT identity (deferred)
All devices currently authenticate as the same `mqttuser`. Fine for a
prototype on a single LAN — but a real deployment would use per-device
MQTT users + ACLs (e.g. `pico-01` can only publish under
`sensors/venthood/+/pico-01/#`). Move on this only after the
 single-credential prototype is stable.
