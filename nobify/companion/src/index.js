#!/usr/bin/env node
// ============================================================================
//  Nobify Companion — desktop system-tray notifier for human-presence alerts.
//
//  Connects to a Nobify server, pops a notification when a person is detected
//  (BLUE = WiFi CSI, ORANGE = mmWave), and lets you snooze from the tray/CLI.
//
//  Works with ZERO installed dependencies (built-in WebSocket-less polling +
//  console/Windows-balloon notifications). Installing the optional deps adds
//  a real WebSocket, rich toast notifications, and a clickable tray icon.
//
//  Usage:  node src/index.js --server http://localhost:8787
// ============================================================================
import { loadConfig } from './config.js';
import { notify, openUrl, onNotificationClick } from './notify.js';
import { createTray } from './tray.js';

let cfg;
let wsUrl;

let snoozeUntil = 0;                 // epoch ms; > now means muted
let lastPresent = false;
let lastNotifyTs = 0;
let tray = null;
let connMode = 'starting';

const nowMs = () => Date.now();
const isSnoozed = () => snoozeUntil > nowMs();

function log(msg) { console.log(`[nobify] ${msg}`); }

// ---- Server control ------------------------------------------------------
async function postSnooze(minutes) {
  try {
    const r = await fetch(`${cfg.server}/api/snooze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes }),
    });
    const j = await r.json();
    if (j.snooze?.until) { snoozeUntil = j.snooze.until; log(`snoozed ${minutes} min`); updateTray(); }
  } catch (e) { log(`snooze failed: ${e.message}`); }
}
async function clearSnooze() {
  try {
    await fetch(`${cfg.server}/api/snooze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear: true }),
    });
    snoozeUntil = 0; log('snooze cleared'); updateTray();
  } catch (e) { log(`clear failed: ${e.message}`); }
}

// ---- Notification composition -------------------------------------------
const sourceLabel = (s) => (s === 'wifi' ? 'WiFi CSI (blue)' : s === 'mmwave' ? 'mmWave 24GHz (orange)' : s === 'fusion' ? 'both sensors' : 'sensor');

function describe({ distanceCm, direction, dark, source }) {
  const parts = [];
  if (distanceCm != null && !Number.isNaN(distanceCm)) parts.push(`${(distanceCm / 100).toFixed(2)} m away`);
  if (direction && direction !== 'stationary') parts.push(direction);
  if (source) parts.push(sourceLabel(source));
  if (dark) parts.push('in the dark');
  return parts.join(' · ') || 'Someone is nearby';
}

function maybeNotify(info) {
  if (isSnoozed()) return;
  if (cfg.onlySource !== 'any' && info.source && info.source !== cfg.onlySource) return;
  if (nowMs() - lastNotifyTs < cfg.minNotifyGapMs) return;
  lastNotifyTs = nowMs();
  notify({ title: 'Nobify — person detected', message: describe(info), sound: cfg.sound, open: cfg.dashboardUrl });
}

// ---- Message handlers (shared by WS + polling) ---------------------------
function handleAlert(alert, snoozed) {
  if (snoozed) return;
  if (!alert?.present) return;
  maybeNotify({ distanceCm: alert.distance_cm, direction: alert.direction, dark: alert.lux != null && alert.lux <= 5, source: alert.source });
}
function handleState(state, snooze) {
  if (snooze?.until) snoozeUntil = snooze.until;
  const present = !!state?.present;
  if (present && !lastPresent) {
    const src = Array.isArray(state.sources) ? state.sources : [];
    const source = src.length > 1 ? 'fusion' : (src[0] || 'mmwave');
    maybeNotify({ distanceCm: state.lastDistanceCm, direction: state.direction, dark: state.dark, source });
  }
  lastPresent = present;
  updateTray(state);
}

