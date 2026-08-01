# Desktop Companion

A small system-tray notifier (`nobify/companion`). It connects to your server and
pops a notification the instant a person is detected — 🔵 WiFi / 🟠 mmWave — with
distance, direction and day/night context, and lets you snooze.

## Zero-dependency by design

| Feature | With optional deps | Built-in fallback |
| --- | --- | --- |
| Live updates | `ws` WebSocket | HTTP polling (`fetch`) |
| Notifications | `node-notifier` toast | Windows tray balloon / console |
| Tray icon menu | `systray2` | headless + keyboard keys |
| YAML config | `yaml` | CLI flags + env vars |

So `node src/index.js` works immediately; `npm install` just makes it richer.
Prebuilt single-file binaries are attached to each GitHub Release (no Node needed).

## Run

```bash
cd nobify/companion
npm install                                    # optional
npm start -- --server http://localhost:8787
```

## Controls

- **Tray menu:** Open dashboard · Snooze 5/15/60 min · Clear snooze · Quit
- **Keyboard (in a terminal):** `s` snooze · `c` clear · `o` open · `q` quit

## Configuration

Precedence: **CLI flag → env var → `companion.yaml` → default**.

| Flag | Env | Default |
| --- | --- | --- |
| `--server` | `NOBIFY_SERVER` | `http://localhost:8787` |
| `--dashboard` | `NOBIFY_DASHBOARD` | = server |
| `--poll` | `NOBIFY_POLL_MS` | `3000` |
| `--gap` | `NOBIFY_NOTIFY_GAP_MS` | `8000` |
| `--source` | `NOBIFY_ONLY_SOURCE` | `any` (`mmwave`/`wifi`/`fusion`) |
| `--snooze` | `NOBIFY_SNOOZE_MIN` | `15` |
| `--tray` | `NOBIFY_TRAY` | `true` |
| — | `NOBIFY_NOTIFY` | force `console` or `balloon` |

Snoozing from the companion calls the server's `/api/snooze`, so the dashboard and
every other client mute in sync.
