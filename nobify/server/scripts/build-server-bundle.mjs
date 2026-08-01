// Bundle the server into ONE self-contained ESM file so it can be downloaded
// and run with `node nobify-server.mjs` — no clone, no `npm install`, no
// node_modules. ws + yaml are inlined; node: built-ins stay external.
// `import.meta.url` is preserved in the ESM output, so config path resolution
// (data dir, firmware dir) keeps working relative to wherever the file lives.
//
//   node scripts/build-server-bundle.mjs
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Prefer the server's own esbuild devDependency; fall back to the companion's
// copy so the bundle builds without a dedicated install during local dev.
let esbuild;
try { esbuild = await import('esbuild'); }
catch { esbuild = await import('../../companion/node_modules/esbuild/lib/main.js'); }
const { build } = esbuild;

const here = dirname(fileURLToPath(import.meta.url));       // nobify/server/scripts
const serverDir = resolve(here, '..');
const outFile = resolve(serverDir, 'dist', 'nobify-server.mjs');

const banner = `// Nobify server — single-file build. (c) Ionity Global (Pty) Ltd — https://www.ionity.co.za
// Run: node nobify-server.mjs   (Node >= 22.5, uses built-in node:sqlite)
import { createRequire as __nobifyCreateRequire } from 'node:module';
const require = __nobifyCreateRequire(import.meta.url);
`;

await build({
  entryPoints: [resolve(serverDir, 'src', 'server.js')],
  outfile: outFile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  banner: { js: banner },
  legalComments: 'none',
  // Keep Node built-ins external; everything else (ws, yaml) gets inlined.
  external: ['node:*'],
});

console.log('✓ built ' + outFile);
