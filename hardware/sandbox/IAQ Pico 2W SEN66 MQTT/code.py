# code.py — SEN66 → MQTT for Raspberry Pi Pico 2 W (CircuitPython)
#
# Reads a Sensirion SEN66 over I2C every PUBLISH_INTERVAL_S seconds and publishes
# all values as a single JSON payload. Follows the savage sensor-platform
# conventions (see ../SENSOR_PLATFORM.md):
#
#   Telemetry topic: sensors/{PROJECT}/{POSITION}/{DEVICE_ID}/sen66
#   Status   topic:  status/{PROJECT}/{DEVICE_ID}             ("online" / "offline" via LWT)
#   Meta     topic:  meta/{PROJECT}/{DEVICE_ID}               (one retained JSON at boot)
#
# Identifiers come from settings.toml; the topic is derived at boot. Goal:
# flashing a new device only requires editing four values (PROJECT, POSITION,
# DEVICE_ID, plus the WiFi creds).
#
# Payload schema is flat, units-suffixed, identifiers OMITTED (they're in the
# topic). No `ts` (let Node-RED / InfluxDB stamp on receive until NTP is
# wired up). See SENSOR_PLATFORM.md §3.

import gc
import json
import os
import time

import adafruit_minimqtt.adafruit_minimqtt as MQTT
import adafruit_sen6x
import board
import busio
import microcontroller
import socketpool
import wifi

FW_VERSION = "0.4.0"

# ---------- Config -----------------------------------------------------------

WIFI_SSID = os.getenv("CIRCUITPY_WIFI_SSID")
WIFI_PASSWORD = os.getenv("CIRCUITPY_WIFI_PASSWORD")

MQTT_BROKER = os.getenv("MQTT_BROKER", "savage.local")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")

# Four-identifier model (SENSOR_PLATFORM.md §1). Edit these three per device:
PROJECT = os.getenv("PROJECT", "venthood")
POSITION = os.getenv("POSITION", "intake")  # intake | exhaust | ambient | duct | room
DEVICE_ID = os.getenv("DEVICE_ID", "pico-01")  # stable hardware ID, stickered on board
SENSOR_TYPE = "sen66"  # fixed for this firmware

# Derived topics — clients should NOT override these in settings.toml; they
# follow directly from the four identifiers above.
TELEMETRY_TOPIC = "sensors/{}/{}/{}/{}".format(
    PROJECT, POSITION, DEVICE_ID, SENSOR_TYPE
)
STATUS_TOPIC = "status/{}/{}".format(PROJECT, DEVICE_ID)
META_TOPIC = "meta/{}/{}".format(PROJECT, DEVICE_ID)

PUBLISH_INTERVAL_S = int(os.getenv("PUBLISH_INTERVAL_S", 5))

# I2C pins — Pico 2 W default I2C0
SDA_PIN = board.GP4
SCL_PIN = board.GP5

# Reconnection / health
WIFI_RETRY_DELAY = 5
MQTT_RETRY_DELAY = 5
MAX_CONSECUTIVE_ERRORS = 10  # board resets after this many failed cycles in a row

# Boot-time wall-clock anchor so uptime_s survives ticks_ms rollovers.
_BOOT_MONO = time.monotonic()


def log(msg):
    print("[{:.1f}] {}".format(time.monotonic() - _BOOT_MONO, msg))


def uptime_s():
    return int(time.monotonic() - _BOOT_MONO)


# ---------- Hardware setup ---------------------------------------------------

log(
    "Booting SEN66 publisher: project={} position={} device_id={} fw={}".format(
        PROJECT, POSITION, DEVICE_ID, FW_VERSION
    )
)
log("Telemetry topic: {}".format(TELEMETRY_TOPIC))

i2c = busio.I2C(scl=SCL_PIN, sda=SDA_PIN, frequency=100_000)
sensor = adafruit_sen6x.SEN66(i2c)

SEN66_SERIAL = None
SEN66_FW = None
try:
    SEN66_SERIAL = str(sensor.serial_number)
    SEN66_FW = str(sensor.version)
    log("SEN66 serial: {}".format(SEN66_SERIAL))
    log("SEN66 firmware: {}".format(SEN66_FW))
except Exception as e:  # noqa: BLE001
    log("Warning: could not read SEN66 identity: {}".format(e))

sensor.start_measurement()
# CO2 needs ~5-6s and NOx ~10-11s after start before they report real values.
# We don't block startup on this — those fields are simply omitted from the
# payload until the sensor reports them.
time.sleep(1.2)


# ---------- WiFi -------------------------------------------------------------


def wifi_connect():
    if wifi.radio.connected:
        return
    log("Connecting to WiFi: {}".format(WIFI_SSID))
    wifi.radio.connect(WIFI_SSID, WIFI_PASSWORD)
    log("WiFi connected. IP: {}".format(wifi.radio.ipv4_address))


# ---------- MQTT -------------------------------------------------------------


