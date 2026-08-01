# Troubleshooting

## Dashboard shows "disconnected"

- The dashboard (especially on GitHub Pages) needs your **backend URL**. Open
  **⚙ Settings** and set it, or edit `webapp/config.js` `serverUrl`.
- Check the server is reachable and **CORS** allows the dashboard origin
  (`server.cors_origin`).

## Device not appearing / no detections

- Confirm `server.url` in `nobify.config.yaml` points at the reachable server
  (not `localhost` from the ESP32's perspective — use the host's LAN IP or tunnel).
- If `server.ingest_key` is set, the device's `server.ingest_key` must match.
- Watch the serial monitor: `pio device monitor` at 115200. Look for
  `[net] connected` and `POST … -> 200`.

## Too many / too few detections

- **False positives** (airflow, pets, plants): raise `mmwave.micro_motion_threshold`
  and/or lengthen `mmwave.background_calibration_ms`. Keep the room empty during
  boot calibration.
- **Missed people**: lower `micro_motion_threshold`, widen the range gate
  (`min_distance_cm` / `max_distance_cm`), or lower `wifi_csi.variance_threshold`.

## Day/night wrong

- Tune `mmwave.ambient_light.dark_lux_threshold` (scale is 0–50 lux). If using an
  LDR, verify it's on `ambient_light.adc_gpio` and check the raw reading in serial.

## OTA not updating

- `GET /api/firmware/manifest` should return `available: true` and a newer
  `version`. Ensure a `.bin` (and optional `manifest.json`) exist in the server's
  `firmware_dir`.
- The server must serve the bin with an **`x-MD5`** header (it does by default);
  a mismatch aborts the flash.
- Confirm `ota.enabled: true` and the device can reach the server URL.

## Companion shows no popup

- On Windows without deps it uses a **tray balloon**; some setups suppress these —
  run with `NOBIFY_NOTIFY=console` to see output, or `npm install` for
  `node-notifier` toasts.
- No tray icon? Install the optional `systray2` dep; otherwise it runs headless
  with keyboard controls.

## `node:sqlite` errors

- Requires **Node ≥ 22.5** (tested on 24). Check `node -v`.

## Firmware won't compile locally

- No PlatformIO? The **Nobify CI** workflow compiles it for you on every push and
  uploads `firmware.bin` as an artifact.
