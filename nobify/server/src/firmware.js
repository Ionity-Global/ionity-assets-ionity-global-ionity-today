// OTA firmware helper. Serves *.bin files and a manifest so ESP32-S3 devices can
// self-update. A manifest.json (written by CI/release) wins; otherwise the newest
// .bin in config.firmwareDir is used and its version parsed from the filename.
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { config } from './config.js';

const md5Cache = new Map(); // name -> { mtimeMs, md5, size }

function binFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.bin'))
    .map((f) => ({ name: f, mtimeMs: statSync(join(dir, f)).mtimeMs }));
}

// Parse a version like "1.2.3" out of "nobify-fw-1.2.3.bin"; falls back to mtime.
function versionFromName(name, mtimeMs) {
  const m = name.match(/(\d+\.\d+\.\d+(?:[-+][\w.]+)?)/);
  if (m) return m[1];
  return `0.0.0+${Math.round(mtimeMs)}`;
}

// Compare dotted versions; returns >0 if a is newer than b.
export function compareVersions(a, b) {
  const norm = (v) => String(v || '0').split(/[-+]/)[0].split('.').map((x) => parseInt(x, 10) || 0);
  const pa = norm(a), pb = norm(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

// Raw manifest describing the latest firmware, or null if none is available.
export function getManifest() {
  const dir = config.firmwareDir;
  const mPath = join(dir, 'manifest.json');
  if (existsSync(mPath)) {
    try {
      const m = JSON.parse(readFileSync(mPath, 'utf8'));
      if (m && m.bin && existsSync(join(dir, m.bin))) {
        return {
          version: String(m.version || versionFromName(m.bin, statSync(join(dir, m.bin)).mtimeMs)),
          bin: basename(m.bin),
          notes: m.notes || '',
          mandatory: !!m.mandatory,
          ts: Number(m.ts) || statSync(join(dir, m.bin)).mtimeMs,
        };
      }
    } catch { /* fall through to auto-derive */ }
  }
  const bins = binFiles(dir).sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (!bins.length) return null;
  const { name, mtimeMs } = bins[0];
  return { version: versionFromName(name, mtimeMs), bin: name, notes: '', mandatory: false, ts: mtimeMs };
}

// size + md5 for a bin (cached by mtime). Guards against path traversal.
export function binInfo(name) {
  const safe = basename(String(name || ''));
  if (!safe.toLowerCase().endsWith('.bin')) return null;
  const path = join(config.firmwareDir, safe);
  if (!existsSync(path)) return null;
  const st = statSync(path);
  const cached = md5Cache.get(safe);
  if (cached && cached.mtimeMs === st.mtimeMs) return { path, size: st.size, md5: cached.md5 };
  const md5 = createHash('md5').update(readFileSync(path)).digest('hex');
  md5Cache.set(safe, { mtimeMs: st.mtimeMs, md5, size: st.size });
  return { path, size: st.size, md5 };
}
