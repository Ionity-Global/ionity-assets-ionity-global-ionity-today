// Persistence layer backed by Node's built-in node:sqlite (no native deps).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS devices (
    id          TEXT PRIMARY KEY,
    name        TEXT,
    ip          TEXT,
    firmware    TEXT,
    first_seen  INTEGER NOT NULL,
    last_seen   INTEGER NOT NULL,
    meta        TEXT
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts          INTEGER NOT NULL,           -- epoch ms of detection
    device_id   TEXT NOT NULL,
    source      TEXT NOT NULL,              -- mmwave | wifi | fusion
    present     INTEGER NOT NULL,           -- 1 present, 0 cleared
    distance_cm REAL,                       -- mmWave target distance
    speed_cms   REAL,                       -- target speed (cm/s); sign only informational
    direction   TEXT,                       -- approaching | leaving | stationary
    lux         REAL,                       -- ambient light 0..50
    rssi        INTEGER,                    -- device WiFi RSSI
    confidence  REAL,                       -- 0..1 sensor confidence/energy
    meta        TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_alerts_ts ON alerts(ts);
  CREATE INDEX IF NOT EXISTS idx_alerts_device ON alerts(device_id, ts);

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`);

// ---- Lightweight migrations (add columns to pre-existing DBs) ------------
const alertCols = new Set(db.prepare(`PRAGMA table_info(alerts)`).all().map((c) => c.name));
for (const [col, type] of [['speed_cms', 'REAL'], ['direction', 'TEXT'], ['lux', 'REAL']]) {
  if (!alertCols.has(col)) db.exec(`ALTER TABLE alerts ADD COLUMN ${col} ${type}`);
}

// ---- Prepared statements -------------------------------------------------
const stmt = {
  upsertDevice: db.prepare(`
    INSERT INTO devices (id, name, ip, firmware, first_seen, last_seen, meta)
    VALUES (:id, :name, :ip, :firmware, :now, :now, :meta)
    ON CONFLICT(id) DO UPDATE SET
      name = COALESCE(excluded.name, devices.name),
      ip = COALESCE(excluded.ip, devices.ip),
      firmware = COALESCE(excluded.firmware, devices.firmware),
      last_seen = excluded.last_seen,
      meta = COALESCE(excluded.meta, devices.meta)
  `),
  insertAlert: db.prepare(`
    INSERT INTO alerts (ts, device_id, source, present, distance_cm, speed_cms, direction, lux, rssi, confidence, meta)
    VALUES (:ts, :device_id, :source, :present, :distance_cm, :speed_cms, :direction, :lux, :rssi, :confidence, :meta)
  `),
  listDevices: db.prepare(`SELECT * FROM devices ORDER BY last_seen DESC`),
  getSetting: db.prepare(`SELECT value FROM settings WHERE key = ?`),
  setSetting: db.prepare(`
    INSERT INTO settings (key, value) VALUES (:key, :value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `),
};

export function upsertDevice({ id, name = null, ip = null, firmware = null, meta = null, now = Date.now() }) {
  stmt.upsertDevice.run({ id, name, ip, firmware, now, meta: meta ? JSON.stringify(meta) : null });
}

export function insertAlert(a) {
  const info = stmt.insertAlert.run({
    ts: a.ts ?? Date.now(),
    device_id: a.device_id,
    source: a.source,
    present: a.present ? 1 : 0,
    distance_cm: a.distance_cm ?? null,
    speed_cms: a.speed_cms ?? null,
    direction: a.direction ?? null,
    lux: a.lux ?? null,
    rssi: a.rssi ?? null,
    confidence: a.confidence ?? null,
    meta: a.meta ? JSON.stringify(a.meta) : null,
  });
  return Number(info.lastInsertRowid);
}

export function listDevices() {
  return stmt.listDevices.all().map(rowDevice);
}

export function listAlerts({ limit = 200, since = 0, device = null } = {}) {
  limit = Math.max(1, Math.min(5000, Number(limit) || 200));
  let sql = `SELECT * FROM alerts WHERE ts >= ?`;
  const params = [Number(since) || 0];
  if (device) { sql += ` AND device_id = ?`; params.push(device); }
  sql += ` ORDER BY ts DESC, id DESC LIMIT ?`;
  params.push(limit);
  return db.prepare(sql).all(...params).map(rowAlert);
}

export function getSetting(key, fallback = null) {
  const row = stmt.getSetting.get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

export function setSetting(key, value) {
  stmt.setSetting.run({ key, value: JSON.stringify(value) });
}

// Aggregate stats used by the dashboard and AI engine.
export function stats(windowMs = 24 * 3600 * 1000) {
  const since = Date.now() - windowMs;
  const total = db.prepare(`SELECT COUNT(*) c FROM alerts WHERE present = 1`).get().c;
  const windowTotal = db.prepare(`SELECT COUNT(*) c FROM alerts WHERE present = 1 AND ts >= ?`).get(since).c;
  const bySource = db.prepare(`
    SELECT source, COUNT(*) c FROM alerts WHERE present = 1 AND ts >= ? GROUP BY source
  `).all(since);
  const byHour = db.prepare(`
    SELECT CAST(strftime('%H', ts/1000, 'unixepoch') AS INTEGER) hour, COUNT(*) c
    FROM alerts WHERE present = 1 AND ts >= ? GROUP BY hour
  `).all(since);
  const lastPresent = db.prepare(`SELECT * FROM alerts WHERE present = 1 ORDER BY ts DESC LIMIT 1`).get();
  const avgDist = db.prepare(`
    SELECT AVG(distance_cm) a FROM alerts WHERE present = 1 AND distance_cm IS NOT NULL AND ts >= ?
  `).get(since).a;
  return {
    totalDetections: total,
    windowDetections: windowTotal,
    windowMs,
    bySource: Object.fromEntries(bySource.map((r) => [r.source, r.c])),
    byHour: Object.fromEntries(byHour.map((r) => [r.hour, r.c])),
    avgDistanceCm: avgDist != null ? Math.round(avgDist) : null,
    lastPresent: lastPresent ? rowAlert(lastPresent) : null,
    deviceCount: db.prepare(`SELECT COUNT(*) c FROM devices`).get().c,
  };
}

function rowAlert(r) {
  return {
    id: r.id,
    ts: r.ts,
    device_id: r.device_id,
    source: r.source,
    present: !!r.present,
    distance_cm: r.distance_cm,
    speed_cms: r.speed_cms,
    direction: r.direction,
    lux: r.lux,
    rssi: r.rssi,
    confidence: r.confidence,
    meta: r.meta ? safeParse(r.meta) : null,
  };
}
function rowDevice(r) {
  return { ...r, meta: r.meta ? safeParse(r.meta) : null };
}
function safeParse(s) { try { return JSON.parse(s); } catch { return s; } }
