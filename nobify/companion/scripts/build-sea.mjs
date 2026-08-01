// Build a self-contained Nobify Companion executable for the CURRENT OS using
// Node.js Single Executable Applications (SEA). No Node install required by the
// end user — they just double-click the binary.
//
//   1. Bundle the ESM app into a single CommonJS file with esbuild.
//   2. Generate a SEA blob from that bundle.
//   3. Copy the running Node binary and inject the blob with postject.
//
// In CI a matrix runs this once per OS (windows/macos/linux) to produce all
// three artifacts. Optional runtime deps (ws, node-notifier, systray2, yaml)
// are left external and degrade gracefully when absent.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as esbuild from 'esbuild';
import { inject } from 'postject';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dist = join(root, 'dist');
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const osTag = isWin ? 'win' : isMac ? 'macos' : 'linux';
const outName = 'nobify-companion-' + osTag + (isWin ? '.exe' : '');
const outPath = join(dist, outName);
const bundle = join(dist, 'companion.cjs');
const blob = join(dist, 'sea-prep.blob');
const seaCfg = join(dist, 'sea-config.json');
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const EXTERNAL = ['ws', 'node-notifier', 'systray2', 'yaml'];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// 1) Bundle ESM -> single CJS file.
console.log('\n=== [1/4] bundling with esbuild ===');
await esbuild.build({
  entryPoints: [join(root, 'src/index.js')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile: bundle,
  external: EXTERNAL,
  logLevel: 'info',
});

// 2) SEA config + blob.
console.log('\n=== [2/4] generating SEA blob ===');
writeFileSync(seaCfg, JSON.stringify({
  main: bundle,
  output: blob,
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false,
}, null, 2));
execFileSync(process.execPath, ['--experimental-sea-config', seaCfg], { stdio: 'inherit' });

// 3) Copy the Node binary as our executable base.
console.log('\n=== [3/4] copying node runtime ===');
copyFileSync(process.execPath, outPath);
if (isMac) { try { execFileSync('codesign', ['--remove-signature', outPath], { stdio: 'inherit' }); } catch {} }

// 4) Inject the blob.
console.log('\n=== [4/4] injecting SEA blob (postject) ===');
await inject(outPath, 'NODE_SEA_BLOB', readFileSync(blob), {
  sentinelFuse: FUSE,
  machoSegmentName: isMac ? 'NODE_SEA' : undefined,
});
if (isMac) { try { execFileSync('codesign', ['--sign', '-', outPath], { stdio: 'inherit' }); } catch {} }

if (!existsSync(outPath)) { console.error('FAILED: ' + outPath + ' not produced'); process.exit(1); }
const mb = (statSync(outPath).size / 1048576).toFixed(1);
console.log('\n[OK] Built ' + outName + ' (' + mb + ' MB)');
