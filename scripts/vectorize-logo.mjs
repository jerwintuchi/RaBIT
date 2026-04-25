// Vectorizes src/assets/branding/logo/rabit-logo.png into SVG color variants.
// Run: node scripts/vectorize-logo.mjs
//
// Outputs:
//   logo.svg            — dark bg (#141414), white mark
//   logo-mark.svg       — transparent bg, currentColor mark
//   logo-mono-dark.svg  — transparent bg, black mark
//   logo-mono-light.svg — transparent bg, white mark
//   logo-inverted.svg   — light bg (#FAFAFA), dark mark

import ImageTracer from 'imagetracerjs';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const logoSrc = join(root, 'src/assets/branding/logo/rabit-logo.png');
const logoDir = join(root, 'src/assets/branding/logo');

// Load PNG metadata
const meta = await sharp(logoSrc).metadata();
const size = Math.max(meta.width, meta.height);

// Get raw RGBA pixels — the mark is white on transparent/white bg
// Strategy: composite onto black, then the bright white mark becomes traceable
const rawBuf = await sharp(logoSrc)
  .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
  .flatten({ background: { r: 0, g: 0, b: 0 } })
  .raw()
  .toBuffer({ resolveWithObject: true });

const { data, info } = rawBuf;
const w = info.width;
const h = info.height;
const channels = info.channels; // 3 (RGB after flatten)

// Build RGBA array for imagetracerjs (needs Uint8ClampedArray, 4 channels)
// Mark is white (255,255,255) with alpha; bg is transparent → composite on black
// gives white mark on black bg. Invert to get black mark on white bg for clean tracing.
const rgba = new Uint8ClampedArray(w * h * 4);
for (let i = 0; i < w * h; i++) {
  const si = i * channels;
  const di = i * 4;
  // After flatten-on-black: mark pixels are bright, bg pixels are black
  // Invert so imagetracerjs can find the dark (mark) region
  rgba[di]     = 255 - data[si];
  rgba[di + 1] = 255 - data[si + 1];
  rgba[di + 2] = 255 - data[si + 2];
  rgba[di + 3] = 255;
}

const imgdataObj = { width: w, height: h, data: rgba };

const options = {
  numberofcolors: 2,
  colorsampling: 0,
  mincolorratio: 0,
  colorquantcycles: 3,
  ltres: 1,
  qtres: 1,
  pathomit: 16,
  rightangleenhance: false,
  scale: 1,
  roundcoords: 1,
  viewbox: true,
  desc: false,
  blurradius: 1,
  blurdelta: 20,
};

console.log(`Tracing ${w}×${h} image…`);
const rawSvg = ImageTracer.imagedataToSVG(imgdataObj, options);

// Extract viewBox
const vbMatch = rawSvg.match(/viewBox="([^"]+)"/);
const viewBox = vbMatch ? vbMatch[1] : `0 0 ${w} ${h}`;

// Extract all <path> elements
const pathMatches = [...rawSvg.matchAll(/<path[^>]+>/g)].map(m => m[0]);

// Keep only dark paths (the mark) — skip the white background path
// imagetracerjs outputs fill as "rgb(r,g,b)" or "#rrggbb"
const markPaths = pathMatches.filter(p => {
  const fill = p.match(/fill="([^"]+)"/);
  if (!fill) return false;
  const v = fill[1];
  let r, g, b;
  const rgbMatch = v.match(/rgb\((\d+),(\d+),(\d+)\)/);
  if (rgbMatch) {
    [, r, g, b] = rgbMatch.map(Number);
  } else {
    const hex = v.replace('#', '');
    if (hex.length !== 6) return false;
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  }
  return (r + g + b) / 3 < 128; // dark = mark silhouette
});

console.log(`Found ${markPaths.length} mark path(s).`);

function repaintPaths(paths, color) {
  return paths.map(p =>
    p.replace(/fill="[^"]+"/g, `fill="${color}"`)
     .replace(/stroke="[^"]+"\s*/g, '')
     .replace(/stroke-width="[^"]+"\s*/g, '')
     .replace(/opacity="[^"]+"\s*/g, '')
  ).join('\n  ');
}

function svgWrap(title, inner) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="RaBIT">
  <title>${title}</title>
  ${inner}
</svg>`;
}

writeFileSync(
  join(logoDir, 'logo.svg'),
  svgWrap('RaBIT',
    `<rect width="${w}" height="${h}" fill="#141414"/>\n  ${repaintPaths(markPaths, '#EAEAEA')}`)
);
console.log('wrote logo.svg');

writeFileSync(
  join(logoDir, 'logo-mark.svg'),
  svgWrap('RaBIT mark', repaintPaths(markPaths, 'currentColor'))
);
console.log('wrote logo-mark.svg');

writeFileSync(
  join(logoDir, 'logo-mono-dark.svg'),
  svgWrap('RaBIT (monochrome dark)', repaintPaths(markPaths, '#000000'))
);
console.log('wrote logo-mono-dark.svg');

writeFileSync(
  join(logoDir, 'logo-mono-light.svg'),
  svgWrap('RaBIT (monochrome light)', repaintPaths(markPaths, '#FFFFFF'))
);
console.log('wrote logo-mono-light.svg');

writeFileSync(
  join(logoDir, 'logo-inverted.svg'),
  svgWrap('RaBIT (light theme)',
    `<rect width="${w}" height="${h}" fill="#FAFAFA"/>\n  ${repaintPaths(markPaths, '#141414')}`)
);
console.log('wrote logo-inverted.svg');

console.log('\nAll logo variants written successfully.');