// ---- Transport: WebSocket (preferred) or polling fallback ----------------
async function startWebSocket() {
  let WebSocketImpl;
  try { const m = await import('ws'); WebSocketImpl = m.WebSocket || m.default; }
  catch { return false; }

  const connect = () => {
    const ws = new WebSocketImpl(wsUrl);
    ws.on('open', () => { connMode = 'websocket'; log(`connected (websocket) → ${cfg.server}`); updateTray(); });
    ws.on('message', (buf) => {
      let m; try { m = JSON.parse(buf.toString()); } catch { return; }
      if (m.type === 'hello') { if (m.snooze?.until) snoozeUntil = m.snooze.until; handleState(m.state, m.snooze); }
      else if (m.type === 'alert') handleAlert(m.alert, m.snoozed);
      else if (m.type === 'state') handleState(m.state, m.snooze);
      else if (m.type === 'snooze') { snoozeUntil = m.snooze?.until || 0; updateTray(); }
    });
    ws.on('close', () => { connMode = 'reconnecting'; updateTray(); setTimeout(connect, 3000); });
    ws.on('error', () => { try { ws.close(); } catch {} });
  };
  connect();
  return true;
}

async function startPolling() {
  connMode = 'polling';
  log(`connected (polling) → ${cfg.server}`);
  const tick = async () => {
    try {
      const r = await fetch(`${cfg.server}/api/state`);
      const j = await r.json();
      handleState(j.state, j.snooze);
    } catch { connMode = 'offline'; updateTray(); }
  };
  await tick();
  setInterval(tick, cfg.pollMs);
}

// ---- Tray + keyboard -----------------------------------------------------
function trayTooltip(state) {
  const conn = connMode === 'websocket' ? 'live' : connMode;
  const pres = state?.present ? 'PRESENT' : 'clear';
  const snz = isSnoozed() ? ` · snoozed ${Math.ceil((snoozeUntil - nowMs()) / 60000)}m` : '';
  return `Nobify · ${pres} · ${conn}${snz}`;
}
function updateTray(state) { if (tray) tray.setTooltip(trayTooltip(state)); }

function setupKeyboard() {
  if (!process.stdin.isTTY) return;
  console.log('\n  Keys:  [s] snooze 15m   [c] clear snooze   [o] open dashboard   [q] quit\n');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (key) => {
    if (key === 's') postSnooze(cfg.defaultSnoozeMin);
    else if (key === 'c') clearSnooze();
    else if (key === 'o') openUrl(cfg.dashboardUrl);
    else if (key === 'q' || key === '\u0003') shutdown();
  });
}

function shutdown() {
  log('shutting down');
  try { tray?.kill(); } catch {}
  process.exit(0);
}

// ---- Boot ----------------------------------------------------------------
async function main() {
  cfg = await loadConfig();
  wsUrl = cfg.server.replace(/^http/, 'ws') + '/ws';

  console.log(`\n  Nobify Companion`);
  console.log(`  ├─ Server   : ${cfg.server}`);
  console.log(`  ├─ Dashboard: ${cfg.dashboardUrl}`);
  console.log(`  └─ Filter   : ${cfg.onlySource === 'any' ? 'all sources' : cfg.onlySource} · snooze default ${cfg.defaultSnoozeMin}m`);

  onNotificationClick(() => openUrl(cfg.dashboardUrl));

  if (cfg.tray) {
    tray = await createTray({
      presets: cfg.snoozePresets,
      dashboardUrl: cfg.dashboardUrl,
      onOpen: () => openUrl(cfg.dashboardUrl),
      onSnooze: (m) => postSnooze(m),
      onClear: () => clearSnooze(),
      onQuit: () => shutdown(),
    });
    log(tray ? 'system-tray icon active' : 'tray unavailable (install "systray2" for a tray icon) — running headless');
  }

  const wsOk = await startWebSocket();
  if (!wsOk) { log('ws module not installed — using built-in polling'); await startPolling(); }

  setupKeyboard();
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => { console.error('[nobify] fatal:', err); process.exit(1); });
