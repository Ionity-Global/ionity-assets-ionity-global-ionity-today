// Publish a firmware image for OTA: copy a built .bin into the server's
// firmware directory as nobify-fw-<version>.bin and (re)write manifest.json.
// Devices polling /api/firmware/manifest then self-update.
//
//   node scripts/publish-firmware.mjs <path-to-firmware.bin> [version] [--mandatory] [--notes "..."]
//
// If <path> is omitted it looks for ../firmware/.pio/build/*/firmware.bin.
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../src/config.js';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positional = args.filter((a) => !a.startsWith('--'));
const notesIdx = args.indexOf('--notes');
const notes = notesIdx >= 0 ? (args[notesIdx + 1] || '') : '';

function findBuiltBin() {
  const buildRoot = resolve(here, '..', '..', 'firmware', '.pio', 'build');
  if (!existsSync(buildRoot)) return null;
  for (const env of readdirSync(buildRoot)) {
    const bin = join(buildRoot, env, 'firmware.bin');
    if (existsSync(bin)) return bin;
  }
  return null;
}

let src = positional[0] && !/^\d+\.\d+\.\d+/.test(positional[0]) ? positional[0] : null;
if (!src) src = findBuiltBin();
if (!src || !existsSync(src)) {
  console.error('No firmware.bin found. Pass a path, or build with `pio run` first.');
  process.exit(1);
}

const versionArg = positional.find((a) => /^\d+\.\d+\.\d+/.test(a));
const version = versionArg || (basename(src).match(/(\d+\.\d+\.\d+(?:[-+][\w.]+)?)/)?.[1]) || `0.0.0+${Date.now()}`;

const dir = config.firmwareDir;
mkdirSync(dir, { recursive: true });
const outName = `nobify-fw-${version}.bin`;
const outPath = join(dir, outName);
copyFileSync(src, outPath);

const manifest = {
  version,
  bin: outName,
  notes: notes || `Nobify firmware ${version}`,
  mandatory: flags.has('--mandatory'),
  ts: Date.now(),
};
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`Published ${outName} (${statSync(outPath).size} bytes) to ${dir}`);
console.log(`Manifest: v${version}${manifest.mandatory ? ' (mandatory)' : ''}`);
console.log('Devices will self-update on their next OTA poll.');
