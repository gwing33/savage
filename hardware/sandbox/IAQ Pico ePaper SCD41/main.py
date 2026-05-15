# CO2 Display  -  Pi Pico W v1  (MicroPython)
#
# Publishes SCD41 + BME280 readings to MQTT following the savage sensor-platform
# conventions (see ../SENSOR_PLATFORM.md):
#
#   Telemetry: sensors/{PROJECT}/{POSITION}/{DEVICE_ID}/scd41
#   Status:    status/{PROJECT}/{DEVICE_ID}            ("online" / "offline" via LWT)
#   Meta:      meta/{PROJECT}/{DEVICE_ID}              (one retained JSON at boot)
#
# Identifiers come from config.py; topics are derived at boot. To deploy a new
# device, you only need to edit PROJECT / POSITION / DEVICE_ID + WiFi creds.
#
# Hardware: SCD41 (I2C0) + BME280 (I2C0) + Waveshare 2.9" e-Paper V2 (SPI1)
#
# Wiring:
#   SCD41   SDA -> GP4 | SCL -> GP5 | VDD -> 3V3 | GND -> GND
#   BME280  SDA -> GP4 | SCL -> GP5 | VDD -> 3V3 | GND -> GND
#   e-Paper DIN -> GP11 | CLK -> GP10 | CS -> GP9 | DC -> GP8
#           RST -> GP12 | BUSY -> GP13
#   Button  one side -> GP14, other side -> GND
#
# Notes:
#   - BME280 I2C breakouts commonly use address 0x76 or 0x77. This script
#     probes both.
#   - The button uses the Pico's internal pull-up, so it reads as pressed when
#     GP14 is connected to GND.

import json
import time

import framebuf
import network
from epaper_2in9 import EPD_2in9_Landscape
from machine import I2C, Pin

FW_VERSION = "0.4.0"

# Optional config: lets the device still boot as a display-only unit if
# config.py is missing. See config.py.example for the expected keys.
try:
    import config  # noqa: F401  (read via getattr below)
except ImportError:
    config = None

# umqtt.simple ships in micropython-lib. Install on the Pico ONCE with:
#   import mip; mip.install("umqtt.simple")
# (or `mpremote mip install umqtt.simple` from a host machine).
# Without it, this device falls back to display-only mode and never publishes
# to MQTT — a deliberately loud warning is printed at boot to flag this.
try:
    from umqtt.simple import MQTTClient
except ImportError:
    MQTTClient = None
    print(
        "\n!! umqtt.simple is NOT installed on this Pico.\n"
        "   This device will NOT publish to MQTT.\n"
        "   To install (one-time):\n"
        '     >>> import mip; mip.install("umqtt.simple")\n'
        "   (Wi-Fi must be up first; see README.)\n"
    )

# Boot-time anchor for uptime_s (ticks_ms wraps after ~12 days).
_BOOT_TICKS = time.ticks_ms()


# -- Bus and sensor constants -------------------------------------------------
I2C_SDA = 4
I2C_SCL = 5

SCD41_ADDR = 0x62
SCD41_CMD_START = b"\x21\xb1"  # start_periodic_measurement
SCD41_CMD_STOP = b"\x3f\x86"  # stop_periodic_measurement (~500 ms to settle)
SCD41_CMD_READY = b"\xe4\xb8"  # get_data_ready_status
SCD41_CMD_READ = b"\xec\x05"  # read_measurement

BME280_CHIP_ID = 0x60
BME280_ADDRS = (0x76, 0x77)

POLL_SEC = 5
FULL_REFRESH_INTERVAL_MS = 120000
UI_POLL_MS = 100
BUTTON_PIN = 14
BUTTON_DEBOUNCE_MS = 250

DISPLAY_WIDTH = 296
DISPLAY_HEIGHT = 128
WHITE = 0xFF
BLACK = 0x00

TEMP_UNIT = "F"
SCREEN_SEQUENCE = ("dashboard", "co2")
DEFAULT_SCREEN_INDEX = 0


# -- Network / MQTT config ----------------------------------------------------
def _cfg(name, default=None):
    """Read a value from config.py, falling back to default."""
    if config is None:
        return default
    return getattr(config, name, default)


WIFI_SSID = _cfg("WIFI_SSID")
WIFI_PASSWORD = _cfg("WIFI_PASSWORD")
MQTT_BROKER = _cfg("MQTT_BROKER")
MQTT_PORT = int(_cfg("MQTT_PORT", 1883) or 1883)
MQTT_USERNAME = _cfg("MQTT_USERNAME")
MQTT_PASSWORD = _cfg("MQTT_PASSWORD")

# Four-identifier model (SENSOR_PLATFORM.md §1). Edit these three per device:
PROJECT = _cfg("PROJECT", "venthood")
POSITION = _cfg("POSITION", "intake")  # intake | exhaust | ambient | duct | room
DEVICE_ID = _cfg("DEVICE_ID", "pico-01")  # stable hardware ID, stickered on board

