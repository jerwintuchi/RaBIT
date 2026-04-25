// Renders src/assets/branding/logo/rabit-logo.png to multiple PNG sizes.
// Writes brand exports to src/assets/branding/logo/exports/
// and the 1024 Tauri source to src-tauri/icons/source.png.
//
// Run: pnpm icons:export
// Then: pnpm tauri icon src-tauri/icons/source.png  (generates .ico/.icns/etc.)

import sharp from 'sharp';
import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const sourcePng = join(root, 'src/assets/branding/logo/rabit-logo.png');
const brandSizes = [32, 64, 128, 256, 512];
const brandOut = join(root, 'src/assets/branding/logo/exports');
const tauriSource = join(root, 'src-tauri/icons/source.png');

mkdirSync(brandOut, { recursive: true });
mkdirSync(dirname(tauriSource), { recursive: true });

for (const size of brandSizes) {
  const out = join(brandOut, `logo-${size}.png`);
  await sharp(sourcePng).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(out);
  console.log(`wrote ${out}`);
}

await sharp(sourcePng).resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } }).flatten({ background: { r: 0, g: 0, b: 0 } }).png().toFile(tauriSource);
console.log(`wrote ${tauriSource} (1024×1024)`);
