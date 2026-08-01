# Hardware and Wiring

## Bill of materials

- **ESP32-S3** dev board (generic **N16R8** — 16 MB flash / 8 MB PSRAM)
- **24 GHz mmWave** human-presence radar with UART output (LD2410-family or
  similar exposing presence / distance / energy)
- Optional **LDR / photodiode** for ambient light (if the radar doesn't report lux)
- **WS2812 / NeoPixel** (2 px) or two plain LEDs
- Optional **ST7789** TFT (240×320)

## Default pinout

All pins are configurable in [`firmware/nobify.config.yaml`](../firmware/nobify.config.yaml).

| Function | GPIO | Notes |
| --- | --- | --- |
| mmWave UART RX | 18 | ← radar TX |
| mmWave UART TX | 17 | → radar RX |
| Ambient-light ADC | 1 | LDR divider (only if radar lacks lux) |
| LED data (NeoPixel) | 47 | pixel 0 = WiFi **blue**, 1 = mmWave **orange** |
| LED mmWave (plain) | 48 | only when `leds.neopixel: false` |
| TFT MOSI / SCLK / CS / DC / RST / BL | 11 / 12 / 10 / 13 / 14 / 21 | set in `platformio.ini` |

## Power

- Feed the radar from **5 V** (per its datasheet) and **share ground** with the
  ESP32-S3.
- The ESP32-S3 CDC-on-boot USB provides serial monitor at **115200** baud.

## LED meaning

| LED | Colour | Trigger |
| --- | --- | --- |
| WiFi | 🔵 Blue | WiFi CSI variance indicates motion |
| mmWave | 🟠 Orange | 24 GHz radar reports a human target |

See [[Firmware and OTA]] for how detection, clutter suppression and movement work.