# This device has TWO physical sensor ICs: the Sensirion SCD41 (CO₂ only) and
# the Bosch BME280 (temperature, humidity, pressure). Per SENSOR_PLATFORM.md
# §8, that means we publish TWO MQTT messages per cycle — one per sensor type
# — so InfluxDB / Grafana can keep the field-source attribution accurate.
# The SCD41's onboard T/RH element is intentionally NOT used here: its spec is
# loose (±0.8 °C / ±6 %RH) and its readings drift warm due to the IR-source
# self-heating cycle. BME280 (±0.5 °C / ±3 %RH) does the climate measuring.
MQTT_TOPIC_SCD41 = "sensors/{}/{}/{}/scd41".format(PROJECT, POSITION, DEVICE_ID)
MQTT_TOPIC_BME280 = "sensors/{}/{}/{}/bme280".format(PROJECT, POSITION, DEVICE_ID)
MQTT_STATUS_TOPIC = "status/{}/{}".format(PROJECT, DEVICE_ID)
MQTT_META_TOPIC = "meta/{}/{}".format(PROJECT, DEVICE_ID)

PUBLISH_INTERVAL_S = int(_cfg("PUBLISH_INTERVAL_S", 5) or 5)

# Treat networking as enabled only if WiFi creds AND umqtt are available.
NET_ENABLED = bool(
    WIFI_SSID and WIFI_PASSWORD and MQTT_BROKER and MQTTClient is not None
)

WIFI_CONNECT_TIMEOUT_MS = 12000
WIFI_RECONNECT_INTERVAL_MS = 5000
MQTT_RECONNECT_INTERVAL_MS = 5000


SEGMENTS = {
    "0": ("a", "b", "c", "d", "e", "f"),
    "1": ("b", "c"),
    "2": ("a", "b", "g", "e", "d"),
    "3": ("a", "b", "g", "c", "d"),
    "4": ("f", "g", "b", "c"),
    "5": ("a", "f", "g", "c", "d"),
    "6": ("a", "f", "g", "e", "c", "d"),
    "7": ("a", "b", "c"),
    "8": ("a", "b", "c", "d", "e", "f", "g"),
    "9": ("a", "b", "c", "d", "f", "g"),
}


# -- SCD41 helpers ------------------------------------------------------------
def scd41_stop(i2c):
    """Cancel any in-progress periodic measurement and wait for the sensor to
    return to idle. Required before re-issuing start_periodic_measurement on a
    sensor that's already running — otherwise the SCD41 may NACK the start
    command, and on the RP2040 a NACK during a clock-stretched window can
    wedge the I2C peripheral. ~500 ms settle per Sensirion datasheet."""
    try:
        i2c.writeto(SCD41_ADDR, SCD41_CMD_STOP)
    except OSError:
        # Sensor wasn't in measurement mode; that's fine.
        pass
    time.sleep_ms(500)


def scd41_start(i2c):
    # Defensive: always stop first so a re-run after soft reboot doesn't wedge.
    scd41_stop(i2c)
    i2c.writeto(SCD41_ADDR, SCD41_CMD_START)


def scd41_is_ready(i2c):
    i2c.writeto(SCD41_ADDR, SCD41_CMD_READY)
    time.sleep_ms(1)
    raw = i2c.readfrom(SCD41_ADDR, 3)
    return bool((raw[0] << 8 | raw[1]) & 0x07FF)


def scd41_read_co2(i2c):
    """Return CO2 ppm when a fresh reading is available, else None."""
    if not scd41_is_ready(i2c):
        return None
    i2c.writeto(SCD41_ADDR, SCD41_CMD_READ)
    time.sleep_ms(1)
    raw = i2c.readfrom(SCD41_ADDR, 9)
    return (raw[0] << 8) | raw[1]


# -- BME280 helpers -----------------------------------------------------------
def _u16_le(buf, index):
    return buf[index] | (buf[index + 1] << 8)


def _s16_le(buf, index):
    value = _u16_le(buf, index)
    return value - 65536 if value > 32767 else value


def _s16(value):
    return value - 65536 if value > 32767 else value


def _s12(value):
    return value - 4096 if value & 0x800 else value


