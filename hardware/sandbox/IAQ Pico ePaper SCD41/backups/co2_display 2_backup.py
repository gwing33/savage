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
def draw_co2(epd, co2_ppm):
    """Render the CO2 value on the e-paper display."""
    epd.fill(0xff)                                 # white background

    label = "CO2 (ppm)"
    value = str(co2_ppm)

    epd.text(label, 100, 10, 0x00)
    epd.text(value, 120, 60, 0x00)

    epd.display(epd.buffer)

# ── Main ─────────────────────────────────────────────────────
def main():
    i2c = I2C(0, sda=Pin(I2C_SDA), scl=Pin(I2C_SCL), freq=100_000)

    epd = EPD_2in9_Landscape()
    epd.init()
    epd.Clear(0xff)

    scd41_start(i2c)
    print("Waiting for first SCD41 reading (~5 s)...")
    time.sleep(5)

    while True:
        co2 = scd41_read_co2(i2c)
        if co2 is not None:
            print(f"CO2: {co2} ppm")
            draw_co2(epd, co2)
        time.sleep(POLL_SEC)

main()

