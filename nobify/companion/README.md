# Nobify Companion

A tiny **desktop system-tray notifier** for Nobify. It connects to your Nobify
server and pops a notification the moment a person is detected — **BLUE** = WiFi
CSI, **ORANGE** = mmWave — with distance, direction and day/night context. Snooze
straight from the tray or the keyboard.

## Runs with zero dependencies

The companion is built on Node's built-ins and **degrades gracefully**:

| Feature | With optional deps | Without (built-in fallback) |
| --- | --- | --- |
| Live updates | `ws` WebSocket | HTTP polling (`fetch`) |
| Notifications | `node-notifier` toast | Windows tray balloon / console |
| Tray icon menu | `systray2` | headless + keyboard controls |
| YAML config | `yaml` | CLI flags + env vars |

So `node src/index.js` works immediately; `npm install` just makes it nicer.

## Quick start

```bash
cd nobify/companion
npm install                 # optional but recommended (tray + rich toasts)
npm start -- --server http://localhost:8787
```

Or point it at a hosted backend:

```bash
node src/index.js --server https://nobify.example.com
```

### Keyboard (when run in a terminal)

`s` snooze 15m · `c` clear snooze · `o` open dashboard · `q` quit

### Tray menu

Open dashboard · Snooze 5/15/60 min · Clear snooze · Quit

## Configuration

Precedence: **CLI flag → env var → `companion.yaml` → default** (see
`companion.example.yaml`).

| Flag | Env | Default | Meaning |
| --- | --- | --- | --- |
| `--server` | `NOBIFY_SERVER` | `http://localhost:8787` | backend base URL |
| `--dashboard` | `NOBIFY_DASHBOARD` | = server | URL opened on click |
| `--poll` | `NOBIFY_POLL_MS` | `3000` | polling interval (ms) |
| `--gap` | `NOBIFY_NOTIFY_GAP_MS` | `8000` | notification debounce (ms) |
| `--source` | `NOBIFY_ONLY_SOURCE` | `any` | `any`/`mmwave`/`wifi`/`fusion` |
| `--snooze` | `NOBIFY_SNOOZE_MIN` | `15` | snooze length for `s` |
| `--tray` | `NOBIFY_TRAY` | `true` | show tray icon |
| — | `NOBIFY_NOTIFY` | — | force `console` or `balloon` output |

## Packaged installers

The `release` CI workflow builds standalone executables (Windows/macOS/Linux)
and attaches them to the GitHub Release, so end users can double-click instead of
installing Node. See the dashboard's **Install** page for download links.
