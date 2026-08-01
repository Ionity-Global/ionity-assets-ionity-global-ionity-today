# Nobify Firmware (ESP32-S3)

Dual-sensor human-presence node for the **ESP32-S3 (generic N16R8)** built with
**PlatformIO** (Arduino framework).

## Wiring (defaults — change in `nobify.config.yaml`)

| Function | GPIO | Notes |
| --- | --- | --- |
| mmWave UART RX | 18 | ← radar TX |
| mmWave UART TX | 17 | → radar RX |
| Ambient-light ADC | 1 | LDR/photodiode (if radar doesn't report lux) |
| LED data (NeoPixel) | 47 | 2 pixels: [0]=WiFi **blue**, [1]=mmWave **orange** |
| LED mmWave (plain mode) | 48 | only if `leds.neopixel: false` |
| TFT (ST7789) | MOSI 11 · SCLK 12 · CS 10 · DC 13 · RST 14 · BL 21 | set in `platformio.ini` |

Power the 24 GHz radar from 5 V (per its datasheet) and share ground with the
ESP32-S3.

## Configure → generate → flash

1. Edit **`nobify.config.yaml`** — WiFi, `server.url`, pins, gates, clutter
   suppression, lux threshold, LED colors, display.
2. Generate the header (needs the server's Node deps once):
   ```bash
   cd ../server && npm install && npm run gen:firmware
   ```
   This writes `include/nobify_config.h` (auto-generated — never edit by hand).
3. Build & flash:
   ```bash
   cd ../firmware
   pio run -t upload
   pio device monitor          # 115200 baud
   ```

## How it works

- **`mmwave.cpp`** — parses LD2410-style 24 GHz UART frames (presence, distance,
  energy). On boot it spends `background_calibration_ms` learning the empty-room
  energy floor; readings below `background + micro_motion_threshold` are treated
  as **clutter** (airflow / pets / plants) and discarded. Range gating +
  a persistence debounce further reject false positives. Speed and
  approaching/leaving **direction** are derived from the distance derivative.
- **`wifi_csi.cpp`** — enables ESP32-S3 **CSI**; human motion raises the
  amplitude variance across recent packets above `variance_threshold` → presence.
- **`leds.cpp`** — **BLUE** for WiFi CSI, **ORANGE** for mmWave (NeoPixel or
  plain GPIO).
- **`display.cpp`** — TFT status screen (presence, distance, movement, lux,
  connectivity). Disable with `display.enabled: false`.
- **`net.cpp`** — connects WiFi and POSTs batched events to `/api/ingest`
  (streams while present, heartbeats when idle).

## Adapting to a different 24 GHz module

Replace `Mmwave::decode()` in `src/mmwave.cpp` with your module's frame parsing,
populating the shared `Reading` struct (`present`, `distanceCm`, `speedCms`,
`direction`, `lux`, `confidence`). Everything downstream stays the same.

## Sensors used

- 24 GHz mmWave human-presence radar with UART output (LD2410-family or similar
  module exposing presence/distance/energy; speed, direction and lux supported
  where the module or an attached LDR provides them).
- ESP32-S3 on-chip WiFi radio for CSI-based presence.
