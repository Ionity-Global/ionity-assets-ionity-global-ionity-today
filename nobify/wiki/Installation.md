# Installation

Four parts, install what you need. Everything lives under `nobify/`.

## 1. Server (Node ≥ 22.5, zero native deps)

```bash
cd nobify/server
npm install
npm run seed      # optional demo data
npm start         # http://localhost:8787  (also serves the dashboard)
npm test          # end-to-end smoke test
```

Config precedence: **env var → `config.yaml` → default**. Copy
`config.example.yaml` → `config.yaml` to customise. See [[Configuration YAML]].

To let the ESP32 and a GitHub-Pages dashboard reach it, expose the port
(Fly.io / Render / a VPS, or a quick tunnel):

```bash
npx localtunnel --port 8787
# or: cloudflared tunnel --url http://localhost:8787
```

## 2. Dashboard (static)

Served automatically by the server at `/`. For a standalone/GitHub-Pages deploy,
publish `nobify/webapp` (the included **Nobify Pages** workflow does this) and set
your backend URL via the in-app **⚙ Settings**. The **⤓ Install** page links to
companion downloads and quick-start commands.

## 3. Desktop companion

```bash
cd nobify/companion
npm install       # optional — adds tray icon + rich toasts
npm start -- --server http://localhost:8787
```

Runs with **zero deps** too (polling + Windows balloon / console notifications).
Prebuilt binaries are attached to each GitHub Release. See [[Desktop Companion]].

## 4. Firmware (PlatformIO)

```bash
# edit nobify/firmware/nobify.config.yaml (wifi, server.url, pins)
cd nobify/server && npm run gen:firmware   # YAML -> include/nobify_config.h
cd ../firmware && pio run -t upload
pio device monitor
```

Later updates go **over the air** — see [[Firmware and OTA]].
