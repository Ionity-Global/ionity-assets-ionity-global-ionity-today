# Nobify Server

Node.js backend for the Nobify presence system. **Zero native dependencies** —
storage uses Node's built-in `node:sqlite` (requires Node **≥ 22.5**, tested on
Node 24). The only runtime dependency is `ws` (WebSocket); `yaml` is used for
config + firmware generation.

## Run

```bash
npm install
npm start          # http://localhost:8787  (also serves ../webapp)
npm run dev        # auto-restart on changes
npm test           # end-to-end smoke test (spins up a throwaway server)
npm run seed       # insert ~3 days of demo detections
```

## Configuration

Precedence: **environment variable → `config.yaml` → built-in default**.

- Copy `config.example.yaml` → `config.yaml` for structured config, or
- create a `.env` (see `.env.example`), or
- just use the defaults.

Key settings: `server.port`, `server.ingest_key` (shared secret for
`x-ingest-key`), `server.cors_origin` (for a separately hosted dashboard),
`sensor.presence_hold_ms`, `sensor.dark_lux_threshold`.

## Firmware config generator

`npm run gen:firmware` reads `../firmware/nobify.config.yaml` and writes
`../firmware/include/nobify_config.h`, so the device carries no YAML parser.

## Deploying (hosting)

Any Node ≥ 22.5 host works (Fly.io, Render, Railway, a VPS, etc.). Expose the
port, set `INGEST_KEY` for security, and point both the ESP32 (`server.url`) and
the dashboard (⚙ Settings) at the public URL. For a quick public tunnel during
development:

```bash
npm start
# in another shell:
npx localtunnel --port 8787      # or: cloudflared tunnel --url http://localhost:8787
```

## Files

- `src/server.js` — HTTP + WebSocket, routing, static hosting, ingest, broadcast
- `src/db.js` — `node:sqlite` schema, queries, aggregates, migrations
- `src/ai.js` — offline insights engine + natural-language assistant
- `src/config.js` — env/YAML/default resolution
