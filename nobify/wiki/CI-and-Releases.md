# CI and Releases

Four GitHub Actions workflows live in `.github/workflows/` (all scoped to
`nobify/**`).

## `Nobify CI` — `nobify-ci.yml`

Runs on push/PR. Jobs:

- **server** — Node 24, `npm install`, `npm test` (18-check smoke test over REST +
  WebSocket + OTA), then `npm run gen:firmware`; uploads the generated header.
- **webapp** — `node --check` on the dashboard scripts; asserts pages exist.
- **companion** — `node --check` on the companion sources.
- **firmware** — installs **PlatformIO** and runs `pio run` to *actually compile*
  the ESP32-S3 firmware, uploading `firmware.bin` as an artifact.

## `Nobify Release` — `nobify-release.yml`

Triggered by a tag `nobify-v*` (or manual dispatch with a version). It:

1. Compiles the firmware and stages `nobify-fw-<ver>.bin` + `manifest.json`.
2. Builds standalone **companion binaries** (`nobify-companion-win.exe`,
   `-macos`, `-linux`) via `@yao-pkg/pkg`.
3. Publishes a **GitHub Release** with all of the above attached.

The dashboard's **Install** page and the firmware **OTA** manifest both point at
these release assets.

```bash
git tag nobify-v1.1.0 && git push origin nobify-v1.1.0
```

## `Deploy Nobify dashboard to GitHub Pages` — `nobify-pages.yml`

Publishes `nobify/webapp` to GitHub Pages on push. Enable it in
**Settings → Pages → Source: GitHub Actions**.

## `Publish Nobify Wiki` — `nobify-wiki.yml`

Mirrors `nobify/wiki/` into this GitHub Wiki. One-time setup: enable the Wiki and
create the first page in the UI so the wiki git repo exists.

## Local checks

```bash
cd nobify/server && npm test        # server + OTA
cd nobify/webapp  && node --check app.js install.js config.js
cd nobify/companion && npm run check
```
