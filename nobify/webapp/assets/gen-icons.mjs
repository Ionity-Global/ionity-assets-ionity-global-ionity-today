// Generate every Nobify icon from ONE master mark so the whole product stays
// visually uniform. Rasterises assets/nobify-mark.svg (+ og.svg) into the PNG
// and ICO variants used by the dashboard, PWA manifest, and desktop companion.
//
//   node gen-icons.mjs
//
// Requires (dev-only): sharp, png-to-ico. Install once with:
//   npm install --no-save sharp png-to-ico
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));           // nobify/webapp/assets
const webappAssets = here;
const companionAssets = resolve(here, '..', '..', 'companion', 'assets');

const mark = readFileSync(join(webappAssets, 'nobify-mark.svg'));
const og = readFileSync(join(webappAssets, 'og.svg'));

const png = (svg, size) => sharp(svg, { density: 384 }).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png();

async function write(svg, size, outPath) {
  await png(svg, size).toFile(outPath);
  console.log('  ✓ ' + outPath.replace(resolve(here, '..', '..'), '.'));
}

async function main() {
  // Dashboard / PWA icons.
  await write(mark, 32, join(webappAssets, 'favicon-32.png'));
  await write(mark, 180, join(webappAssets, 'apple-touch-icon.png'));
  await write(mark, 192, join(webappAssets, 'icon-192.png'));
  await write(mark, 512, join(webappAssets, 'icon-512.png'));

  // Social / Open Graph preview (1200x630).
  await sharp(og, { density: 192 }).resize(1200, 630).png().toFile(join(webappAssets, 'og.png'));
  console.log('  ✓ ./webapp/assets/og.png');

  // Multi-size favicon.ico.
  const icoSizes = await Promise.all([16, 24, 32, 48, 64].map((s) => png(mark, s).toBuffer()));
  writeFileSync(join(webappAssets, 'favicon.ico'), await pngToIco(icoSizes));
  console.log('  ✓ ./webapp/assets/favicon.ico');

  // Desktop companion tray icons (kept in sync with the brand mark).
  await write(mark, 32, join(companionAssets, 'tray.png'));
  const trayIco = await Promise.all([16, 24, 32, 48].map((s) => png(mark, s).toBuffer()));
  writeFileSync(join(companionAssets, 'tray.ico'), await pngToIco(trayIco));
  console.log('  ✓ ./companion/assets/tray.ico');

  console.log('\nAll icons regenerated from nobify-mark.svg');
}

main().catch((e) => { console.error(e); process.exit(1); });
