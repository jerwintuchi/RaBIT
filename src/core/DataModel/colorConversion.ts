// Color-space conversions used by the color picker. RGBA is the canonical
// project type (32-bit packed, big-endian); HSV / Hex are picker-side views.
import type { RGBA } from './types';
import { packRGBA, unpackRGBA } from './pixels';

export interface HSV {
  h: number; // 0–360
  s: number; // 0–100
  v: number; // 0–100
}

/** RGB (0–255) → HSV. */
export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : (delta / max) * 100;
  const v = max * 100;
  return { h, s, v };
}

/** HSV → RGB (0–255). */
export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const sn = s / 100;
  const vn = v / 100;
  const c = vn * sn;
  const hp = (h % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = vn - c;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

/** Packed RGBA → "#RRGGBBAA" (alpha omitted only if it would round-trip the same). */
export function rgbaToHex(rgba: RGBA, includeAlpha = true): string {
  const [r, g, b, a] = unpackRGBA(rgba);
  const hex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  if (includeAlpha) return `#${hex(r)}${hex(g)}${hex(b)}${hex(a)}`;
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Parses a hex color string into a packed RGBA, or null if invalid.
 * Accepts: "#RRGGBB", "#RRGGBBAA", "RRGGBB", "RRGGBBAA", and 3/4-digit shorthands.
 */
export function parseHex(input: string): RGBA | null {
  const cleaned = input.trim().replace(/^#/, '').toUpperCase();
  if (!/^[0-9A-F]+$/.test(cleaned)) return null;
  let r = 0, g = 0, b = 0, a = 255;
  if (cleaned.length === 3) {
    r = parseInt(cleaned[0]! + cleaned[0]!, 16);
    g = parseInt(cleaned[1]! + cleaned[1]!, 16);
    b = parseInt(cleaned[2]! + cleaned[2]!, 16);
  } else if (cleaned.length === 4) {
    r = parseInt(cleaned[0]! + cleaned[0]!, 16);
    g = parseInt(cleaned[1]! + cleaned[1]!, 16);
    b = parseInt(cleaned[2]! + cleaned[2]!, 16);
    a = parseInt(cleaned[3]! + cleaned[3]!, 16);
  } else if (cleaned.length === 6) {
    r = parseInt(cleaned.slice(0, 2), 16);
    g = parseInt(cleaned.slice(2, 4), 16);
    b = parseInt(cleaned.slice(4, 6), 16);
  } else if (cleaned.length === 8) {
    r = parseInt(cleaned.slice(0, 2), 16);
    g = parseInt(cleaned.slice(2, 4), 16);
    b = parseInt(cleaned.slice(4, 6), 16);
    a = parseInt(cleaned.slice(6, 8), 16);
  } else {
    return null;
  }
  return packRGBA(r, g, b, a);
}
