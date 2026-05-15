# CO2 Display  —  Pi Pico W v1
# Hardware: SCD41 (I2C0) + Waveshare 2.9" e-Paper V2 (SPI1)
#
# Before running, download the driver from Waveshare and copy it to your Pico:
#   https://github.com/waveshareteam/Pico_ePaper_Code/blob/main/python/Pico_ePaper-2.9.py
#   Rename it to  epaper_2in9.py  (Python can't import filenames with hyphens)
#
# Wiring (from your chat):
#   SCD41  SDA → GP4 | SCL → GP5 | VDD → 3V3 | GND → GND
#   e-Paper DIN→GP11 | CLK→GP10 | CS→GP9 | DC→GP8 | RST→GP12 | BUSY→GP13

from machine import I2C, Pin
import framebuf
import time
from epaper_2in9 import EPD_2in9_Landscape   # renamed driver file

# ── SCD41 constants ─────────────────────────────────────────
I2C_SDA      = 4
I2C_SCL      = 5
SCD41_ADDR   = 0x62
CMD_START    = b'\x21\xb1'   # start_periodic_measurement
CMD_READY    = b'\xe4\xb8'   # get_data_ready_status
CMD_READ     = b'\xec\x05'   # read_measurement

POLL_SEC     = 5             # SCD41 produces a new reading every 5 s
FULL_REFRESH_EVERY = 12      # periodic cleanup refresh to reduce ghosting

DISPLAY_WIDTH  = 296
DISPLAY_HEIGHT = 128
WHITE          = 0xff
BLACK          = 0x00

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

# ── SCD41 helpers ────────────────────────────────────────────
def scd41_start(i2c):
    i2c.writeto(SCD41_ADDR, CMD_START)

def scd41_is_ready(i2c):
    i2c.writeto(SCD41_ADDR, CMD_READY)
    time.sleep_ms(1)
    raw = i2c.readfrom(SCD41_ADDR, 3)
    return bool((raw[0] << 8 | raw[1]) & 0x07FF)

def scd41_read_co2(i2c):
    """Return CO2 ppm (int) when a fresh reading is available, else None."""
    if not scd41_is_ready(i2c):
        return None
    i2c.writeto(SCD41_ADDR, CMD_READ)
    time.sleep_ms(1)
    raw = i2c.readfrom(SCD41_ADDR, 9)
    return (raw[0] << 8) | raw[1]   # bytes 0-1 = CO2; rest = temp/hum (unused)

# ── Display helpers ──────────────────────────────────────────
def draw_text_scaled(epd, text, x, y, scale=1, color=BLACK):
    """Draw text using the built-in 8px font, scaled up by integer multiples."""
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


def draw_badge(epd, text, x, y, w, h):
    epd.fill_rect(x, y, w, h, BLACK)
    epd.rect(x, y, w, h, BLACK)
    scale = 2 if len(text) <= 3 and w >= len(text) * 16 + 8 else 1
    text_w = len(text) * 8 * scale
    text_h = 8 * scale
    text_x = x + max(4, (w - text_w) // 2)
    text_y = y + max(2, (h - text_h) // 2)
    draw_text_scaled(epd, text, text_x, text_y, scale=scale, color=WHITE)


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


def classify_co2(co2_ppm):
    if co2_ppm <= 800:
        return "FRESH"
    if co2_ppm <= 1200:
        return "OK"
    if co2_ppm <= 2000:
        return "STALE"
    return "HIGH"


def draw_scale(epd, co2_ppm):
    x = 16
    y = 106
    w = 264
    h = 10
    min_ppm = 400
    max_ppm = 2400

    epd.rect(x, y, w, h, BLACK)

    stops = (800, 1200, 2000)
    for stop in stops:
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


def draw_header(epd, co2_ppm):
    draw_badge(epd, "CO2", 10, 8, 58, 22)
    epd.text("INDOOR AIR", 104, 14, BLACK)
    draw_badge(epd, classify_co2(co2_ppm), 220, 8, 66, 22)


def draw_value(epd, co2_ppm):
    value = str(max(0, int(co2_ppm)))
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


def draw_co2(epd, co2_ppm, full_refresh=False):
    """Render the CO2 dashboard on the e-paper display."""
    epd.fill(WHITE)
    epd.rect(2, 2, DISPLAY_WIDTH - 4, DISPLAY_HEIGHT - 4, BLACK)
    epd.hline(2, 36, DISPLAY_WIDTH - 4, BLACK)

    draw_header(epd, co2_ppm)
    draw_value(epd, co2_ppm)
    draw_scale(epd, co2_ppm)

    if full_refresh:
        epd.display_Base(epd.buffer)
    else:
        epd.display_Partial(epd.buffer)


def draw_startup(epd):
    epd.fill(WHITE)
    epd.rect(2, 2, DISPLAY_WIDTH - 4, DISPLAY_HEIGHT - 4, BLACK)
    draw_badge(epd, "CO2", 10, 10, 58, 22)
    draw_text_scaled(epd, "SCD41", 92, 22, scale=3, color=BLACK)
    draw_text_scaled(epd, "warming up", 64, 60, scale=2, color=BLACK)
    epd.text("first reading in about 5 seconds", 40, 100, BLACK)
    epd.display_Base(epd.buffer)

# ── Main ─────────────────────────────────────────────────────
def main():
    i2c = I2C(0, sda=Pin(I2C_SDA), scl=Pin(I2C_SCL), freq=100_000)

    epd = EPD_2in9_Landscape()
    epd.Clear(WHITE)

    scd41_start(i2c)
    draw_startup(epd)
    print("Waiting for first SCD41 reading (~5 s)...")
    time.sleep(5)

    last_co2 = None
    updates_since_full = 0

    while True:
        co2 = scd41_read_co2(i2c)
        if co2 is not None and co2 != last_co2:
            print(f"CO2: {co2} ppm")
            full_refresh = last_co2 is None or updates_since_full >= FULL_REFRESH_EVERY
            draw_co2(epd, co2, full_refresh=full_refresh)
            last_co2 = co2
            updates_since_full = 0 if full_refresh else updates_since_full + 1
        time.sleep(POLL_SEC)

main()
