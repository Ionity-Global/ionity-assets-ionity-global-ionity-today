// Nobify server — built-in http + ws. Serves REST, WebSocket, static dashboard.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { upsertDevice, insertAlert, listDevices, listAlerts, stats, getSetting, setSetting } from './db.js';
import { insights, ask, liveState } from './ai.js';
import { getManifest, binInfo, compareVersions } from './firmware.js';
import { createReadStream } from 'node:fs';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.map': 'application/json',
};

// ---- WebSocket hub -------------------------------------------------------
const wss = new WebSocketServer({ noServer: true });
function broadcast(obj) {
  const data = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(data);
  }
}
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'hello', state: liveState(), snooze: currentSnooze(), serverTs: Date.now() }));
  ws.on('message', (buf) => {
    let msg; try { msg = JSON.parse(buf.toString()); } catch { return; }
    if (msg?.type === 'ping') ws.send(JSON.stringify({ type: 'pong', serverTs: Date.now() }));
  });
});

// ---- Snooze helpers ------------------------------------------------------
function currentSnooze() {
  const s = getSetting('snooze', null);
  if (s && s.until && s.until > Date.now()) return s;
  return null;
}
function isSnoozed() { return !!currentSnooze(); }

// ---- HTTP helpers --------------------------------------------------------
function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': config.corsOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, x-ingest-key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}
function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function serveStatic(req, res, pathname) {
  if (!config.serveWebapp) { sendJson(res, 404, { error: 'not found' }); return; }
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const full = normalize(join(config.webappDir, rel));
  if (!full.startsWith(config.webappDir)) { sendJson(res, 403, { error: 'forbidden' }); return; }
  try {
    const st = await stat(full);
    const target = st.isDirectory() ? join(full, 'index.html') : full;
    const data = await readFile(target);
    res.writeHead(200, { 'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: 'not found', path: rel });
  }
}

// ---- Ingest core (shared by device POST) --------------------------------
function ingestEvent(payload, ip) {
  const now = Date.now();
  const deviceId = String(payload.device_id || payload.device || 'esp32-s3');
  upsertDevice({ id: deviceId, name: payload.name || null, ip, firmware: payload.firmware || null, now, meta: payload.meta || null });

  // A single payload may carry several sensor readings.
  const events = Array.isArray(payload.events) ? payload.events : [payload];
  const stored = [];
  for (const e of events) {
    const source = ['mmwave', 'wifi', 'fusion'].includes(e.source) ? e.source : 'mmwave';
    const dir = normalizeDirection(e.direction, e.speed_cms ?? e.speed);
    const alert = {
      ts: Number(e.ts) || now,
      device_id: deviceId,
      source,
      present: e.present === undefined ? true : !!e.present,
      distance_cm: e.distance_cm != null ? Number(e.distance_cm) : (e.distance != null ? Number(e.distance) : null),
      speed_cms: e.speed_cms != null ? Number(e.speed_cms) : (e.speed != null ? Number(e.speed) : null),
      direction: dir,
      lux: e.lux != null ? Number(e.lux) : (e.light != null ? Number(e.light) : (payload.lux != null ? Number(payload.lux) : null)),
      rssi: e.rssi != null ? Number(e.rssi) : (payload.rssi != null ? Number(payload.rssi) : null),
      confidence: e.confidence != null ? Number(e.confidence) : (e.energy != null ? clamp01(Number(e.energy) / 100) : null),
      meta: e.meta || null,
    };
    const id = insertAlert(alert);
    stored.push({ id, ...alert });
  }

  const snoozed = isSnoozed();
  const state = liveState();
  for (const a of stored) broadcast({ type: 'alert', alert: a, snoozed, state });
  broadcast({ type: 'state', state, device_id: deviceId });
  return { stored, snoozed, state };
}
const clamp01 = (n) => Math.max(0, Math.min(1, n));
function normalizeDirection(dir, speed) {
  if (typeof dir === 'string') {
    const d = dir.toLowerCase();
    if (d.startsWith('appro') || d === 'in' || d === 'toward') return 'approaching';
    if (d.startsWith('leav') || d.startsWith('away') || d === 'out') return 'leaving';
    if (d.startsWith('stat') || d === 'still' || d === 'micro') return 'stationary';
  }
  if (speed != null && !Number.isNaN(Number(speed))) {
    const s = Number(speed);
    if (Math.abs(s) < 2) return 'stationary';
    return s < 0 ? 'approaching' : 'leaving'; // negative = closing distance
  }
  return null;
}

// ---- Router --------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;
  const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '').replace('::ffff:', '');

  if (req.method === 'OPTIONS') { sendJson(res, 204, {}); return; }

  try {
    // ---- API ----
    if (p === '/api/health') return sendJson(res, 200, { ok: true, service: 'nobify', ts: Date.now(), uptime: process.uptime(), devices: listDevices().length });

    if (p === '/api/state') return sendJson(res, 200, { state: liveState(), snooze: currentSnooze() });

    if (p === '/api/ingest' && req.method === 'POST') {
      if (config.ingestKey && req.headers['x-ingest-key'] !== config.ingestKey)
        return sendJson(res, 401, { error: 'invalid ingest key' });
      const body = await readBody(req);
      const result = ingestEvent(body, ip);
      return sendJson(res, 200, { ok: true, serverTs: Date.now(), snoozed: result.snoozed, stored: result.stored.length, holdMs: config.presenceHoldMs });
    }

    if (p === '/api/alerts') {
      return sendJson(res, 200, { alerts: listAlerts({ limit: url.searchParams.get('limit') || 200, since: url.searchParams.get('since') || 0, device: url.searchParams.get('device') }) });
    }

    if (p === '/api/devices') return sendJson(res, 200, { devices: listDevices(), timeoutMs: config.deviceTimeoutMs });

    if (p === '/api/stats') return sendJson(res, 200, stats(Number(url.searchParams.get('windowMs')) || undefined));

    if (p === '/api/ai/insights') return sendJson(res, 200, insights({ windowMs: Number(url.searchParams.get('windowMs')) || undefined }));

    if (p === '/api/ai/ask' && req.method === 'POST') {
      const body = await readBody(req);
      return sendJson(res, 200, ask(body.question || body.q || ''));
    }
    if (p === '/api/ai/ask' && req.method === 'GET') {
      return sendJson(res, 200, ask(url.searchParams.get('q') || ''));
    }

    // ---- OTA firmware manifest (must precede the /api/ catch-all) ----
    if (p === '/api/firmware/manifest') {
      if (!config.otaEnabled) return sendJson(res, 404, { error: 'ota disabled' });
      const m = getManifest();
      if (!m) return sendJson(res, 200, { available: false });
      const info = binInfo(m.bin);
      const proto = (req.headers['x-forwarded-proto']?.split(',')[0]) || 'http';
      const fwBase = `${proto}://${req.headers.host}`;
      const current = url.searchParams.get('current') || url.searchParams.get('version');
      const updateAvailable = current ? compareVersions(m.version, current) > 0 : true;
      return sendJson(res, 200, {
        available: true, version: m.version, bin: m.bin,
        url: `${fwBase}/firmware/${encodeURIComponent(m.bin)}`,
        size: info?.size ?? null, md5: info?.md5 ?? null,
        notes: m.notes, mandatory: m.mandatory, ts: m.ts,
        current: current || null, updateAvailable,
      });
    }

    if (p === '/api/snooze') {
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (body.clear) { setSetting('snooze', null); broadcast({ type: 'snooze', snooze: null }); return sendJson(res, 200, { snooze: null }); }
        const minutes = Math.max(1, Math.min(1440, Number(body.minutes) || 15));
        const snooze = { until: Date.now() + minutes * 60000, minutes, setAt: Date.now() };
        setSetting('snooze', snooze);
        broadcast({ type: 'snooze', snooze });
        return sendJson(res, 200, { snooze });
      }
      return sendJson(res, 200, { snooze: currentSnooze() });
    }

    if (p.startsWith('/api/')) return sendJson(res, 404, { error: 'unknown endpoint', path: p });

    // ---- OTA: firmware binaries ----
    if (p.startsWith('/firmware/')) {
      if (!config.otaEnabled) return sendJson(res, 404, { error: 'ota disabled' });
      const info = binInfo(decodeURIComponent(p.slice('/firmware/'.length)));
      if (!info) return sendJson(res, 404, { error: 'firmware not found' });
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': info.size,
        'Content-MD5': info.md5,
        'x-MD5': info.md5,
        'Cache-Control': 'no-cache',
      });
      if (req.method === 'HEAD') { res.end(); return; }
      createReadStream(info.path).pipe(res);
      return;
    }

    // ---- Static dashboard ----
    return serveStatic(req, res, p);
  } catch (err) {
    return sendJson(res, 400, { error: String(err.message || err) });
  }
});

// Upgrade HTTP → WebSocket on /ws.
server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (pathname === '/ws') wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  else socket.destroy();
});

// Periodically re-broadcast live state so clients clear presence after hold.
setInterval(() => broadcast({ type: 'state', state: liveState(), snooze: currentSnooze() }), 3000).unref();

server.listen(config.port, config.host, () => {
  console.log(`\n  Nobify server ready`);
  console.log(`  ├─ HTTP/API : http://localhost:${config.port}`);
  console.log(`  ├─ WebSocket: ws://localhost:${config.port}/ws`);
  console.log(`  ├─ Dashboard: ${config.serveWebapp ? `http://localhost:${config.port}/` : 'disabled'}`);
  console.log(`  ├─ Ingest   : POST http://localhost:${config.port}/api/ingest${config.ingestKey ? ' (key required)' : ''}`);
  console.log(`  ├─ OTA      : ${config.otaEnabled ? `http://localhost:${config.port}/api/firmware/manifest` : 'disabled'}`);
  console.log(`  └─ DB       : ${config.dbPath}\n`);
});

export { server, ingestEvent, broadcast };
