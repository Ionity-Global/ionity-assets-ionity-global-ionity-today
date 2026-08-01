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

### Behind a reverse proxy (TLS)

When Nobify runs behind Caddy, nginx, or Cloudflare, set `trust_proxy: true` so it
honours `x-forwarded-for` / `x-forwarded-proto`, and pin the external base URL with
`public_url` so OTA download links are correct:

```yaml
server:
  trust_proxy: true
  public_url: "https://nobify.example.com"
```

Caddy makes TLS + proxying a one-liner:

```
nobify.example.com {
    reverse_proxy 127.0.0.1:8787
}
```

nginx equivalent:

```nginx
server {
    server_name nobify.example.com;
    location / {
        proxy_pass         http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;         # WebSocket
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

## Over-the-air (OTA) firmware

Devices poll `GET /api/firmware/manifest` and self-update. Publish a build so they
pick it up:

```bash
# copy a locally-built firmware.bin into the OTA dir + write manifest.json
npm run publish:firmware -- 0.1.0 --notes "bugfixes"
#   (auto-detects ../firmware/.pio/build/*/firmware.bin if no path is given)

# or pull the latest GitHub Release image and publish it
npm run sync:firmware
```

## Files

- `src/server.js` — HTTP + WebSocket, routing, static hosting, ingest, broadcast
- `src/db.js` — `node:sqlite` schema, queries, aggregates, migrations
- `src/ai.js` — offline insights engine + natural-language assistant
- `src/config.js` — env/YAML/default resolution
