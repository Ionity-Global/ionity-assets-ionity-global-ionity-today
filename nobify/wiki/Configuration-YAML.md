# Configuration (YAML)

YAML is Nobify's primary, human-friendly config surface. There are three files.

## Server — `nobify/server/config.yaml`

Copy from `config.example.yaml`. Precedence: **env var → YAML → default**.

```yaml
server:
  port: 8787
  host: 0.0.0.0
  ingest_key: ""          # shared secret for x-ingest-key ("" = open)
  serve_webapp: true
  cors_origin: "*"        # for a separately hosted dashboard
  db_path: ""             # blank = ./data/nobify.db
  ota_enabled: true
  firmware_dir: ""        # blank = ./firmware (holds *.bin + manifest.json)
sensor:
  presence_hold_ms: 8000
  device_timeout_ms: 30000
  dark_lux_threshold: 5   # <= this lux is reported as "dark"
```

Env overrides: `PORT`, `HOST`, `INGEST_KEY`, `SERVE_WEBAPP`, `CORS_ORIGIN`,
`DB_PATH`, `OTA_ENABLED`, `FIRMWARE_DIR`, `PRESENCE_HOLD_MS`, `DEVICE_TIMEOUT_MS`,
`DARK_LUX`.

## Firmware — `nobify/firmware/nobify.config.yaml`

The **single source of truth** for the device. Run
`cd nobify/server && npm run gen:firmware` to render
`firmware/include/nobify_config.h` (never edit that header by hand).

Key blocks: `device`, `firmware`, `ota`, `wifi`, `server`, `mmwave`
(with `clutter_suppression`, `movement`, `ambient_light`), `wifi_csi`, `leds`,
`display`. See [[Firmware and OTA]] and [[Hardware and Wiring]].

## Companion — `nobify/companion/companion.yaml`

Optional (needs the `yaml` dep; otherwise use flags/env). Copy from
`companion.example.yaml`:

```yaml
server: "http://localhost:8787"
only_source: "any"        # any | mmwave | wifi | fusion
default_snooze_min: 15
snooze_presets: [5, 15, 60]
tray: true
```

## Dashboard — `nobify/webapp/config.js`

Static site, so a tiny JS config (not YAML). Set `serverUrl` (or use in-app
⚙ Settings) and `repo` (powers the Install page download links).