class BME280:
    def __init__(self, i2c, address):
        self.i2c = i2c
        self.address = address
        self.t_fine = 0
        self._read_calibration()
        self._configure()

    def _write8(self, register, value):
        self.i2c.writeto_mem(self.address, register, bytes((value,)))

    def _read(self, register, length):
        return self.i2c.readfrom_mem(self.address, register, length)

    def _read_calibration(self):
        calib1 = self._read(0x88, 24)
        calib2 = self._read(0xA1, 1)
        calib3 = self._read(0xE1, 7)

        self.dig_T1 = _u16_le(calib1, 0)
        self.dig_T2 = _s16_le(calib1, 2)
        self.dig_T3 = _s16_le(calib1, 4)

        self.dig_P1 = _u16_le(calib1, 6)
        self.dig_P2 = _s16_le(calib1, 8)
        self.dig_P3 = _s16_le(calib1, 10)
        self.dig_P4 = _s16_le(calib1, 12)
        self.dig_P5 = _s16_le(calib1, 14)
        self.dig_P6 = _s16_le(calib1, 16)
        self.dig_P7 = _s16_le(calib1, 18)
        self.dig_P8 = _s16_le(calib1, 20)
        self.dig_P9 = _s16_le(calib1, 22)

        self.dig_H1 = calib2[0]
        self.dig_H2 = _s16_le(calib3, 0)
        self.dig_H3 = calib3[2]
        self.dig_H4 = _s12((calib3[3] << 4) | (calib3[4] & 0x0F))
        self.dig_H5 = _s12((calib3[5] << 4) | (calib3[4] >> 4))
        self.dig_H6 = calib3[6] - 256 if calib3[6] > 127 else calib3[6]

    def _configure(self):
        self._write8(0xE0, 0xB6)
        time.sleep_ms(5)

        self._write8(0xF2, 0x01)  # humidity oversampling x1
        self._write8(0xF5, 0xA0)  # standby 1000 ms, filter off
        self._write8(0xF4, 0x27)  # temp x1, pressure x1, normal mode
        time.sleep_ms(10)

    def read_measurements(self):
        raw = self._read(0xF7, 8)

        adc_p = (raw[0] << 12) | (raw[1] << 4) | (raw[2] >> 4)
        adc_t = (raw[3] << 12) | (raw[4] << 4) | (raw[5] >> 4)
        adc_h = (raw[6] << 8) | raw[7]

        var1 = (((adc_t >> 3) - (self.dig_T1 << 1)) * self.dig_T2) >> 11
        var2 = (
            ((((adc_t >> 4) - self.dig_T1) * ((adc_t >> 4) - self.dig_T1)) >> 12)
            * self.dig_T3
        ) >> 14
        self.t_fine = var1 + var2
        temp_c = ((self.t_fine * 5 + 128) >> 8) / 100.0

        var1 = self.t_fine - 128000
        var2 = var1 * var1 * self.dig_P6
        var2 = var2 + ((var1 * self.dig_P5) << 17)
        var2 = var2 + (self.dig_P4 << 35)
        var1 = ((var1 * var1 * self.dig_P3) >> 8) + ((var1 * self.dig_P2) << 12)
        var1 = (((1 << 47) + var1) * self.dig_P1) >> 33

        pressure_hpa = None
        if var1 != 0:
            pressure = 1048576 - adc_p
            pressure = (((pressure << 31) - var2) * 3125) // var1
            var1 = (self.dig_P9 * (pressure >> 13) * (pressure >> 13)) >> 25
            var2 = (self.dig_P8 * pressure) >> 19
            pressure = ((pressure + var1 + var2) >> 8) + (self.dig_P7 << 4)
            pressure_hpa = (pressure / 256.0) / 100.0

        # Bosch BME280 humidity compensation. Do NOT reformat / re-wrap this
        # expression — the second factor's `>> 14` MUST stay inside its parens.
        # Black/ruff happily promote it out, which silently corrupts the result
        # because in Python `*` binds tighter than `>>`, so `A * B >> 14`
        # parses as `(A * B) >> 14`, not `A * (B >> 14)`. fmt: off
        humidity = self.t_fine - 76800
        humidity = (
            (((adc_h << 14) - (self.dig_H4 << 20) - (self.dig_H5 * humidity)) + 16384)
            >> 15
        ) * (
            (
                (
                    (
                        (
                            ((humidity * self.dig_H6) >> 10)
                            * (((humidity * self.dig_H3) >> 11) + 32768)
                        )
                        >> 10
                    )
                    + 2097152
                )
                * self.dig_H2
                + 8192
            )
            >> 14
        )
        humidity = humidity - (
            ((((humidity >> 15) * (humidity >> 15)) >> 7) * self.dig_H1) >> 4
        )
        # fmt: on
        if humidity < 0:
            humidity = 0
        if humidity > 419430400:
            humidity = 419430400
        humidity_q10 = humidity >> 12
        humidity_raw = humidity_q10 / 1024.0
        humidity = humidity_raw
        if humidity > 100.0:
            humidity = 100.0

        return {
            "temp_c": temp_c,
            "humidity": humidity,
            "pressure_hpa": pressure_hpa,
        }


def init_bme280(i2c):
    for address in BME280_ADDRS:
        try:
            chip_id = i2c.readfrom_mem(address, 0xD0, 1)[0]
        except OSError:
            continue
        if chip_id == BME280_CHIP_ID:
            return BME280(i2c, address)
    return None


# -- Formatting helpers -------------------------------------------------------
def text_size(text, scale):
    return len(text) * 8 * scale, 8 * scale


def draw_text_scaled(epd, text, x, y, scale=1, color=BLACK):
    if scale <= 1:
        epd.text(text, x, y, color)
        return

    width = len(text) * 8
    row_bytes = (width + 7) // 8
    buf = bytearray(row_bytes * 8)
    glyphs = framebuf.FrameBuffer(buf, width, 8, framebuf.MONO_HLSB)
    glyphs.fill(0)
    glyphs.text(text, 0, 0, 1)

    for px in range(width):
        for py in range(8):
            if glyphs.pixel(px, py):
                epd.fill_rect(x + px * scale, y + py * scale, scale, scale, color)


