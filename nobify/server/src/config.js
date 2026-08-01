// Central configuration. Precedence: environment variable > config.yaml > default.
// A tiny .env parser and a YAML loader are included; YAML is the primary,
// human-friendly config surface (per project conventions).
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// Minimal .env loader (KEY=VALUE lines, # comments, optional quotes).
const envPath = join(rootDir, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

// YAML config (config.yaml). Structured, wins over defaults, loses to env vars.
let y = {};
const yamlPath = process.env.NOBIFY_CONFIG || join(rootDir, 'config.yaml');
if (existsSync(yamlPath)) {
  try { y = parseYaml(readFileSync(yamlPath, 'utf8')) || {}; }
  catch (e) { console.warn(`[config] failed to parse ${yamlPath}: ${e.message}`); }
}
const ys = y.server || {};
const yn = y.sensor || {};

const num = (v, d) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
// pick: env var (string) first, then yaml value, then default
const pick = (env, yv, d) => (process.env[env] !== undefined ? process.env[env] : (yv !== undefined ? yv : d));
const pickNum = (env, yv, d) => num(process.env[env], yv !== undefined ? Number(yv) : d);
const pickBool = (env, yv, d) => {
  const v = pick(env, yv, d);
  return v === true || v === 'true' || v === 1 || v === '1';
};

export const config = {
  rootDir,
  yamlPath: existsSync(yamlPath) ? yamlPath : null,
  port: pickNum('PORT', ys.port, 8787),
  host: pick('HOST', ys.host, '0.0.0.0'),
  dbPath: pick('DB_PATH', ys.db_path, join(rootDir, 'data', 'nobify.db')),
  ingestKey: pick('INGEST_KEY', ys.ingest_key, ''),
  serveWebapp: pickBool('SERVE_WEBAPP', ys.serve_webapp, true),
  webappDir: resolve(rootDir, '..', 'webapp'),
  deviceTimeoutMs: pickNum('DEVICE_TIMEOUT_MS', yn.device_timeout_ms, 30000),
  presenceHoldMs: pickNum('PRESENCE_HOLD_MS', yn.presence_hold_ms, 8000),
  historyLimit: pickNum('HISTORY_LIMIT', ys.history_limit, 5000),
  corsOrigin: pick('CORS_ORIGIN', ys.cors_origin, '*'),
  // Reverse-proxy support: only honour x-forwarded-* when explicitly trusted,
  // and let operators pin the externally-reachable base URL (used for OTA).
  trustProxy: pickBool('TRUST_PROXY', ys.trust_proxy, false),
  publicUrl: pick('PUBLIC_URL', ys.public_url, '').replace(/\/+$/, ''),
  darkLuxThreshold: pickNum('DARK_LUX', yn.dark_lux_threshold, 5),
  // Over-the-air firmware: directory that holds *.bin + optional manifest.json.
  firmwareDir: resolve(pick('FIRMWARE_DIR', ys.firmware_dir, join(rootDir, 'firmware'))),
  otaEnabled: pickBool('OTA_ENABLED', ys.ota_enabled, true),
};

