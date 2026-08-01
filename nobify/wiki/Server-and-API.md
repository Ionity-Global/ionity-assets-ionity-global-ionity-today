# Server and API

Node HTTP + WebSocket server. Storage is Node's built-in `node:sqlite` (no native
deps); the only runtime dependency is `ws` (`yaml` powers config + firmware gen).

Base URL defaults to `http://localhost:8787`.

## REST

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness + device count |
| GET | `/api/state` | Current live presence + snooze |
| POST | `/api/ingest` | Device upload (see below) |
| GET | `/api/alerts?limit&since&device` | Detection history |
| GET | `/api/devices` | Known devices + online timeout |
| GET | `/api/stats?windowMs` | Aggregates (counts, peak hour, avg distance) |
| GET | `/api/ai/insights?windowMs` | AI report (summary, fusion, anomaly, metrics) |
| GET/POST | `/api/ai/ask` | Natural-language Q&A (`?q=` or `{ "question" }`) |
| GET/POST | `/api/snooze` | Read / set / clear snooze |
| GET | `/api/firmware/manifest?current=<ver>` | OTA manifest (see [[Firmware and OTA]]) |
| GET | `/firmware/<name>.bin` | OTA binary (with `x-MD5`) |

### Ingest payload

One payload may carry several sensor readings. Each event's `source` is
`mmwave`, `wifi`, or `fusion`.

```json
{
  "device_id": "esp32-s3-01",
  "name": "Lobby Sensor",
  "firmware": "nobify-fw/1.0.0",
  "rssi": -52,
  "events": [
    { "source": "mmwave", "present": true, "distance_cm": 142,
      "speed_cms": -8, "direction": "approaching", "lux": 3, "confidence": 0.9 },
    { "source": "wifi", "present": true }
  ]
}
```

If `server.ingest_key` is set, devices must send it in the **`x-ingest-key`**
header.

## WebSocket (`/ws`)

The server pushes JSON frames:

- `hello` — initial state + snooze on connect
- `alert` — a stored detection (`{ alert, snoozed, state }`)
- `state` — live presence (also re-broadcast every 3 s so clients clear presence)
- `snooze` — snooze changed

## AI engine

Fully **offline / deterministic** (`src/ai.js`): live state, activity summaries,
busiest hour, sensor-agreement (fusion) score, z-score anomaly detection, dwell
metrics, and a keyword-intent Q&A matcher (presence, distance, darkness,
movement/direction, speed, anomalies…).
