# Firmware and OTA

Modular PlatformIO sketch for the ESP32-S3. Configure everything in
`nobify/firmware/nobify.config.yaml`, then regenerate the header
(`cd nobify/server && npm run gen:firmware`) — the device carries no YAML parser.

## Modules

| File | Role |
| --- | --- |
| `mmwave.cpp` | Parse 24 GHz radar frames; distance, energy, movement, clutter suppression |
| `wifi_csi.cpp` | WiFi CSI amplitude-variance motion detection |
| `leds.cpp` | 🔵 WiFi / 🟠 mmWave indicators (NeoPixel or plain GPIO) |
| `display.cpp` | TFT status screen (presence, distance, movement, lux, link) |
| `net.cpp` | WiFi + batched JSON upload to `/api/ingest` |
| `ota.cpp` | Over-the-air updates (see below) |
| `main.cpp` | Orchestrates sensors → LEDs → display → upload |

## Detection details

- **Clutter suppression** — on boot the radar samples the empty room for
  `background_calibration_ms` to learn the energy floor. Readings below
  `background + micro_motion_threshold` are treated as airflow / pets / plants
  and discarded. Range gating + a persistence debounce further reject noise.
- **Movement** — speed and **approaching / leaving / stationary** direction are
  derived from the distance derivative (`|speed| < approach_speed_cms` = stationary).
- **Ambient light** — 0–50 lux, from the radar if it reports lux, else an LDR on
  `ambient_light.adc_gpio`. At/below `dark_lux_threshold` the area is "dark".

## OTA (over-the-air updates)

Two complementary paths, both configured under the YAML `ota:` block:

### 1. Server-pull (HTTP Update)

The device periodically calls
`GET {server}/api/firmware/manifest?current=<version>`. If the server advertises
a newer build it downloads the `.bin` and flashes it (the server sends an
**`x-MD5`** header which the ESP32 verifies), then reboots.

Publish a build by dropping it into the server's firmware dir:

```bash
cp .pio/build/*/firmware.bin  nobify/server/firmware/nobify-fw-1.1.0.bin
# optional manifest.json: { "version": "1.1.0", "bin": "nobify-fw-1.1.0.bin", ... }
```

The [[CI and Releases]] `Nobify Release` workflow does this automatically and
attaches the artifacts to a GitHub Release.

### 2. Local push (ArduinoOTA)

With `ota.arduino_ota: true` you can flash over WiFi from your machine:

```bash
pio run -t upload --upload-port <device-ip>
```

Set `ota.arduino_ota_password` to protect it.

### YAML

```yaml
firmware:
  version: "1.0.0"
ota:
  enabled: true
  check_interval_ms: 900000   # 0 = only check on boot
  arduino_ota: true
  arduino_ota_password: ""
```
