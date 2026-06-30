# Find Spidy · by Ionity

Crawl any URL and surface its complete public metadata — title, description,
Open Graph, Twitter Card, JSON-LD structured data, canonical, favicon, author,
keywords, robots, theme colour, and (for Google Forms) the Workspace org banner,
questions list, and identity verdict.

> Find Spidy reads only publicly served HTML. It surfaces what an author typed
> or configured. It cannot reveal an owner identity that the server withholds.

## One core, three platforms
| Layer | Tech |
|---|---|
| Engine | `src/parser.js` — pure JS, no DOM, runs everywhere |
| Fetch | `src/fetcher.js` — platform-aware (CORS proxy / Electron IPC / Capacitor native) |
| Web | React 18 + Vite 5 |
| Desktop | Electron 31 (Windows / macOS / Linux) |
| Mobile | Capacitor 6 (Android / iOS) |

## Run it

```bash
npm install

# Web dev server
npm run dev            # http://localhost:5173

# Windows desktop (Vite + Electron together)
npm run electron:dev

# Production web build
npm run build && npm run preview
```

### Package Windows .exe
```bash
npm i -D electron-builder
npx electron-builder --win   # after `npm run build`
```
Add to `package.json` when you want installers:
```json
"build": {
  "appId": "today.ionity.findspidy",
  "files": ["dist/**", "electron/**"]
}
```

### Mobile (Capacitor)
```bash
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npm run build
npx cap add android      # and/or ios
npm run cap:sync
npx cap open android
```
`CapacitorHttp` is enabled so mobile builds fetch without a proxy.

## What it extracts

| Category | Fields |
|---|---|
| Core | title, description, canonical, favicon, author, keywords, robots, theme-color |
| Open Graph | og:title, og:description, og:type, og:site_name, og:image, og:url |
| Twitter / X | twitter:card, twitter:title, twitter:description, twitter:image, twitter:site |
| Structured data | All JSON-LD blocks (parsed, type-labelled) |
| Google Forms | Workspace org banner → identity verdict, form questions list, build label, region |
| Misc | Emails found in HTML, page size, fetch path |

---
_Find Spidy is part of the Ionity toolchain · ionity.today_