def make_mqtt_client(pool):
    client = MQTT.MQTT(
        broker=MQTT_BROKER,
        port=MQTT_PORT,
        username=MQTT_USERNAME,
        password=MQTT_PASSWORD,
        socket_pool=pool,
        is_ssl=False,
        client_id="{}-{}".format(DEVICE_ID, SENSOR_TYPE),
    )
    # Last Will: if the broker stops hearing from us, it publishes "offline"
    # (retained) so dashboards / Node-RED can detect dead devices.
    # adafruit_minimqtt exposes will_set() before connect().
    try:
        client.will_set(STATUS_TOPIC, "offline", qos=0, retain=True)
    except Exception as e:  # noqa: BLE001
        # Older adafruit_minimqtt versions used the kwarg name; either way we
        # don't want LWT-setup failures to prevent the device from publishing.
        log("Warning: could not register LWT: {}".format(e))

    client.on_connect = lambda c, u, f, rc: log("MQTT connected (rc={})".format(rc))
    client.on_disconnect = lambda c, u, rc: log("MQTT disconnected (rc={})".format(rc))
    return client


def mqtt_connect(client):
    log("Connecting to MQTT {}:{} as {}".format(MQTT_BROKER, MQTT_PORT, MQTT_USERNAME))
    client.connect()
    # Retained "online" so subscribers can tell the device is up. Pairs with
    # the LWT "offline" set on the client above.
    try:
        client.publish(STATUS_TOPIC, "online", retain=True)
    except Exception as e:  # noqa: BLE001
        log("Status publish failed: {}".format(e))
    # One-shot meta publish (retained). Cheap discovery payload.
    try:
        meta = {
            "fw": FW_VERSION,
            "project": PROJECT,
            "position": POSITION,
            "device_id": DEVICE_ID,
            "sensors": [SENSOR_TYPE],
            "ip": str(wifi.radio.ipv4_address) if wifi.radio.ipv4_address else None,
        }
        if SEN66_SERIAL:
            meta["sen66_serial"] = SEN66_SERIAL
        if SEN66_FW:
            meta["sen66_fw"] = SEN66_FW
        client.publish(META_TOPIC, json.dumps(meta), retain=True)
    except Exception as e:  # noqa: BLE001
        log("Meta publish failed: {}".format(e))


# ---------- Sensor read + publish -------------------------------------------


def read_payload():
    """Return a flat JSON-serialisable dict matching SENSOR_PLATFORM.md §3, or
    None if no fresh sensor data is ready yet.

    Identifiers (project/position/device_id/sensor_type) are intentionally
    NOT in the payload — they're already in the topic. `ts` is omitted; Node-RED
    timestamps on receive."""
    if not sensor.data_ready:
        return None
    m = sensor.all_measurements()
    payload = {
        "fw": FW_VERSION,
        "uptime_s": uptime_s(),
    }
    # Only include keys the sensor actually reported. Missing-from-JSON is the
    # signal to Node-RED / InfluxDB that this reading is unavailable; null/0
    # would be a false reading.
    mapping = (
        ("pm1_0", "pm1_0"),
        ("pm2_5", "pm2_5"),
        ("pm4_0", "pm4_0"),
        ("pm10", "pm10"),
        ("humidity_rh", "humidity"),
        ("temperature_c", "temperature"),
        ("voc_index", "voc_index"),
        ("nox_index", "nox_index"),
        ("co2_ppm", "co2"),
    )
    for out_key, sen_key in mapping:
        v = m.get(sen_key)
        if v is not None:
            payload[out_key] = v
    return payload


def publish_once(client):
    payload = read_payload()
    if payload is None:
        log("No fresh SEN66 data yet")
        return False
    client.publish(TELEMETRY_TOPIC, json.dumps(payload))
    # Concise log line; only fields actually in the payload.
    log(
        "Published: PM2.5={} CO2={} VOC={} NOx={} T={} RH={}".format(
            payload.get("pm2_5"),
            payload.get("co2_ppm"),
            payload.get("voc_index"),
            payload.get("nox_index"),
            payload.get("temperature_c"),
            payload.get("humidity_rh"),
        )
    )
    return True


# ---------- Main loop --------------------------------------------------------


def main():
    wifi_connect()
    pool = socketpool.SocketPool(wifi.radio)
    client = make_mqtt_client(pool)
    mqtt_connect(client)

    errors_in_a_row = 0
    next_publish_at = time.monotonic()

    while True:
        now = time.monotonic()
        if now < next_publish_at:
            # Service the MQTT keepalive between publishes
            try:
                client.loop(timeout=0.2)
            except Exception:  # noqa: BLE001
                pass
            time.sleep(0.1)
            continue

        next_publish_at = now + PUBLISH_INTERVAL_S

        try:
            if not wifi.radio.connected:
                wifi_connect()
            if not client.is_connected():
                log("MQTT not connected, reconnecting...")
                client.reconnect()
                # Re-assert retained "online" after a reconnect (the broker
                # will have flipped to LWT "offline" if it noticed the drop).
                try:
                    client.publish(STATUS_TOPIC, "online", retain=True)
                except Exception:  # noqa: BLE001
                    pass

            publish_once(client)
            errors_in_a_row = 0
        except Exception as e:  # noqa: BLE001
            errors_in_a_row += 1
            log("Cycle error ({} in a row): {}".format(errors_in_a_row, e))
            if errors_in_a_row >= MAX_CONSECUTIVE_ERRORS:
                raise
            time.sleep(MQTT_RETRY_DELAY)

        gc.collect()


# ---------- Crash handler ----------------------------------------------------

try:
    main()
except Exception as e:  # noqa: BLE001
    log("FATAL: {}. Resetting in 10s...".format(e))
    time.sleep(10)
    microcontroller.reset()
