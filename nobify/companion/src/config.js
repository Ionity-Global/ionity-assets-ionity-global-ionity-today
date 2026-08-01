// Companion configuration. Precedence: CLI arg > env var > companion.yaml > default.
// Everything is optional; sensible defaults let it run with zero setup.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __here = import.meta.url ? dirname(fileURLToPath(import.meta.url)) : dirname(process.execPath);
const rootDir = resolve(__here, '..');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

async function loadYaml() {
  const path = process.env.NOBIFY_COMPANION_CONFIG || join(rootDir, 'companion.yaml');
  if (!existsSync(path)) return {};
  try {
    const { parse } = await import('yaml'); // optional dependency
    return parse(readFileSync(path, 'utf8')) || {};
  } catch {
    return {}; // yaml not installed — env/args still work
  }
}

export async function loadConfig(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const y = await loadYaml();

  const pick = (arg, env, yv, d) =>
    (args[arg] !== undefined ? args[arg]
      : process.env[env] !== undefined ? process.env[env]
      : yv !== undefined ? yv : d);
  const num = (v, d) => (v == null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
  const bool = (v, d) => (v === undefined ? d : v === true || v === 'true' || v === '1' || v === 1);

  let server = String(pick('server', 'NOBIFY_SERVER', y.server, 'http://localhost:8787')).replace(/\/+$/, '');

  return {
    rootDir,
    server,
    ingestKeyless: true,
    pollMs: num(pick('poll', 'NOBIFY_POLL_MS', y.poll_ms, 3000), 3000),
    // Minimum gap between desktop notifications (debounce), ms.
    minNotifyGapMs: num(pick('gap', 'NOBIFY_NOTIFY_GAP_MS', y.notify_gap_ms, 8000), 8000),
    // Snooze presets (minutes) offered in the tray menu.
    snoozePresets: Array.isArray(y.snooze_presets) ? y.snooze_presets : [5, 15, 60],
    defaultSnoozeMin: num(pick('snooze', 'NOBIFY_SNOOZE_MIN', y.default_snooze_min, 15), 15),
    sound: bool(pick('sound', 'NOBIFY_SOUND', y.sound, true), true),
    // Only notify when this source detects a person: 'any' | 'mmwave' | 'wifi' | 'fusion'.
    onlySource: String(pick('source', 'NOBIFY_ONLY_SOURCE', y.only_source, 'any')).toLowerCase(),
    tray: bool(pick('tray', 'NOBIFY_TRAY', y.tray, true), true),
    dashboardUrl: String(pick('dashboard', 'NOBIFY_DASHBOARD', y.dashboard_url, '') || server),
  };
}