def draw_text_centered(epd, text, x, y, w, h, scale=1, color=BLACK):
    text_w, text_h = text_size(text, scale)
    draw_x = x + max(0, (w - text_w) // 2)
    draw_y = y + max(0, (h - text_h) // 2)
    draw_text_scaled(epd, text, draw_x, draw_y, scale=scale, color=color)


def draw_badge(epd, text, x, y, w, h):
    epd.fill_rect(x, y, w, h, BLACK)
    epd.rect(x, y, w, h, BLACK)
    scale = 2 if len(text) <= 3 and w >= len(text) * 16 + 8 else 1
    draw_text_centered(epd, text, x, y, w, h, scale=scale, color=WHITE)


def draw_status_pip(epd, letter, x, y, w, h, lit):
    """Tiny solid/outline box used as a WiFi/MQTT indicator."""
    if lit:
        epd.fill_rect(x, y, w, h, BLACK)
        draw_text_centered(epd, letter, x, y, w, h, scale=1, color=WHITE)
    else:
        epd.rect(x, y, w, h, BLACK)
        draw_text_centered(epd, letter, x, y, w, h, scale=1, color=BLACK)


def draw_net_status(epd, x, y, wifi_ok, mqtt_ok):
    """Draw two pips side by side at (x, y). Total footprint: 32 x 16."""
    pip_w, pip_h, gap = 14, 16, 4
    draw_status_pip(epd, "W", x, y, pip_w, pip_h, wifi_ok)
    draw_status_pip(epd, "M", x + pip_w + gap, y, pip_w, pip_h, mqtt_ok)


def format_temp(temp_c):
    if temp_c is None:
        return "--.-", TEMP_UNIT

    value = temp_c
    if TEMP_UNIT == "F":
        value = temp_c * 9.0 / 5.0 + 32.0
    return "{:.1f}".format(value), TEMP_UNIT


def format_humidity(humidity):
    if humidity is None:
        return "--", "%"
    return "{:.0f}".format(humidity), "%"


def format_pressure(pressure_hpa):
    if pressure_hpa is None:
        return "--.- hPa"
    return "{:.1f} hPa".format(pressure_hpa)


def format_co2(co2_ppm):
    if co2_ppm is None:
        return "----"
    return str(int(co2_ppm))


def classify_co2(co2_ppm):
    if co2_ppm is None:
        return "WAIT"
    if co2_ppm <= 800:
        return "FRESH"
    if co2_ppm <= 1200:
        return "OK"
    if co2_ppm <= 2000:
        return "STALE"
    return "HIGH"


def snapshot_for_screen(measurements, screen_name):
    temp_value, temp_unit = format_temp(measurements["temp_c"])
    hum_value, hum_unit = format_humidity(measurements["humidity"])
    pressure = format_pressure(measurements["pressure_hpa"])
    return (
        screen_name,
        format_co2(measurements["co2"]),
        classify_co2(measurements["co2"]),
        temp_value,
        temp_unit,
        hum_value,
        hum_unit,
        pressure,
        measurements["bme_ok"],
        measurements.get("wifi_ok", False),
        measurements.get("mqtt_ok", False),
    )


# -- CO2 full-screen display helpers -----------------------------------------
def draw_segment(epd, x, y, w, h):
    if w > 0 and h > 0:
        epd.fill_rect(x, y, w, h, BLACK)


def draw_digit(epd, digit, x, y, w=44, h=74, thickness=8):
    if digit not in SEGMENTS:
        return

    mid_y = y + h // 2 - thickness // 2
    half_h = h // 2
    vertical_h = half_h - thickness

    segments = {
        "a": (x + thickness, y, w - 2 * thickness, thickness),
        "b": (x + w - thickness, y + thickness, thickness, vertical_h),
        "c": (x + w - thickness, y + half_h, thickness, vertical_h),
        "d": (x + thickness, y + h - thickness, w - 2 * thickness, thickness),
        "e": (x, y + half_h, thickness, vertical_h),
        "f": (x, y + thickness, thickness, vertical_h),
        "g": (x + thickness, mid_y, w - 2 * thickness, thickness),
    }

    epd.rect(x, y, w, h, BLACK)
    for name in SEGMENTS[digit]:
        draw_segment(epd, *segments[name])


def draw_co2_scale(epd, co2_ppm):
    x = 16
    y = 106
    w = 264
    h = 10
    min_ppm = 400
    max_ppm = 2400

    epd.rect(x, y, w, h, BLACK)

    for stop in (800, 1200, 2000):
        stop_x = x + ((stop - min_ppm) * (w - 1)) // (max_ppm - min_ppm)
        epd.vline(stop_x, y, h, BLACK)

    pointer_ppm = min(max(co2_ppm, min_ppm), max_ppm)
    pointer_x = x + ((pointer_ppm - min_ppm) * (w - 1)) // (max_ppm - min_ppm)
    epd.fill_rect(pointer_x - 2, y - 4, 5, h + 8, BLACK)
    epd.fill_rect(pointer_x - 1, y - 2, 3, h + 4, WHITE)

    epd.text("400", x, 118, BLACK)
    epd.text("800", x + 46, 118, BLACK)
    epd.text("1200", x + 95, 118, BLACK)
    epd.text("2000+", x + 204, 118, BLACK)


def draw_co2_full(epd, measurements):
    co2_ppm = measurements["co2"]
    epd.fill(WHITE)
    epd.rect(2, 2, DISPLAY_WIDTH - 4, DISPLAY_HEIGHT - 4, BLACK)
    epd.hline(2, 36, DISPLAY_WIDTH - 4, BLACK)

    draw_badge(epd, "CO2", 10, 8, 58, 22)
    draw_net_status(
        epd,
        74,
        9,
        measurements.get("wifi_ok", False),
        measurements.get("mqtt_ok", False),
    )
    epd.text("INDOOR AIR", 124, 14, BLACK)
    draw_badge(epd, classify_co2(co2_ppm), 220, 8, 66, 22)

    value = format_co2(co2_ppm)
    digit_w = 44
    digit_h = 74
    gap = 8
    digits_area_x = 12
    digits_area_w = 210
    total_w = len(value) * digit_w + max(0, len(value) - 1) * gap
    start_x = digits_area_x + max(0, (digits_area_w - total_w) // 2)
    start_y = 28

    for index, digit in enumerate(value):
        draw_digit(
            epd, digit, start_x + index * (digit_w + gap), start_y, digit_w, digit_h, 8
        )

    epd.rect(232, 54, 48, 24, BLACK)
    draw_text_scaled(epd, "ppm", 240, 58, scale=2, color=BLACK)
    draw_co2_scale(epd, co2_ppm)


# -- Dashboard helpers --------------------------------------------------------
def draw_metric_card(epd, title, value, unit, x, y, w, h):
    epd.rect(x, y, w, h, BLACK)
    epd.text(title, x + 6, y + 5, BLACK)

    value_scale = 2
    value_w, value_h = text_size(value, value_scale)
    unit_w, unit_h = text_size(unit, 1)
    total_w = value_w + 4 + unit_w
    start_x = x + max(6, (w - total_w) // 2)
    value_y = y + h - value_h - 7
    unit_y = y + h - unit_h - 8

    draw_text_scaled(epd, value, start_x, value_y, scale=value_scale, color=BLACK)
    epd.text(unit, start_x + value_w + 4, unit_y, BLACK)


def draw_dashboard(epd, measurements):
    co2_text = format_co2(measurements["co2"])
    temp_value, temp_unit = format_temp(measurements["temp_c"])
    hum_value, hum_unit = format_humidity(measurements["humidity"])

    epd.fill(WHITE)
    epd.rect(2, 2, DISPLAY_WIDTH - 4, DISPLAY_HEIGHT - 4, BLACK)
    draw_badge(epd, "AIR", 10, 8, 48, 20)
    draw_net_status(
        epd,
        64,
        9,
        measurements.get("wifi_ok", False),
        measurements.get("mqtt_ok", False),
    )
    draw_badge(epd, classify_co2(measurements["co2"]), 222, 8, 64, 20)

    epd.text("CO2", 16, 34, BLACK)
    epd.text("ppm", 147, 34, BLACK)

    draw_text_scaled(epd, co2_text, 18, 46, scale=4, color=BLACK)
    epd.text("living space", 18, 90, BLACK)

    draw_metric_card(epd, "TEMP", temp_value, temp_unit, 194, 30, 92, 40)
    draw_metric_card(epd, "HUMID", hum_value, hum_unit, 194, 74, 92, 40)

    epd.hline(10, 102, 170, BLACK)
    if measurements["bme_ok"]:
        epd.text("Pressure", 16, 108, BLACK)
        epd.text(format_pressure(measurements["pressure_hpa"]), 88, 108, BLACK)
    else:
        epd.text("BME280 not detected yet", 16, 108, BLACK)


def draw_startup(epd, bme_ok):
    epd.fill(WHITE)
    epd.rect(2, 2, DISPLAY_WIDTH - 4, DISPLAY_HEIGHT - 4, BLACK)
    draw_badge(epd, "AIR", 10, 10, 48, 20)
    draw_text_scaled(epd, "warming up", 56, 28, scale=2, color=BLACK)
    epd.text("SCD41 CO2 sensor starting", 34, 66, BLACK)
    if bme_ok:
        epd.text("BME280 climate sensor ready", 34, 82, BLACK)
    else:
        epd.text("BME280 climate sensor pending", 24, 82, BLACK)
    epd.text("first CO2 reading in about 5 seconds", 22, 102, BLACK)
    epd.display_Base(epd.buffer)


def render_screen(epd, measurements, screen_name, full_refresh=False):
    if screen_name == "co2":
        draw_co2_full(epd, measurements)
    else:
        draw_dashboard(epd, measurements)

    if full_refresh:
        epd.display_Base(epd.buffer)
    else:
        epd.display_Partial(epd.buffer)


def button_was_pressed(button, last_button_state, last_press_ms, now_ms):
    current_state = button.value()
    pressed = False

    if last_button_state == 1 and current_state == 0:
        if time.ticks_diff(now_ms, last_press_ms) >= BUTTON_DEBOUNCE_MS:
            pressed = True
            last_press_ms = now_ms

    return pressed, current_state, last_press_ms


# -- Network helpers ----------------------------------------------------------
def log(msg):
    print("[{}] {}".format(time.ticks_ms(), msg))


def wifi_setup():
    """Activate the WLAN interface and kick off a connect; non-blocking."""
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        log("WiFi: connecting to {}".format(WIFI_SSID))
        try:
            wlan.connect(WIFI_SSID, WIFI_PASSWORD)
        except OSError as e:
            log("WiFi connect call failed: {}".format(e))
    return wlan


def wifi_wait(wlan, timeout_ms):
    """Block briefly waiting for a freshly-issued connect to finish."""
    deadline = time.ticks_add(time.ticks_ms(), timeout_ms)
    while not wlan.isconnected():
        if time.ticks_diff(deadline, time.ticks_ms()) <= 0:
            return False
        time.sleep_ms(200)
    return True


def mqtt_make_client():
    if MQTTClient is None:
        return None
    # MQTT client_id only needs to be unique per broker connection — use the
    # device_id directly now that this firmware publishes under two sensor types.
    client_id = DEVICE_ID
    client = MQTTClient(
        client_id=client_id,
        server=MQTT_BROKER,
        port=MQTT_PORT,
        user=MQTT_USERNAME,
        password=MQTT_PASSWORD,
        keepalive=60,
    )
    # Last Will: if the broker stops hearing from us, it publishes "offline"
    # (retained) so dashboards / Node-RED can detect dead devices.
    try:
        client.set_last_will(MQTT_STATUS_TOPIC, b"offline", retain=True, qos=0)
    except Exception as e:
        log("Warning: could not register LWT: {}".format(e))
    return client


def _uptime_s():
    return time.ticks_diff(time.ticks_ms(), _BOOT_TICKS) // 1000


def mqtt_try_connect(client, wlan=None):
    """Connect + publish retained 'online' status + one-shot meta. Returns True
    on success."""
    if client is None:
        return False
    try:
        log(
            "MQTT: connecting to {}:{} as {}".format(
                MQTT_BROKER, MQTT_PORT, MQTT_USERNAME
            )
        )
        client.connect()
        try:
            client.publish(MQTT_STATUS_TOPIC, b"online", retain=True)
        except OSError as e:
            log("MQTT status publish failed: {}".format(e))
        # One-shot retained meta (firmware / identity / IP). Best-effort.
        try:
            meta = {
                "fw": FW_VERSION,
                "project": PROJECT,
                "position": POSITION,
                "device_id": DEVICE_ID,
                "sensors": ["scd41", "bme280"],
            }
            if wlan is not None and wlan.isconnected():
                try:
                    meta["ip"] = wlan.ifconfig()[0]
                except Exception:
                    pass
            client.publish(
                MQTT_META_TOPIC, json.dumps(meta).encode("utf-8"), retain=True
            )
        except (OSError, Exception) as e:
            log("MQTT meta publish failed: {}".format(e))
        log("MQTT: connected")
        return True
    except (OSError, Exception) as e:
        log("MQTT connect failed: {}".format(e))
        return False


def build_payloads(measurements):
    """Return (scd41_payload, bme280_payload). Either may be None if that
    sensor isn't currently producing fresh data.

    Per SENSOR_PLATFORM.md §8, when one physical board hosts multiple sensor
    ICs, each gets its own MQTT message on its own topic. So the SCD41 publish
    carries ONLY co2_ppm (its actual measurement), and the BME280 publish
    carries temperature / humidity / pressure.

    Identifiers live in the topic (not the payload). `ts` is omitted —
    Node-RED stamps on receive.
    """
    base = {"fw": FW_VERSION, "uptime_s": _uptime_s()}

    co2 = measurements.get("co2")
    scd41 = None
    if co2 is not None:
        scd41 = dict(base, co2_ppm=int(co2))

    temp_c = measurements.get("temp_c")
    humidity = measurements.get("humidity")
    pressure_hpa = measurements.get("pressure_hpa")
    bme280 = None
    if temp_c is not None or humidity is not None or pressure_hpa is not None:
        bme280 = dict(base)
        if temp_c is not None:
            bme280["temperature_c"] = round(temp_c, 2)
        if humidity is not None:
            bme280["humidity_rh"] = round(humidity, 2)
        if pressure_hpa is not None:
            bme280["pressure_hpa"] = round(pressure_hpa, 2)

    return scd41, bme280


def _draw_fatal(epd, title, detail):
    """Render a clearly-visible 'this device failed at boot' screen instead of
    leaving the display blank (the default state after Clear() before any
    other render). Helps diagnose problems without USB serial attached."""
    try:
        epd.fill(WHITE)
        epd.rect(2, 2, DISPLAY_WIDTH - 4, DISPLAY_HEIGHT - 4, BLACK)
        draw_text_scaled(epd, "BOOT FAIL", 12, 12, scale=2, color=BLACK)
        epd.text(title, 12, 50, BLACK)
        # Wrap detail across two short lines if it's long.
        epd.text(detail[:36], 12, 70, BLACK)
        if len(detail) > 36:
            epd.text(detail[36:72], 12, 86, BLACK)
        epd.text("check USB serial for full traceback", 12, 108, BLACK)
        epd.display_Base(epd.buffer)
    except Exception as render_err:
        print("Could not render fatal screen: {}".format(render_err))


# -- Main ---------------------------------------------------------------------
def main():
    print(
        "Booting savage SCD41 publisher: project={} position={} device_id={} fw={}".format(
            PROJECT, POSITION, DEVICE_ID, FW_VERSION
        )
    )
    print("Telemetry topics: {} + {}".format(MQTT_TOPIC_SCD41, MQTT_TOPIC_BME280))

    i2c = I2C(0, sda=Pin(I2C_SDA), scl=Pin(I2C_SCL), freq=100_000)
    button = Pin(BUTTON_PIN, Pin.IN, Pin.PULL_UP)
    epd = EPD_2in9_Landscape()
    epd.Clear(WHITE)

    # Probe the I2C bus so we get an early, visible diagnostic instead of
    # crashing later with a bare OSError if something isn't wired up.
    devices = i2c.scan()
    print("[1/6] I2C scan: {}".format([hex(d) for d in devices]))
    if SCD41_ADDR not in devices:
        msg = "SCD41 (0x62) not on I2C bus"
        print("FATAL: " + msg)
        print(
            "  Devices found: {}".format([hex(d) for d in devices])
            if devices
            else "  Bus is empty — check SDA(GP4)/SCL(GP5)/VDD(3V3)/GND wiring."
        )
        _draw_fatal(
            epd,
            "SCD41 not detected",
            "i2c.scan() = {}".format(
                [hex(d) for d in devices] if devices else "(empty)"
            ),
        )
        while True:
            time.sleep(60)

    print("[2/6] Stopping any in-progress SCD41 measurement...")
    try:
        scd41_stop(i2c)
    except Exception as e:
        print("  scd41_stop raised (continuing): {}".format(e))

    print("[3/6] Starting SCD41 periodic measurement...")
    try:
        # NB: scd41_start internally calls scd41_stop again — cheap, idempotent.
        i2c.writeto(SCD41_ADDR, SCD41_CMD_START)
    except OSError as e:
        msg = "scd41 start_periodic_measurement failed: {}".format(e)
        print("FATAL: " + msg)
        _draw_fatal(epd, "SCD41 start failed", str(e))
        while True:
            time.sleep(60)

    print("[4/6] Probing BME280...")
    bme280 = init_bme280(i2c)
    if bme280 is None:
        print("  BME280 not detected on 0x76 or 0x77 (optional, continuing)")
    else:
        print("  BME280 detected at 0x{:02X}".format(bme280.address))

    print("[5/6] Rendering startup screen...")
    draw_startup(epd, bme280 is not None)
    print("[6/6] Waiting for first SCD41 reading (~5 s)...")
    time.sleep(5)

    # -- Network bring-up (best-effort, non-fatal) ----------------------------
    wlan = None
    mqtt_client = None
    wifi_ok = False
    mqtt_ok = False
    next_wifi_attempt_ms = time.ticks_ms()
    next_mqtt_attempt_ms = time.ticks_ms()
    next_publish_ms = time.ticks_ms()

    if NET_ENABLED:
        wlan = wifi_setup()
        # Give the radio a brief window to associate so the very first publish
        # cycle has a chance to succeed; if it doesn't, the main loop retries.
        wifi_ok = wifi_wait(wlan, WIFI_CONNECT_TIMEOUT_MS)
        if wifi_ok:
            log("WiFi: connected, IP {}".format(wlan.ifconfig()[0]))
            mqtt_client = mqtt_make_client()
            mqtt_ok = mqtt_try_connect(mqtt_client, wlan)
        else:
            log("WiFi: not connected yet, will keep trying in background")
    else:
        log("Networking disabled (missing config or umqtt.simple); display-only mode")

    active_screen_index = DEFAULT_SCREEN_INDEX
    last_snapshot = None
    last_co2 = None
    last_full_refresh_ms = time.ticks_ms()
    force_redraw = False
    last_button_state = button.value()
    last_press_ms = time.ticks_ms()
    next_sample_ms = time.ticks_ms()
    measurements = {
        "co2": None,
        "temp_c": None,
        "humidity": None,
        "pressure_hpa": None,
        "bme_ok": bme280 is not None,
        "wifi_ok": wifi_ok,
        "mqtt_ok": mqtt_ok,
    }

    while True:
        now_ms = time.ticks_ms()

        pressed, last_button_state, last_press_ms = button_was_pressed(
            button,
            last_button_state,
            last_press_ms,
            now_ms,
        )
        if pressed:
            active_screen_index = (active_screen_index + 1) % len(SCREEN_SEQUENCE)
            force_redraw = True
            print("Screen: {}".format(SCREEN_SEQUENCE[active_screen_index]))

        if time.ticks_diff(now_ms, next_sample_ms) >= 0:
            co2 = scd41_read_co2(i2c)
            if co2 is not None:
                last_co2 = co2
                print("CO2: {} ppm".format(co2))

            climate = {"temp_c": None, "humidity": None, "pressure_hpa": None}
            bme_ok = False

            if bme280 is None:
                bme280 = init_bme280(i2c)
                if bme280 is not None:
                    print("BME280 detected at 0x{:02X}".format(bme280.address))

            if bme280 is not None:
                try:
                    climate = bme280.read_measurements()
                    bme_ok = True
                except OSError:
                    print("BME280 read failed, will retry")
                    bme280 = None

            measurements = {
                "co2": last_co2,
                "temp_c": climate["temp_c"],
                "humidity": climate["humidity"],
                "pressure_hpa": climate["pressure_hpa"],
                "bme_ok": bme_ok,
                "wifi_ok": wifi_ok,
                "mqtt_ok": mqtt_ok,
            }
            next_sample_ms = time.ticks_add(now_ms, POLL_SEC * 1000)

        # -- Network maintenance + publish -----------------------------------
        if NET_ENABLED:
            # WiFi: if dropped, retry on an interval (without blocking the UI)
            if wlan is not None and not wlan.isconnected():
                if wifi_ok:
                    log("WiFi: link dropped")
                wifi_ok = False
                mqtt_ok = False
                if time.ticks_diff(now_ms, next_wifi_attempt_ms) >= 0:
                    try:
                        wlan.connect(WIFI_SSID, WIFI_PASSWORD)
                    except OSError as e:
                        log("WiFi reconnect call failed: {}".format(e))
                    next_wifi_attempt_ms = time.ticks_add(
                        now_ms, WIFI_RECONNECT_INTERVAL_MS
                    )
            elif wlan is not None and wlan.isconnected() and not wifi_ok:
                wifi_ok = True
                log("WiFi: connected, IP {}".format(wlan.ifconfig()[0]))

            # MQTT: only attempt while WiFi is up
            if wifi_ok and not mqtt_ok:
                if time.ticks_diff(now_ms, next_mqtt_attempt_ms) >= 0:
                    if mqtt_client is None:
                        mqtt_client = mqtt_make_client()
                    mqtt_ok = mqtt_try_connect(mqtt_client, wlan)
                    next_mqtt_attempt_ms = time.ticks_add(
                        now_ms, MQTT_RECONNECT_INTERVAL_MS
                    )

            # Publish on cadence (skip if no fresh CO2 reading yet)
            if (
                mqtt_ok
                and mqtt_client is not None
                and measurements["co2"] is not None
                and time.ticks_diff(now_ms, next_publish_ms) >= 0
            ):
                scd_payload, bme_payload = build_payloads(measurements)
                publish_failed = False
                if scd_payload is not None:
                    try:
                        mqtt_client.publish(MQTT_TOPIC_SCD41, json.dumps(scd_payload))
                    except (OSError, Exception) as e:
                        log("SCD41 publish failed: {}".format(e))
                        publish_failed = True
                if bme_payload is not None and not publish_failed:
                    try:
                        mqtt_client.publish(MQTT_TOPIC_BME280, json.dumps(bme_payload))
                    except (OSError, Exception) as e:
                        log("BME280 publish failed: {}".format(e))
                        publish_failed = True
                if publish_failed:
                    mqtt_ok = False
                    try:
                        mqtt_client.disconnect()
                    except Exception:
                        pass
                else:
                    log(
                        "Published: CO2={} T={} RH={} P={}".format(
                            scd_payload.get("co2_ppm") if scd_payload else None,
                            bme_payload.get("temperature_c") if bme_payload else None,
                            bme_payload.get("humidity_rh") if bme_payload else None,
                            bme_payload.get("pressure_hpa") if bme_payload else None,
                        )
                    )
                next_publish_ms = time.ticks_add(now_ms, PUBLISH_INTERVAL_S * 1000)

            # Keep the connection alive between publishes
            if mqtt_ok and mqtt_client is not None:
                try:
                    mqtt_client.check_msg()
                except (OSError, Exception) as e:
                    log("MQTT check_msg failed: {}".format(e))
                    mqtt_ok = False

            # Reflect any net-state change into measurements so the display
            # snapshot detects it and redraws the W/M pips.
            if (
                measurements.get("wifi_ok") != wifi_ok
                or measurements.get("mqtt_ok") != mqtt_ok
            ):
                measurements["wifi_ok"] = wifi_ok
                measurements["mqtt_ok"] = mqtt_ok

        if measurements["co2"] is not None:
            screen_name = SCREEN_SEQUENCE[active_screen_index]
            snapshot = snapshot_for_screen(measurements, screen_name)
            if force_redraw or snapshot != last_snapshot:
                full_refresh = (
                    last_snapshot is None
                    or time.ticks_diff(now_ms, last_full_refresh_ms)
                    >= FULL_REFRESH_INTERVAL_MS
                )
                render_screen(epd, measurements, screen_name, full_refresh=full_refresh)
                last_snapshot = snapshot
                if full_refresh:
                    last_full_refresh_ms = now_ms
                force_redraw = False

        time.sleep_ms(UI_POLL_MS)


main()
