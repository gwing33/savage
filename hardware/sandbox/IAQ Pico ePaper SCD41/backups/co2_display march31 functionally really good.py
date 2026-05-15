# CO2 Display  -  Pi Pico W v1
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

from machine import I2C, Pin
import framebuf
import time
from epaper_2in9 import EPD_2in9_Landscape


# -- Bus and sensor constants -------------------------------------------------
I2C_SDA = 4
I2C_SCL = 5

SCD41_ADDR = 0x62
SCD41_CMD_START = b"\x21\xb1"
SCD41_CMD_READY = b"\xe4\xb8"
SCD41_CMD_READ = b"\xec\x05"

BME280_CHIP_ID = 0x60
BME280_ADDRS = (0x76, 0x77)

POLL_SEC = 5
FULL_REFRESH_EVERY = 12
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
def scd41_start(i2c):
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
        var2 = (((((adc_t >> 4) - self.dig_T1) * ((adc_t >> 4) - self.dig_T1)) >> 12) * self.dig_T3) >> 14
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

        humidity = self.t_fine - 76800
        humidity = (((((adc_h << 14) - (self.dig_H4 << 20) - (self.dig_H5 * humidity)) + 16384) >> 15) *
                    (((((((humidity * self.dig_H6) >> 10) * (((humidity * self.dig_H3) >> 11) + 32768)) >> 10) +
                       2097152) * self.dig_H2 + 8192) >> 14))
        humidity = humidity - (((((humidity >> 15) * (humidity >> 15)) >> 7) * self.dig_H1) >> 4)
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
    epd.text("INDOOR AIR", 104, 14, BLACK)
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
        draw_digit(epd, digit, start_x + index * (digit_w + gap), start_y, digit_w, digit_h, 8)

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


# -- Main ---------------------------------------------------------------------
def main():
    i2c = I2C(0, sda=Pin(I2C_SDA), scl=Pin(I2C_SCL), freq=100_000)
    button = Pin(BUTTON_PIN, Pin.IN, Pin.PULL_UP)
    epd = EPD_2in9_Landscape()
    epd.Clear(WHITE)

    scd41_start(i2c)
    bme280 = init_bme280(i2c)

    if bme280 is None:
        print("BME280 not detected on 0x76 or 0x77")
    else:
        print("BME280 detected at 0x{:02X}".format(bme280.address))

    draw_startup(epd, bme280 is not None)
    print("Waiting for first SCD41 reading (~5 s)...")
    time.sleep(5)

    active_screen_index = DEFAULT_SCREEN_INDEX
    last_snapshot = None
    last_co2 = None
    updates_since_full = 0
    force_full_refresh = False
    last_button_state = button.value()
    last_press_ms = time.ticks_ms()
    next_sample_ms = time.ticks_ms()
    measurements = {
        "co2": None,
        "temp_c": None,
        "humidity": None,
        "pressure_hpa": None,
        "bme_ok": bme280 is not None,
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
            force_full_refresh = True
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
            }
            next_sample_ms = time.ticks_add(now_ms, POLL_SEC * 1000)

        if measurements["co2"] is not None:
            screen_name = SCREEN_SEQUENCE[active_screen_index]
            snapshot = snapshot_for_screen(measurements, screen_name)
            if force_full_refresh or snapshot != last_snapshot:
                full_refresh = force_full_refresh or last_snapshot is None or updates_since_full >= FULL_REFRESH_EVERY
                render_screen(epd, measurements, screen_name, full_refresh=full_refresh)
                last_snapshot = snapshot
                updates_since_full = 0 if full_refresh else updates_since_full + 1
                force_full_refresh = False

        time.sleep_ms(UI_POLL_MS)


main()
