// Pull the latest released firmware image from GitHub and publish it for OTA.
// Uses the public releases API (no token needed for public repos).
//
//   node scripts/sync-release-firmware.mjs [owner/repo]
//
// Defaults to the repo in package.json / env NOBIFY_REPO.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../src/config.js';

const repo = process.argv[2] || process.env.NOBIFY_REPO || 'Ionity-Global/ionity-assets-ionity-global-ionity-today';
const api = `https://api.github.com/repos/${repo}/releases/latest`;

const headers = { 'user-agent': 'nobify-ota-sync', accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const rel = await fetch(api, { headers }).then((r) => {
  if (!r.ok) throw new Error(`GitHub API ${r.status} for ${repo}`);
  return r.json();
});

// Prefer the OTA app image (nobify-fw-*.bin), never the merged factory bin.
const asset = (rel.assets || []).find((a) => /^nobify-fw-.*\.bin$/i.test(a.name));
if (!asset) {
  console.error(`No nobify-fw-*.bin asset in release ${rel.tag_name || '?'}`);
  process.exit(1);
}

const version = asset.name.match(/(\d+\.\d+\.\d+(?:[-+][\w.]+)?)/)?.[1] || rel.tag_name?.replace(/^v/, '') || '0.0.0';
const dir = config.firmwareDir;
mkdirSync(dir, { recursive: true });

const buf = Buffer.from(await fetch(asset.browser_download_url, { headers }).then((r) => {
  if (!r.ok) throw new Error(`Download ${r.status} for ${asset.name}`);
  return r.arrayBuffer();
}));
writeFileSync(join(dir, asset.name), buf);
writeFileSync(join(dir, 'manifest.json'), JSON.stringify({
  version, bin: asset.name, notes: rel.name || `Release ${rel.tag_name}`,
  mandatory: false, ts: Date.now(),
}, null, 2));

console.log(`Synced ${asset.name} (${buf.length} bytes, v${version}) from ${rel.tag_name}`);
console.log('Devices will self-update on their next OTA poll.');
