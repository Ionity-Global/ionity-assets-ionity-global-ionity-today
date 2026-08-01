// Generates Nobify's derived brand images from the OFFICIAL Ionity app icon
// (the blue "AI" AEDI monogram) so everything stays uniform with the Ionity
// ecosystem (ionity-today / ionity-metadata).
//
// The canonical icon set (favicon.svg/.ico, favicon-32, apple-touch-icon,
// icon-192/512, icon-maskable-512) is mirrored 1:1 from Ionity-today and is
// NOT regenerated here. This script only builds the two Nobify-specific extras
// that the ecosystem doesn't ship:
//   - og.png                          social/OpenGraph card
//   - ../../companion/assets/tray.*   desktop tray icon (png + ico)
//
//   node assets/gen-icons.mjs            (run from nobify/webapp)
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const master = join(here, 'icon-512.png'); // official Ionity monogram
const companionAssets = resolve(here, '..', '..', 'companion', 'assets');

const BRAND_BG = '#0A0A12';   // Ionity icon backdrop
const BRAND_BLUE = '#2b6fd6';

// ---- OG / social card (1200x630) ----------------------------------------
async function buildOg() {
  const markSize = 300;
  const mark = await sharp(master).resize(markSize, markSize, { fit: 'contain' }).png().toBuffer();
  const markB64 = mark.toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0A0A12"/>
        <stop offset="0.55" stop-color="#0d1426"/>
        <stop offset="1" stop-color="#0a0e1a"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.28" cy="0.4" r="0.6">
        <stop offset="0" stop-color="#2b6fd6" stop-opacity="0.35"/>
        <stop offset="1" stop-color="#2b6fd6" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <rect width="1200" height="630" fill="url(#glow)"/>
    <image x="90" y="165" width="${markSize}" height="${markSize}" href="data:image/png;base64,${markB64}"/>
    <text x="430" y="300" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="104" font-weight="800" fill="#ffffff">Nobify</text>
    <text x="432" y="360" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="34" font-weight="500" fill="#9fb4d8">Human presence detection for ESP32-S3</text>
    <text x="432" y="418" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="26" font-weight="600" fill="${BRAND_BLUE}">Ionity Global (Pty) Ltd</text>
    <rect x="0" y="620" width="1200" height="10" fill="${BRAND_BLUE}"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(join(here, 'og.png'));
  console.log('og.png');
}

// ---- Companion tray icon (png + ico) ------------------------------------
async function buildTray() {
  // Flatten the transparent monogram onto the brand backdrop so it reads on
  // both light and dark system trays.
  const base = await sharp(master)
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .flatten({ background: BRAND_BG })
    .png()
    .toBuffer();
  await sharp(base).resize(32, 32).png().toFile(join(companionAssets, 'tray.png'));
  const ico = await pngToIco([
    await sharp(base).resize(16, 16).png().toBuffer(),
    await sharp(base).resize(32, 32).png().toBuffer(),
    await sharp(base).resize(48, 48).png().toBuffer(),
    await sharp(base).resize(64, 64).png().toBuffer(),
  ]);
  writeFileSync(join(companionAssets, 'tray.ico'), ico);
  console.log('companion tray.png + tray.ico');
}

await buildOg();
await buildTray();
console.log('Done. Canonical icons are mirrored from Ionity-today (not regenerated).');
